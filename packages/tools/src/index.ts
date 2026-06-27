/**
 * @organic/tools - Tool management and execution module
 *
 * Provides tool registration, discovery, and execution capabilities
 * with sandbox support and built-in tools.
 */

// Types
export * from './types/index.js';

// Services
export {
  ToolService,
  createToolService,
  DEFAULT_TOOL_SERVICE_CONFIG,
} from './services/ToolService.js';

// Executor
export {
  ToolExecutor,
  createToolExecutor,
  DEFAULT_EXECUTOR_CONFIG,
} from './executor/ToolExecutor.js';

// Built-in tools
export { FileTool, ShellTool, SearchTool, registerBuiltinTools } from './builtin/index.js';

// Sandbox
export {
  DockerSandbox,
  SandboxManager,
  DEFAULT_SANDBOX_CONFIG,
  DEFAULT_MANAGER_CONFIG,
} from './sandbox/index.js';
export type {
  DockerSandboxConfig,
  SandboxExecutionResult,
  SandboxState,
  SandboxManagerConfig,
} from './sandbox/index.js';

// Permission
export { PermissionManager, type ApprovalResponse, type PermissionManagerConfig } from './permission/PermissionManager.js';

/**
 * Module version
 */
export const VERSION = '0.1.0';
