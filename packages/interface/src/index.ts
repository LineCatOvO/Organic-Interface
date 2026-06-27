export const VERSION = '0.1.0';

// Types
export type {
  OperationType,
  OperationStatus,
  OperationResult,
  OperationContext,
  PermissionLevel,
} from './types/operations.js';

// Agent
export type {
  AgentStatus,
  SessionState,
  IAgentSession,
  AgentStats,
  IAgentController,
} from './api/AgentFacade.js';

// Kernel
export type {
  KernelStatus,
  KernelConfig,
  PluginInfo,
  IPluginManager,
  IKernelFacade,
} from './api/KernelFacade.js';

// Tools
export type {
  ToolDefinition,
  ToolExecutionResult,
  IToolExecutor,
} from './api/ToolFacade.js';

// Storage
export type {
  StorageEntity,
  StorageQueryOptions,
  IStorageFacade,
} from './api/StorageFacade.js';

// Events
export type {
  EventPayload,
  EventListener,
  EventSubscription,
  IEventBus,
  KernelEventData,
  AgentEventData,
  OperationEventData,
  PluginEventData,
} from './api/EventFacade.js';