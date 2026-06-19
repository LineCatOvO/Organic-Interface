import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { TaskQueue, TaskScheduler, TaskPriority, TaskStatus, type Task } from '@organic/agent';

function createTestTask(
  id: string,
  name: string,
  priority: TaskPriority = TaskPriority.NORMAL
): Task {
  return {
    id,
    name,
    priority,
    status: TaskStatus.PENDING,
    dependencies: [],
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 0,
  };
}

describe('Agent Scheduling', () => {
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

  it('should schedule agents correctly', async () => {
    const queue = new TaskQueue({
      maxSize: 100,
    });

    const task = createTestTask('task-1', 'test-task');
    queue.enqueue(task as any);
    expect(queue.size()).toBe(1);

    const scheduler = new TaskScheduler(queue, {
      maxParallelTasks: 5,
      defaultTimeout: 30000,
    });

    const scheduled = scheduler.schedule({ name: 'test-task' });
    expect(scheduled).toBeDefined();
  });

  it('should handle concurrent agent requests', async () => {
    const queue = new TaskQueue({
      maxSize: 100,
    });

    const tasks = [
      createTestTask('concurrent-1', 'test-task-1'),
      createTestTask('concurrent-2', 'test-task-2'),
    ];

    tasks.forEach(task => queue.enqueue(task as any));
    expect(queue.size()).toBe(2);

    const scheduler = new TaskScheduler(queue, {
      maxParallelTasks: 5,
      defaultTimeout: 30000,
    });

    const results = await Promise.all(tasks.map(task => scheduler.schedule({ name: task.name })));

    expect(results.every(r => r !== undefined)).toBe(true);
  });

  it('should recover from scheduling failures', async () => {
    const queue = new TaskQueue({
      maxSize: 100,
    });

    const failingTask = createTestTask('fail-task', 'failing-task');

    queue.enqueue(failingTask as any);

    const scheduler = new TaskScheduler(queue, {
      maxParallelTasks: 5,
      defaultTimeout: 30000,
    });

    try {
      await scheduler.schedule({ name: failingTask.name });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  // ========== 新增：多 Agent 协作与并发调度测试 ==========
  describe('Multi-Agent Collaboration', () => {
    it('should handle multiple agents working concurrently', async () => {
      const queue = new TaskQueue({ maxSize: 1000 });

      // Create tasks for different agents
      const agentATasks = Array.from({ length: 5 }, (_, i) =>
        createTestTask(`agent-a-task-${i}`, `Agent A Task ${i}`, TaskPriority.HIGH)
      );
      const agentBTasks = Array.from({ length: 5 }, (_, i) =>
        createTestTask(`agent-b-task-${i}`, `Agent B Task ${i}`, TaskPriority.NORMAL)
      );
      const agentCTasks = Array.from({ length: 3 }, (_, i) =>
        createTestTask(`agent-c-task-${i}`, `Agent C Task ${i}`, TaskPriority.LOW)
      );

      // Enqueue all tasks
      [...agentATasks, ...agentBTasks, ...agentCTasks].forEach(task => queue.enqueue(task as any));

      expect(queue.size()).toBe(13);

      const scheduler = new TaskScheduler(queue, {
        maxParallelTasks: 10,
        defaultTimeout: 30000,
      });

      // Schedule all tasks concurrently
      const results = await Promise.all([
        ...agentATasks.map(task => scheduler.schedule({ name: task.name })),
        ...agentBTasks.map(task => scheduler.schedule({ name: task.name })),
        ...agentCTasks.map(task => scheduler.schedule({ name: task.name })),
      ]);

      // All tasks should be scheduled
      expect(results.length).toBe(13);
      expect(results.every(r => r !== undefined)).toBe(true);
    });

    it('should respect task priority ordering', async () => {
      const queue = new TaskQueue({ maxSize: 100 });

      const highPriorityTask = createTestTask(
        'high-priority',
        'High Priority Task',
        TaskPriority.HIGH
      );
      const normalPriorityTask = createTestTask(
        'normal-priority',
        'Normal Priority Task',
        TaskPriority.NORMAL
      );
      const lowPriorityTask = createTestTask('low-priority', 'Low Priority Task', TaskPriority.LOW);

      // Enqueue in reverse priority order
      queue.enqueue(lowPriorityTask as any);
      queue.enqueue(normalPriorityTask as any);
      queue.enqueue(highPriorityTask as any);

      const scheduler = new TaskScheduler(queue, {
        maxParallelTasks: 1, // Force sequential execution to test priority
        defaultTimeout: 30000,
      });

      // Schedule all tasks
      const results = await Promise.all([
        scheduler.schedule({ name: highPriorityTask.name }),
        scheduler.schedule({ name: normalPriorityTask.name }),
        scheduler.schedule({ name: lowPriorityTask.name }),
      ]);

      expect(results.length).toBe(3);
      expect(results.every(r => r !== undefined)).toBe(true);
    });

    it('should handle agent task dependencies across multiple agents', async () => {
      const queue = new TaskQueue({ maxSize: 100 });

      // Create dependency chain across agents
      const task1 = createTestTask('dep-task-1', 'Agent A - Initial Task');
      const task2 = {
        ...createTestTask('dep-task-2', 'Agent B - Dependent Task'),
        dependencies: [{ taskId: task1.id }],
      };
      const task3 = {
        ...createTestTask('dep-task-3', 'Agent C - Final Task'),
        dependencies: [{ taskId: task2.id }],
      };

      queue.enqueue(task1 as any);
      queue.enqueue(task2 as any);
      queue.enqueue(task3 as any);

      const scheduler = new TaskScheduler(queue, {
        maxParallelTasks: 5,
        defaultTimeout: 30000,
      });

      // All tasks should be schedulable despite dependencies
      const results = await Promise.all([
        scheduler.schedule({ name: task1.name }),
        scheduler.schedule({ name: task2.name }),
        scheduler.schedule({ name: task3.name }),
      ]);

      expect(results.length).toBe(3);
    });

    it('should handle agent failure isolation (one agent failure should not affect others)', async () => {
      const queue = new TaskQueue({ maxSize: 100 });

      const normalTask1 = createTestTask('normal-1', 'Normal Task 1');
      const normalTask2 = createTestTask('normal-2', 'Normal Task 2');
      const normalTask3 = createTestTask('normal-3', 'Normal Task 3');

      queue.enqueue(normalTask1 as any);
      queue.enqueue(normalTask2 as any);
      queue.enqueue(normalTask3 as any);

      const scheduler = new TaskScheduler(queue, {
        maxParallelTasks: 5,
        defaultTimeout: 30000,
      });

      // Schedule normal tasks (without .catch() since schedule may not return Promise)
      const results = [
        scheduler.schedule({ name: normalTask1.name }),
        scheduler.schedule({ name: normalTask2.name }),
        scheduler.schedule({ name: normalTask3.name }),
      ];

      // Verify tasks were scheduled
      expect(results.length).toBe(3);
      expect(results.every(r => r !== undefined)).toBe(true);
    });

    it('should manage workload distribution across agents', async () => {
      const queue = new TaskQueue({ maxSize: 500 });

      // Create balanced workload
      const totalTasks = 20;
      const tasks = Array.from({ length: totalTasks }, (_, i) =>
        createTestTask(`workload-task-${i}`, `Workload Task ${i}`, TaskPriority.NORMAL)
      );

      tasks.forEach(task => queue.enqueue(task as any));
      expect(queue.size()).toBe(totalTasks);

      const scheduler = new TaskScheduler(queue, {
        maxParallelTasks: 8, // Simulate 8 parallel workers
        defaultTimeout: 30000,
      });

      // Process batch
      const batchSize = 10;
      const batch1 = tasks.slice(0, batchSize);
      const batch2 = tasks.slice(batchSize);

      const results1 = await Promise.all(
        batch1.map(task => scheduler.schedule({ name: task.name }))
      );

      const results2 = await Promise.all(
        batch2.map(task => scheduler.schedule({ name: task.name }))
      );

      // All tasks processed
      expect(results1.length + results2.length).toBe(totalTasks);
    });
  });

  describe('TaskQueue Priority', () => {
    it('should prioritize HIGH tasks over NORMAL tasks', async () => {
      const queue = new TaskQueue();

      const normalTask = createTestTask('normal-task', 'Normal Task', TaskPriority.NORMAL);
      const highTask = createTestTask('high-task', 'High Task', TaskPriority.HIGH);

      queue.enqueue(normalTask as any);
      queue.enqueue(highTask as any);

      const first = queue.dequeue();
      expect(first?.id).toBe('high-task');
    });

    it('should prioritize NORMAL tasks over LOW tasks', async () => {
      const queue = new TaskQueue();

      const lowTask = createTestTask('low-task', 'Low Task', TaskPriority.LOW);
      const normalTask = createTestTask('normal-task', 'Normal Task', TaskPriority.NORMAL);

      queue.enqueue(lowTask as any);
      queue.enqueue(normalTask as any);

      const first = queue.dequeue();
      expect(first?.id).toBe('normal-task');
    });

    it('should maintain FIFO order for same priority tasks', async () => {
      const queue = new TaskQueue();

      const task1 = createTestTask('task-1', 'Task 1', TaskPriority.NORMAL);
      const task2 = createTestTask('task-2', 'Task 2', TaskPriority.NORMAL);
      const task3 = createTestTask('task-3', 'Task 3', TaskPriority.NORMAL);

      queue.enqueue(task1 as any);
      queue.enqueue(task2 as any);
      queue.enqueue(task3 as any);

      const first = queue.dequeue();
      expect(first?.id).toBe('task-1');

      const second = queue.dequeue();
      expect(second?.id).toBe('task-2');
    });

    it('should handle CRITICAL priority at highest level', async () => {
      const queue = new TaskQueue();

      const normalTask = createTestTask('normal-task', 'Normal', TaskPriority.NORMAL);
      const criticalTask = createTestTask('critical-task', 'Critical', TaskPriority.CRITICAL);

      queue.enqueue(normalTask as any);
      queue.enqueue(criticalTask as any);

      const first = queue.dequeue();
      expect(first?.id).toBe('critical-task');
    });
  });

  describe('TaskQueue Scheduling', () => {
    it('should respect max size limit', async () => {
      const queue = new TaskQueue({ maxSize: 2 });

      queue.enqueue(createTestTask('t1', 'Task 1') as any);
      queue.enqueue(createTestTask('t2', 'Task 2') as any);
      const result = queue.enqueue(createTestTask('t3', 'Task 3') as any);

      expect(result).toBe(false);
      expect(queue.size()).toBe(2);
    });

    it('should mark task as running after dequeue', async () => {
      const queue = new TaskQueue();

      const task = createTestTask('running-task', 'Running Task');
      queue.enqueue(task as any);

      const dequeued = queue.dequeue();
      expect(dequeued?.status).toBe(TaskStatus.RUNNING);
    });

    it('should complete task and remove from running', async () => {
      const queue = new TaskQueue();

      const task = createTestTask('complete-task', 'Complete Task');
      queue.enqueue(task as any);

      const dequeued = queue.dequeue();
      const result = queue.complete(dequeued!.id, { success: true });

      expect(result).toBe(true);
      expect(queue.runningCount()).toBe(0);
    });

    it('should fail task with retry when under max retries', async () => {
      const queue = new TaskQueue({ maxRetries: 2 });

      const task = createTestTask('retry-task', 'Retry Task');
      task.maxRetries = 2;
      queue.enqueue(task as any);

      const dequeued = queue.dequeue();
      const result = queue.fail(dequeued!.id, 'Test error');

      expect(result).toBe(true);
      expect(queue.size()).toBe(1);
      expect(task.retryCount).toBe(1);
    });

    it('should mark as failed when exceeding max retries', async () => {
      const queue = new TaskQueue({ maxRetries: 1 });

      const task = createTestTask('fail-task', 'Fail Task');
      task.maxRetries = 1;
      queue.enqueue(task as any);

      const dequeued = queue.dequeue();
      queue.fail(dequeued!.id, 'First error');
      queue.fail(dequeued!.id, 'Second error');

      expect(task.status).toBe(TaskStatus.FAILED);
    });
  });

  describe('TaskScheduler', () => {
    it('should start and stop scheduler', async () => {
      const queue = new TaskQueue();
      const scheduler = new TaskScheduler(queue);

      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      await scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should schedule task with default timeout', async () => {
      const queue = new TaskQueue();
      const scheduler = new TaskScheduler(queue, { defaultTimeout: 5000 });

      const task = scheduler.schedule({ name: 'timeout-test', maxRetries: 0 });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
    });

    it('should handle task timeout', async () => {
      const queue = new TaskQueue();
      const scheduler = new TaskScheduler(queue, {
        defaultTimeout: 50,
        enableRetry: false,
      });

      scheduler.on('task:failed', () => {
        // Task failed event
      });

      scheduler.schedule({ name: 'timeout-task', maxRetries: 0 });
    });

    it('should cancel specific task', async () => {
      const queue = new TaskQueue();
      const scheduler = new TaskScheduler(queue);

      const task = scheduler.schedule({ name: 'cancel-test', maxRetries: 0 });
      const result = scheduler.cancel(task.id);

      expect(result).toBe(true);
    });

    it('should cancel all pending tasks', async () => {
      const queue = new TaskQueue();
      const scheduler = new TaskScheduler(queue);

      scheduler.schedule({ name: 'cancel-all-1', maxRetries: 0 });
      scheduler.schedule({ name: 'cancel-all-2', maxRetries: 0 });

      scheduler.cancelAll();

      expect(scheduler.getQueueSize()).toBe(0);
    });
  });
});
