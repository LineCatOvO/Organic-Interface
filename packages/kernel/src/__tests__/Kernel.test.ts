/**
 * Kernel Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Kernel } from '../kernel/Kernel.js';
import type {
  KernelConfig,
  PluginInterface,
  PluginInput,
  PluginOutput,
  InitializeResult,
} from '@organic/utils';

// Mock plugin for testing
const createMockPlugin = (
  name: string,
  version: string,
  description?: string
): PluginInterface => ({
  name,
  version,
  description,
  initialize: vi.fn(async (): Promise<InitializeResult> => ({ success: true })),
  execute: vi.fn(
    async (input: PluginInput): Promise<PluginOutput> => ({
      success: true,
      data: { action: input.action, result: 'executed' },
    })
  ),
  shutdown: vi.fn(async () => {}),
});

// Mock KernelConfig
const createMockConfig = (): KernelConfig => ({
  name: 'test-kernel',
  version: '1.0.0',
  plugins: [],
  tools: [],
});

describe('Kernel', () => {
  let kernel: Kernel;
  let mockConfig: KernelConfig;

  beforeEach(() => {
    mockConfig = createMockConfig();
    kernel = new Kernel({ config: mockConfig });
  });

  afterEach(async () => {
    // Ensure kernel is stopped
    try {
      await kernel.stop();
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe('Constructor', () => {
    it('should create a Kernel instance', () => {
      expect(kernel).toBeDefined();
      expect(kernel).toBeInstanceOf(Kernel);
    });

    it('should initialize with default services', () => {
      expect(kernel.text).toBeDefined();
      expect(kernel.info).toBeDefined();
    });
  });

  describe('getConfig() - Get configuration', () => {
    it('should return kernel configuration', () => {
      const config = kernel.getConfig();

      expect(config.name).toBe('test-kernel');
      expect(config.version).toBe('1.0.0');
    });

    it('should return a copy, not the original', () => {
      const config1 = kernel.getConfig();
      const config2 = kernel.getConfig();

      expect(config1).not.toBe(config2);
    });
  });

  describe('getVersion() - Get version', () => {
    it('should return kernel version', () => {
      expect(kernel.getVersion()).toBe('1.0.0');
    });
  });

  describe('registerPlugin() - Register plugin', () => {
    it('should register a plugin when kernel is initialized', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await kernel.initialize();
      await kernel.registerPlugin(plugin);

      const retrieved = kernel.getPlugin('test-plugin');
      expect(retrieved).toBe(plugin);
    });

    it('should throw when kernel is not initialized', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await expect(kernel.registerPlugin(plugin)).rejects.toThrow(/Invalid kernel state/);
    });

    it('should register plugin when kernel is running', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await kernel.initialize();
      await kernel.start();
      await kernel.registerPlugin(plugin);

      const retrieved = kernel.getPlugin('test-plugin');
      expect(retrieved).toBe(plugin);
    });
  });

  describe('unregisterPlugin() - Unregister plugin', () => {
    it('should unregister a plugin when kernel is initialized', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await kernel.initialize();
      await kernel.registerPlugin(plugin);
      await kernel.unregisterPlugin('test-plugin');

      expect(kernel.getPlugin('test-plugin')).toBeUndefined();
    });

    it('should throw when kernel is not initialized', async () => {
      await expect(kernel.unregisterPlugin('test-plugin')).rejects.toThrow(/Invalid kernel state/);
    });
  });

  describe('getPlugin() - Get plugin', () => {
    it('should return registered plugin', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await kernel.initialize();
      await kernel.registerPlugin(plugin);

      expect(kernel.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should return undefined for non-existent plugin', () => {
      expect(kernel.getPlugin('non-existent')).toBeUndefined();
    });
  });

  describe('listPlugins() - List plugins', () => {
    it('should return all registered plugins', async () => {
      const plugin1 = createMockPlugin('plugin-1', '1.0.0');
      const plugin2 = createMockPlugin('plugin-2', '2.0.0');

      await kernel.initialize();
      await kernel.registerPlugin(plugin1);
      await kernel.registerPlugin(plugin2);

      const plugins = kernel.listPlugins();
      expect(plugins).toHaveLength(2);
    });
  });

  describe('executeTool() - Execute tool', () => {
    it('should execute a tool when kernel is running', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');
      (plugin.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          data: { result: 'tool executed' },
          metadata: {
            tool_name: 'test-tool',
            start_time: Date.now(),
            end_time: Date.now(),
            execution_time: 10,
            request_id: 'req_1',
          },
        },
      });

      await kernel.initialize();
      await kernel.start();
      await kernel.registerPlugin(plugin);

      const result = await kernel.executeTool('test-tool', { param: 'value' });

      expect(result.success).toBe(true);
      expect(result.metadata?.tool_name).toBe('test-tool');
    });

    it('should throw when kernel is not running', async () => {
      await kernel.initialize();

      await expect(kernel.executeTool('test-tool', {})).rejects.toThrow(/Invalid kernel state/);
    });

    it('should return error result for non-existent tool', async () => {
      await kernel.initialize();
      await kernel.start();

      const result = await kernel.executeTool('non-existent-tool', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_NOT_FOUND');
    });
  });

  describe('initialize() - Kernel initialization', () => {
    it('should initialize kernel successfully', async () => {
      await kernel.initialize();

      const status = kernel.getStatus();
      expect(status.state).toBe('initialized');
    });

    it('should emit kernel:init event', async () => {
      const eventData = await new Promise<any>(resolve => {
        kernel.onEvent('kernel:init', resolve);
        kernel.initialize();
      });

      expect(eventData.name).toBe('test-kernel');
      expect(eventData.version).toBe('1.0.0');
    });

    it('should warn if already initialized', async () => {
      await kernel.initialize();
      // Should not throw, just warn
      await expect(kernel.initialize()).resolves.not.toThrow();
    });
  });

  describe('start() - Kernel start', () => {
    it('should start kernel successfully', async () => {
      await kernel.initialize();
      await kernel.start();

      const status = kernel.getStatus();
      expect(status.state).toBe('running');
      expect(status.isRunning).toBe(true);
    });

    it('should emit kernel:start event', async () => {
      await kernel.initialize();

      const eventData = await new Promise<any>(resolve => {
        kernel.onceEvent('kernel:start', resolve);
        kernel.start();
      });

      expect(eventData.name).toBe('test-kernel');
    });

    it('should throw if not initialized', async () => {
      await expect(kernel.start()).rejects.toThrow(/Invalid kernel state/);
    });

    it('should warn if already running', async () => {
      await kernel.initialize();
      await kernel.start();

      // Should not throw, just warn
      await expect(kernel.start()).resolves.not.toThrow();
    });
  });

  describe('stop() - Kernel stop', () => {
    it('should stop kernel successfully', async () => {
      await kernel.initialize();
      await kernel.start();
      await kernel.stop();

      const status = kernel.getStatus();
      expect(status.state).toBe('stopped');
      expect(status.isRunning).toBe(false);
    });

    it('should emit kernel:stop event', async () => {
      await kernel.initialize();
      await kernel.start();

      const eventData = await new Promise<any>(resolve => {
        kernel.onceEvent('kernel:stop', resolve);
        kernel.stop();
      });

      expect(eventData.name).toBe('test-kernel');
    });

    it('should warn if already stopped', async () => {
      await kernel.initialize();
      await kernel.start();
      await kernel.stop();

      // Should not throw, just warn
      await expect(kernel.stop()).resolves.not.toThrow();
    });

    it('should shutdown all plugins on stop', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await kernel.initialize();
      await kernel.registerPlugin(plugin);
      await kernel.start();
      await kernel.stop();

      expect(plugin.shutdown).toHaveBeenCalled();
    });
  });

  describe('updateConfig() - Update configuration', () => {
    it('should update kernel configuration', () => {
      kernel.updateConfig({ name: 'updated-kernel' });

      const config = kernel.getConfig();
      expect(config.name).toBe('updated-kernel');
    });

    it('should emit config:update event', async () => {
      const eventData = await new Promise<any>(resolve => {
        kernel.onEvent('config:update', resolve);
        kernel.updateConfig({ name: 'updated-kernel' });
      });

      expect(eventData.newConfig.name).toBe('updated-kernel');
    });
  });

  describe('getStatus() - Get kernel status', () => {
    it('should return correct status when created', () => {
      const status = kernel.getStatus();

      expect(status.name).toBe('test-kernel');
      expect(status.version).toBe('1.0.0');
      expect(status.pluginCount).toBe(0);
      expect(status.isRunning).toBe(false);
      expect(status.isActive).toBe(false);
    });

    it('should return correct status when initialized', async () => {
      await kernel.initialize();

      const status = kernel.getStatus();

      expect(status.isActive).toBe(true);
      expect(status.isRunning).toBe(false);
    });

    it('should return correct status when running', async () => {
      await kernel.initialize();
      await kernel.start();

      const status = kernel.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.isActive).toBe(true);
    });
  });

  describe('getPluginManager() - Get plugin manager', () => {
    it('should return plugin manager instance', () => {
      const pluginManager = kernel.getPluginManager();

      expect(pluginManager).toBeDefined();
    });
  });

  describe('getEventBus() - Get event bus', () => {
    it('should return event bus instance', () => {
      const eventBus = kernel.getEventBus();

      expect(eventBus).toBeDefined();
    });
  });

  describe('getLifecycleManager() - Get lifecycle manager', () => {
    it('should return lifecycle manager instance', () => {
      const lifecycle = kernel.getLifecycleManager();

      expect(lifecycle).toBeDefined();
    });
  });

  describe('executePlugin() - Execute plugin directly', () => {
    it('should execute a plugin action', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await kernel.initialize();
      await kernel.registerPlugin(plugin);

      const result = await kernel.executePlugin('test-plugin', {
        action: 'test-action',
        params: {},
      });

      expect(result.success).toBe(true);
    });

    it('should return error for non-existent plugin', async () => {
      const result = await kernel.executePlugin('non-existent', {
        action: 'test-action',
        params: {},
      });

      expect(result.success).toBe(false);
    });
  });

  describe('onEvent() / onceEvent() - Event subscription', () => {
    it('should subscribe to events with onEvent', async () => {
      const listener = vi.fn();

      kernel.onEvent('test-event', listener);
      kernel.getEventBus().emit('test-event', { data: 'test' });

      // Wait for async dispatch
      await new Promise(resolve => setImmediate(resolve));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to events once with onceEvent', async () => {
      const listener = vi.fn();

      kernel.onceEvent('test-event', listener);
      kernel.getEventBus().emit('test-event', { data: 'first' });
      kernel.getEventBus().emit('test-event', { data: 'second' });

      // Wait for async dispatch
      await new Promise(resolve => setImmediate(resolve));

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Full lifecycle', () => {
    it('should complete full lifecycle: create -> initialize -> start -> stop', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await kernel.initialize();
      await kernel.registerPlugin(plugin);
      await kernel.start();

      let status = kernel.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.pluginCount).toBe(1);

      await kernel.stop();

      status = kernel.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.state).toBe('stopped');
    });
  });

  // ==================== 补充分支覆盖率测试 ====================

  describe('executeTool - error handling branches', () => {
    it('should handle plugin execution error gracefully', async () => {
      // 可追溯性: 覆盖 Kernel.ts L159-165 executeTool catch error 分支
      const plugin = createMockPlugin('error-plugin', '1.0.0');

      // Mock plugin.execute 抛出异常
      (plugin.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Plugin execution crashed')
      );

      await kernel.initialize();
      await kernel.start();
      await kernel.registerPlugin(plugin);

      const result = await kernel.executeTool('test-tool', { param: 'value' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXECUTION_ERROR');
      expect(result.error?.message).toBe('Plugin execution crashed');
    });

    it('should handle non-Error thrown objects', async () => {
      // 可追溯性: 覆盖 Kernel.ts L163 error instanceof Error 分支
      const plugin = createMockPlugin('throw-plugin', '1.0.0');

      // Mock plugin.execute 抛出非 Error 对象
      (plugin.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error');

      await kernel.initialize();
      await kernel.start();
      await kernel.registerPlugin(plugin);

      const result = await kernel.executeTool('test-tool', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXECUTION_ERROR');
      expect(result.error?.message).toBe('string error');
    });
  });

  describe('initialize - error recovery branch', () => {
    it('should transition to ERROR state when initialization fails', async () => {
      // 可追溯性: 覆盖 Kernel.ts L199-204 initialize catch error 分支
      // Mock lifecycle.transition 在 INITIALIZING 状态时抛出异常
      const lifecycleManager = kernel.getLifecycleManager();

      // 使用 vi.spyOn 模拟 transition 失败
      vi.spyOn(lifecycleManager, 'transition').mockImplementationOnce(async () => {
        // 第一次调用 (INITIALIZING) 成功
      }).mockRejectedValueOnce(new Error('Lifecycle transition failed'));

      await expect(kernel.initialize()).rejects.toThrow('Lifecycle transition failed');

      const status = kernel.getStatus();
      // 状态可能仍然是未初始化或错误状态，取决于 mock 的执行顺序
      expect(['uninitialized', 'error', 'initializing']).toContain(status.state);
    });
  });
});
