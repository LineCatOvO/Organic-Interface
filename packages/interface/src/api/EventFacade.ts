/** Generic event payload */
export interface EventPayload<T = unknown> {
  type: string;
  data: T;
  source?: string;
  timestamp: number;
}

/** Event listener callback */
export type EventListener<T = unknown> = (event: EventPayload<T>) => void;

/** Event subscription handle */
export interface EventSubscription {
  unsubscribe(): void;
}

/** Event bus interface */
export interface IEventBus {
  on<T>(type: string, listener: EventListener<T>): EventSubscription;
  once<T>(type: string, listener: EventListener<T>): EventSubscription;
  emit<T>(type: string, data: T, source?: string): void;
  off<T>(type: string, listener: EventListener<T>): void;
}

// ---- Core Event Types ----

/** Kernel lifecycle event data */
export interface KernelEventData {
  status: string;
  version: string;
}

/** Agent lifecycle event data */
export interface AgentEventData {
  agentId: string;
  status: string;
  sessionId?: string;
}

/** Operation execution event data */
export interface OperationEventData {
  operationId: string;
  type: string;
  status: string;
  agentId?: string;
  sessionId?: string;
}

/** Plugin state change event data */
export interface PluginEventData {
  pluginName: string;
  action: 'registered' | 'unregistered' | 'enabled' | 'disabled';
}