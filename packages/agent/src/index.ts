/**
 * @organic/agent - Agent module for Organic Interface
 *
 * Provides the core agent implementation, task scheduling,
 * and context management capabilities.
 */

// Re-export from @organic/utils
export { createLogger, type Logger, type LogLevel } from '@organic/utils';

// Re-export from core module
export {
  Agent,
  type AgentResult,
  type AgentTaskInput,
  type AgentTaskHandler,
  type AgentExecutionContext,
  type AgentEvents,
  type AgentConfig,
  type AgentConfigOptions,
  AgentType,
  AgentPriority,
  DEFAULT_AGENT_CONFIG,
  createAgentConfig,
  type AgentState,
  type AgentStateOptions,
  type AgentStats,
  AgentStatus,
  createAgentState,
  getAgentStats,
} from './core/index.js';

// Re-export from scheduler module
export {
  TaskQueue,
  TaskPriority,
  TaskStatus,
  type Task as SchedulerTask,
  type TaskOptions,
  type TaskQueueConfig,
  DEFAULT_QUEUE_CONFIG,
  createTask as createSchedulerTask,
  TaskScheduler,
  DEFAULT_SCHEDULER_CONFIG,
} from './scheduler/index.js';

// Re-export from context module
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
  ContextManager,
  type ConversationContext,
  type Participant,
  type ContextMetadata,
  type StateItem,
  type StateChange,
  type ContextStats,
  type ContextManagerConfig,
  ContextStatus,
  ContextItemType,
  StateType,
  DEFAULT_CONTEXT_CONFIG,
  // ContextItem model
  type ContextItem,
  type ContextItemOptions,
  type ContextItemFilter,
  type ContextItemUpdate,
  type ContextItemMetadata,
  ContextItemType as ContextItemTypeEnum,
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
  // ContextWindowManager
  ContextWindowManager,
  type ContextWindow,
  type ContextWindowConfig,
  type ContextWindowManagerConfig,
  ContextWindowType,
  DEFAULT_CONTEXT_WINDOW_CONFIG,
  DEFAULT_CONTEXT_WINDOW_MANAGER_CONFIG,
  // ContextService
  ContextService,
  type PropagationScope,
  type ContextFilter,
  type ExecutionFrame,
  type ExecutionContextStack,
  type ContextServiceConfig,
  PropagationMode,
  DEFAULT_CONTEXT_SERVICE_CONFIG,
} from './context/index.js';

// Re-export from memory module
export {
  ConversationMemory,
  type ConversationMemoryConfig,
  type MemoryEntry,
  type RelevanceResult,
  DEFAULT_MEMORY_CONFIG,
} from './memory/ConversationMemory.js';

// Re-export from workflow module
export {
  // Task model
  type Task as WorkflowTask,
  type TaskExecution,
  type TaskExecutionHistory,
  type TaskConfig,
  type TaskInput,
  type TaskOutput,
  type TaskDependency,
  type TaskMetadata,
  type RetryPolicy,
  type TaskTimeout,
  type ConditionExpression,
  type LoopConfig,
  type ParallelConfig,
  TaskStatus as WorkflowTaskStatus,
  TaskType,
  DEFAULT_RETRY_POLICY,
  createTask as createWorkflowTask,
  createTaskExecution,
  updateTaskExecution,
  isTaskExecutionFinal,
  canTaskRetry,
  calculateRetryInterval,
  isValidTask,
  createSimpleTask,
  createConditionTask,
  createLoopTask,
  createParallelTask,
  // Workflow model
  type Workflow,
  type WorkflowEdge,
  type WorkflowConfig,
  type WorkflowVariable,
  type WorkflowExecution,
  type WorkflowExecutionSnapshot,
  type WorkflowVersion,
  type EdgeCondition,
  WorkflowStatus,
  WorkflowExecutionStatus,
  EdgeConditionType,
  DEFAULT_WORKFLOW_CONFIG,
  createWorkflow,
  createWorkflowEdge,
  createSimpleEdge,
  createSuccessEdge,
  createFailureEdge,
  createWorkflowExecution,
  createWorkflowSnapshot,
  updateWorkflowExecution,
  isValidWorkflow,
  getEntryNode,
  getExitNodes,
  getOutgoingEdges,
  getIncomingEdges,
  isValidDAG,
  getTopologicalOrder,
  // Workflow executor
  WorkflowExecutor,
  type WorkflowExecutorConfig,
  type TaskExecutionResult,
  NodeExecutor,
  DEFAULT_WORKFLOW_EXECUTOR_CONFIG,
  defaultNodeExecutor,
  // Workflow engine
  WorkflowEngine,
  type WorkflowEngineConfig,
  DEFAULT_WORKFLOW_ENGINE_CONFIG,
  WORKFLOW_VERSION,
} from './workflow/index.js';

// Re-export from orchestration module
export {
  type OrchestrationRequest,
  OrchestrationStrategy,
  type OrchestrationResult,
  type OrchestrationLayerPlan,
  OrchestrationPlanStatus,
  type OrchestrationLayerEvents,
  type DecomposedTask,
  type AgentSelectionStrategy,
  type OrchestrationLayerConfig,
  DEFAULT_ORCHESTRATION_CONFIG,
  OrchestrationLayer,
  createOrchestrationLayer,
  type ExecutionRequest as OrchestrationExecutionRequest,
  type RetryConfig as OrchestrationRetryConfig,
  DEFAULT_RETRY_CONFIG as DEFAULT_ORCHESTRATION_RETRY_CONFIG,
  type ExecutionResult as OrchestrationExecutionResult,
  type ExecutionPlan as OrchestrationExecutionPlan,
  type ExecutionStep as OrchestrationExecutionStep,
  type CoordinatorEvents as OrchestrationCoordinatorEvents,
  ExecutionCoordinator,
} from './orchestration/index.js';

// Re-export from progress module
export {
  ProgressReporter,
  type ProgressStep,
  type ProgressEstimate,
  type ProgressEvent,
  type ProgressReporterConfig,
  StatusPusher,
  TaskState,
  type StatusPushEvent,
  type StatusPushConfig,
} from './progress/index.js';

/**
 * Module version
 */
export const VERSION = '0.1.0';
