/**
 * Context module exports
 */

// Message exports
export {
  type Message,
  type MessageSender,
  type MessageContent,
  type MessageOptions,
  type Attachment,
  type ToolCall,
  type ToolResponse,
  MessageType,
  MessageStatus,
  MessageFlag,
  ContentFormat,
  AttachmentType,
  createMessage,
  createUserMessage,
  createAssistantMessage,
  createToolCallMessage,
  createToolResponseMessage,
  createSystemMessage,
  createErrorMessage,
  isValidMessage,
} from './Message.js';

// ContextManager exports
export {
  ContextManager,
  type ConversationContext,
  type Participant,
  type ContextMetadata,
  type StateItem,
  type StateChange,
  type ContextStats,
  type ContextManagerConfig,
  ContextStatus,
  ContextItemType as ContextManagerContextItemType,
  StateType,
  DEFAULT_CONTEXT_CONFIG,
} from './ContextManager.js';

// ContextItem model exports
export {
  type ContextItem,
  type ContextItemOptions,
  type ContextItemFilter,
  type ContextItemUpdate,
  type ContextItemMetadata,
  ContextItemType,
  ContextItemPriority,
  createContextItem,
  createMessageContextItem,
  createStateContextItem,
  createToolCallContextItem,
  createResultContextItem,
  updateContextItem,
  isContextItemExpired,
  touchContextItem,
  isValidContextItem,
  calculateContextItemSize,
  compareContextItems,
} from './models/index.js';

// ContextWindowManager exports
export {
  ContextWindowManager,
  type ContextWindow,
  type ContextWindowConfig,
  type ContextWindowManagerConfig,
  ContextWindowType,
  DEFAULT_CONTEXT_WINDOW_CONFIG,
  DEFAULT_CONTEXT_WINDOW_MANAGER_CONFIG,
} from './services/ContextWindowManager.js';

// TokenBudget exports
export {
  TokenBudget,
  type TokenBudgetConfig,
  type BudgetAllocation,
  type BudgetResult,
  DEFAULT_TOKEN_BUDGET_CONFIG,
} from './TokenBudget.js';

// ContextCompressor exports
export {
  ContextCompressor,
  type ContextCompressorConfig,
  type CompressedResult,
  CompressionStrategy,
  DEFAULT_COMPRESSOR_CONFIG,
} from './ContextCompressor.js';

// ContextService exports
export {
  ContextService,
  type PropagationScope,
  type ContextFilter,
  type ExecutionFrame,
  type ExecutionContextStack,
  type ContextServiceConfig,
  PropagationMode,
  DEFAULT_CONTEXT_SERVICE_CONFIG,
} from './services/ContextService.js';
