/**
 * StatusPusher
 *
 * EventEmitter-based task status push mechanism.
 * Exposes task status change events through the
 * @organic/interface IEventBus contract.
 */
import { EventEmitter } from 'events';
import type { IEventBus, EventSubscription, EventListener } from '@organic/interface';

export enum TaskState {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface StatusPushEvent {
  taskId: string;
  from: TaskState;
  to: TaskState;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface StatusPushConfig {
  taskId: string;
  eventBus?: IEventBus;
}

export class StatusPusher extends EventEmitter {
  private taskId: string;
  private currentState: TaskState = TaskState.PENDING;
  private eventBus?: IEventBus;
  private history: StatusPushEvent[] = [];
  private busSubscriptions: EventSubscription[] = [];

  constructor(config: StatusPushConfig) {
    super();
    this.taskId = config.taskId;
    this.eventBus = config.eventBus;
  }

  get state(): TaskState {
    return this.currentState;
  }

  get taskIdentifier(): string {
    return this.taskId;
  }

  push(to: TaskState, metadata?: Record<string, unknown>): StatusPushEvent {
    const event: StatusPushEvent = {
      taskId: this.taskId,
      from: this.currentState,
      to,
      timestamp: Date.now(),
      metadata,
    };
    this.history.push(event);
    this.currentState = to;
    this.emit('status:change', event);
    this.emit(`status:${to}`, event);
    if (this.eventBus) {
      this.eventBus.emit('task:status', event, this.taskId);
    }
    return event;
  }

  getHistory(): StatusPushEvent[] {
    return [...this.history];
  }

  subscribe(
    listener: (event: StatusPushEvent) => void
  ): EventSubscription {
    this.on('status:change', listener);
    let unsubscribed = false;
    return {
      unsubscribe: (): void => {
        if (!unsubscribed) {
          unsubscribed = true;
          this.off('status:change', listener);
        }
      },
    };
  }

  dispose(): void {
    for (const sub of this.busSubscriptions) {
      sub.unsubscribe();
    }
    this.busSubscriptions = [];
    this.history = [];
    this.removeAllListeners();
  }
}