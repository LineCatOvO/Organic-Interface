/**
 * Frontend-agnostic operation types for unified interface.
 * Independent of browser/DOM concepts.
 */

/** Permission levels for operations */
export type PermissionLevel = 'L1' | 'L2' | 'L3' | 'L4';

/** Frontend-agnostic operation types */
export type OperationType =
  | 'INPUT'
  | 'SELECT'
  | 'NAVIGATE'
  | 'QUERY'
  | 'ACTION'
  | 'WAIT'
  | 'CAPTURE';

/** Operation execution status */
export type OperationStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';

/** Generic operation result */
export interface OperationResult<T = unknown> {
  operationId: string;
  type: OperationType;
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
  status: OperationStatus;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/** Context for operation execution */
export interface OperationContext {
  operationId: string;
  agentId: string;
  sessionId: string;
  permissionLevel: PermissionLevel;
  timeout: number;
  retryCount: number;
  metadata: Record<string, unknown>;
}