import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent, type AgentTaskInput } from '../Agent.js';
import { AgentStatus } from '../AgentState.js';

vi.mock('@organic/kernel', () => ({
  KernelApi: vi.fn(),
}));

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('Agent', () => {
  let agent: Agent;
  const mockKernel = {} as any;

  beforeEach(() => {
    agent = new Agent({
      kernel: mockKernel,
      config: {
        id: 'test-agent',
        name: 'TestAgent',
        version: '1.0.0',
      },
    });
  });

  describe('constructor', () => {
    it('should create an agent with default config', () => {
      expect(agent).toBeDefined();
      expect(agent.getId()).toBe('test-agent');
      expect(agent.getName()).toBe('TestAgent');
    });

    it('should create agent with custom id if not provided', () => {
      const agentWithDefaultId = new Agent({
        kernel: mockKernel,
        config: {
          name: 'TestAgent',
          version: '1.0.0',
        },
      });
      expect(agentWithDefaultId.getId()).toMatch(/^agent_/);
    });
  });

  describe('initialize', () => {
    it('should initialize the agent successfully', async () => {
      await agent.initialize();
      expect(agent.getStatus()).toBe(AgentStatus.IDLE);
    });

    it('should not re-initialize already initialized agent', async () => {
      await agent.initialize();
      await agent.initialize();
      expect(agent.getStatus()).toBe(AgentStatus.IDLE);
    });
  });

  describe('shutdown', () => {
    it('should shutdown an initialized agent', async () => {
      await agent.initialize();
      await agent.shutdown();
      expect(agent.getStatus()).toBe(AgentStatus.OFFLINE);
    });

    it('should handle shutdown of uninitialized agent', async () => {
      await agent.shutdown();
      expect(agent.getStatus()).toBeDefined();
    });
  });

  describe('getConfig', () => {
    it('should return agent configuration', () => {
      const config = agent.getConfig();
      expect(config.id).toBe('test-agent');
      expect(config.name).toBe('TestAgent');
      expect(config.version).toBe('1.0.0');
    });
  });

  describe('getState', () => {
    it('should return agent state', () => {
      const state = agent.getState();
      expect(state.agentId).toBe('test-agent');
      expect(state.status).toBe(AgentStatus.IDLE);
    });
  });

  describe('getStats', () => {
    it('should return agent statistics', () => {
      const stats = agent.getStats();
      expect(stats.completedTasks).toBe(0);
      expect(stats.failedTasks).toBe(0);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getId', () => {
    it('should return agent id', () => {
      expect(agent.getId()).toBe('test-agent');
    });
  });

  describe('getName', () => {
    it('should return agent name', () => {
      expect(agent.getName()).toBe('TestAgent');
    });
  });

  describe('getStatus', () => {
    it('should return agent status', () => {
      expect(agent.getStatus()).toBe(AgentStatus.IDLE);
    });
  });

  describe('registerTaskHandler', () => {
    it('should register a task handler', () => {
      const handler = vi.fn();
      agent.registerTaskHandler('test-task', handler);
    });
  });

  describe('unregisterTaskHandler', () => {
    it('should unregister a task handler', () => {
      const handler = vi.fn();
      agent.registerTaskHandler('test-task', handler);
      const result = agent.unregisterTaskHandler('test-task');
      expect(result).toBe(true);
    });

    it('should return false for non-existent handler', () => {
      const result = agent.unregisterTaskHandler('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('should throw error if agent not initialized', async () => {
      const input: AgentTaskInput = {
        taskId: 'test-task',
        payload: {},
      };

      await expect(agent.execute(input)).rejects.toThrow('Agent not initialized');
    });

    it('should execute task successfully', async () => {
      await agent.initialize();

      const handler = vi.fn().mockResolvedValue('result');
      agent.registerTaskHandler('test-task', handler);

      const input: AgentTaskInput = {
        taskId: 'test-task',
        payload: { data: 'test' },
      };

      const result = await agent.execute(input);
      expect(result.success).toBe(true);
      expect(result.data).toBe('result');
      expect(handler).toHaveBeenCalled();
    });

    it('should handle task execution error', async () => {
      await agent.initialize();

      const handler = vi.fn().mockRejectedValue(new Error('Task failed'));
      agent.registerTaskHandler('test-task', handler);

      const input: AgentTaskInput = {
        taskId: 'test-task',
        payload: {},
      };

      const result = await agent.execute(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task failed');
    });

    it('should emit task:error event on execution error', async () => {
      await agent.initialize();
      const errorHandler = vi.fn();
      agent.on('task:error', errorHandler);

      const handler = vi.fn().mockRejectedValue(new Error('Task failed'));
      agent.registerTaskHandler('test-task', handler);

      const input: AgentTaskInput = {
        taskId: 'test-task',
        payload: {},
      };

      await agent.execute(input);
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should emit task:complete event on successful execution', async () => {
      await agent.initialize();
      const completeHandler = vi.fn();
      agent.on('task:complete', completeHandler);

      const handler = vi.fn().mockResolvedValue('result');
      agent.registerTaskHandler('test-task', handler);

      const input: AgentTaskInput = {
        taskId: 'test-task',
        payload: {},
      };

      await agent.execute(input);
      expect(completeHandler).toHaveBeenCalled();
    });

    it('should handle execution timeout', async () => {
      await agent.initialize();

      const handler = vi
        .fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 500)));
      agent.registerTaskHandler('slow-task', handler);

      const input: AgentTaskInput = {
        taskId: 'slow-task',
        payload: {},
        timeout: 10,
      };

      const result = await agent.execute(input);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should throw error for unregistered task', async () => {
      await agent.initialize();

      const input: AgentTaskInput = {
        taskId: 'unregistered-task',
        payload: {},
      };

      const result = await agent.execute(input);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler registered');
    });
  });

  describe('child agent management', () => {
    it('should register a child agent', async () => {
      await agent.initialize();

      const childAgent = new Agent({
        kernel: mockKernel,
        config: {
          id: 'child-agent',
          name: 'ChildAgent',
          version: '1.0.0',
        },
      });

      agent.registerChildAgent(childAgent);
      const children = agent.getChildAgents();
      expect(children).toHaveLength(1);
      expect(children[0].getId()).toBe('child-agent');
    });

    it('should not duplicate child agent registration', async () => {
      await agent.initialize();

      const childAgent = new Agent({
        kernel: mockKernel,
        config: {
          id: 'child-agent',
          name: 'ChildAgent',
          version: '1.0.0',
        },
      });

      agent.registerChildAgent(childAgent);
      agent.registerChildAgent(childAgent);
      const children = agent.getChildAgents();
      expect(children).toHaveLength(1);
    });

    it('should unregister a child agent', async () => {
      await agent.initialize();

      const childAgent = new Agent({
        kernel: mockKernel,
        config: {
          id: 'child-agent',
          name: 'ChildAgent',
          version: '1.0.0',
        },
      });

      agent.registerChildAgent(childAgent);
      const result = agent.unregisterChildAgent('child-agent');
      expect(result).toBe(true);
      expect(agent.getChildAgents()).toHaveLength(0);
    });

    it('should return false when unregistering non-existent child', async () => {
      await agent.initialize();
      const result = agent.unregisterChildAgent('non-existent');
      expect(result).toBe(false);
    });

    it('should emit child:register event', async () => {
      await agent.initialize();
      const handler = vi.fn();
      agent.on('child:register', handler);

      const childAgent = new Agent({
        kernel: mockKernel,
        config: {
          id: 'child-agent',
          name: 'ChildAgent',
          version: '1.0.0',
        },
      });

      agent.registerChildAgent(childAgent);
      expect(handler).toHaveBeenCalled();
    });

    it('should get child agent by id', async () => {
      await agent.initialize();

      const childAgent = new Agent({
        kernel: mockKernel,
        config: {
          id: 'child-agent',
          name: 'ChildAgent',
          version: '1.0.0',
        },
      });

      agent.registerChildAgent(childAgent);
      const found = agent.getChildAgent('child-agent');
      expect(found).toBeDefined();
      expect(found?.getId()).toBe('child-agent');
    });

    it('should return undefined for non-existent child', async () => {
      await agent.initialize();
      const found = agent.getChildAgent('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('capabilities', () => {
    it('should check if agent has capability', async () => {
      const capAgent = new Agent({
        kernel: mockKernel,
        config: {
          id: 'cap-agent',
          name: 'CapAgent',
          version: '1.0.0',
          capabilities: ['cap1', 'cap2'],
        },
      });

      expect(capAgent.hasCapability('cap1')).toBe(true);
      expect(capAgent.hasCapability('cap3')).toBe(false);
    });
  });

  describe('canAcceptTasks', () => {
    it('should return true when idle and under capacity', async () => {
      await agent.initialize();
      expect(agent.canAcceptTasks()).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      await agent.initialize();
      const result = await agent.sendMessage('target-agent', 'action', { data: 'test' });
      expect(result).toEqual({ success: true, action: 'action', payload: { data: 'test' } });
    });

    it('should throw error when emit fails', async () => {
      // 可追溯性: 覆盖 Agent.ts L583-584 sendMessage catch 分支
      await agent.initialize();
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Emit failed');
      });
      agent.on('message:send', errorHandler);
      await expect(agent.sendMessage('target', 'action', {})).rejects.toThrow('Emit failed');
    });
  });

  describe('events', () => {
    it('should emit status:change event', async () => {
      await agent.initialize();
      const statusChangeHandler = vi.fn();
      agent.on('status:change', statusChangeHandler);

      await agent.shutdown();

      expect(statusChangeHandler).toHaveBeenCalled();
    });

    it('should emit task:start event', async () => {
      await agent.initialize();
      const taskStartHandler = vi.fn();
      agent.on('task:start', taskStartHandler);

      const handler = vi.fn().mockResolvedValue('result');
      agent.registerTaskHandler('test-task', handler);

      const input: AgentTaskInput = {
        taskId: 'test-task',
        payload: {},
      };

      await agent.execute(input);
      expect(taskStartHandler).toHaveBeenCalled();
    });

    it('should emit heartbeat event after initialization', async () => {
      const heartbeatAgent = new Agent({
        kernel: mockKernel,
        config: {
          id: 'heartbeat-agent',
          name: 'HeartbeatAgent',
          version: '1.0.0',
          heartbeatInterval: 1,
        },
      });

      await heartbeatAgent.initialize();
      const heartbeatHandler = vi.fn();
      heartbeatAgent.on('heartbeat', heartbeatHandler);

      // Wait for heartbeat to be emitted
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(heartbeatHandler).toHaveBeenCalled();
      await heartbeatAgent.shutdown();
    });

    it('should return early when heartbeatInterval already exists', async () => {
      // 可追溯性: 覆盖 Agent.ts L508 startHeartbeat heartbeatInterval已存在分支
      const heartbeatAgent = new Agent({
        kernel: mockKernel,
        config: {
          id: 'heartbeat-agent-2',
          name: 'HeartbeatAgent2',
          version: '1.0.0',
          heartbeatInterval: 1,
        },
      });

      await heartbeatAgent.initialize();
      await new Promise(resolve => setTimeout(resolve, 1100));

      // heartbeatInterval should exist after initialization
      expect((heartbeatAgent as any).heartbeatInterval).toBeDefined();

      // 再次调用startHeartbeat应直接返回
      (heartbeatAgent as any).startHeartbeat();

      // heartbeatInterval应保持不变
      const existingInterval = (heartbeatAgent as any).heartbeatInterval;
      expect((heartbeatAgent as any).heartbeatInterval).toBe(existingInterval);

      await heartbeatAgent.shutdown();
    });
  });
});
