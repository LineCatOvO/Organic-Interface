/**
 * @organic/ui - UI module
 *
 * Provides UI components, operations, and agent capabilities
 * for Organic Interface.
 */

// Re-export utils
export { createLogger, type Logger, type LogLevel } from '@organic/utils';

// Re-export UI components
export {
  Prompt,
  type PromptType,
  type SelectOption,
  type PromptConfig,
  type PromptResult,
  defaultPrompt,
  createPrompt,
} from './components/Prompt.js';

export {
  Progress,
  type ProgressStyle,
  type ProgressConfig,
  type ProgressState,
  createProgress,
  showProgress,
} from './components/Progress.js';

export {
  Table,
  type TableColumn,
  type TableConfig,
  type TableSortConfig,
  createTable,
  renderTable,
} from './components/Table.js';

// Re-export UI core modules
export {
  UIOperationManager,
  type UIOperationType,
  type UIOperationStatus,
  type UIOperationResult,
  type UIOperationInput,
  type UIOperationOptions,
  type UIOperationContext,
  type UIPermissionLevel,
  type UIOperationHandler,
  type UIOperationValidationError,
  type UIOperationEvents,
  type ClickInput,
  type InputInput,
  type SelectInput,
  type ScrollInput,
  type HoverInput,
  type WaitInput,
  type GetTextInput,
  type GetAttributeInput,
  type ScreenshotInput,
  OPERATION_PERMISSIONS,
  SENSITIVE_OPERATIONS,
} from './core/UIOperation.js';

export {
  Sandbox,
  createSandbox,
  type SandboxConfig,
  type SandboxSession,
  type SandboxSessionStatus,
  type SandboxOperationContext,
  type SandboxNetworkRestrictions,
  type PermissionCheckResult,
  type SandboxEvents,
  DEFAULT_SANDBOX_CONFIG,
} from './core/Sandbox.js';

export {
  UIAgent,
  createUIAgent,
  type UIAgentConfig,
  type UIAgentState,
  type UIAgentStatus,
  type UIAgentEvents,
  type UIOperationRequest,
  DEFAULT_UI_AGENT_CONFIG,
} from './core/UIAgent.js';

// CLI interface
export { CLI } from './cli/CLI.js';
export { ApprovalPrompt, type ApprovalRequest } from './cli/ApprovalPrompt.js';

/**
 * Module version
 */
export const VERSION = '0.1.0';
