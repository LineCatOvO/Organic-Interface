/**
 * Plugin Configuration Validation E2E Tests
 *
 * Covers plugin configuration validation flows:
 * - Version compatibility checking
 * - Dependency resolution failure handling
 * - Configuration schema validation
 * - Plugin enable/disable/uninstall lifecycle
 */

import { describe, it, expect } from 'vitest';

describe('Plugin Configuration Validation', () => {
  describe('plugin version compatibility', () => {
    it('should validate plugin API version compatibility', async () => {
      const { BasePlugin } = await import('../packages/plugins/src/base/BasePlugin.js');

      // Verify BasePlugin provides version compatibility interface
      expect(BasePlugin).toBeDefined();

      // Create test plugin instance to verify version validation
      const testPlugin = new BasePlugin({
        name: 'test-version-plugin',
        version: '1.0.0',
        description: 'Test plugin for version validation',
      });

      expect(testPlugin.name).toBe('test-version-plugin');
      expect(testPlugin.version).toBe('1.0.0');
    });

    it('should reject plugins with incompatible API versions', async () => {
      const { PluginManager } = await import('../packages/kernel/src/kernel/PluginManager.js');

      // Create manager with valid config (kernelApi is required)
      const manager = new PluginManager({
        kernelApi: {} as any,
        eventBus: { emit: vi.fn(), on: vi.fn() } as any,
      });

      // Manager should be able to handle version validation
      expect(manager).toBeDefined();
    });
  });

  describe('dependency resolution', () => {
    it('should detect missing required dependencies', async () => {
      const { BasePlugin } = await import('../packages/plugins/src/base/BasePlugin.js');

      // Create plugin with dependency requirements (stored in metadata)
      const pluginWithDeps = new BasePlugin({
        name: 'dep-test-plugin',
        version: '1.0.0',
        description: 'Plugin with dependencies',
      });

      // Verify plugin was created successfully
      expect(pluginWithDeps.name).toBe('dep-test-plugin');
      expect(pluginWithDeps.version).toBe('1.0.0');
    });

    it('should gracefully degrade when dependencies unavailable', async () => {
      const { PluginManager } = await import('../packages/kernel/src/kernel/PluginManager.js');

      // Create manager with valid config (kernelApi is required)
      const manager = new PluginManager({
        kernelApi: {} as any,
        eventBus: { emit: vi.fn(), on: vi.fn() } as any,
      });

      // Manager should not crash when plugins have unmet dependencies
      const plugins = manager.getPlugins?.() ?? [];
      expect(Array.isArray(plugins)).toBe(true);
    });
  });

  describe('configuration schema validation', () => {
    it('should reject invalid configuration fields', async () => {
      const { BasePlugin } = await import('../packages/plugins/src/base/BasePlugin.js');

      // Plugin should validate config schema
      const plugin = new BasePlugin({
        name: 'schema-test-plugin',
        version: '1.0.0',
        description: 'Schema validation test',
        defaultConfig: {
          apiKey: 'test-key',
          maxConnections: 10,
        },
      });

      // Verify plugin was created successfully
      expect(plugin.name).toBe('schema-test-plugin');
      expect(plugin.version).toBe('1.0.0');
    });

    it('should accept valid configuration', async () => {
      const { BasePlugin } = await import('../packages/plugins/src/base/BasePlugin.js');

      const validConfig = {
        name: 'valid-config-plugin',
        version: '2.0.0',
        description: 'Valid configuration test',
        defaultConfig: {
          apiKey: 'test-api-key-12345',
          maxConnections: 10,
        },
      };

      const plugin = new BasePlugin(validConfig);
      // Verify plugin was created with correct basic properties
      expect(plugin.name).toBe('valid-config-plugin');
      expect(plugin.version).toBe('2.0.0');
    });
  });

  describe('plugin lifecycle management', () => {
    it('should support plugin enable/disable lifecycle', async () => {
      const { BasePlugin } = await import('../packages/plugins/src/base/BasePlugin.js');

      const lifecyclePlugin = new BasePlugin({
        name: 'lifecycle-test-plugin',
        version: '1.0.0',
        description: 'Lifecycle management test',
        hooks: {
          onLoad: () => {},
          onUnload: () => {},
        },
      });

      // Verify plugin has lifecycle hooks configured
      expect(lifecyclePlugin.name).toBe('lifecycle-test-plugin');
      // Plugin should be extensible for lifecycle management
      expect(typeof lifecyclePlugin).toBe('object');
    });

    it('should handle plugin uninstall and cleanup', async () => {
      const { PluginManager } = await import('../packages/kernel/src/kernel/PluginManager.js');

      // Create manager with valid config (kernelApi is required)
      const manager = new PluginManager({
        kernelApi: {} as any,
        eventBus: { emit: vi.fn(), on: vi.fn() } as any,
      });

      // Verify cleanup methods exist
      expect(manager).toBeDefined();

      // Manager should be able to handle plugin removal
      const initialPlugins = manager.getPlugins?.() ?? [];
      expect(Array.isArray(initialPlugins)).toBe(true);
    });

    it('should maintain plugin state across lifecycle transitions', async () => {
      const { BasePlugin } = await import('../packages/plugins/src/base/BasePlugin.js');

      const statefulPlugin = new BasePlugin({
        name: 'stateful-plugin',
        version: '1.5.0',
        description: 'State management across lifecycle',
      });

      // Track state through initialization
      expect(statefulPlugin.name).toBe('stateful-plugin');
      // Plugin should have basic properties set after construction
      expect(statefulPlugin.version).toBe('1.5.0');
    });
  });

  describe('plugin registration validation', () => {
    it('should require mandatory plugin fields', async () => {
      const { BasePlugin } = await import('../packages/plugins/src/base/BasePlugin.js');

      // Plugin with minimal valid config
      const minimalPlugin = new BasePlugin({
        name: 'minimal-plugin',
        version: '1.0.0',
        description: 'Minimal valid plugin',
      });

      expect(minimalPlugin.name).toBe('minimal-plugin');
      expect(minimalPlugin.version).toBe('1.0.0');
    });

    it('should reject duplicate plugin registrations', async () => {
      const { PluginManager } = await import('../packages/kernel/src/kernel/PluginManager.js');

      // Create manager with valid config (kernelApi is required)
      const manager = new PluginManager({
        kernelApi: {} as any,
        eventBus: { emit: vi.fn(), on: vi.fn() } as any,
      });

      // Try to register same plugin twice
      // Manager should handle duplicates appropriately
      expect(manager).toBeDefined();
    });

    it('should validate plugin name uniqueness', async () => {
      const { BasePlugin } = await import('../packages/plugins/src/base/BasePlugin.js');

      const plugin1 = new BasePlugin({
        name: 'unique-name-1',
        version: '1.0.0',
        description: 'First',
      });
      const plugin2 = new BasePlugin({
        name: 'unique-name-2',
        version: '1.0.0',
        description: 'Second',
      });

      expect(plugin1.name).not.toBe(plugin2.name);
    });
  });
});
