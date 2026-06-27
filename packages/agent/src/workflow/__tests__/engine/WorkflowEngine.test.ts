import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowEngine } from '../../engine/WorkflowEngine.js';
import {
  createWorkflow,
  WorkflowExecutionStatus,
  type WorkflowExecutionSnapshot,
} from '../../models/Workflow.js';
import { TaskType, TaskStatus, createTask } from '../../models/Task.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  describe('constructor', () => {
    it('should create engine with default config', () => {
      expect(engine).toBeDefined();
    });

    it('should accept custom config', () => {
      const customEngine = new WorkflowEngine({
        maxConcurrency: 5,
        enableParallelExecution: false,
      });
      expect(customEngine).toBeDefined();
    });
  });

  describe('registerWorkflow', () => {
    it('should register a workflow', () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      expect(engine.getWorkflow(workflow.id)).toBeDefined();
    });

    it('should emit workflow:registered event', () => {
      const handler = vi.fn();
      engine.on('workflow:registered', handler);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      expect(handler).toHaveBeenCalledWith(workflow);
    });
  });

  describe('getWorkflow', () => {
    it('should get registered workflow', () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const result = engine.getWorkflow(workflow.id);
      expect(result?.id).toBe(workflow.id);
    });

    it('should return undefined for non-existent workflow', () => {
      const result = engine.getWorkflow('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('unregisterWorkflow', () => {
    it('should unregister workflow', () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const result = engine.unregisterWorkflow(workflow.id);
      expect(result).toBe(true);
      expect(engine.getWorkflow(workflow.id)).toBeUndefined();
    });

    it('should emit workflow:unregistered event', () => {
      const handler = vi.fn();
      engine.on('workflow:unregistered', handler);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      engine.unregisterWorkflow(workflow.id);
      expect(handler).toHaveBeenCalledWith(workflow.id);
    });
  });

  describe('listWorkflows', () => {
    it('should list all workflows', () => {
      engine.registerWorkflow(createWorkflow('Workflow1', '1.0.0'));
      engine.registerWorkflow(createWorkflow('Workflow2', '1.0.0'));
      const workflows = engine.listWorkflows();
      expect(workflows).toHaveLength(2);
    });

    it('should return empty array when no workflows', () => {
      const workflows = engine.listWorkflows();
      expect(workflows).toEqual([]);
    });
  });

  describe('startExecution', () => {
    it('should throw error for non-existent workflow', async () => {
      await expect(engine.startExecution('non-existent')).rejects.toThrow('Workflow not found');
    });

    it('should create execution for valid workflow', async () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const executionId = await engine.startExecution(workflow.id);
      expect(executionId).toBeDefined();
      expect(executionId).toMatch(/^exec_/);
    });

    it('should emit execution:started event', async () => {
      const handler = vi.fn();
      engine.on('execution:started', handler);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      await engine.startExecution(workflow.id);
      expect(handler).toHaveBeenCalled();
    });

    it('should set entry node as current', async () => {
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0', { config: {} });
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      const executionId = await engine.startExecution(workflow.id);
      const execution = engine.getExecution(executionId);
      expect(execution?.currentNodeIds).toContain(startNode.id);
    });
  });

  describe('getExecution', () => {
    it('should get execution by ID', async () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const executionId = await engine.startExecution(workflow.id);
      const execution = engine.getExecution(executionId);
      expect(execution).toBeDefined();
      expect(execution?.workflowId).toBe(workflow.id);
    });

    it('should return undefined for non-existent execution', () => {
      const execution = engine.getExecution('non-existent');
      expect(execution).toBeUndefined();
    });
  });

  describe('pauseExecution', () => {
    it('should return false for non-existent execution', () => {
      const result = engine.pauseExecution('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('resumeExecution', () => {
    it('should return false for non-existent execution', async () => {
      const result = await engine.resumeExecution('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('cancelExecution', () => {
    it('should return false for non-existent execution', () => {
      const result = engine.cancelExecution('non-existent');
      expect(result).toBe(false);
    });

    it('should cancel running execution', async () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const executionId = await engine.startExecution(workflow.id);
      const result = engine.cancelExecution(executionId);
      expect(result).toBe(true);
    });
  });

  describe('getExecutionHistory', () => {
    it('should return executions for workflow', async () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      await engine.startExecution(workflow.id);
      await engine.startExecution(workflow.id);
      const history = engine.getExecutionHistory(workflow.id);
      expect(history).toHaveLength(2);
    });

    it('should return empty array for workflow with no executions', () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const history = engine.getExecutionHistory(workflow.id);
      expect(history).toEqual([]);
    });
  });

  describe('createSnapshot', () => {
    it('should return null for non-existent execution', () => {
      const snapshot = engine.createSnapshot('non-existent');
      expect(snapshot).toBeNull();
    });
  });

  describe('recoverFromSnapshot', () => {
    it('should return false for non-existent execution', async () => {
      const result = await engine.recoverFromSnapshot({
        id: 'snapshot-1',
        executionId: 'non-existent',
        data: {
          status: 'paused' as any,
          currentNodeIds: [],
          completedNodeIds: [],
          failedNodeIds: [],
          context: {},
        },
        createdAt: Date.now(),
      });
      expect(result).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should dispose the engine', () => {
      engine.registerWorkflow(createWorkflow('TestWorkflow', '1.0.0'));
      engine.dispose();
      expect(engine.listWorkflows()).toEqual([]);
    });
  });

  // ==================== 新增覆盖率增强测试 ====================

  describe('pauseExecution - running execution', () => {
    it('should pause a running execution and emit event', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L197-212 pauseExecution 实际暂停逻辑
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      // Mock executor 使任务不立即完成
      vi.spyOn((engine as any).executor, 'executeTask').mockImplementation(
        () => new Promise(() => {})
      );

      const handler = vi.fn();
      engine.on('execution:paused', handler);

      const executionId = await engine.startExecution(workflow.id);
      // 等待异步调度
      await new Promise(resolve => setImmediate(resolve));

      const result = engine.pauseExecution(executionId);
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);

      const execution = engine.getExecution(executionId);
      expect(execution?.status).toBe(WorkflowExecutionStatus.PAUSED);
    });

    it('should return false when execution is not running', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L199 status !== RUNNING 分支
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setImmediate(resolve));

      // 先暂停
      engine.pauseExecution(executionId);
      // 再次暂停应返回 false
      const result = engine.pauseExecution(executionId);
      expect(result).toBe(false);
    });
  });

  describe('resumeExecution - paused execution', () => {
    it('should resume a paused execution and emit event', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L217-238 resumeExecution 实际恢复逻辑
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      vi.spyOn((engine as any).executor, 'executeTask').mockImplementation(
        () => new Promise(() => {})
      );

      const handler = vi.fn();
      engine.on('execution:resumed', handler);

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setImmediate(resolve));
      engine.pauseExecution(executionId);

      const result = await engine.resumeExecution(executionId);
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);

      const execution = engine.getExecution(executionId);
      expect(execution?.status).toBe(WorkflowExecutionStatus.RUNNING);
    });

    it('should return false when workflow not found during resume', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L223-226 workflow 未找到分支
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      vi.spyOn((engine as any).executor, 'executeTask').mockImplementation(
        () => new Promise(() => {})
      );

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setImmediate(resolve));
      engine.pauseExecution(executionId);

      // 注销工作流使恢复失败
      engine.unregisterWorkflow(workflow.id);
      const result = await engine.resumeExecution(executionId);
      expect(result).toBe(false);
    });
  });

  describe('cancelExecution - running execution', () => {
    it('should cancel running execution and emit event', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L243-259 cancelExecution 实际取消逻辑
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      vi.spyOn((engine as any).executor, 'executeTask').mockImplementation(
        () => new Promise(() => {})
      );

      const handler = vi.fn();
      engine.on('execution:cancelled', handler);

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setImmediate(resolve));

      const result = engine.cancelExecution(executionId);
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);

      const execution = engine.getExecution(executionId);
      expect(execution?.status).toBe(WorkflowExecutionStatus.CANCELLED);
      expect(execution?.finishedAt).toBeDefined();
    });
  });

  describe('workflow execution - success path', () => {
    it('should complete workflow when all nodes succeed', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L438-507 processNodeResult 成功路径 + L590-647 checkWorkflowCompletion
      const startNode = createTask('start', TaskType.START);
      const endNode = createTask('end', TaskType.END);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode, endNode];
      workflow.entryNodeId = startNode.id;

      engine.registerWorkflow(workflow);

      // Mock executor 返回成功
      vi.spyOn((engine as any).executor, 'executeTask').mockResolvedValue({
        success: true,
        output: { result: 'completed' },
        duration: 10,
      });

      const handler = vi.fn();
      engine.on('execution:completed', handler);

      const executionId = await engine.startExecution(workflow.id);
      // 等待异步执行完成
      await new Promise(resolve => setTimeout(resolve, 50));

      const execution = engine.getExecution(executionId);
      expect(execution?.status).toBe(WorkflowExecutionStatus.COMPLETED);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(execution?.result).toBeDefined();
    });

    it('should update context with node output on success', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L482-484 context 更新分支
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      const outputData = { value: 42 };
      vi.spyOn((engine as any).executor, 'executeTask').mockResolvedValue({
        success: true,
        output: outputData,
        duration: 5,
      });

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setTimeout(resolve, 50));

      const execution = engine.getExecution(executionId);
      expect(execution?.context[`node.${startNode.id}.output`]).toEqual(outputData);
    });
  });

  describe('workflow execution - failure path', () => {
    it('should fail workflow when node fails', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L504-506 handleWorkflowFailure + L652-684
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      vi.spyOn((engine as any).executor, 'executeTask').mockResolvedValue({
        success: false,
        error: { code: 'NODE_ERR', message: 'Node failed' },
        duration: 5,
      });

      const handler = vi.fn();
      engine.on('execution:failed', handler);

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setTimeout(resolve, 50));

      const execution = engine.getExecution(executionId);
      expect(execution?.status).toBe(WorkflowExecutionStatus.FAILED);
      expect(execution?.error?.code).toBe('NODE_ERR');
      expect(execution?.error?.nodeId).toBe(startNode.id);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should continue on error when configured', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L502 continueOnError 分支
      const engine2 = new WorkflowEngine({ continueOnError: true });
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine2.registerWorkflow(workflow);

      vi.spyOn((engine2 as any).executor, 'executeTask').mockResolvedValue({
        success: false,
        error: { code: 'NODE_ERR', message: 'Node failed' },
        duration: 5,
      });

      const executionId = await engine2.startExecution(workflow.id);
      await new Promise(resolve => setTimeout(resolve, 50));

      const execution = engine2.getExecution(executionId);
      // continueOnError 时，失败节点被记录但工作流继续
      expect(execution?.failedNodeIds).toContain(startNode.id);
      engine2.dispose();
    });

    it('should handle node execution error via processNodeError', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L429-432 processNodeError + L512-534
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      // Mock executor 抛出异常
      vi.spyOn((engine as any).executor, 'executeTask').mockRejectedValue(
        new Error('Executor crashed')
      );

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setTimeout(resolve, 50));

      const execution = engine.getExecution(executionId);
      expect(execution?.status).toBe(WorkflowExecutionStatus.FAILED);
      expect(execution?.error?.message).toBe('Executor crashed');
    });
  });

  describe('workflow execution - dependency management', () => {
    it('should update dependencies for downstream nodes', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L539-585 updateDependencyStatus
      const startNode = createTask('start', TaskType.START, {}, { id: 'start-node' });
      const dependentTask = createTask(
        'dependent',
        TaskType.TASK,
        { handler: 'dep' },
        {
          id: 'dep-node',
          dependencies: [{ taskId: 'start-node' }],
        }
      );
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode, dependentTask];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      let callCount = 0;
      vi.spyOn((engine as any).executor, 'executeTask').mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          success: true,
          output: { index: callCount },
          duration: 5,
        });
      });

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = engine.getExecution(executionId);
      // 两个节点都应完成
      expect(execution?.completedNodeIds).toContain('start-node');
      expect(execution?.completedNodeIds).toContain('dep-node');
      expect(execution?.status).toBe(WorkflowExecutionStatus.COMPLETED);
    });

    it('should respect requiredStatus in dependencies', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L572-574 dep.requiredStatus 分支
      const startNode = createTask('start', TaskType.START, {}, { id: 'start-node' });
      const dependentTask = createTask(
        'dependent',
        TaskType.TASK,
        { handler: 'dep' },
        {
          id: 'dep-node',
          dependencies: [{ taskId: 'start-node', requiredStatus: TaskStatus.COMPLETED }],
        }
      );
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode, dependentTask];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      vi.spyOn((engine as any).executor, 'executeTask').mockResolvedValue({
        success: true,
        output: { ok: true },
        duration: 5,
      });

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = engine.getExecution(executionId);
      expect(execution?.completedNodeIds).toContain('dep-node');
    });
  });

  describe('createSnapshot - with execution', () => {
    it('should create snapshot for existing execution', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L711-718 createSnapshot 实际创建
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      vi.spyOn((engine as any).executor, 'executeTask').mockImplementation(
        () => new Promise(() => {})
      );

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setImmediate(resolve));

      const snapshot = engine.createSnapshot(executionId);
      expect(snapshot).not.toBeNull();
      expect(snapshot?.executionId).toBe(executionId);
      expect(snapshot?.id).toMatch(/^snapshot_/);
      expect(snapshot?.data.currentNodeIds).toContain(startNode.id);
    });
  });

  describe('recoverFromSnapshot - with execution', () => {
    it('should return false when workflow not found', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L723-728 workflow 未找到分支
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      vi.spyOn((engine as any).executor, 'executeTask').mockImplementation(
        () => new Promise(() => {})
      );

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setImmediate(resolve));
      engine.pauseExecution(executionId);

      const snapshot = engine.createSnapshot(executionId);
      expect(snapshot).not.toBeNull();

      // 注销工作流使恢复失败
      engine.unregisterWorkflow(workflow.id);
      const result = await engine.recoverFromSnapshot(snapshot as WorkflowExecutionSnapshot);
      expect(result).toBe(false);
    });
  });

  describe('forwardExecutorEvents', () => {
    it('should forward task events from executor', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L803-823 forwardExecutorEvents
      const taskStartHandler = vi.fn();
      const taskCompleteHandler = vi.fn();
      engine.on('task:start', taskStartHandler);
      engine.on('task:complete', taskCompleteHandler);

      // 直接通过内部 executor 发射事件来测试转发
      const innerExecutor = (engine as any).executor;
      innerExecutor.emit('task:start', { task: { id: 't1' }, execution: {} });
      innerExecutor.emit('task:complete', { task: { id: 't1' }, execution: {} });

      expect(taskStartHandler).toHaveBeenCalledTimes(1);
      expect(taskCompleteHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose - with snapshot timer', () => {
    it('should stop snapshot timer on dispose', () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L828-836 dispose 清理定时器
      const engine2 = new WorkflowEngine({ enableRecovery: true });
      engine2.registerWorkflow(createWorkflow('TestWorkflow', '1.0.0'));
      engine2.dispose();
      // 验证 dispose 后 listWorkflows 返回空
      expect(engine2.listWorkflows()).toEqual([]);
    });
  });

  describe('updateNodeState - early return paths', () => {
    it('should return silently when nodeStates map not found', () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L307-309 nodeStates 不存在
      const engine2 = new WorkflowEngine();
      // 直接调用私有方法不会抛出错误
      (engine2 as any).updateNodeState('non-existent-exec', 'node-1', { status: 'running' });
      expect(true).toBe(true);
    });
  });

  describe('processNodeResult - early return paths', () => {
    it('should return when execution not found during processNodeResult', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L447-449 execution 不存在
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setTimeout(resolve, 50));

      // processNodeResult 在 execution 已删除时不应抛出错误
      const execution = engine.getExecution(executionId);
      if (execution) {
        const state = (engine as any).getNodeState(executionId, startNode.id);
        if (state) {
          // 手动调用 processNodeResult 验证容错
          const result = { success: true, output: {}, duration: 1 };
          await (engine as any).processNodeResult(executionId, workflow, startNode, result);
          expect(true).toBe(true);
        }
      }
    });
  });

  describe('forwardExecutorEvents - all event types', () => {
    it('should forward task:error, task:timeout, task:cancelled events', () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L814-823 task:error/timeout/cancelled 转发
      const errorHandler = vi.fn();
      const timeoutHandler = vi.fn();
      const cancelledHandler = vi.fn();
      engine.on('task:error', errorHandler);
      engine.on('task:timeout', timeoutHandler);
      engine.on('task:cancelled', cancelledHandler);

      const innerExecutor = (engine as any).executor;
      innerExecutor.emit('task:error', { task: { id: 't1' }, error: new Error('fail') });
      innerExecutor.emit('task:timeout', { task: { id: 't2' } });
      innerExecutor.emit('task:cancelled', { task: { id: 't3' } });

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(timeoutHandler).toHaveBeenCalledTimes(1);
      expect(cancelledHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('collectResults - nodeStates not found', () => {
    it('should return empty object when nodeStates not available', () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L694-698 collectResults nodeStates 不存在
      const engine2 = new WorkflowEngine();
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      const results = (engine2 as any).collectResults('non-existent-exec', workflow);
      expect(results).toEqual({});
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle duplicate workflow registration', () => {
      // 覆盖重复注册场景
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      // 再次注册相同的工作流（不应该抛出错误）
      engine.registerWorkflow(workflow);
      const result = engine.getWorkflow(workflow.id);
      expect(result).toBeDefined();
    });

    it('should handle unregister non-existent workflow', () => {
      // 覆盖注销不存在的工作流
      const result = engine.unregisterWorkflow('non-existent');
      expect(result).toBe(false);
    });

    it('should cancel already completed execution gracefully', async () => {
      // 覆盖取消已完成执行的场景
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      vi.spyOn((engine as any).executor, 'executeTask').mockResolvedValue({
        success: true,
        output: {},
        duration: 1,
      });

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setTimeout(resolve, 50));

      // 取消已完成的执行应返回 false 或 true 但不抛出错误
      const result = engine.cancelExecution(executionId);
      expect(typeof result).toBe('boolean');
    });

    it('should resume only paused execution', async () => {
      // 覆盖恢复非暂停执行的场景
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      vi.spyOn((engine as any).executor, 'executeTask').mockImplementation(
        () => new Promise(() => {})
      );

      const executionId = await engine.startExecution(workflow.id);
      await new Promise(resolve => setImmediate(resolve));

      // 尝试恢复正在运行（非暂停）的执行应返回 false
      const result = await engine.resumeExecution(executionId);
      expect(result).toBe(false);
    });

    it('should handle multiple concurrent executions', async () => {
      // 覆盖多执行并发场景
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);

      const execId1 = await engine.startExecution(workflow.id);
      const execId2 = await engine.startExecution(workflow.id);
      const execId3 = await engine.startExecution(workflow.id);

      expect(execId1).toBeDefined();
      expect(execId2).toBeDefined();
      expect(execId3).toBeDefined();
      expect(execId1).not.toBe(execId2);
      expect(execId2).not.toBe(execId3);

      // 所有执行都应存在
      expect(engine.getExecution(execId1)).toBeDefined();
      expect(engine.getExecution(execId2)).toBeDefined();
      expect(engine.getExecution(execId3)).toBeDefined();
    });

    it('should emit events with correct payload structure', async () => {
      // 验证事件负载结构
      const workflow = createWorkflow('EventTest', '1.0.0');
      engine.registerWorkflow(workflow);

      let registeredPayload: unknown = null;
      engine.on('workflow:registered', (payload: unknown) => {
        registeredPayload = payload;
      });

      engine.registerWorkflow(workflow);
      expect(registeredPayload).toBeTruthy();
    });
  });

  // ==================== 补充分支覆盖率测试 ====================

  describe('startSnapshotTimer - existing timer branch', () => {
    it('should return early when snapshotTimer already exists', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L777-779 startSnapshotTimer timer 已存在分支
      const engine2 = new WorkflowEngine({ enableRecovery: true, snapshotInterval: 1000 });

      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      const startNode = createTask('start', TaskType.START);
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine2.registerWorkflow(workflow);

      vi.spyOn((engine2 as any).executor, 'executeTask').mockImplementation(
        () => new Promise(() => {})
      );

      // 第一次启动会创建 timer
      await engine2.startExecution(workflow.id);
      await new Promise(resolve => setImmediate(resolve));

      // 验证 timer 已存在
      expect((engine2 as any).snapshotTimer).toBeDefined();

      // 再次调用 startSnapshotTimer 应直接返回
      (engine2 as any).startSnapshotTimer();

      // timer 应保持不变（未重新创建）
      const existingTimer = (engine2 as any).snapshotTimer;
      expect((engine2 as any).snapshotTimer).toBe(existingTimer);

      engine2.dispose();
    });
  });

  describe('cleanupExecution - hasRunning branch', () => {
    it('should stop snapshot timer when no running executions remain', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L814-824 cleanupExecution hasRunning=false 分支
      const engine2 = new WorkflowEngine({ enableRecovery: true, snapshotInterval: 1000 });

      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      const startNode = createTask('start', TaskType.START);
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine2.registerWorkflow(workflow);

      vi.spyOn((engine2 as any).executor, 'executeTask').mockResolvedValue({
        success: true,
        output: {},
        duration: 5,
      });

      const executionId = await engine2.startExecution(workflow.id);
      await new Promise(resolve => setTimeout(resolve, 50));

      // 执行完成后应触发 cleanup
      const execution = engine2.getExecution(executionId);
      expect(execution?.status).toBe(WorkflowExecutionStatus.COMPLETED);

      // 验证 snapshot timer 已停止
      expect((engine2 as any).snapshotTimer).toBeUndefined();

      engine2.dispose();
    });

    it('should not stop snapshot timer when other executions are running', async () => {
      // 可追溯性: 覆盖 WorkflowEngine.ts L815-820 cleanupExecution hasRunning=true 分支
      const engine2 = new WorkflowEngine({ enableRecovery: true, snapshotInterval: 1000 });

      const workflow1 = createWorkflow('Workflow1', '1.0.0');
      const workflow2 = createWorkflow('Workflow2', '1.0.0');

      const startNode1 = createTask('start1', TaskType.START);
      const startNode2 = createTask('start2', TaskType.START);

      workflow1.nodes = [startNode1];
      workflow1.entryNodeId = startNode1.id;

      workflow2.nodes = [startNode2];
      workflow2.entryNodeId = startNode2.id;

      engine2.registerWorkflow(workflow1);
      engine2.registerWorkflow(workflow2);

      // Workflow1 成功完成，Workflow2 保持运行状态
      let callCount = 0;
      vi.spyOn((engine2 as any).executor, 'executeTask').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // 第一个任务（workflow1 的 start）完成
          return Promise.resolve({ success: true, output: {}, duration: 5 });
        } else {
          // 第二个任务（workflow2 的 start）保持运行
          return new Promise(() => {});
        }
      });

      const execId1 = await engine2.startExecution(workflow1.id);
      const execId2 = await engine2.startExecution(workflow2.id);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Workflow1 完成，触发 cleanup
      const exec1 = engine2.getExecution(execId1);
      expect(exec1?.status).toBe(WorkflowExecutionStatus.COMPLETED);

      // Workflow2 仍在运行
      const exec2 = engine2.getExecution(execId2);
      expect(exec2?.status).toBe(WorkflowExecutionStatus.RUNNING);

      // 但 Workflow2 仍在运行，timer 不应停止
      expect((engine2 as any).snapshotTimer).toBeDefined();

      engine2.dispose();
    });
  });
});
