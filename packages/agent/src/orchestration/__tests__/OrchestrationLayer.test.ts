import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OrchestrationLayer,
  createOrchestrationLayer,
  OrchestrationPlanStatus,
  OrchestrationStrategy,
  type OrchestrationRequest,
} from '../OrchestrationLayer.js';
import { AgentRegistry } from '../../registry/AgentRegistry.js';
import { ExecutionCoordinator, type ExecutionResult } from '../ExecutionCoordinator.js';
import { AgentType, createAgentMetadata } from '../../registry/AgentMetadata.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('OrchestrationLayer', () => {
  let layer: OrchestrationLayer;
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.start();
    layer = new OrchestrationLayer(registry);
  });

  describe('constructor', () => {
    it('should create orchestration layer', () => {
      expect(layer).toBeDefined();
    });

    it('should accept custom coordinator', () => {
      const coordinator = new ExecutionCoordinator(registry);
      const customLayer = new OrchestrationLayer(registry, coordinator);
      expect(customLayer).toBeDefined();
    });
  });

  describe('registerAgent', () => {
    it('should register agent', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      expect(layer.getAgent('agent-1')).toBeDefined();
    });

    it('should emit agent:registered event', () => {
      const handler = vi.fn();
      layer.on('agent:registered', handler);
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      expect(handler).toHaveBeenCalledWith({ agentId: 'agent-1' });
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister agent', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      const result = layer.unregisterAgent('agent-1');
      expect(result).toBe(true);
      expect(layer.getAgent('agent-1')).toBeUndefined();
    });

    it('should emit agent:unregistered event', () => {
      const handler = vi.fn();
      layer.on('agent:unregistered', handler);
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      layer.unregisterAgent('agent-1');
      expect(handler).toHaveBeenCalledWith({ agentId: 'agent-1' });
    });
  });

  describe('getAgent', () => {
    it('should get registered agent', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      const agent = layer.getAgent('agent-1');
      expect(agent?.id).toBe('agent-1');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = layer.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('listAgents', () => {
    it('should list all agents', () => {
      layer.registerAgent(createAgentMetadata('agent-1', 'Agent1', AgentType.EXECUTOR));
      layer.registerAgent(createAgentMetadata('agent-2', 'Agent2', AgentType.PLANNER));
      const agents = layer.listAgents();
      expect(agents).toHaveLength(2);
    });
  });

  describe('orchestrate', () => {
    it('should return error when max concurrent reached', async () => {
      const limitedLayer = new OrchestrationLayer(registry, undefined, {
        maxConcurrentOrchestrations: 0,
      });

      const result = await limitedLayer.orchestrate({
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MAX_CONCURRENT');
    });

    it('should emit orchestration:start event', async () => {
      const handler = vi.fn();
      layer.on('orchestration:start', handler);

      await layer.orchestrate({
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      });

      expect(handler).toHaveBeenCalledWith({ requestId: 'req-1' });
    });

    it('should handle orchestration failure', async () => {
      const result = await layer.orchestrate({
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      });

      expect(result.success).toBe(false);
    });
  });

  describe('createPlan', () => {
    it('should create orchestration plan', () => {
      const plan = layer.createPlan([
        { requestId: 'req-1', taskName: 'task1', payload: {} },
        { requestId: 'req-2', taskName: 'task2', payload: {} },
      ]);

      expect(plan.planId).toMatch(/^orchestration_plan_/);
      expect(plan.status).toBe(OrchestrationPlanStatus.PENDING);
    });
  });

  describe('getOrchestrationPlan', () => {
    it('should get plan by ID', () => {
      const createdPlan = layer.createPlan([
        { requestId: 'req-1', taskName: 'task1', payload: {} },
      ]);

      const plan = layer.getOrchestrationPlan(createdPlan.planId);
      expect(plan?.planId).toBe(createdPlan.planId);
    });

    it('should return undefined for non-existent plan', () => {
      const plan = layer.getOrchestrationPlan('non-existent');
      expect(plan).toBeUndefined();
    });
  });

  describe('listPlans', () => {
    it('should list all plans', () => {
      layer.createPlan([{ requestId: 'req-1', taskName: 'task1', payload: {} }]);
      layer.createPlan([{ requestId: 'req-2', taskName: 'task2', payload: {} }]);
      const plans = layer.listPlans();
      expect(plans).toHaveLength(2);
    });
  });

  describe('pause', () => {
    it('should return false for non-existent plan', () => {
      const result = layer.pause('non-existent');
      expect(result).toBe(false);
    });

    it('should pause plan', () => {
      const plan = layer.createPlan([{ requestId: 'req-1', taskName: 'task1', payload: {} }]);

      const result = layer.pause(plan.planId);
      expect(result).toBe(true);
    });
  });

  describe('resume', () => {
    it('should return error for non-existent plan', async () => {
      const result = await layer.resume('non-existent');
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PLAN_NOT_FOUND');
    });
  });

  describe('cancel', () => {
    it('should return false for non-existent orchestration', () => {
      const result = layer.cancel('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('cancelAll', () => {
    it('should cancel all orchestrations', () => {
      layer.cancelAll();
      expect(layer.getActiveCount()).toBe(0);
    });
  });

  describe('selectAgent', () => {
    it('should return null when no agents available', () => {
      const agent = layer.selectAgent();
      expect(agent).toBeNull();
    });

    it('should select agent with capability', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      const agent = layer.selectAgent();
      expect(agent).toBeDefined();
    });
  });

  describe('getAvailableAgents', () => {
    it('should return available agents', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      const agents = layer.getAvailableAgents();
      expect(agents).toHaveLength(1);
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 initially', () => {
      expect(layer.getActiveCount()).toBe(0);
    });
  });

  describe('isActive', () => {
    it('should return false for non-active request', () => {
      expect(layer.isActive('non-existent')).toBe(false);
    });
  });

  describe('getCoordinator', () => {
    it('should return coordinator', () => {
      const coordinator = layer.getCoordinator();
      expect(coordinator).toBeDefined();
    });
  });

  describe('getRegistry', () => {
    it('should return registry', () => {
      const reg = layer.getRegistry();
      expect(reg).toBeDefined();
    });
  });

  describe('dispose', () => {
    it('should dispose orchestration layer', () => {
      layer.dispose();
      expect(layer.listAgents()).toEqual([]);
      expect(layer.listPlans()).toEqual([]);
    });
  });

  describe('createOrchestrationLayer', () => {
    it('should create orchestration layer with defaults', () => {
      const createdLayer = createOrchestrationLayer(registry);
      expect(createdLayer).toBeDefined();
      createdLayer.dispose();
    });
  });

  // ==================== 新增覆盖率增强测试 ====================

  describe('orchestrate - success path', () => {
    it('should return success when coordinator executes successfully', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L334-377 orchestrate 成功路径
      const successResult: ExecutionResult = {
        success: true,
        data: { output: 'done' },
        duration: 10,
        agentId: 'agent-1',
        attempts: 1,
      };
      vi.spyOn((layer as any).coordinator, 'execute').mockResolvedValue(successResult);

      const result = await layer.orchestrate({
        requestId: 'req-success',
        taskName: 'test-task',
        payload: {},
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({ totalCount: 1, successCount: 1 }));
      expect(result.agentId).toBe('agent-1');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return failure when coordinator returns failed result', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L368-373 success=false findError 分支
      const failResult: ExecutionResult = {
        success: false,
        error: 'Task execution failed',
        errorCode: 'TASK_FAILED',
        duration: 10,
        attempts: 1,
      };
      vi.spyOn((layer as any).coordinator, 'execute').mockResolvedValue(failResult);

      const result = await layer.orchestrate({
        requestId: 'req-fail',
        taskName: 'test-task',
        payload: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task execution failed');
    });

    it('should handle orchestration exception', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L378-385 catch 分支
      vi.spyOn((layer as any).coordinator, 'execute').mockRejectedValue(new Error('Coordinator crashed'));

      const result = await layer.orchestrate({
        requestId: 'req-exception',
        taskName: 'test-task',
        payload: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Coordinator crashed');
      expect(result.errorCode).toBe('ORCHESTRATION_ERROR');
    });
  });

  describe('orchestrate - with strategies', () => {
    it('should use SEQUENTIAL strategy for multiple tasks', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L356-357 SEQUENTIAL 分支
      const layer2 = new OrchestrationLayer(registry, undefined, { autoDecompose: true });
      const seqResults: ExecutionResult[] = [
        { success: true, data: 'r1', duration: 5, attempts: 1 },
        { success: true, data: 'r2', duration: 5, attempts: 1 },
      ];
      vi.spyOn((layer2 as any).coordinator, 'executeSequential').mockResolvedValue(seqResults);

      const result = await layer2.orchestrate({
        requestId: 'req-seq',
        taskName: 'parent-task',
        payload: {
          subTasks: [
            { subTaskId: 's1', taskName: 'sub1', payload: {}, dependsOn: [] },
            { subTaskId: 's2', taskName: 'sub2', payload: {}, dependsOn: [] },
          ],
        },
        strategy: OrchestrationStrategy.SEQUENTIAL,
      });

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(2);
      layer2.dispose();
    });

    it('should use PARALLEL strategy for multiple tasks', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L358-359 PARALLEL 分支
      const layer2 = new OrchestrationLayer(registry, undefined, { autoDecompose: true });
      const parResults: ExecutionResult[] = [
        { success: true, data: 'r1', duration: 5, attempts: 1 },
        { success: true, data: 'r2', duration: 5, attempts: 1 },
      ];
      vi.spyOn((layer2 as any).coordinator, 'executeParallel').mockResolvedValue(parResults);

      const result = await layer2.orchestrate({
        requestId: 'req-par',
        taskName: 'parent-task',
        payload: {
          subTasks: [
            { subTaskId: 's1', taskName: 'sub1', payload: {}, dependsOn: [] },
            { subTaskId: 's2', taskName: 'sub2', payload: {}, dependsOn: [] },
          ],
        },
        strategy: OrchestrationStrategy.PARALLEL,
      });

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(2);
      layer2.dispose();
    });

    it('should use AUTO strategy for multiple tasks', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L360-364 AUTO createPlan 分支
      const layer2 = new OrchestrationLayer(registry, undefined, { autoDecompose: true });
      const autoResults: ExecutionResult[] = [
        { success: true, data: 'r1', duration: 5, attempts: 1 },
        { success: true, data: 'r2', duration: 5, attempts: 1 },
      ];
      const mockPlan = { requestId: 'plan-1', steps: [], parallelGroups: [] };
      vi.spyOn((layer2 as any).coordinator, 'createPlan').mockReturnValue(mockPlan);
      vi.spyOn((layer2 as any).coordinator, 'executeWithPlan').mockResolvedValue(autoResults);

      const result = await layer2.orchestrate({
        requestId: 'req-auto',
        taskName: 'parent-task',
        payload: {
          subTasks: [
            { subTaskId: 's1', taskName: 'sub1', payload: {}, dependsOn: [] },
            { subTaskId: 's2', taskName: 'sub2', payload: {}, dependsOn: [] },
          ],
        },
        strategy: OrchestrationStrategy.AUTO,
      });

      expect(result.success).toBe(true);
      layer2.dispose();
    });
  });

  describe('orchestrate - with autoDecompose', () => {
    it('should decompose task with subTasks payload', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L337-340 autoDecompose + shouldDecompose + decomposeTask
      const layer2 = new OrchestrationLayer(registry, undefined, { autoDecompose: true });
      const results: ExecutionResult[] = [
        { success: true, data: 'sub1-result', duration: 5, attempts: 1 },
        { success: true, data: 'sub2-result', duration: 5, attempts: 1 },
      ];
      const mockPlan = { requestId: 'plan-decomp', steps: [], parallelGroups: [] };
      vi.spyOn((layer2 as any).coordinator, 'createPlan').mockReturnValue(mockPlan);
      vi.spyOn((layer2 as any).coordinator, 'executeWithPlan').mockResolvedValue(results);

      const result = await layer2.orchestrate({
        requestId: 'req-decompose',
        taskName: 'parent',
        payload: {
          subTasks: [
            { subTaskId: 'st1', taskName: 'sub1', payload: { x: 1 }, dependsOn: [] },
            { subTaskId: 'st2', taskName: 'sub2', payload: { y: 2 }, dependsOn: ['st1'] },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({ totalCount: 2, successCount: 2 }));
      layer2.dispose();
    });

    it('should not decompose when autoDecompose is false', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L337 autoDecompose=false 分支
      const successResult: ExecutionResult = {
        success: true,
        data: 'single',
        duration: 5,
        attempts: 1,
      };
      vi.spyOn((layer as any).coordinator, 'execute').mockResolvedValue(successResult);

      const result = await layer.orchestrate({
        requestId: 'req-no-decompose',
        taskName: 'parent',
        payload: {
          subTasks: [
            { subTaskId: 'st1', taskName: 'sub1', payload: {}, dependsOn: [] },
          ],
        },
      });

      expect(result.success).toBe(true);
      // 单任务执行，不分解
      expect(result.stepResults).toHaveLength(1);
    });
  });

  describe('pause and resume - complete flow', () => {
    it('should pause and resume a plan', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L497-557 pause + resume 完整流程
      const plan = layer.createPlan([{ requestId: 'req-1', taskName: 'task1', payload: {} }]);

      // Pause
      const pauseResult = layer.pause(plan.planId);
      expect(pauseResult).toBe(true);
      expect(plan.status).toBe(OrchestrationPlanStatus.PAUSED);

      // Mock executeWithPlan for resume
      const results: ExecutionResult[] = [
        { success: true, data: 'resumed-result', duration: 10, attempts: 1 },
      ];
      vi.spyOn((layer as any).coordinator, 'executeWithPlan').mockResolvedValue(results);

      // Resume
      const resumeResult = await layer.resume(plan.planId);
      expect(resumeResult.success).toBe(true);
      expect(resumeResult.data).toEqual(expect.objectContaining({ totalCount: 1 }));
      expect(plan.status).toBe(OrchestrationPlanStatus.COMPLETED);
    });

    it('should return error when resuming non-paused plan', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L524-531 NOT_PAUSED 分支
      const plan = layer.createPlan([{ requestId: 'req-1', taskName: 'task1', payload: {} }]);

      const result = await layer.resume(plan.planId);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_PAUSED');
    });

    it('should handle resume failure', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L548-556 resume catch 分支
      const plan = layer.createPlan([{ requestId: 'req-1', taskName: 'task1', payload: {} }]);
      layer.pause(plan.planId);

      vi.spyOn((layer as any).coordinator, 'executeWithPlan').mockRejectedValue(new Error('Resume failed'));

      const result = await layer.resume(plan.planId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Resume failed');
      expect(result.errorCode).toBe('RESUME_FAILED');
      expect(plan.status).toBe(OrchestrationPlanStatus.FAILED);
    });
  });

  describe('cancel - active orchestration', () => {
    it('should cancel active orchestration', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L564-573 cancel 实际取消逻辑
      vi.spyOn((layer as any).coordinator, 'cancel').mockReturnValue(true);

      // 模拟活跃编排
      (layer as any).activeOrchestrations.set('req-cancel', {
        request: { requestId: 'req-cancel' } as OrchestrationRequest,
        startTime: Date.now(),
      });

      const result = layer.cancel('req-cancel');
      expect(result).toBe(true);
      expect(layer.isActive('req-cancel')).toBe(false);
    });
  });

  describe('event forwarding', () => {
    it('should forward execution:complete event', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L244-263 execution:complete 事件转发
      const handler = vi.fn();
      layer.on('orchestration:complete', handler);

      // 模拟活跃编排
      const requestId = 'req-fwd-complete';
      (layer as any).activeOrchestrations.set(requestId, {
        request: { requestId } as OrchestrationRequest,
        startTime: Date.now(),
      });

      // 触发 coordinator 的 execution:complete 事件
      (layer as any).coordinator.emit('execution:complete', {
        requestId,
        results: [{ success: true, data: 'ok', duration: 5, attempts: 1 }],
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId,
          result: expect.objectContaining({ success: true }),
        })
      );
    });

    it('should forward execution:failed event', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L265-271 execution:failed 事件转发
      const handler = vi.fn();
      layer.on('orchestration:failed', handler);

      const requestId = 'req-fwd-fail';
      (layer as any).activeOrchestrations.set(requestId, {
        request: { requestId } as OrchestrationRequest,
        startTime: Date.now(),
      });

      (layer as any).coordinator.emit('execution:failed', {
        requestId,
        error: 'Execution failed',
      });

      expect(handler).toHaveBeenCalledWith({ requestId, error: 'Execution failed' });
      expect(layer.isActive(requestId)).toBe(false);
    });

    it('should forward execution:step-start event', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L226-228 execution:step-start 事件转发
      const handler = vi.fn();
      layer.on('orchestration:step-start', handler);

      (layer as any).coordinator.emit('execution:step-start', {
        requestId: 'req-1',
        stepId: 'step-1',
      });

      expect(handler).toHaveBeenCalledWith({ requestId: 'req-1', stepId: 'step-1' });
    });

    it('should forward execution:step-complete event', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L230-235 execution:step-complete 事件转发
      const handler = vi.fn();
      layer.on('orchestration:step-complete', handler);

      const stepResult: ExecutionResult = { success: true, data: 'step-data', duration: 5, attempts: 1 };
      (layer as any).coordinator.emit('execution:step-complete', {
        requestId: 'req-1',
        stepId: 'step-1',
        result: stepResult,
      });

      expect(handler).toHaveBeenCalledWith({ requestId: 'req-1', stepId: 'step-1', result: stepResult });
    });

    it('should forward execution:step-failed event', async () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L237-242 execution:step-failed 事件转发
      const handler = vi.fn();
      layer.on('orchestration:step-failed', handler);

      (layer as any).coordinator.emit('execution:step-failed', {
        requestId: 'req-1',
        stepId: 'step-1',
        error: 'Step failed',
      });

      expect(handler).toHaveBeenCalledWith({ requestId: 'req-1', stepId: 'step-1', error: 'Step failed' });
    });
  });

  describe('unregisterAgent - failure path', () => {
    it('should return false when agent does not exist', () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L288-295 unregisterAgent success=false 分支
      const result = layer.unregisterAgent('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('selectAgent - with strategy', () => {
    it('should select agent with selection strategy', () => {
      // 可追溯性: 覆盖 OrchestrationLayer.ts L588-592 selectAgent 带策略
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);

      const agent = layer.selectAgent(undefined, {
        preferIdle: true,
        loadBalancing: true,
      });
      expect(agent).not.toBeNull();
      expect(agent?.id).toBe('agent-1');
    });
  });
});
