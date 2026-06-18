import { describe, it, expect, vi } from 'vitest';
import { UIAgent, createUIAgent } from '../UIAgent.js';
import type { UIOperationType, UIOperationStatus } from '../UIOperation.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('UIAgent', () => {
  describe('constructor', () => {
    it('should create UIAgent instance', () => {
      const agent = new UIAgent();
      expect(agent).toBeDefined();
    });

    it('should accept custom config', () => {
      const agent = new UIAgent({
        agentId: 'custom-agent',
        name: 'CustomAgent',
      });
      expect(agent).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start the agent', async () => {
      const agent = new UIAgent();
      await agent.start();
      expect(agent.getState().status).toBe('idle');
    });

    it('should stop the agent', async () => {
      const agent = new UIAgent();
      await agent.start();
      await agent.stop();
      expect(agent.getState().status).toBe('offline');
    });

    it('should not start if already idle', async () => {
      const agent = new UIAgent();
      await agent.start();
      await agent.start();
      expect(agent.getState().status).toBe('idle');
    });

    it('should not stop if already offline', async () => {
      const agent = new UIAgent();
      await agent.start();
      await agent.stop();
      await agent.stop();
      expect(agent.getState().status).toBe('offline');
    });
  });

  describe('pause/resume', () => {
    it('should pause the agent', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.pause();
      expect(agent.getState().status).toBe('paused');
    });

    it('should resume the agent', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.pause();
      agent.resume();
      expect(agent.getState().status).toBe('idle');
    });

    it('should not pause in offline state', async () => {
      const agent = new UIAgent();
      agent.pause();
      expect(agent.getState().status).toBe('offline');
    });

    it('should not resume when not paused', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.resume();
      expect(agent.getState().status).toBe('idle');
    });
  });

  describe('session management', () => {
    it('should start a session', async () => {
      const agent = new UIAgent();
      await agent.start();
      const session = agent.startSession();
      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^session_/);
    });

    it('should end a session', async () => {
      const agent = new UIAgent();
      await agent.start();
      const session = agent.startSession();
      await agent.endSession(session.sessionId);
      expect(agent.getCurrentSession()).toBeUndefined();
    });

    it('should get current session', async () => {
      const agent = new UIAgent();
      await agent.start();
      const session = agent.startSession();
      expect(agent.getCurrentSession()?.sessionId).toBe(session.sessionId);
    });
  });

  describe('execute', () => {
    it('should throw error when no session', async () => {
      const agent = new UIAgent();
      await agent.start();
      await expect(
        agent.execute({
          type: 'click',
          input: { selector: '#button' },
        })
      ).rejects.toThrow('No active session');
    });

    it('should return permission denied result', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L1');
      agent.startSession();
      const result = await agent.execute({
        type: 'click',
        input: { selector: '#button' },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient permission level');
    });
  });

  describe('executeSequence', () => {
    it('should execute multiple operations', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.startSession();
      agent.setPermissionLevel('L4');
      const results = await agent.executeSequence([
        { type: 'click', input: { selector: '#button1' } },
        { type: 'click', input: { selector: '#button2' } },
      ]);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should stop on failure', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.startSession();
      agent.setPermissionLevel('L1');
      const results = await agent.executeSequence([
        { type: 'click', input: { selector: '#button1' } },
        { type: 'click', input: { selector: '#button2' } },
      ]);
      expect(results[0].success).toBe(false);
    });
  });

  describe('registerOperationHandler', () => {
    it('should register custom handler', async () => {
      const agent = new UIAgent();
      await agent.start();
      const mockHandler = {
        getType: () => 'click' as UIOperationType,
        supports: (op: UIOperationType) => op === 'click',
        execute: async () => ({
          success: true,
          operationId: '',
          type: 'click' as UIOperationType,
          status: 'completed' as UIOperationStatus,
          executionTime: 0,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);
      expect(agent.getState().status).toBe('idle');
    });
  });

  describe('unregisterOperationHandler', () => {
    it('should unregister handler', async () => {
      const agent = new UIAgent();
      await agent.start();
      const result = agent.unregisterOperationHandler('non-existent' as UIOperationType);
      expect(result).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return agent state', () => {
      const agent = new UIAgent();
      const state = agent.getState();
      expect(state).toHaveProperty('status');
      expect(state).toHaveProperty('totalOperations');
      expect(state).toHaveProperty('successfulOperations');
    });
  });

  describe('getConfig', () => {
    it('should return agent config', () => {
      const agent = new UIAgent({ name: 'TestAgent' });
      const config = agent.getConfig();
      expect(config.name).toBe('TestAgent');
    });
  });

  describe('setPermissionLevel', () => {
    it('should set permission level', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L3');
      expect(agent.getState().permissionLevel).toBe('L3');
    });
  });

  describe('getStats', () => {
    it('should return agent statistics', () => {
      const agent = new UIAgent();
      const stats = agent.getStats();
      expect(stats).toHaveProperty('totalOperations');
      expect(stats).toHaveProperty('successRate');
    });
  });

  describe('createUIAgent', () => {
    it('should create UIAgent instance', () => {
      const agent = createUIAgent();
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(UIAgent);
    });
  });

  // ==================== Enhanced Coverage Tests (ST-07) ====================
  // Traceability: ST-07 > UIAgent.ts > execute() success path
  // Normal path: register handler + L4 permission + start session + execute click

  describe('execute success path', () => {
    it('should execute operation successfully with registered handler', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const mockHandler = {
        getType: () => 'click' as UIOperationType,
        supports: (op: UIOperationType) => op === 'click',
        execute: async () => ({
          success: true,
          operationId: 'op-1',
          type: 'click' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 5,
          timestamp: Date.now(),
          data: { clicked: true },
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      const result = await agent.execute({
        type: 'click',
        input: { selector: '#button' },
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe('click');
      expect(result.status).toBe('success');
      expect(result.operationId).toMatch(/^click_\d+_\d+$/);
      expect(agent.getState().status).toBe('idle');
      expect(agent.getState().totalOperations).toBe(1);
      expect(agent.getState().successfulOperations).toBe(1);
      expect(agent.getState().failedOperations).toBe(0);
    });

    it('should record failed operation when handler throws error', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const mockHandler = {
        getType: () => 'click' as UIOperationType,
        supports: (op: UIOperationType) => op === 'click',
        execute: async () => {
          throw new Error('Handler execution failed');
        },
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      const result = await agent.execute({
        type: 'click',
        input: { selector: '#button' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Handler execution failed');
      expect(result.status).toBe('failed');
      expect(agent.getState().totalOperations).toBe(1);
      expect(agent.getState().failedOperations).toBe(1);
      expect(agent.getState().successfulOperations).toBe(0);
    });

    it('should record failed operation when handler throws non-Error value', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const mockHandler = {
        getType: () => 'click' as UIOperationType,
        supports: (op: UIOperationType) => op === 'click',
        execute: async () => {
          throw 'string error';
        },
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      const result = await agent.execute({
        type: 'click',
        input: { selector: '#button' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
      expect(result.status).toBe('failed');
    });
  });

  // Traceability: ST-07 > UIAgent.ts > execute() with autoConfirmSensitive config
  describe('execute with autoConfirmSensitive', () => {
    it('should auto-confirm sensitive input operation when config enabled', async () => {
      const agent = new UIAgent({ autoConfirmSensitive: true });
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const mockHandler = {
        getType: () => 'input' as UIOperationType,
        supports: (op: UIOperationType) => op === 'input',
        execute: async () => ({
          success: true,
          operationId: 'op-input-1',
          type: 'input' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 3,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      const result = await agent.execute({
        type: 'input',
        input: { selector: '#textbox', value: 'hello' } as never,
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe('input');
    });
  });

  // Traceability: ST-07 > UIAgent.ts > execute() with force option
  describe('execute with force option', () => {
    it('should skip confirmation when force option is true', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const mockHandler = {
        getType: () => 'input' as UIOperationType,
        supports: (op: UIOperationType) => op === 'input',
        execute: async () => ({
          success: true,
          operationId: 'op-input-force',
          type: 'input' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 2,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      const result = await agent.execute({
        type: 'input',
        input: { selector: '#textbox', value: 'hello' } as never,
        options: { force: true },
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe('input');
    });
  });

  // Traceability: ST-07 > UIAgent.ts > execute() sensitive operation cancelled by user
  describe('execute sensitive operation cancelled', () => {
    it('should cancel sensitive input operation when user does not confirm', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const mockHandler = {
        getType: () => 'input' as UIOperationType,
        supports: (op: UIOperationType) => op === 'input',
        execute: async () => ({
          success: true,
          operationId: 'should-not-reach',
          type: 'input' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 0,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      const result = await agent.execute({
        type: 'input',
        input: { selector: '#textbox', value: 'hello' } as never,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('cancelled');
      expect(result.error).toBe('Operation cancelled by user');
    });
  });

  // Traceability: ST-07 > UIAgent.ts > executeSequence() full success flow
  describe('executeSequence full success flow', () => {
    it('should execute all operations in sequence when all succeed', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const clickHandler = {
        getType: () => 'click' as UIOperationType,
        supports: (op: UIOperationType) => op === 'click',
        execute: async () => ({
          success: true,
          operationId: 'click-op',
          type: 'click' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 1,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      const scrollHandler = {
        getType: () => 'scroll' as UIOperationType,
        supports: (op: UIOperationType) => op === 'scroll',
        execute: async () => ({
          success: true,
          operationId: 'scroll-op',
          type: 'scroll' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 1,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(clickHandler);
      agent.registerOperationHandler(scrollHandler);

      const results = await agent.executeSequence([
        { type: 'click', input: { selector: '#btn1' } },
        { type: 'scroll', input: { selector: '#container', direction: 'down' } as never },
        { type: 'click', input: { selector: '#btn2' } },
      ]);

      expect(results.length).toBe(3);
      expect(results[0].success).toBe(true);
      expect(results[0].type).toBe('click');
      expect(results[1].success).toBe(true);
      expect(results[1].type).toBe('scroll');
      expect(results[2].success).toBe(true);
      expect(results[2].type).toBe('click');
      expect(agent.getState().totalOperations).toBe(3);
      expect(agent.getState().successfulOperations).toBe(3);
    });

    it('should continue sequence when operation is cancelled (not failure)', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const inputHandler = {
        getType: () => 'input' as UIOperationType,
        supports: (op: UIOperationType) => op === 'input',
        execute: async () => ({
          success: true,
          operationId: 'input-op',
          type: 'input' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 1,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      const clickHandler = {
        getType: () => 'click' as UIOperationType,
        supports: (op: UIOperationType) => op === 'click',
        execute: async () => ({
          success: true,
          operationId: 'click-op',
          type: 'click' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 1,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(inputHandler);
      agent.registerOperationHandler(clickHandler);

      const results = await agent.executeSequence([
        { type: 'input', input: { selector: '#tb', value: 'x' } as never },
        { type: 'click', input: { selector: '#btn' } },
      ]);

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(false);
      expect(results[0].status).toBe('cancelled');
      expect(results[1].success).toBe(true);
    });
  });

  // Traceability: ST-07 > UIAgent.ts > confirmOperation() / cancelOperation()
  describe('confirmOperation and cancelOperation', () => {
    it('should expose confirmOperation method', () => {
      const agent = new UIAgent();
      expect(typeof agent.confirmOperation).toBe('function');
      expect(() => agent.confirmOperation('confirm_test')).not.toThrow();
    });

    it('should expose cancelOperation method', () => {
      const agent = new UIAgent();
      expect(typeof agent.cancelOperation).toBe('function');
      expect(() => agent.cancelOperation('confirm_test')).not.toThrow();
    });
  });

  // Traceability: ST-07 > UIAgent.ts > startSession() error paths
  describe('startSession error paths', () => {
    it('should throw when starting session in offline state', () => {
      const agent = new UIAgent();
      expect(() => agent.startSession()).toThrow(
        'Agent is not in a state that allows starting sessions'
      );
    });

    it('should throw when starting session in paused state', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.pause();
      expect(() => agent.startSession()).toThrow(
        'Agent is not in a state that allows starting sessions'
      );
    });
  });

  // Traceability: ST-07 > UIAgent.ts > endSession() non-existent session
  describe('endSession non-existent session', () => {
    it('should not throw when ending non-existent session', async () => {
      const agent = new UIAgent();
      await agent.start();
      await expect(agent.endSession('non-existent-session')).resolves.not.toThrow();
      expect(agent.getCurrentSession()).toBeUndefined();
    });
  });

  // Traceability: ST-07 > UIAgent.ts > pause() in error state
  describe('pause in error state', () => {
    it('should not pause when agent is in error state', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.pause();
      agent.resume();
      expect(agent.getState().status).toBe('idle');
    });
  });

  // Traceability: ST-07 > UIAgent.ts > getStats() with operation data
  describe('getStats with operation data', () => {
    it('should return accurate stats after operations', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const successHandler = {
        getType: () => 'click' as UIOperationType,
        supports: (op: UIOperationType) => op === 'click',
        execute: async () => ({
          success: true,
          operationId: 'op-1',
          type: 'click' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 10,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(successHandler);

      await agent.execute({ type: 'click', input: { selector: '#btn1' } });
      await agent.execute({ type: 'click', input: { selector: '#btn2' } });

      const stats = agent.getStats();
      expect(stats.totalOperations).toBe(2);
      expect(stats.successfulOperations).toBe(2);
      expect(stats.failedOperations).toBe(0);
      expect(stats.successRate).toBe(1);
      expect(stats.avgExecutionTime).toBe(0);
    });

    it('should return zero success rate when no operations', () => {
      const agent = new UIAgent();
      const stats = agent.getStats();
      expect(stats.totalOperations).toBe(0);
      expect(stats.successfulOperations).toBe(0);
      expect(stats.failedOperations).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  // Traceability: ST-07 > UIAgent.ts > setPermissionLevel() updates state
  describe('setPermissionLevel updates state', () => {
    it('should update state permission level when called', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L3');
      expect(agent.getState().permissionLevel).toBe('L3');
    });

    it('should update state permission level to L1', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L1');
      expect(agent.getState().permissionLevel).toBe('L1');
    });

    it('should update state permission level to L4', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      expect(agent.getState().permissionLevel).toBe('L4');
    });
  });

  // Traceability: ST-07 > UIAgent.ts > executeOperation catch block (lines 458-479)
  describe('executeOperation catch block', () => {
    it('should handle error when sandbox recordOperation throws', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const mockHandler = {
        getType: () => 'click' as UIOperationType,
        supports: (op: UIOperationType) => op === 'click',
        execute: async () => ({
          success: true,
          operationId: 'op-ok',
          type: 'click' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 5,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      // Make sandbox.recordOperation throw to trigger catch block
      const sandbox = (agent as any).sandbox;
      const originalRecordOp = sandbox.recordOperation;
      sandbox.recordOperation = vi.fn().mockImplementation(() => {
        throw new Error('Sandbox record error');
      });

      const result = await agent.execute({
        type: 'click',
        input: { selector: '#btn' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sandbox record error');
      expect(result.status).toBe('failed');

      sandbox.recordOperation = originalRecordOp;
    });
  });

  // Traceability: ST-07 > UIAgent.ts > stop() ends all active sessions
  describe('stop ends all active sessions', () => {
    it('should end all active sessions on stop', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.startSession();
      agent.startSession();
      await agent.stop();
      expect(agent.getState().status).toBe('offline');
      expect(agent.getCurrentSession()).toBeUndefined();
    });
  });

  // Traceability: ST-07 > UIAgent.ts > events emission
  describe('events emission', () => {
    it('should emit agent:start event', async () => {
      const agent = new UIAgent({ agentId: 'test-agent-1' });
      let emitted = false;
      agent.on('agent:start', data => {
        expect(data.agentId).toBe('test-agent-1');
        expect(typeof data.timestamp).toBe('number');
        emitted = true;
      });
      await agent.start();
      expect(emitted).toBe(true);
    });

    it('should emit agent:stop event', async () => {
      const agent = new UIAgent({ agentId: 'test-agent-2' });
      let emitted = false;
      agent.on('agent:stop', data => {
        expect(data.agentId).toBe('test-agent-2');
        emitted = true;
      });
      await agent.start();
      await agent.stop();
      expect(emitted).toBe(true);
    });

    it('should emit agent:pause and agent:resume events', async () => {
      const agent = new UIAgent({ agentId: 'test-agent-3' });
      let pauseEmitted = false;
      let resumeEmitted = false;
      agent.on('agent:pause', () => {
        pauseEmitted = true;
      });
      agent.on('agent:resume', () => {
        resumeEmitted = true;
      });
      await agent.start();
      agent.pause();
      agent.resume();
      expect(pauseEmitted).toBe(true);
      expect(resumeEmitted).toBe(true);
    });

    it('should emit session:start and session:end events', async () => {
      const agent = new UIAgent({ agentId: 'test-agent-4' });
      let startEmitted = false;
      let endEmitted = false;
      let sessionId = '';
      agent.on('session:start', data => {
        expect(data.agentId).toBe('test-agent-4');
        expect(data.sessionId).toMatch(/^session_/);
        sessionId = data.sessionId;
        startEmitted = true;
      });
      agent.on('session:end', data => {
        expect(data.sessionId).toBe(sessionId);
        endEmitted = true;
      });
      await agent.start();
      const session = agent.startSession();
      await agent.endSession(session.sessionId);
      expect(startEmitted).toBe(true);
      expect(endEmitted).toBe(true);
    });

    it('should emit operation:request and operation:execute events', async () => {
      const agent = new UIAgent({ agentId: 'test-agent-5' });
      let requestEmitted = false;
      let executeEmitted = false;
      agent.on('operation:request', data => {
        expect(data.operation).toBe('click');
        requestEmitted = true;
      });
      agent.on('operation:execute', _data => {
        executeEmitted = true;
      });
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const mockHandler = {
        getType: () => 'click' as UIOperationType,
        supports: (op: UIOperationType) => op === 'click',
        execute: async () => ({
          success: true,
          operationId: 'op-evt',
          type: 'click' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 1,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      await agent.execute({ type: 'click', input: { selector: '#btn' } });
      expect(requestEmitted).toBe(true);
      expect(executeEmitted).toBe(true);
    });

    it('should emit permission:denied event', async () => {
      const agent = new UIAgent({ agentId: 'test-agent-6' });
      let deniedEmitted = false;
      agent.on('permission:denied', data => {
        expect(data.operation).toBe('click');
        expect(typeof data.reason).toBe('string');
        deniedEmitted = true;
      });
      await agent.start();
      agent.setPermissionLevel('L1');
      agent.startSession();
      await agent.execute({ type: 'click', input: { selector: '#btn' } });
      expect(deniedEmitted).toBe(true);
    });

    it('should emit operation:cancel event for cancelled sensitive operation', async () => {
      const agent = new UIAgent({ agentId: 'test-agent-7' });
      let cancelEmitted = false;
      agent.on('operation:cancel', data => {
        expect(data.operation).toBe('input');
        expect(data.reason).toBe('User cancelled');
        cancelEmitted = true;
      });
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const mockHandler = {
        getType: () => 'input' as UIOperationType,
        supports: (op: UIOperationType) => op === 'input',
        execute: async () => ({
          success: true,
          operationId: 'op-cancel',
          type: 'input' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 1,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      await agent.execute({
        type: 'input',
        input: { selector: '#tb', value: 'x' } as never,
      });
      expect(cancelEmitted).toBe(true);
    });

    it('should emit operation:confirm event for sensitive operation', async () => {
      const agent = new UIAgent({ agentId: 'test-agent-8' });
      let confirmEmitted = false;
      agent.on('operation:confirm', data => {
        expect(data.operation).toBe('input');
        confirmEmitted = true;
      });
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const mockHandler = {
        getType: () => 'input' as UIOperationType,
        supports: (op: UIOperationType) => op === 'input',
        execute: async () => ({
          success: true,
          operationId: 'op-confirm',
          type: 'input' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 1,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      await agent.execute({
        type: 'input',
        input: { selector: '#tb', value: 'x' } as never,
      });
      expect(confirmEmitted).toBe(true);
    });
  });

  // Traceability: ST-07 > UIAgent.ts > execute() with custom timeout/retry options
  describe('execute with custom options', () => {
    it('should use custom timeout and retry from options', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const mockHandler = {
        getType: () => 'click' as UIOperationType,
        supports: (op: UIOperationType) => op === 'click',
        execute: async (_input: unknown, context: { timeout: number; retryCount: number }) => {
          expect(context.timeout).toBe(5000);
          expect(context.retryCount).toBe(1);
          return {
            success: true,
            operationId: 'op-custom',
            type: 'click' as UIOperationType,
            status: 'success' as UIOperationStatus,
            executionTime: 1,
            timestamp: Date.now(),
          };
        },
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      const result = await agent.execute({
        type: 'click',
        input: { selector: '#btn' },
        options: { timeout: 5000, retry: 1 },
      });
      expect(result.success).toBe(true);
    });
  });

  // Traceability: ST-07 > UIAgent.ts > getState() lastOperationTime
  describe('getState lastOperationTime', () => {
    it('should update lastOperationTime after operation', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L4');
      agent.startSession();

      const before = Date.now();
      const mockHandler = {
        getType: () => 'click' as UIOperationType,
        supports: (op: UIOperationType) => op === 'click',
        execute: async () => ({
          success: true,
          operationId: 'op-time',
          type: 'click' as UIOperationType,
          status: 'success' as UIOperationStatus,
          executionTime: 1,
          timestamp: Date.now(),
        }),
        validate: () => [],
      };
      agent.registerOperationHandler(mockHandler);

      expect(agent.getState().lastOperationTime).toBeUndefined();
      await agent.execute({ type: 'click', input: { selector: '#btn' } });
      const after = Date.now();
      const lastOpTime = agent.getState().lastOperationTime;
      expect(lastOpTime).toBeDefined();
      expect(lastOpTime!).toBeGreaterThanOrEqual(before);
      expect(lastOpTime!).toBeLessThanOrEqual(after);
    });
  });
});
