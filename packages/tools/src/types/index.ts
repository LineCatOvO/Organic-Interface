/**
 * Tool type definitions for @organic/tools
 */

/**
 * Tool execution result
 */
export interface ToolResult<T = unknown> {
  /** Whether execution was successful */
  success: boolean;

  /** Result data */
  data?: T;

  /** Error message if failed */
  error?: string;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Logs from tool execution */
  logs?: ToolLog[];

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution log entry
 */
export interface ToolLog {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';

  /** Log message */
  message: string;

  /** Timestamp */
  timestamp: number;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Tool definition
 */
export interface ToolDefinition {
  /** Unique tool identifier */
  id: string;

  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Tool category */
  category: ToolCategory;

  /** Input schema (JSON Schema) */
  inputSchema: Record<string, unknown>;

  /** Output schema (JSON Schema) */
  outputSchema?: Record<string, unknown>;

  /** Whether tool is enabled */
  enabled: boolean;

  /** Timeout in milliseconds */
  timeout: number;

  /** Retry configuration */
  retry?: ToolRetryConfig;

  /** Permissions required */
  permissions?: ToolPermission[];

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tool categories
 */
export type ToolCategory = 'file' | 'shell' | 'search' | 'http' | 'database' | 'git' | 'custom';

/**
 * Tool retry configuration
 */
export interface ToolRetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;

  /** Initial delay in milliseconds */
  initialDelay: number;

  /** Maximum delay in milliseconds */
  maxDelay: number;

  /** Backoff multiplier */
  backoffMultiplier: number;

  /** Retryable error codes */
  retryableErrors?: string[];
}

/**
 * Tool permission
 */
export interface ToolPermission {
  /** Permission type */
  type: ToolPermissionType;

  /** Permission scope */
  scope: string;

  /** Whether permission is granted */
  granted: boolean;
}

/**
 * Tool permission types
 */
export type ToolPermissionType = 'read' | 'write' | 'execute' | 'network' | 'filesystem';

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** Tool ID */
  toolId: string;

  /** Execution ID */
  executionId: string;

  /** User ID */
  userId?: string;

  /** Session ID */
  sessionId?: string;

  /** Working directory */
  workingDirectory: string;

  /** Environment variables */
  environment: Record<string, string>;

  /** Cancellation flag */
  cancelled: boolean;

  /** Abort signal */
  signal?: AbortSignal;

  /** Permission level */
  permissionLevel: PermissionLevel;

  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Permission levels for tool execution
 */
export type PermissionLevel = 'L1' | 'L2' | 'L3' | 'L4';

/**
 * Tool input validation error
 */
export interface ToolValidationError {
  /** Field path */
  path: string;

  /** Error message */
  message: string;

  /** Expected type */
  expected?: string;

  /** Actual value */
  actual?: unknown;
}

/**
 * Tool registry entry
 */
export interface ToolRegistryEntry {
  /** Tool definition */
  definition: ToolDefinition;

  /** Tool instance */
  instance: Tool;

  /** Registration timestamp */
  registeredAt: number;

  /** Execution statistics */
  stats: ToolStats;
}

/**
 * Tool execution statistics
 */
export interface ToolStats {
  /** Total execution count */
  totalExecutions: number;

  /** Successful executions */
  successfulExecutions: number;

  /** Failed executions */
  failedExecutions: number;

  /** Total execution time in milliseconds */
  totalExecutionTime: number;

  /** Average execution time in milliseconds */
  avgExecutionTime: number;

  /** Last execution timestamp */
  lastExecutionAt?: number;

  /** Last successful execution timestamp */
  lastSuccessAt?: number;

  /** Last failed execution timestamp */
  lastFailureAt?: number;
}

/**
 * Base interface for all tools
 */
export interface Tool {
  /** Get tool definition */
  getDefinition(): ToolDefinition;

  /** Validate input */
  validate(input: unknown): ToolValidationError[];

  /** Execute the tool */
  execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult>;
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  /** Timeout in milliseconds */
  timeout?: number;

  /** Retry configuration */
  retry?: boolean;

  /** Cancellation signal */
  signal?: AbortSignal;

  /** Callback for progress updates */
  onProgress?: (progress: number) => void;

  /** Callback for log updates */
  onLog?: (log: ToolLog) => void;
}

/**
 * Tool service configuration
 */
export interface ToolServiceConfig {
  /** Default timeout in milliseconds */
  defaultTimeout: number;

  /** Maximum concurrent executions */
  maxConcurrentExecutions: number;

  /** Enable tool validation */
  enableValidation: boolean;

  /** Enable execution logging */
  enableLogging: boolean;

  /** Enable metrics collection */
  enableMetrics: boolean;

  /** Sandbox configuration */
  sandbox?: SandboxConfig;
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  /** Enable sandbox */
  enabled: boolean;

  /** Allowed directories */
  allowedDirectories: string[];

  /** Denied patterns */
  deniedPatterns: string[];

  /** Network restrictions */
  networkRestrictions?: NetworkRestrictions;

  /** Maximum file size */
  maxFileSize?: number;
}

/**
 * Network restrictions for sandbox
 */
export interface NetworkRestrictions {
  /** Allowed hosts */
  allowedHosts?: string[];

  /** Denied hosts */
  deniedHosts?: string[];

  /** Allowed ports */
  allowedPorts?: number[];

  /** Maximum request size */
  maxRequestSize?: number;
}
