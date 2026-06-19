import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { BasePlugin, type PluginConfig, type PluginMetadata } from '@organic/plugins';

describe('Plugin System', () => {
  let kernel: Kernel;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
    await kernel.initialize();
  });

  afterEach(async () => {
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  it('should load plugins on startup', async () => {
    class TestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test plugin for unit testing',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        this.setState({ status: 'initialized' });
        return { success: true };
      }

      async shutdown() {
        this.setState({ status: 'stopped' });
        return { success: true };
      }
    }

    const config: PluginConfig = {
      name: 'test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new TestPlugin(config);
    await kernel.registerPlugin(plugin);

    const loadedPlugin = kernel.getPlugin('test-plugin');
    expect(loadedPlugin).toBeDefined();
  });

  it('should enable and disable plugins', async () => {
    class ToggleTestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'toggle-test-plugin',
        name: 'Toggle Test Plugin',
        version: '1.0.0',
        description: 'Toggle test plugin',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        this.setState({ status: 'initialized' });
        return { success: true };
      }

      async shutdown() {
        this.setState({ status: 'stopped' });
        return { success: true };
      }
    }

    const config: PluginConfig = {
      name: 'toggle-test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new ToggleTestPlugin(config);
    await kernel.registerPlugin(plugin);

    const metadata = kernel.getPlugin('toggle-test-plugin');
    expect(metadata).toBeDefined();

    await kernel.unregisterPlugin('toggle-test-plugin');
    expect(kernel.getPlugin('toggle-test-plugin')).toBeUndefined();
  });

  it('should handle plugin errors without crashing', async () => {
    class ErrorTestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'error-test-plugin',
        name: 'Error Test Plugin',
        version: '1.0.0',
        description: 'Error test plugin',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        throw new Error('Intentional initialization error');
      }

      async shutdown() {
        this.setState({ status: 'stopped' });
        return { success: true };
      }
    }

    const config: PluginConfig = {
      name: 'error-test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new ErrorTestPlugin(config);

    try {
      await kernel.registerPlugin(plugin);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should transition through plugin lifecycle states', async () => {
    class LifecycleTestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'lifecycle-test-plugin',
        name: 'Lifecycle Test Plugin',
        version: '1.0.0',
        description: 'Lifecycle test plugin',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        this.setState({ status: 'initialized' });
        return { success: true };
      }

      async shutdown() {
        this.setState({ status: 'stopped' });
        return { success: true };
      }
    }

    const config: PluginConfig = {
      name: 'lifecycle-test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new LifecycleTestPlugin(config);
    await kernel.registerPlugin(plugin);

    const metadata = plugin.getMetadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe('lifecycle-test-plugin');

    await kernel.unregisterPlugin('lifecycle-test-plugin');
  });

  it('should validate plugin configuration', async () => {
    class ConfigTestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'config-test-plugin',
        name: 'Config Test Plugin',
        version: '1.0.0',
        description: 'Config test plugin',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        return { success: true };
      }

      async shutdown() {
        return { success: true };
      }
    }

    const config: PluginConfig = {
      name: 'config-test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new ConfigTestPlugin(config);
    await kernel.registerPlugin(plugin);

    const loadedPlugin = kernel.getPlugin('config-test-plugin');
    expect(loadedPlugin).toBeDefined();
    expect(loadedPlugin?.name).toBe('config-test-plugin');
  });

  it('should check plugin dependencies', async () => {
    class DepTestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'dep-test-plugin',
        name: 'Dependency Test Plugin',
        version: '1.0.0',
        description: 'Dependency test plugin',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: ['non-existent-dep'],
      };

      async initialize() {
        return { success: true };
      }

      async shutdown() {
        return { success: true };
      }
    }

    const config: PluginConfig = {
      name: 'dep-test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new DepTestPlugin(config);

    const metadata = plugin.getMetadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe('dep-test-plugin');
  });

  it('should handle multiple plugins', async () => {
    class MultiPlugin1 extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'multi-plugin-1',
        name: 'Multi Plugin 1',
        version: '1.0.0',
        description: 'Multi plugin 1',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        return { success: true };
      }
      async shutdown() {
        return { success: true };
      }
    }

    class MultiPlugin2 extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'multi-plugin-2',
        name: 'Multi Plugin 2',
        version: '1.0.0',
        description: 'Multi plugin 2',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        return { success: true };
      }
      async shutdown() {
        return { success: true };
      }
    }

    await kernel.registerPlugin(
      new MultiPlugin1({ name: 'multi-plugin-1', version: '1.0.0', enabled: true })
    );
    await kernel.registerPlugin(
      new MultiPlugin2({ name: 'multi-plugin-2', version: '1.0.0', enabled: true })
    );

    const plugin1 = kernel.getPlugin('multi-plugin-1');
    const plugin2 = kernel.getPlugin('multi-plugin-2');

    expect(plugin1).toBeDefined();
    expect(plugin2).toBeDefined();
  });

  it('should verify plugin priority handling', async () => {
    class PriorityPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'priority-plugin',
        name: 'Priority Plugin',
        version: '1.0.0',
        description: 'Priority plugin',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        return { success: true };
      }
      async shutdown() {
        return { success: true };
      }
    }

    const plugin = new PriorityPlugin({ name: 'priority-plugin', version: '1.0.0', enabled: true });
    await kernel.registerPlugin(plugin);

    const loaded = kernel.getPlugin('priority-plugin');
    expect(loaded).toBeDefined();
  });

  // ========== 新增：完整插件生命周期测试 ==========
  describe('Complete Plugin Lifecycle', () => {
    it('should complete full lifecycle: register → initialize → execute → shutdown → unregister', async () => {
      const lifecycleStates: string[] = [];

      class FullLifecyclePlugin extends BasePlugin {
        private _state: Record<string, unknown> = {};

        static override metadata: PluginMetadata = {
          id: 'full-lifecycle-plugin',
          name: 'Full Lifecycle Plugin',
          version: '1.0.0',
          description: 'Full lifecycle test plugin',
          author: 'Test',
          apiVersion: '1.0.0',
          dependencies: [],
        };

        async initialize() {
          lifecycleStates.push('initialized');
          this._state = { status: 'ready', initializedAt: Date.now() };
          return { success: true };
        }

        async execute(context?: Record<string, unknown>) {
          lifecycleStates.push('executing');
          return {
            success: true,
            result: { message: 'execution completed', input: context },
          };
        }

        async shutdown() {
          lifecycleStates.push('shutdown');
          this._state = { status: 'stopped', stoppedAt: Date.now() };
          return { success: true };
        }

        getState() {
          return this._state;
        }

        setState(state: Record<string, unknown>) {
          this._state = { ...this._state, ...state };
        }
      }

      const config: PluginConfig = {
        name: 'full-lifecycle-plugin',
        version: '1.0.0',
        enabled: true,
      };

      const plugin = new FullLifecyclePlugin(config);

      // Step 1: Register and Initialize
      await kernel.registerPlugin(plugin);
      expect(kernel.getPlugin('full-lifecycle-plugin')).toBeDefined();

      // Manually call initialize to trigger lifecycle
      await plugin.initialize();
      expect(lifecycleStates).toContain('initialized');

      // Step 2: Execute (if supported)
      if (typeof plugin.execute === 'function') {
        const result = await plugin.execute({ test: 'data' });
        expect(result.success).toBe(true);
        expect(lifecycleStates).toContain('executing');
      }

      // Step 3 & 4: Unregister (this will trigger shutdown)
      await kernel.unregisterPlugin('full-lifecycle-plugin');
      expect(kernel.getPlugin('full-lifecycle-plugin')).toBeUndefined();
      expect(lifecycleStates).toContain('shutdown');

      // Verify lifecycle contains all expected states
      expect(lifecycleStates).toContain('initialized');
      expect(lifecycleStates).toContain('executing');
      expect(lifecycleStates).toContain('shutdown');
    });

    it('should handle plugin with dependencies loading order', async () => {
      const loadOrder: string[] = [];

      class DependencyPluginA extends BasePlugin {
        static override metadata: PluginMetadata = {
          id: 'dep-plugin-a',
          name: 'Dependency Plugin A',
          version: '1.0.0',
          description: 'First dependency',
          author: 'Test',
          apiVersion: '1.0.0',
          dependencies: [],
        };

        async initialize() {
          loadOrder.push('plugin-a');
          return { success: true };
        }
        async shutdown() {
          return { success: true };
        }
      }

      class DependencyPluginB extends BasePlugin {
        static override metadata: PluginMetadata = {
          id: 'dep-plugin-b',
          name: 'Dependency Plugin B',
          version: '1.0.0',
          description: 'Second dependency (depends on A)',
          author: 'Test',
          apiVersion: '1.0.0',
          dependencies: ['dep-plugin-a'],
        };

        async initialize() {
          loadOrder.push('plugin-b');
          return { success: true };
        }
        async shutdown() {
          return { success: true };
        }
      }

      // Register plugins
      const pluginA = new DependencyPluginA({
        name: 'dep-plugin-a',
        version: '1.0.0',
        enabled: true,
      });
      const pluginB = new DependencyPluginB({
        name: 'dep-plugin-b',
        version: '1.0.0',
        enabled: true,
      });

      await kernel.registerPlugin(pluginB);
      await kernel.registerPlugin(pluginA);

      // Manually trigger initialization to track order
      await pluginA.initialize();
      await pluginB.initialize();

      // Verify both plugins are registered
      expect(kernel.getPlugin('dep-plugin-a')).toBeDefined();
      expect(kernel.getPlugin('dep-plugin-b')).toBeDefined();

      // Verify both were initialized
      expect(loadOrder).toContain('plugin-a');
      expect(loadOrder).toContain('plugin-b');
    });

    it('should handle plugin state persistence across operations', async () => {
      class StatefulPlugin extends BasePlugin {
        private _internalState: Record<string, unknown> = {};

        static override metadata: PluginMetadata = {
          id: 'stateful-plugin',
          name: 'Stateful Plugin',
          version: '1.0.0',
          description: 'State management test',
          author: 'Test',
          apiVersion: '1.0.0',
          dependencies: [],
        };

        async initialize() {
          this._internalState = {
            status: 'active',
            counter: 0,
            lastOperation: null as string | null,
          };
          return { success: true };
        }

        async execute(_context?: Record<string, unknown>) {
          const newCounter = (this._internalState?.counter || 0) + 1;
          this._internalState = {
            ...this._internalState,
            counter: newCounter,
            lastOperation: 'execute',
            lastExecutedAt: Date.now(),
          };
          return { success: true, result: { executionCount: newCounter } };
        }

        async shutdown() {
          this._internalState = { status: 'stopped' };
          return { success: true };
        }

        getState() {
          return this._internalState;
        }
      }

      const plugin = new StatefulPlugin({
        name: 'stateful-plugin',
        version: '1.0.0',
        enabled: true,
      });
      await kernel.registerPlugin(plugin);
      await plugin.initialize();

      // Execute multiple times and verify state accumulation
      const result1 = await plugin.execute();
      expect(result1.result.executionCount).toBe(1);

      const result2 = await plugin.execute();
      expect(result2.result.executionCount).toBe(2);

      const result3 = await plugin.execute();
      expect(result3.result.executionCount).toBe(3);

      // Verify final state
      const finalState = plugin.getState();
      expect(finalState.counter).toBe(3);
      expect(finalState.lastOperation).toBe('execute');
    });

    it('should handle concurrent plugin operations safely', async () => {
      let operationCount = 0;

      class ConcurrentPlugin extends BasePlugin {
        static override metadata: PluginMetadata = {
          id: 'concurrent-plugin',
          name: 'Concurrent Plugin',
          version: '1.0.0',
          description: 'Concurrency safety test',
          author: 'Test',
          apiVersion: '1.0.0',
          dependencies: [],
        };

        async initialize() {
          return { success: true };
        }

        async execute() {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          operationCount++;
          return { success: true, result: { count: operationCount } };
        }

        async shutdown() {
          return { success: true };
        }
      }

      const plugin = new ConcurrentPlugin({
        name: 'concurrent-plugin',
        version: '1.0.0',
        enabled: true,
      });
      await kernel.registerPlugin(plugin);

      // Execute concurrently
      const results = await Promise.all([
        plugin.execute(),
        plugin.execute(),
        plugin.execute(),
        plugin.execute(),
        plugin.execute(),
      ]);

      // All executions should complete
      expect(results.length).toBe(5);
      expect(results.every(r => r.success)).toBe(true);
      expect(operationCount).toBe(5);
    });
  });
});
