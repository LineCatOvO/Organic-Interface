/** Tool definition metadata */
export interface ToolDefinition {
  name: string;
  version: string;
  description: string;
  type: string;
  parameters?: unknown;
  permissions?: string[];
  maxExecutionTime?: number;
}

/** Tool execution result */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
  executionTime: number;
}

/** Tool executor interface */
export interface IToolExecutor {
  execute(name: string, params: Record<string, unknown>): Promise<ToolExecutionResult>;
  getToolDefinition(name: string): ToolDefinition | undefined;
  listTools(): ToolDefinition[];
}