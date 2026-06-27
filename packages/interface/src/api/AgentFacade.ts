import type { OperationResult, OperationContext } from '../types/operations.js';

/** Agent lifecycle status */
export type AgentStatus = 'idle' | 'busy' | 'paused' | 'error' | 'offline';

/** Agent session state */
export interface SessionState {
  sessionId: string;
  status: AgentStatus;
  createdAt: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
}

/** Agent session interface */
export interface IAgentSession {
  readonly sessionId: string;
  readonly status: AgentStatus;
  execute<T>(input: unknown, ctx: OperationContext): Promise<OperationResult<T>>;
  getState(): SessionState;
}

/** Agent runtime statistics */
export interface AgentStats {
  totalSessions: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  uptime: number;
  lastOperationTime?: number;
}

/** Agent controller interface for lifecycle management */
export interface IAgentController {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getState(): AgentStatus;
  getStats(): AgentStats;
  createSession(): Promise<IAgentSession>;
  closeSession(sessionId: string): Promise<void>;
}