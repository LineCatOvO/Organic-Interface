/**
 * PluginManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginManager } from '../kernel/PluginManager.js';
import { EventBus } from '../kernel/EventBus.js';
import type { PluginInterface, PluginInput, PluginOutput } from '@organic/utils';

// Mock plugin for testing
const createMockPlugin = (
  name: string,
  version: string,
  description?: string
): PluginInterface => ({
  name,
  version,
  description,
  initialize: vi.fn(async () => ({ success: true })),
  execute: vi.fn(
    async (input: PluginInput): Promise<PluginOutput> => ({
      success: true,
      data: { action: input.action, result: 'executed' },
    })
  ),
  shutdown: vi.fn(async () => {}),
});

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let mockKernelApi: any;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    mockKernelApi = {
      getConfig: vi.fn(() => ({})),
      getVersion: vi.fn(() => '1.0.0'),
    };
    pluginManager = new PluginManager({
      kernelApi: mockKernelApi,
      eventBus,
    });
  });

  describe('register() - Plugin registration', () => {
    it('should register a plugin successfully', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);

      expect(pluginManager.has('test-plugin')).toBe(true);
      expect(pluginManager.count()).toBe(1);
    });

    it('should throw if plugin is already registered', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);

      await expect(pluginManager.register(plugin)).rejects.toThrow(
        'Plugin test-plugin is already registered'
      );
    });

    it('should emit plugin:register event', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0', 'Test plugin');
      const eventListener = vi.fn();

      eventBus.on('plugin:register', eventListener);

      await pluginManager.register(plugin);

      // Wait for async dispatch
      await new Promise(resolve => setImmediate(resolve));

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:register',
          data: expect.objectContaining({
            name: 'test-plugin',
            version: '1.0.0',
            description: 'Test plugin',
          }),
        })
      );
    });

    it('should respect autoEnable option', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin, { autoEnable: false });

      const metadata = pluginManager.getMetadata('test-plugin');
      expect(metadata?.enabled).toBe(false);
    });
  });

  describe('unregister() - Plugin unregistration', () => {
    it('should unregister a plugin successfully', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);
      await pluginManager.unregister('test-plugin');

      expect(pluginManager.has('test-plugin')).toBe(false);
      expect(pluginManager.count()).toBe(0);
    });

    it('should call plugin shutdown on unregister', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);
      await pluginManager.unregister('test-plugin');

      expect(plugin.shutdown).toHaveBeenCalled();
    });

    it('should throw if plugin is not registered', async () => {
      await expect(pluginManager.unregister('non-existent')).rejects.toThrow(
        'Plugin non-existent is not registered'
      );
    });

    it('should emit plugin:unregister event', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');
      const eventListener = vi.fn();

      await pluginManager.register(plugin);
      eventBus.on('plugin:unregister', eventListener);

      await pluginManager.unregister('test-plugin');

      // Wait for async dispatch
      await new Promise(resolve => setImmediate(resolve));

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:unregister',
          data: { name: 'test-plugin' },
        })
      );
    });
  });

  describe('get() - Get plugin', () => {
    it('should return registered plugin', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);

      const retrieved = pluginManager.get('test-plugin');
      expect(retrieved).toBe(plugin);
    });

    it('should return undefined for non-existent plugin', () => {
      expect(pluginManager.get('non-existent')).toBeUndefined();
    });
  });

  describe('getMetadata() - Get plugin metadata', () => {
    it('should return plugin metadata', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);

      const metadata = pluginManager.getMetadata('test-plugin');
      expect(metadata).toBeDefined();
      expect(metadata?.plugin).toBe(plugin);
      expect(metadata?.enabled).toBe(true);
    });

    it('should return undefined for non-existent plugin', () => {
      expect(pluginManager.getMetadata('non-existent')).toBeUndefined();
    });
  });

  describe('list() - List plugins', () => {
    it('should return all registered plugins', async () => {
      const plugin1 = createMockPlugin('plugin-1', '1.0.0');
      const plugin2 = createMockPlugin('plugin-2', '2.0.0');

      await pluginManager.register(plugin1);
      await pluginManager.register(plugin2);

      const plugins = pluginManager.list();
      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(plugin1);
      expect(plugins).toContain(plugin2);
    });

    it('should return empty array when no plugins registered', () => {
      expect(pluginManager.list()).toEqual([]);
    });
  });

  describe('listWithMetadata() - List plugins with metadata', () => {
    it('should return all plugins with metadata', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);

      const metadataList = pluginManager.listWithMetadata();
      expect(metadataList).toHaveLength(1);
      expect(metadataList[0].plugin).toBe(plugin);
    });
  });

  describe('initialize() - Initialize plugin', () => {
    it('should initialize a registered plugin', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);
      await pluginManager.initialize('test-plugin');

      expect(plugin.initialize).toHaveBeenCalled();
    });

    it('should throw if plugin is not registered', async () => {
      await expect(pluginManager.initialize('non-existent')).rejects.toThrow(
        'Plugin non-existent is not registered'
      );
    });

    it('should skip initialization for disabled plugins', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin, { autoEnable: false });
      await pluginManager.initialize('test-plugin');

      expect(plugin.initialize).not.toHaveBeenCalled();
    });
  });

  describe('execute() - Execute plugin', () => {
    it('should execute a registered plugin', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');
      const input: PluginInput = { action: 'test', params: {} };

      await pluginManager.register(plugin);
      const result = await pluginManager.execute('test-plugin', input);

      expect(plugin.execute).toHaveBeenCalledWith(input);
      expect(result.success).toBe(true);
    });

    it('should return error for non-existent plugin', async () => {
      const result = await pluginManager.execute('non-existent', { action: 'test', params: {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });

    it('should return error for disabled plugin', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin, { autoEnable: false });
      const result = await pluginManager.execute('test-plugin', { action: 'test', params: {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('should update execution statistics', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);
      await pluginManager.execute('test-plugin', { action: 'test', params: {} });

      const metadata = pluginManager.getMetadata('test-plugin');
      expect(metadata?.executionCount).toBe(1);
      expect(metadata?.lastExecutedAt).toBeDefined();
    });
  });

  describe('shutdown() - Shutdown plugin', () => {
    it('should shutdown a registered plugin', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);
      await pluginManager.shutdown('test-plugin');

      expect(plugin.shutdown).toHaveBeenCalled();
    });

    it('should not throw for non-existent plugin', async () => {
      await expect(pluginManager.shutdown('non-existent')).resolves.not.toThrow();
    });
  });

  describe('shutdownAll() - Shutdown all plugins', () => {
    it('should shutdown all registered plugins', async () => {
      const plugin1 = createMockPlugin('plugin-1', '1.0.0');
      const plugin2 = createMockPlugin('plugin-2', '2.0.0');

      await pluginManager.register(plugin1);
      await pluginManager.register(plugin2);

      await pluginManager.shutdownAll();

      expect(plugin1.shutdown).toHaveBeenCalled();
      expect(plugin2.shutdown).toHaveBeenCalled();
    });

    it('should clear all plugins after shutdown', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);
      await pluginManager.shutdownAll();

      expect(pluginManager.count()).toBe(0);
    });
  });

  describe('enable() - Enable plugin', () => {
    it('should enable a registered plugin', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin, { autoEnable: false });
      pluginManager.enable('test-plugin');

      const metadata = pluginManager.getMetadata('test-plugin');
      expect(metadata?.enabled).toBe(true);
    });
  });

  describe('disable() - Disable plugin', () => {
    it('should disable a registered plugin', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);
      pluginManager.disable('test-plugin');

      const metadata = pluginManager.getMetadata('test-plugin');
      expect(metadata?.enabled).toBe(false);
    });
  });

  describe('has() - Check if plugin exists', () => {
    it('should return true for registered plugin', async () => {
      const plugin = createMockPlugin('test-plugin', '1.0.0');

      await pluginManager.register(plugin);

      expect(pluginManager.has('test-plugin')).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      expect(pluginManager.has('non-existent')).toBe(false);
    });
  });

  describe('count() - Get plugin count', () => {
    it('should return correct count', async () => {
      expect(pluginManager.count()).toBe(0);

      await pluginManager.register(createMockPlugin('plugin-1', '1.0.0'));
      expect(pluginManager.count()).toBe(1);

      await pluginManager.register(createMockPlugin('plugin-2', '1.0.0'));
      expect(pluginManager.count()).toBe(2);
    });
  });

  describe('getEnabled() - Get enabled plugins', () => {
    it('should return only enabled plugins', async () => {
      const plugin1 = createMockPlugin('enabled-plugin', '1.0.0');
      const plugin2 = createMockPlugin('disabled-plugin', '2.0.0');

      await pluginManager.register(plugin1);
      await pluginManager.register(plugin2, { autoEnable: false });

      const enabled = pluginManager.getEnabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0]).toBe(plugin1);
    });
  });

  describe('getDisabled() - Get disabled plugins', () => {
    it('should return only disabled plugins', async () => {
      const plugin1 = createMockPlugin('enabled-plugin', '1.0.0');
      const plugin2 = createMockPlugin('disabled-plugin', '2.0.0');

      await pluginManager.register(plugin1);
      await pluginManager.register(plugin2, { autoEnable: false });

      const disabled = pluginManager.getDisabled();
      expect(disabled).toHaveLength(1);
      expect(disabled[0]).toBe(plugin2);
    });
  });

  // ==================== 新增覆盖率增强测试 ====================

  describe('initialize() - failure paths', () => {
    it('should throw when initialize returns failure', async () => {
      const failingPlugin: PluginInterface = {
        name: 'failing-plugin',
        version: '1.0.0',
        description: 'Fails on init',
        initialize: vi.fn(async () => ({ success: false, error: 'Init failed' })),
        execute: vi.fn(),
        shutdown: vi.fn(),
      };

      await pluginManager.register(failingPlugin);
      await expect(pluginManager.initialize('failing-plugin')).rejects.toThrow('Init failed');
    });

    it('should emit plugin:error on initialize failure', async () => {
      const failingPlugin: PluginInterface = {
        name: 'error-plugin',
        version: '1.0.0',
        initialize: vi.fn(async () => Promise.reject(new Error('Crashed'))),
        execute: vi.fn(),
        shutdown: vi.fn(),
      };

      const errorListener = vi.fn();
      eventBus.on('plugin:error', errorListener);

      await pluginManager.register(failingPlugin);
      await expect(pluginManager.initialize('error-plugin')).rejects.toThrow('Crashed');

      await new Promise(resolve => setImmediate(resolve));
      expect(errorListener).toHaveBeenCalled();
    });
  });

  describe('execute() - error handling', () => {
    it('should handle execute error and emit plugin:error', async () => {
      const errorPlugin: PluginInterface = {
        name: 'error-plugin',
        version: '1.0.0',
        initialize: vi.fn(async () => ({ success: true })),
        execute: vi.fn(async () => Promise.reject(new Error('Execute failed'))),
        shutdown: vi.fn(),
      };

      const errorListener = vi.fn();
      eventBus.on('plugin:error', errorListener);

      await pluginManager.register(errorPlugin);
      const result = await pluginManager.execute('error-plugin', { action: 'test', params: {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execute failed');

      await new Promise(resolve => setImmediate(resolve));
      expect(errorListener).toHaveBeenCalled();
    });
  });

  describe('unregister() - shutdown error', () => {
    it('should handle shutdown error gracefully', async () => {
      const badShutdownPlugin: PluginInterface = {
        name: 'bad-shutdown',
        version: '1.0.0',
        initialize: vi.fn(async () => ({ success: true })),
        execute: vi.fn(),
        shutdown: vi.fn(async () => Promise.reject(new Error('Shutdown failed'))),
      };

      await pluginManager.register(badShutdownPlugin);
      // Should not throw, just log error
      await pluginManager.unregister('bad-shutdown');
      expect(pluginManager.has('bad-shutdown')).toBe(false);
    });
  });

  describe('shutdown() - error handling', () => {
    it('should handle shutdown error without throwing', async () => {
      const errorPlugin: PluginInterface = {
        name: 'error-plugin',
        version: '1.0.0',
        initialize: vi.fn(),
        execute: vi.fn(),
        shutdown: vi.fn(async () => Promise.reject(new Error('Shutdown error'))),
      };

      await pluginManager.register(errorPlugin);
      // Should not throw
      await pluginManager.shutdown('error-plugin');
    });
  });

  describe('shutdownAll() - error handling', () => {
    it('should handle multiple shutdown errors', async () => {
      const plugin1: PluginInterface = {
        name: 'plugin-1',
        version: '1.0.0',
        initialize: vi.fn(),
        execute: vi.fn(),
        shutdown: vi.fn(async () => Promise.reject(new Error('Error 1'))),
      };
      const plugin2: PluginInterface = {
        name: 'plugin-2',
        version: '1.0.0',
        initialize: vi.fn(),
        execute: vi.fn(),
        shutdown: vi.fn(async () => Promise.reject(new Error('Error 2'))),
      };

      await pluginManager.register(plugin1);
      await pluginManager.register(plugin2);

      // Should not throw, all plugins cleared
      await pluginManager.shutdownAll();
      expect(pluginManager.count()).toBe(0);
    });
  });
});
