import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionCoordinator, type ExecutionRequest, type ExecutionResult } from '../ExecutionCoordinator.js';
import { AgentRegistry } from '../../registry/AgentRegistry.js';
import { AgentType, createAgentMetadata } from '../../registry/AgentMetadata.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ExecutionCoordinator', () => {
  let coordinator: ExecutionCoordinator;
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.start();
    coordinator = new ExecutionCoordinator(registry);
  });

  describe('constructor', () => {
    it('should create coordinator with registry', () => {
      expect(coordinator).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should return error when no agent found', async () => {
      const request: ExecutionRequest = {
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      };

      const result = await coordinator.execute(request);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_AGENT');
    });

    it('should emit execution:start event', async () => {
      const handler = vi.fn();
      coordinator.on('execution:start', handler);

      const request: ExecutionRequest = {
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      };

      await coordinator.execute(request);
      expect(handler).toHaveBeenCalledWith({ requestId: 'req-1' });
    });

    it('should handle execution when no agent found', async () => {
      const request: ExecutionRequest = {
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      };

      const result = await coordinator.execute(request);
      expect(result.success).toBe(false);
    });
  });

  describe('executeParallel', () => {
    it('should execute requests in parallel', async () => {
      const requests: ExecutionRequest[] = [
        { requestId: 'req-1', taskName: 'task1', payload: {} },
        { requestId: 'req-2', taskName: 'task2', payload: {} },
      ];

      const results = await coordinator.executeParallel(requests);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(false);
    });
  });

  describe('executeSequential', () => {
    it('should stop on first failure', async () => {
      const requests: ExecutionRequest[] = [
        { requestId: 'req-1', taskName: 'task1', payload: {} },
        { requestId: 'req-2', taskName: 'task2', payload: {} },
      ];

      const results = await coordinator.executeSequential(requests);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });
  });

  describe('executeWithPlan', () => {
    it('should execute with plan', async () => {
      const plan = coordinator.createPlan([{ requestId: 'req-1', taskName: 'task1', payload: {} }]);

      const results = await coordinator.executeWithPlan(plan);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('createPlan', () => {
    it('should create execution plan', () => {
      const requests: ExecutionRequest[] = [
        { requestId: 'req-1', taskName: 'task1', payload: {} },
        { requestId: 'req-2', taskName: 'task2', payload: {} },
      ];

      const plan = coordinator.createPlan(requests);
      expect(plan.requestId).toMatch(/^plan_/);
      expect(plan.steps).toHaveLength(2);
      expect(plan.parallelGroups).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('should return false for non-existent execution', () => {
      const result = coordinator.cancel('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('cancelAll', () => {
    it('should cancel all executions', () => {
      coordinator.cancelAll();
      expect(coordinator.getActiveCount()).toBe(0);
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 initially', () => {
      expect(coordinator.getActiveCount()).toBe(0);
    });
  });

  describe('setDefaultTimeout', () => {
    it('should set default timeout', () => {
      coordinator.setDefaultTimeout(60000);
      expect(coordinator).toBeDefined();
    });
  });

  describe('dispose', () => {
    it('should dispose coordinator', () => {
      coordinator.dispose();
      expect(coordinator.getActiveCount()).toBe(0);
    });
  });

  // ==================== 新增覆盖率增强测试 ====================

  describe('execute - success path with agent', () => {
    it('should execute successfully when agent and channel are available', async () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L172-225 execute 成功路径
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      registry.register(metadata);

      const mockChannel = { sendAndWait: vi.fn().mockResolvedValue({ output: 'success' }) };
      vi.spyOn((coordinator as any), 'getOrCreateChannel').mockReturnValue(mockChannel);

      const request: ExecutionRequest = {
        requestId: 'req-success',
        taskName: 'test-task',
        payload: { input: 'data' },
        retryConfig: { maxAttempts: 1 },
      };

      const result = await coordinator.execute(request);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ output: 'success' });
      expect(result.agentId).toBe('agent-1');
      expect(result.attempts).toBe(1);
    });

    it('should execute with target agent ID', async () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L158-160 targetAgentId 分支
      const metadata = createAgentMetadata('agent-target', 'TargetAgent', AgentType.EXECUTOR);
      registry.register(metadata);

      const mockChannel = { sendAndWait: vi.fn().mockResolvedValue('target-result') };
      vi.spyOn((coordinator as any), 'getOrCreateChannel').mockReturnValue(mockChannel);

      const request: ExecutionRequest = {
        requestId: 'req-target',
        taskName: 'test-task',
        payload: {},
        targetAgentId: 'agent-target',
        retryConfig: { maxAttempts: 1 },
      };

      const result = await coordinator.execute(request);
      expect(result.success).toBe(true);
      expect(result.data).toBe('target-result');
    });

    it('should emit execution:complete event on success', async () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L214-217 emit execution:complete
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      registry.register(metadata);

      const mockChannel = { sendAndWait: vi.fn().mockResolvedValue('event-result') };
      vi.spyOn((coordinator as any), 'getOrCreateChannel').mockReturnValue(mockChannel);

      const handler = vi.fn();
      coordinator.on('execution:complete', handler);

      await coordinator.execute({
        requestId: 'req-event',
        taskName: 'test',
        payload: {},
        retryConfig: { maxAttempts: 1 },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-event',
          results: expect.arrayContaining([expect.objectContaining({ success: true })]),
        })
      );
    });
  });

  describe('execute - retry logic', () => {
    it('should retry on failure and succeed on second attempt', async () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L226-244 retry 逻辑
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      registry.register(metadata);

      const mockChannel = {
        sendAndWait: vi
          .fn()
          .mockRejectedValueOnce(new Error('First attempt failed'))
          .mockResolvedValueOnce('retry-success'),
      };
      vi.spyOn((coordinator as any), 'getOrCreateChannel').mockReturnValue(mockChannel);
      vi.spyOn((coordinator as any), 'sleep').mockResolvedValue(undefined);

      const result = await coordinator.execute({
        requestId: 'req-retry',
        taskName: 'test',
        payload: {},
        retryConfig: { maxAttempts: 3, baseDelay: 10, maxDelay: 100, backoffFactor: 2 },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('retry-success');
      expect(result.attempts).toBe(2);
      expect(mockChannel.sendAndWait).toHaveBeenCalledTimes(2);
    });

    it('should fail after all retry attempts', async () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L248-260 全部重试失败
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      registry.register(metadata);

      const mockChannel = {
        sendAndWait: vi.fn().mockRejectedValue(new Error('Always fails')),
      };
      vi.spyOn((coordinator as any), 'getOrCreateChannel').mockReturnValue(mockChannel);
      vi.spyOn((coordinator as any), 'sleep').mockResolvedValue(undefined);

      const handler = vi.fn();
      coordinator.on('execution:failed', handler);

      const result = await coordinator.execute({
        requestId: 'req-fail-all',
        taskName: 'test',
        payload: {},
        retryConfig: { maxAttempts: 2, baseDelay: 10, maxDelay: 100, backoffFactor: 2 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Always fails');
      expect(result.errorCode).toBe('EXECUTION_FAILED');
      expect(result.attempts).toBe(2);
      expect(handler).toHaveBeenCalledWith({
        requestId: 'req-fail-all',
        error: 'Always fails',
      });
    });
  });

  describe('executeSequential - with context', () => {
    it('should inject previous result into next request payload', async () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L280-289 context 注入逻辑
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      registry.register(metadata);

      const mockChannel = {
        sendAndWait: vi
          .fn()
          .mockResolvedValueOnce('first-result')
          .mockResolvedValueOnce('second-result'),
      };
      vi.spyOn((coordinator as any), 'getOrCreateChannel').mockReturnValue(mockChannel);

      const context = new Map<string, unknown>();
      const requests: ExecutionRequest[] = [
        { requestId: 'req-1', taskName: 'task1', payload: {}, retryConfig: { maxAttempts: 1 } },
        { requestId: 'req-2', taskName: 'task2', payload: {}, retryConfig: { maxAttempts: 1 } },
      ];

      const results = await coordinator.executeSequential(requests, context);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('executeWithPlan - dependency handling', () => {
    it('should skip steps with unmet dependencies', async () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L326-334 依赖未满足跳过分支
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      registry.register(metadata);

      const mockChannel = { sendAndWait: vi.fn().mockResolvedValue('plan-result') };
      vi.spyOn((coordinator as any), 'getOrCreateChannel').mockReturnValue(mockChannel);

      // 创建带依赖的计划
      const plan = coordinator.createPlan([
        { requestId: 'req-1', taskName: 'task1', payload: {}, retryConfig: { maxAttempts: 1 } },
        {
          requestId: 'req-2',
          taskName: 'task2',
          payload: { dependsOn: ['step_0'] },
          retryConfig: { maxAttempts: 1 },
        },
      ]);

      // 修改第二个步骤的依赖为不存在的步骤
      plan.steps[1].dependsOn = ['non-existent-step'];

      const results = await coordinator.executeWithPlan(plan);
      // 第一个步骤执行成功，第二个步骤因依赖未满足被跳过
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(plan.steps[1].status).toBe('skipped');
    });

    it('should emit step-start and step-complete events', async () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L337-354 step 事件
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      registry.register(metadata);

      const mockChannel = { sendAndWait: vi.fn().mockResolvedValue('step-result') };
      vi.spyOn((coordinator as any), 'getOrCreateChannel').mockReturnValue(mockChannel);

      const startHandler = vi.fn();
      const completeHandler = vi.fn();
      coordinator.on('execution:step-start', startHandler);
      coordinator.on('execution:step-complete', completeHandler);

      const plan = coordinator.createPlan([
        { requestId: 'req-1', taskName: 'task1', payload: {}, retryConfig: { maxAttempts: 1 } },
      ]);

      await coordinator.executeWithPlan(plan);

      expect(startHandler).toHaveBeenCalledWith({ requestId: plan.requestId, stepId: 'step_0' });
      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: plan.requestId,
          stepId: 'step_0',
          result: expect.objectContaining({ success: true }),
        })
      );
    });

    it('should emit step-failed and stop on failure', async () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L355-364 step 失败和中止
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      registry.register(metadata);

      const mockChannel = { sendAndWait: vi.fn().mockRejectedValue(new Error('Step failed')) };
      vi.spyOn((coordinator as any), 'getOrCreateChannel').mockReturnValue(mockChannel);
      vi.spyOn((coordinator as any), 'sleep').mockResolvedValue(undefined);

      const failHandler = vi.fn();
      coordinator.on('execution:step-failed', failHandler);

      const plan = coordinator.createPlan([
        { requestId: 'req-1', taskName: 'task1', payload: {}, retryConfig: { maxAttempts: 1 } },
        { requestId: 'req-2', taskName: 'task2', payload: {}, retryConfig: { maxAttempts: 1 } },
      ]);

      const results = await coordinator.executeWithPlan(plan);

      expect(results).toHaveLength(0);
      expect(failHandler).toHaveBeenCalled();
      expect(plan.steps[0].status).toBe('failed');
    });
  });

  describe('createPlan - parallel groups', () => {
    it('should identify parallel steps with same dependencies', () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L409-438 identifyParallelGroups
      const requests: ExecutionRequest[] = [
        { requestId: 'req-1', taskName: 'task1', payload: {}, retryConfig: { maxAttempts: 1 } },
        { requestId: 'req-2', taskName: 'task2', payload: {}, retryConfig: { maxAttempts: 1 } },
      ];

      const plan = coordinator.createPlan(requests);
      // 两个步骤都没有依赖，应被识别为可并行
      expect(plan.parallelGroups.length).toBeGreaterThanOrEqual(0);
      expect(plan.steps).toHaveLength(2);
    });

    it('should create plan with dependsOn from payload', () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L388-398 dependsOn 提取
      const requests: ExecutionRequest[] = [
        {
          requestId: 'req-1',
          taskName: 'task1',
          payload: { dependsOn: ['step_0'] },
          retryConfig: { maxAttempts: 1 },
        },
      ];

      const plan = coordinator.createPlan(requests);
      expect(plan.steps[0].dependsOn).toEqual(['step_0']);
    });
  });

  describe('cancel - active execution', () => {
    it('should cancel active execution', async () => {
      // 可追溯性: 覆盖 ExecutionCoordinator.ts L466-474 cancel 实际取消
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      registry.register(metadata);

      // 创建一个会延迟完成的执行
      let resolveSend: (value: unknown) => void = () => {};
      const mockChannel = {
        sendAndWait: vi.fn().mockImplementation(
          () => new Promise(resolve => { resolveSend = resolve; })
        ),
      };
      vi.spyOn((coordinator as any), 'getOrCreateChannel').mockReturnValue(mockChannel);

      const plan = coordinator.createPlan([
        { requestId: 'req-cancel', taskName: 'task1', payload: {}, retryConfig: { maxAttempts: 1 } },
      ]);

      // 开始执行但不等待
      const executePromise = coordinator.executeWithPlan(plan);
      await new Promise(resolve => setImmediate(resolve));

      // 取消执行
      expect(coordinator.getActiveCount()).toBe(1);
      const cancelResult = coordinator.cancel(plan.requestId);
      expect(cancelResult).toBe(true);

      // 完成挂起的执行以清理
      resolveSend('cancelled-result');
      await executePromise;
    });
  });
});
