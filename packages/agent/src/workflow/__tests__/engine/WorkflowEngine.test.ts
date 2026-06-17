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
      const dependentTask = createTask('dependent', TaskType.TASK, { handler: 'dep' }, {
        id: 'dep-node',
        dependencies: [{ taskId: 'start-node' }],
      });
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
      const dependentTask = createTask('dependent', TaskType.TASK, { handler: 'dep' }, {
        id: 'dep-node',
        dependencies: [{ taskId: 'start-node', requiredStatus: TaskStatus.COMPLETED }],
      });
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
});
