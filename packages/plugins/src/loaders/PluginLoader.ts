/**
 * PluginLoader - Filesystem-based plugin loader for Organic Interface
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  PluginInterface,
  PluginMetadata,
  PluginConfig,
  PluginStatus,
  PluginContext,
} from '../interfaces/PluginInterface.js';
import { PluginLifecycleState } from '../interfaces/PluginInterface.js';
import type {
  PluginLoaderInterface,
  PluginLoaderOptions,
  PluginLoadResult,
  PluginDiscoveryResult,
  CompatibilityResult,
  CompatibilityIssue,
} from '../interfaces/PluginLoaderInterface.js';
import type {
  KernelApi,
  KernelConfig,
  ToolResult,
  TextServiceInterface,
  InfoServiceInterface,
} from '@organic/utils';
import { ToolErrorCode } from '@organic/utils';

/**
 * Default plugin loader options
 */
const DEFAULT_OPTIONS: Required<PluginLoaderOptions> = {
  baseDir: './plugins',
  cacheEnabled: true,
  cacheTtl: 300000, // 5 minutes
};

/**
 * Plugin cache entry
 */
interface CacheEntry {
  plugin: PluginInterface;
  metadata: PluginMetadata;
  loadedAt: number;
  config: PluginConfig | undefined;
}

/**
 * PluginLoader - Loads plugins from the filesystem
 */
export class PluginLoader implements PluginLoaderInterface {
  private options: Required<PluginLoaderOptions>;
  private cache: Map<string, CacheEntry> = new Map();
  private status: Map<string, PluginStatus> = new Map();
  private pluginPaths: Map<string, string> = new Map();

  /**
   * Create a new PluginLoader
   * @param options - Loader options
   */
  constructor(options: PluginLoaderOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Load a plugin by identifier
   * @param pluginId - Unique plugin identifier
   * @param config - Optional plugin configuration
   * @returns Promise resolving to PluginLoadResult containing plugin instance and metadata
   * @throws {Error} When plugin module is invalid or lacks required exports
   * @throws {Error} When plugin initialization fails
   * @example
   * ```typescript
   * const loader = new PluginLoader({ baseDir: './plugins' });
   * const result = await loader.load('my-plugin', { enabled: true });
   * if (result.success) {
   *   console.log(`Loaded ${result.metadata.name}`);
   * }
   * ```
   */
  async load(pluginId: string, config?: PluginConfig): Promise<PluginLoadResult> {
    try {
      // Check cache first
      if (this.options.cacheEnabled && this.cache.has(pluginId)) {
        const cached = this.cache.get(pluginId)!;
        if (Date.now() - cached.loadedAt < this.options.cacheTtl) {
          return {
            success: true,
            plugin: cached.plugin,
            metadata: cached.metadata,
          };
        }
      }

      // Get plugin path
      const pluginPath = this.resolvePluginPath(pluginId);
      if (!pluginPath) {
        return {
          success: false,
          error: `Plugin not found: ${pluginId}`,
        };
      }

      // Update status to loading
      this.updateStatus(pluginId, PluginLifecycleState.LOADING);

      // Dynamically import the plugin module
      const pluginModule = await import(pluginPath);

      // Get plugin instance (try load static method first, then default export)
      let plugin: PluginInterface;
      if (typeof pluginModule.load === 'function') {
        plugin = await pluginModule.load(pluginPath);
      } else if (pluginModule.default) {
        plugin = new pluginModule.default();
      } else {
        return {
          success: false,
          error: `Plugin module does not export a valid plugin: ${pluginId}`,
        };
      }

      // Get metadata
      const metadata = this.extractMetadata(plugin, pluginPath);

      // Check compatibility
      const compatibility = await this.validateCompatibility(metadata);
      if (!compatibility.compatible) {
        const issues = compatibility.issues
          ?.filter(i => i.severity === 'error')
          .map(i => i.message)
          .join(', ');
        return {
          success: false,
          error: `Plugin ${pluginId} is not compatible: ${issues}`,
        };
      }

      // Initialize plugin if not already initialized
      if (plugin.initialize) {
        const context: PluginContext = {
          kernel: this.createKernelApi(pluginId),
          config: {
            name: pluginId,
            enabled: config?.enabled ?? true,
            options: config?.config,
          },
        };

        const initResult = await plugin.initialize(context);
        if (!initResult.success) {
          return {
            success: false,
            error: initResult.error || 'Plugin initialization failed',
          };
        }
      }

      // Cache the plugin
      if (this.options.cacheEnabled) {
        this.cache.set(pluginId, {
          plugin,
          metadata,
          loadedAt: Date.now(),
          config,
        });
      }

      // Track plugin path
      this.pluginPaths.set(pluginId, pluginPath);

      // Update status to active
      this.updateStatus(pluginId, PluginLifecycleState.ACTIVE);

      return {
        success: true,
        plugin,
        metadata,
      };
    } catch (error) {
      this.updateStatus(
        pluginId,
        PluginLifecycleState.ERROR,
        error instanceof Error ? error.message : String(error)
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Unload a plugin by identifier
   * @param pluginId - Unique plugin identifier
   * @returns Promise that resolves when plugin is unloaded
   * @remarks
   * Calls the plugin's shutdown method if available before removing from cache.
   * Updates plugin lifecycle state to SHUTDOWN upon successful unload.
   */
  async unload(pluginId: string): Promise<void> {
    const entry = this.cache.get(pluginId);
    if (entry) {
      // Call shutdown if available
      if (entry.plugin.shutdown) {
        try {
          await entry.plugin.shutdown();
        } catch (error) {
          console.error(`Error shutting down plugin ${pluginId}:`, error);
        }
      }

      // Remove from cache
      this.cache.delete(pluginId);
      this.pluginPaths.delete(pluginId);
      this.updateStatus(pluginId, PluginLifecycleState.SHUTDOWN);
    }
  }

  /**
   * Reload a plugin by identifier
   * @param pluginId - Unique plugin identifier
   * @returns Promise resolving to PluginLoadResult for the reloaded plugin
   * @remarks
   * Performs unload followed by load with the same configuration.
   * Useful for applying configuration changes or recovering from error states.
   */
  async reload(pluginId: string): Promise<PluginLoadResult> {
    await this.unload(pluginId);
    const entry = this.cache.get(pluginId + '_config');
    return this.load(pluginId, entry?.config);
  }

  /**
   * Discover available plugins in the configured base directory
   * @returns Promise resolving to array of PluginDiscoveryResult
   * @remarks
   * Scans the base directory for subdirectories containing package.json.
   * Each valid plugin directory is added to the results with parsed metadata.
   * Failed discoveries include error information for debugging.
   */
  async discover(): Promise<PluginDiscoveryResult[]> {
    const results: PluginDiscoveryResult[] = [];

    try {
      // Check if base directory exists
      if (!fs.existsSync(this.options.baseDir)) {
        return results;
      }

      // Scan directory for plugins
      const entries = fs.readdirSync(this.options.baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const pluginId = entry.name;
        const pluginPath = path.join(this.options.baseDir, pluginId);
        const packageJsonPath = path.join(pluginPath, 'package.json');

        if (!fs.existsSync(packageJsonPath)) continue;

        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

          results.push({
            pluginId,
            source: pluginPath,
            metadata: this.parsePackageMetadata(packageJson),
            discoveredAt: Date.now(),
            success: true,
          });
        } catch (error) {
          results.push({
            pluginId,
            source: pluginPath,
            discoveredAt: Date.now(),
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      console.error('Error discovering plugins:', error);
    }

    return results;
  }

  /**
   * Get plugin status
   */
  getStatus(pluginId: string): PluginStatus | undefined {
    return this.status.get(pluginId);
  }

  /**
   * Check if a plugin is loaded
   */
  isLoaded(pluginId: string): boolean {
    return this.cache.has(pluginId);
  }

  /**
   * Get all loaded plugin identifiers
   */
  listLoaded(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Validate plugin compatibility
   */
  async validateCompatibility(metadata: PluginMetadata): Promise<CompatibilityResult> {
    const issues: CompatibilityIssue[] = [];

    // Check API version compatibility (simplified check)
    // In a real implementation, this would compare against actual kernel version
    if (metadata.minKernelVersion) {
      // For now, just warn if minKernelVersion is specified
      issues.push({
        severity: 'warning',
        code: 'KERNEL_VERSION',
        message: `Plugin requires minimum kernel version ${metadata.minKernelVersion}`,
      });
    }

    // Check for required dependencies
    if (metadata.dependencies) {
      for (const dep of metadata.dependencies) {
        if (!this.cache.has(dep.pluginName) && !dep.optional) {
          issues.push({
            severity: 'error',
            code: 'MISSING_DEPENDENCY',
            message: `Required dependency not found: ${dep.pluginName} (${dep.versionRange})`,
          });
        }
      }
    }

    return {
      compatible: !issues.some(i => i.severity === 'error'),
      issues,
    };
  }

  // ==================== Private Methods ====================

  /**
   * Resolve plugin path from plugin identifier
   */
  private resolvePluginPath(pluginId: string): string | undefined {
    // Check if already tracked
    if (this.pluginPaths.has(pluginId)) {
      return this.pluginPaths.get(pluginId);
    }

    // Security: prevent path traversal attacks
    if (pluginId.includes('..') || pluginId.includes('/') || pluginId.includes('\\')) {
      return undefined;
    }

    // Check standard locations (all constrained to baseDir)
    const locations = [
      path.join(this.options.baseDir, pluginId, 'dist', 'index.js'),
      path.join(this.options.baseDir, pluginId, 'src', 'index.ts'),
      path.join(this.options.baseDir, pluginId, 'index.js'),
    ];

    for (const loc of locations) {
      if (fs.existsSync(loc)) {
        // Verify resolved path is still within baseDir
        const resolved = path.resolve(loc);
        if (!resolved.startsWith(path.resolve(this.options.baseDir))) {
          continue;
        }
        return resolved;
      }
    }

    return undefined;
  }

  /**
   * Extract metadata from plugin instance or path
   */
  private extractMetadata(plugin: PluginInterface, pluginPath: string): PluginMetadata {
    if (plugin.getMetadata) {
      return plugin.getMetadata();
    }

    // Extract from package.json
    const packageJsonPath = path.join(path.dirname(pluginPath), '..', 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return this.parsePackageMetadata(JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')));
    }

    // Return basic metadata
    return {
      id: pluginPath,
      name: plugin.name,
      version: plugin.version || '0.0.0',
      description: plugin.description,
      apiVersion: '1.0.0',
    };
  }

  /**
   * Parse metadata from package.json
   */
  private parsePackageMetadata(pkg: Record<string, unknown>): PluginMetadata {
    const organic = pkg.organic as Record<string, unknown> | undefined;
    const deps = (organic?.dependencies ?? {}) as Record<string, string>;
    return {
      id: pkg.name as string,
      name: pkg.name as string,
      version: (pkg.version as string) || '0.0.0',
      description: pkg.description as string | undefined,
      apiVersion: (organic?.api_version as string) || '1.0.0',
      author: pkg.author as string | undefined,
      dependencies: Object.entries(deps).map(([name, version]) => ({
        pluginName: name,
        versionRange: version,
      })),
    };
  }

  /**
   * Update plugin status
   */
  private updateStatus(pluginId: string, state: PluginLifecycleState, error?: string): void {
    const existing = this.status.get(pluginId);
    this.status.set(pluginId, {
      pluginId,
      state,
      enabled: existing?.enabled ?? true,
      error,
      lastStateChange: Date.now(),
      stats: existing?.stats,
    });
  }

  /**
   * Create a minimal kernel API for plugin initialization
   */
  private createKernelApi(_pluginId: string): KernelApi {
    return {
      getConfig: () => ({}) as KernelConfig,
      getVersion: () => '0.1.0',
      text: this.createTextServiceStub(),
      info: this.createInfoServiceStub(),
      registerPlugin: async () => {},
      unregisterPlugin: async () => {},
      getPlugin: (name: string) => this.cache.get(name)?.plugin,
      listPlugins: () => Array.from(this.cache.values()).map(e => e.plugin),
      executeTool: this.createExecuteToolHandler(),
    } as KernelApi;
  }

  /**
   * Create a stub TextServiceInterface for plugin text operations
   */
  private createTextServiceStub(): TextServiceInterface {
    return {
      print: () => {},
      println: () => {},
      formatTable: () => '',
      formatList: () => '',
      formatSection: () => '',
      styled: (text: string) => text,
      success: (text: string) => text,
      error: (text: string) => text,
      warning: (text: string) => text,
      info: (text: string) => text,
      createStream: () => ({}),
      progress: () => '',
      spinner: () => ({}),
    };
  }

  /**
   * Create a stub InfoServiceInterface for plugin info queries
   */
  private createInfoServiceStub(): InfoServiceInterface {
    return {
      getConfig: () => undefined,
      getAllConfigs: () => ({}),
      getRuntimeInfo: () => ({}),
      getProjectContext: () => ({}),
      getProjectRoot: () => '',
      getProjectName: () => '',
      getProjectVersion: () => '',
      getSystemInfo: () => ({}),
      getPlatformInfo: () => ({}),
      getEnv: () => undefined,
      getAllEnvs: () => ({}),
    };
  }

  /**
   * Create executeTool handler that delegates to loaded plugins
   */
  private createExecuteToolHandler(): (
    name: string,
    params: Record<string, unknown>
  ) => Promise<ToolResult> {
    return async (name: string, params: Record<string, unknown>): Promise<ToolResult> => {
      const startTime = Date.now();
      const requestId = `req_${startTime}_${Math.random().toString(36).slice(2, 8)}`;

      try {
        for (const entry of this.cache.values()) {
          const result = await entry.plugin.execute({
            action: 'executeTool',
            params: { name, params, requestId },
          });

          if (result.success && result.data) {
            return this.buildToolSuccessResult(name, startTime, requestId, result.data);
          }
        }

        return this.buildToolErrorResult(
          name,
          startTime,
          requestId,
          ToolErrorCode.TOOL_NOT_FOUND,
          `Tool ${name} not found`
        );
      } catch (error) {
        return this.buildToolErrorResult(
          name,
          startTime,
          requestId,
          ToolErrorCode.EXECUTION_ERROR,
          error instanceof Error ? error.message : String(error)
        );
      }
    };
  }

  /**
   * Build successful tool execution result
   */
  private buildToolSuccessResult(
    toolName: string,
    startTime: number,
    requestId: string,
    data: unknown
  ): ToolResult {
    const endTime = Date.now();
    return {
      success: true,
      data,
      metadata: {
        tool_name: toolName,
        start_time: startTime,
        end_time: endTime,
        execution_time: endTime - startTime,
        request_id: requestId,
      },
    };
  }

  /**
   * Build error tool execution result
   */
  private buildToolErrorResult(
    toolName: string,
    startTime: number,
    requestId: string,
    code: ToolErrorCode,
    message: string
  ): ToolResult {
    const endTime = Date.now();
    return {
      success: false,
      error: { code, message },
      metadata: {
        tool_name: toolName,
        start_time: startTime,
        end_time: endTime,
        execution_time: endTime - startTime,
        request_id: requestId,
      },
    };
  }
}
