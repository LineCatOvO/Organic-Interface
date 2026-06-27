import { describe, it, expect, vi, afterEach } from 'vitest';
import { StatusPusher, TaskState } from '../StatusPusher.js';
import type { IEventBus } from '@organic/interface';

describe('StatusPusher', () => {
  let pusher: StatusPusher;

  afterEach(() => {
    pusher.dispose();
  });

  describe('constructor', () => {
    it('should initialize with PENDING state', () => {
      pusher = new StatusPusher({ taskId: 'task-1' });
      expect(pusher.state).toBe(TaskState.PENDING);
    });

    it('should set taskId correctly', () => {
      pusher = new StatusPusher({ taskId: 'task-42' });
      expect(pusher.taskIdentifier).toBe('task-42');
    });
  });

  describe('push', () => {
    it('should create state transition and update current state', () => {
      pusher = new StatusPusher({ taskId: 'task-1' });
      const event = pusher.push(TaskState.RUNNING);
      expect(event.from).toBe(TaskState.PENDING);
      expect(event.to).toBe(TaskState.RUNNING);
      expect(event.taskId).toBe('task-1');
      expect(pusher.state).toBe(TaskState.RUNNING);
    });

    it('should emit status:change event', () => {
      pusher = new StatusPusher({ taskId: 'task-1' });
      const listener = vi.fn();
      pusher.on('status:change', listener);
      pusher.push(TaskState.RUNNING);
      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0].to).toBe(TaskState.RUNNING);
    });

    it('should emit status:{to} event', () => {
      pusher = new StatusPusher({ taskId: 'task-1' });
      const listener = vi.fn();
      pusher.on('status:running', listener);
      pusher.push(TaskState.RUNNING);
      expect(listener).toHaveBeenCalledOnce();
    });

    it('should include metadata in event', () => {
      pusher = new StatusPusher({ taskId: 'task-1' });
      const event = pusher.push(TaskState.RUNNING, { key: 'val' });
      expect(event.metadata).toEqual({ key: 'val' });
    });

    it('should track multi-step transitions in history', () => {
      pusher = new StatusPusher({ taskId: 'task-1' });
      pusher.push(TaskState.RUNNING);
      pusher.push(TaskState.COMPLETED);
      const history = pusher.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].to).toBe(TaskState.RUNNING);
      expect(history[1].to).toBe(TaskState.COMPLETED);
    });
  });

  describe('subscribe', () => {
    it('should register listener and return subscription', () => {
      pusher = new StatusPusher({ taskId: 'task-1' });
      const listener = vi.fn();
      const sub = pusher.subscribe(listener);
      pusher.push(TaskState.RUNNING);
      expect(listener).toHaveBeenCalledOnce();
      sub.unsubscribe();
      pusher.push(TaskState.COMPLETED);
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('getHistory', () => {
    it('should return a copy of history', () => {
      pusher = new StatusPusher({ taskId: 'task-1' });
      pusher.push(TaskState.RUNNING);
      const h = pusher.getHistory();
      h.push({ taskId: 'x', from: TaskState.PENDING, to: TaskState.RUNNING, timestamp: 0 });
      expect(pusher.getHistory()).toHaveLength(1);
    });
  });

  describe('IEventBus integration', () => {
    it('should emit to event bus when provided', () => {
      const mockBus: IEventBus = {
        on: vi.fn(),
        once: vi.fn(),
        emit: vi.fn(),
        off: vi.fn(),
      };
      pusher = new StatusPusher({ taskId: 't1', eventBus: mockBus });
      pusher.push(TaskState.RUNNING);
      expect(mockBus.emit).toHaveBeenCalledWith(
        'task:status', expect.anything(), 't1'
      );
    });
  });

  describe('dispose', () => {
    it('should clear listeners and history', () => {
      pusher = new StatusPusher({ taskId: 'task-1' });
      pusher.push(TaskState.RUNNING);
      pusher.dispose();
      expect(pusher.getHistory()).toHaveLength(0);
      expect(pusher.listenerCount('status:change')).toBe(0);
    });
  });
});