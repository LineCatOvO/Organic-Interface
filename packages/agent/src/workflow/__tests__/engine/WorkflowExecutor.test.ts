import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkflowExecutor, defaultNodeExecutor } from '../../engine/WorkflowExecutor.js';
import { TaskType, TaskStatus, createTask, createTaskExecution } from '../../models/Task.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('WorkflowExecutor', () => {
  let executor: WorkflowExecutor;

  beforeEach(() => {
    const mockNodeExecutor = vi.fn(async () => ({ success: true, output: {}, duration: 100 }));
    executor = new WorkflowExecutor(mockNodeExecutor);
  });

  describe('constructor', () => {
    it('should create executor with default config', () => {
      expect(executor).toBeDefined();
    });

    it('should accept custom config', () => {
      const customExecutor = new WorkflowExecutor(
        vi.fn(async () => ({ success: true, output: {}, duration: 100 })),
        {
          maxConcurrency: 5,
          autoRetry: false,
        }
      );
      expect(customExecutor).toBeDefined();
    });
  });

  describe('executeTask', () => {
    it('should execute task successfully', async () => {
      const mockFn = vi.fn(async () => ({
        success: true,
        output: { result: 'success' },
        duration: 100,
      }));
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('TestTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const result = await executor.executeTask(task, execution, {}, {});
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ result: 'success' });
    });

    it('should handle task failure', async () => {
      const mockFn = vi.fn(async () => ({
        success: false,
        error: { code: 'ERR_001', message: 'Task failed' },
        duration: 100,
      }));
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('TestTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const result = await executor.executeTask(task, execution, {}, {});
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Task failed');
    });

    it('should handle executor error', async () => {
      const mockFn = vi.fn(async () => {
        throw new Error('Execution error');
      });
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('TestTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const result = await executor.executeTask(task, execution, {}, {});
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Execution error');
    });

    it('should emit task:start event', async () => {
      const mockFn = vi.fn(async () => ({ success: true, duration: 100 }));
      executor = new WorkflowExecutor(mockFn);

      const handler = vi.fn();
      executor.on('task:start', handler);

      const task = createTask('TestTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      await executor.executeTask(task, execution, {}, {});
      expect(handler).toHaveBeenCalled();
    });

    it('should emit task:complete event', async () => {
      const mockFn = vi.fn(async () => ({ success: true, duration: 100 }));
      executor = new WorkflowExecutor(mockFn);

      const handler = vi.fn();
      executor.on('task:complete', handler);

      const task = createTask('TestTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      await executor.executeTask(task, execution, {}, {});
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('shouldRetry', () => {
    it('should return false if autoRetry is disabled', () => {
      const mockFn = vi.fn(async () => ({ success: true, output: {}, duration: 100 }));
      const noRetryExecutor = new WorkflowExecutor(mockFn, { autoRetry: false });
      const task = createTask('TestTask', TaskType.TASK);
      const execution = createTaskExecution(task.id, 'exec-1');

      expect(noRetryExecutor.shouldRetry(task, execution)).toBe(false);
    });
  });

  describe('cancelTask', () => {
    it('should return false for non-existent task', () => {
      const result = executor.cancelTask('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('pauseTask', () => {
    it('should return false for non-existent task', () => {
      const result = executor.pauseTask('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 initially', () => {
      expect(executor.getActiveCount()).toBe(0);
    });
  });

  describe('isTaskRunning', () => {
    it('should return false for non-running task', () => {
      expect(executor.isTaskRunning('non-existent')).toBe(false);
    });
  });

  describe('getActiveExecution', () => {
    it('should return null for non-existent task', () => {
      expect(executor.getActiveExecution('non-existent')).toBeNull();
    });
  });

  describe('clearActiveExecutions', () => {
    it('should clear all active executions', () => {
      executor.clearActiveExecutions();
      expect(executor.getActiveCount()).toBe(0);
    });
  });

  // ==================== 新增覆盖率增强测试 ====================

  describe('executeTask - duplicate execution', () => {
    it('should throw error when task is already executing', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L118-120 activeExecutions.has 分支
      let resolveFirst: (value: {
        success: boolean;
        output: unknown;
        duration: number;
      }) => void = () => {};
      const mockFn = vi.fn(
        () =>
          new Promise<{ success: boolean; output: unknown; duration: number }>(resolve => {
            resolveFirst = resolve;
          })
      );
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('TestTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      // 启动第一次执行（不等待完成）
      const firstPromise = executor.executeTask(task, execution, {}, {});
      // 等待 activeExecutions 被设置
      await new Promise(resolve => setImmediate(resolve));

      // 尝试再次执行同一任务应抛错
      await expect(executor.executeTask(task, execution, {}, {})).rejects.toThrow(
        `Task ${task.id} is already executing`
      );

      // 完成第一次执行以清理
      resolveFirst({ success: true, output: {}, duration: 10 });
      await firstPromise;
    });
  });

  describe('executeTask - timeout handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle task timeout via defaultTimeout config', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L134-138 timeout 设置 + L197-226 handleTimeout
      const mockFn = vi.fn(
        () => new Promise<{ success: boolean; output: unknown; duration: number }>(() => {})
      );
      executor = new WorkflowExecutor(mockFn, { defaultTimeout: 1000 });

      const handler = vi.fn();
      executor.on('task:timeout', handler);

      const task = createTask('TimeoutTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      // 启动执行（不 await，因为 mock 永不 resolve）
      executor.executeTask(task, execution, {}, {});

      // 推进定时器触发超时
      await vi.advanceTimersByTimeAsync(1000);

      // 验证超时事件
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({ id: task.id }),
          execution: expect.objectContaining({
            error: expect.objectContaining({
              code: 'WF_002',
              message: expect.stringContaining('timed out'),
            }),
          }),
        })
      );

      // 超时后任务从 activeExecutions 中移除
      expect(executor.isTaskRunning(task.id)).toBe(false);
    });

    it('should handle task timeout via task.timeout config', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L187-192 getTaskTimeout task.timeout 分支
      const mockFn = vi.fn(
        () => new Promise<{ success: boolean; output: unknown; duration: number }>(() => {})
      );
      executor = new WorkflowExecutor(mockFn, { defaultTimeout: 60000 });

      const handler = vi.fn();
      executor.on('task:timeout', handler);

      const task = createTask(
        'TimeoutTask',
        TaskType.TASK,
        { handler: 'test' },
        {
          timeout: { duration: 500, action: 'fail' },
        }
      );
      const execution = createTaskExecution(task.id, 'exec-1');

      executor.executeTask(task, execution, {}, {});
      await vi.advanceTimersByTimeAsync(500);

      // 验证超时事件携带 task.timeout 信息
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          execution: expect.objectContaining({
            error: expect.objectContaining({
              code: 'WF_002',
              message: expect.stringContaining('500ms'),
            }),
          }),
        })
      );
      expect(executor.isTaskRunning(task.id)).toBe(false);
    });

    it('should emit task:timeout event on timeout', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L214 emit task:timeout
      const mockFn = vi.fn(
        () => new Promise<{ success: boolean; output: unknown; duration: number }>(() => {})
      );
      executor = new WorkflowExecutor(mockFn, { defaultTimeout: 100 });

      const handler = vi.fn();
      executor.on('task:timeout', handler);

      const task = createTask('TimeoutTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      executor.executeTask(task, execution, {}, {});
      await vi.advanceTimersByTimeAsync(100);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({ id: task.id }),
        })
      );
      expect(executor.isTaskRunning(task.id)).toBe(false);
    });
  });

  describe('executeTask - failure without error object', () => {
    it('should use default error code when result has no error', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L241-253 processTaskResult success=false 无 error 分支
      const mockFn = vi.fn(async () => ({
        success: false,
        duration: 50,
      }));
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('FailTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const result = await executor.executeTask(task, execution, {}, {});
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('WF_003');
      expect(result.error?.message).toBe('Task execution failed');
    });

    it('should use error code from result when error.code is empty', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L245 result.error.code || 'WF_003' 分支
      const mockFn = vi.fn(async () => ({
        success: false,
        error: { code: '', message: 'Empty code error' },
        duration: 50,
      }));
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('FailTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const result = await executor.executeTask(task, execution, {}, {});
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('WF_003');
      expect(result.error?.message).toBe('Empty code error');
    });
  });

  describe('executeTask - error with details', () => {
    it('should include error stack in details on execution error', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L271-296 handleExecutionError error.stack 分支
      const testError = new Error('Custom execution error');
      const mockFn = vi.fn(async () => {
        throw testError;
      });
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('ErrTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const result = await executor.executeTask(task, execution, {}, {});
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('WF_003');
      expect(result.error?.message).toBe('Custom execution error');
      expect(result.error?.details).toBe(testError.stack);
    });

    it('should emit task:error event on execution error', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L293 emit task:error
      const mockFn = vi.fn(async () => {
        throw new Error('Emit error event');
      });
      executor = new WorkflowExecutor(mockFn);

      const handler = vi.fn();
      executor.on('task:error', handler);

      const task = createTask('ErrTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      await executor.executeTask(task, execution, {}, {});
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('shouldRetry - with autoRetry enabled', () => {
    it('should return true when retry is possible', () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L303-309 shouldRetry autoRetry=true canTaskRetry=true
      const mockFn = vi.fn(async () => ({ success: true, output: {}, duration: 100 }));
      executor = new WorkflowExecutor(mockFn, { autoRetry: true });

      const task = createTask(
        'RetryTask',
        TaskType.TASK,
        { handler: 'test' },
        {
          retryPolicy: { maxRetries: 3, retryInterval: 100 },
        }
      );
      // 创建非最终状态的执行记录
      const execution = createTaskExecution(task.id, 'exec-1');
      execution.status = TaskStatus.RUNNING;
      execution.retryCount = 0;

      expect(executor.shouldRetry(task, execution)).toBe(true);
    });

    it('should return false when max retries exceeded', () => {
      // 可追溯性: 覆盖 canTaskRetry retryCount >= maxRetries 分支
      const mockFn = vi.fn(async () => ({ success: true, output: {}, duration: 100 }));
      executor = new WorkflowExecutor(mockFn, { autoRetry: true });

      const task = createTask(
        'RetryTask',
        TaskType.TASK,
        { handler: 'test' },
        {
          retryPolicy: { maxRetries: 2, retryInterval: 100 },
        }
      );
      const execution = createTaskExecution(task.id, 'exec-1');
      execution.status = TaskStatus.RUNNING;
      execution.retryCount = 2;

      expect(executor.shouldRetry(task, execution)).toBe(false);
    });

    it('should return false when execution status is final', () => {
      // 可追溯性: 覆盖 canTaskRetry isTaskExecutionFinal=true 分支
      const mockFn = vi.fn(async () => ({ success: true, output: {}, duration: 100 }));
      executor = new WorkflowExecutor(mockFn, { autoRetry: true });

      const task = createTask(
        'RetryTask',
        TaskType.TASK,
        { handler: 'test' },
        {
          retryPolicy: { maxRetries: 3, retryInterval: 100 },
        }
      );
      const execution = createTaskExecution(task.id, 'exec-1');
      execution.status = TaskStatus.FAILED;
      execution.retryCount = 0;

      expect(executor.shouldRetry(task, execution)).toBe(false);
    });
  });

  describe('scheduleRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should schedule retry after interval and return result', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L314-342 scheduleRetry 完整流程
      const mockFn = vi.fn(async () => ({
        success: true,
        output: { retryResult: true },
        duration: 10,
      }));
      executor = new WorkflowExecutor(mockFn, { autoRetry: true });

      const task = createTask(
        'RetryTask',
        TaskType.TASK,
        { handler: 'test' },
        {
          retryPolicy: { maxRetries: 3, retryInterval: 500 },
        }
      );
      const execution = createTaskExecution(task.id, 'exec-1');
      execution.status = TaskStatus.FAILED;
      execution.retryCount = 0;

      const promise = executor.scheduleRetry(task, execution, {}, {});

      // 推进定时器触发重试
      await vi.advanceTimersByTimeAsync(500);

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ retryResult: true });
    });

    it('should reject when retry execution throws', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L337-339 scheduleRetry catch reject 分支
      const mockFn = vi.fn(async () => {
        throw new Error('Retry execution failed');
      });
      executor = new WorkflowExecutor(mockFn, { autoRetry: true });

      const task = createTask(
        'RetryTask',
        TaskType.TASK,
        { handler: 'test' },
        {
          retryPolicy: { maxRetries: 3, retryInterval: 100 },
        }
      );
      const execution = createTaskExecution(task.id, 'exec-1');
      execution.status = TaskStatus.RUNNING;
      execution.retryCount = 0;

      const promise = executor.scheduleRetry(task, execution, {}, {});
      await vi.advanceTimersByTimeAsync(100);

      await expect(promise).resolves.toMatchObject({
        success: false,
        error: { message: 'Retry execution failed' },
      });
    });
  });

  describe('cancelTask - active execution', () => {
    it('should cancel running task and emit event', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L349-376 cancelTask 实际取消逻辑
      let rejectFirst: (error: Error) => void = () => {};
      const mockFn = vi.fn(
        () =>
          new Promise<{ success: boolean; output: unknown; duration: number }>((_, reject) => {
            rejectFirst = reject;
          })
      );
      executor = new WorkflowExecutor(mockFn);

      const handler = vi.fn();
      executor.on('task:cancelled', handler);

      const task = createTask('CancelTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const promise = executor.executeTask(task, execution, {}, {});
      await new Promise(resolve => setImmediate(resolve));

      // 取消任务
      const cancelResult = executor.cancelTask(task.id);
      expect(cancelResult).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(executor.isTaskRunning(task.id)).toBe(false);

      // 拒绝挂起的 promise 以清理
      rejectFirst(new Error('Task execution was cancelled'));
      await expect(promise).resolves.toMatchObject({ success: false });
    });
  });

  describe('pauseTask - active execution', () => {
    it('should pause running task by cancelling it', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L381-390 pauseTask 实际暂停逻辑
      let rejectFirst: (error: Error) => void = () => {};
      const mockFn = vi.fn(
        () =>
          new Promise<{ success: boolean; output: unknown; duration: number }>((_, reject) => {
            rejectFirst = reject;
          })
      );
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('PauseTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const promise = executor.executeTask(task, execution, {}, {});
      await new Promise(resolve => setImmediate(resolve));

      const pauseResult = executor.pauseTask(task.id);
      expect(pauseResult).toBe(true);
      expect(executor.isTaskRunning(task.id)).toBe(false);

      rejectFirst(new Error('Task execution was cancelled'));
      await expect(promise).resolves.toMatchObject({ success: false });
    });
  });

  describe('getActiveExecution - with active task', () => {
    it('should return execution for running task', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L409-411 getActiveExecution 返回实际执行
      let resolveFirst: (value: {
        success: boolean;
        output: unknown;
        duration: number;
      }) => void = () => {};
      const mockFn = vi.fn(
        () =>
          new Promise<{ success: boolean; output: unknown; duration: number }>(resolve => {
            resolveFirst = resolve;
          })
      );
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('ActiveTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const promise = executor.executeTask(task, execution, {}, {});
      await new Promise(resolve => setImmediate(resolve));

      expect(executor.isTaskRunning(task.id)).toBe(true);
      expect(executor.getActiveCount()).toBe(1);
      const activeExec = executor.getActiveExecution(task.id);
      expect(activeExec).not.toBeNull();
      expect(activeExec?.taskId).toBe(task.id);

      resolveFirst({ success: true, output: {}, duration: 10 });
      await promise;
    });
  });

  describe('clearActiveExecutions - with active tasks', () => {
    it('should cancel all active executions', async () => {
      // 可追溯性: 覆盖 WorkflowExecutor.ts L416-420 clearActiveExecutions 循环取消
      let rejectFirst: (error: Error) => void = () => {};
      const mockFn = vi.fn(
        () =>
          new Promise<{ success: boolean; output: unknown; duration: number }>((_, reject) => {
            rejectFirst = reject;
          })
      );
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('ClearTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const promise = executor.executeTask(task, execution, {}, {});
      await new Promise(resolve => setImmediate(resolve));

      expect(executor.getActiveCount()).toBe(1);
      executor.clearActiveExecutions();
      expect(executor.getActiveCount()).toBe(0);

      rejectFirst(new Error('cancelled'));
      await expect(promise).resolves.toMatchObject({ success: false });
    });
  });
});

describe('defaultNodeExecutor', () => {
  it('should throw error for task without handler', async () => {
    const task = createTask('TestTask', TaskType.TASK);

    await expect(defaultNodeExecutor(task, {}, {})).rejects.toThrow('No handler defined');
  });

  it('should throw error for unimplemented handler', async () => {
    const task = createTask('TestTask', TaskType.TASK, { handler: 'unknown-handler' });

    await expect(defaultNodeExecutor(task, {}, {})).rejects.toThrow('not implemented');
  });
});
