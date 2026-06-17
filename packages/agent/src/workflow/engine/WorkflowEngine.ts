/**
 * WorkflowEngine - Main workflow orchestration engine
 *
 * Manages workflow execution, scheduling, state tracking,
 * and coordinates with WorkflowExecutor for task execution.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import type { Workflow } from '../models/Workflow.js';
import {
  type Task,
  type TaskExecution,
  TaskStatus,
  createTaskExecution,
  updateTaskExecution,
} from '../models/Task.js';
import {
  WorkflowExecutionStatus,
  createWorkflowExecution,
  updateWorkflowExecution,
  createWorkflowSnapshot,
  getEntryNode,
  type WorkflowExecution,
  type WorkflowExecutionSnapshot,
} from '../models/Workflow.js';
import {
  WorkflowExecutor,
  type WorkflowExecutorConfig,
  type TaskExecutionResult,
  defaultNodeExecutor,
} from './WorkflowExecutor.js';

/**
 * Workflow engine configuration
 */
export interface WorkflowEngineConfig extends WorkflowExecutorConfig {
  /** Enable parallel execution */
  enableParallelExecution?: boolean;
  /** Maximum parallel node count */
  maxParallelNodes?: number;
  /** Enable execution recovery */
  enableRecovery?: boolean;
  /** Snapshot interval in milliseconds */
  snapshotInterval?: number;
  /** Continue on error */
  continueOnError?: boolean;
}

/**
 * Default workflow engine configuration
 */
export const DEFAULT_WORKFLOW_ENGINE_CONFIG: Required<WorkflowEngineConfig> = {
  maxConcurrency: 10,
  defaultTimeout: 3600000,
  autoRetry: true,
  enableTracking: true,
  enableParallelExecution: true,
  maxParallelNodes: 10,
  enableRecovery: true,
  snapshotInterval: 30000,
  continueOnError: false,
};

/**
 * Node execution state
 */
interface NodeExecutionState {
  task: Task;
  execution: TaskExecution;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  dependenciesCompleted: boolean;
}

/**
 * WorkflowEngine
 *
 * Orchestrates workflow execution including task scheduling,
 * dependency management, and parallel execution coordination.
 */
export class WorkflowEngine extends EventEmitter {
  private config: Required<WorkflowEngineConfig>;
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private nodeStates: Map<string, Map<string, NodeExecutionState>> = new Map();
  private executor: WorkflowExecutor;
  private snapshotTimer?: ReturnType<typeof setInterval>;
  private logger: Logger;

  /**
   * Create a new WorkflowEngine
   */
  constructor(config: WorkflowEngineConfig = {}) {
    super();
    this.config = {
      ...DEFAULT_WORKFLOW_ENGINE_CONFIG,
      ...config,
    };

    // Create executor with config
    this.executor = new WorkflowExecutor(defaultNodeExecutor, {
      maxConcurrency: this.config.maxConcurrency,
      defaultTimeout: this.config.defaultTimeout,
      autoRetry: this.config.autoRetry,
      enableTracking: this.config.enableTracking,
    });

    this.logger = createLogger({ prefix: 'workflow-engine' });

    // Forward executor events
    this.forwardExecutorEvents();
  }

  // ==================== Workflow Management ====================

  /**
   * Register a workflow
   */
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
    this.logger.info(`Workflow registered: ${workflow.id} (${workflow.name})`);
    this.emit('workflow:registered', workflow);
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Unregister a workflow
   */
  unregisterWorkflow(workflowId: string): boolean {
    const result = this.workflows.delete(workflowId);
    if (result) {
      this.emit('workflow:unregistered', workflowId);
    }
    return result;
  }

  /**
   * List all registered workflows
   */
  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  // ==================== Execution Management ====================

  /**
   * Start workflow execution
   */
  async startExecution(workflowId: string, input: Record<string, unknown> = {}): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Create execution record
    const execution = createWorkflowExecution(workflowId, input);

    // Find entry node
    const entryNode = getEntryNode(workflow);
    if (entryNode) {
      execution.currentNodeIds = [entryNode.id];
    }

    this.executions.set(execution.id, execution);
    this.initializeNodeStates(execution.id, workflow);

    this.logger.info(`Starting workflow execution: ${execution.id}`);
    this.emit('execution:started', { execution });

    // Start snapshot timer
    if (this.config.enableRecovery) {
      this.startSnapshotTimer();
    }

    // Begin execution
    this.scheduleNextNodes(execution.id, workflow);

    return execution.id;
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Pause workflow execution
   */
  pauseExecution(executionId: string): boolean {
    let execution = this.executions.get(executionId);
    if (!execution || execution.status !== WorkflowExecutionStatus.RUNNING) {
      return false;
    }

    execution = updateWorkflowExecution(execution, {
      status: WorkflowExecutionStatus.PAUSED,
    });
    this.executions.set(executionId, execution);

    // Pause all running tasks
    this.executor.clearActiveExecutions();

    this.emit('execution:paused', { execution });
    return true;
  }

  /**
   * Resume paused execution
   */
  async resumeExecution(executionId: string): Promise<boolean> {
    let execution = this.executions.get(executionId);
    if (!execution || execution.status !== WorkflowExecutionStatus.PAUSED) {
      return false;
    }

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      return false;
    }

    execution = updateWorkflowExecution(execution, {
      status: WorkflowExecutionStatus.RUNNING,
    });
    this.executions.set(executionId, execution);

    this.emit('execution:resumed', { execution });

    // Resume scheduling
    this.scheduleNextNodes(executionId, workflow);

    return true;
  }

  /**
   * Cancel workflow execution
   */
  cancelExecution(executionId: string): boolean {
    let execution = this.executions.get(executionId);
    if (!execution) {
      return false;
    }

    // Cancel all running tasks
    this.executor.clearActiveExecutions();

    execution = updateWorkflowExecution(execution, {
      status: WorkflowExecutionStatus.CANCELLED,
      finishedAt: Date.now(),
    });
    this.executions.set(executionId, execution);

    this.emit('execution:cancelled', { execution });
    return true;
  }

  /**
   * Get execution history for a workflow
   */
  getExecutionHistory(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(e => e.workflowId === workflowId);
  }

  // ==================== Node State Management ====================

  /**
   * Initialize node states for execution
   */
  private initializeNodeStates(executionId: string, workflow: Workflow): void {
    const nodeStates = new Map<string, NodeExecutionState>();

    for (const task of workflow.nodes) {
      nodeStates.set(task.id, {
        task,
        execution: createTaskExecution(task.id, executionId, {}),
        status: 'pending',
        dependenciesCompleted: task.dependencies.length === 0,
      });
    }

    this.nodeStates.set(executionId, nodeStates);
  }

  /**
   * Get node state
   */
  private getNodeState(executionId: string, nodeId: string): NodeExecutionState | undefined {
    return this.nodeStates.get(executionId)?.get(nodeId);
  }

  /**
   * Update node state
   */
  private updateNodeState(
    executionId: string,
    nodeId: string,
    updates: Partial<NodeExecutionState>
  ): void {
    const states = this.nodeStates.get(executionId);
    if (!states) {
      return;
    }

    const state = states.get(nodeId);
    if (!state) {
      return;
    }

    Object.assign(state, updates);
  }

  // ==================== Execution Scheduling ====================

  /**
   * Schedule next nodes for execution
   */
  private async scheduleNextNodes(executionId: string, workflow: Workflow): Promise<void> {
    let execution = this.executions.get(executionId);
    if (!execution) {
      return;
    }

    const nodeStates = this.nodeStates.get(executionId);
    if (!nodeStates) {
      return;
    }

    // Get executable nodes
    const executableNodes = this.getExecutableNodes(executionId, workflow, nodeStates);

    if (executableNodes.length === 0) {
      // Check if workflow is complete
      this.checkWorkflowCompletion(executionId, workflow);
      return;
    }

    // Update current nodes
    execution = updateWorkflowExecution(execution, {
      currentNodeIds: executableNodes.map(n => n.task.id),
    });

    // Execute nodes
    for (const { task, execution: taskExec } of executableNodes) {
      this.executeNode(executionId, workflow, task, taskExec);
    }
  }

  /**
   * Get nodes ready for execution
   */
  private getExecutableNodes(
    executionId: string,
    workflow: Workflow,
    nodeStates: Map<string, NodeExecutionState>
  ): Array<{ task: Task; execution: TaskExecution }> {
    const result: Array<{ task: Task; execution: TaskExecution }> = [];
    const execution = this.executions.get(executionId);
    if (!execution) {
      return result;
    }

    for (const [, state] of nodeStates) {
      // Skip already processed nodes
      if (state.status !== 'pending') {
        continue;
      }

      // Check if dependencies are completed
      if (!state.dependenciesCompleted) {
        continue;
      }

      // Check for parallel execution limit
      if (
        this.config.enableParallelExecution &&
        execution.currentNodeIds.length >= this.config.maxParallelNodes
      ) {
        break;
      }

      result.push({ task: state.task, execution: state.execution });
    }

    return result;
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    executionId: string,
    workflow: Workflow,
    task: Task,
    taskExecution: TaskExecution
  ): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return;
    }

    this.updateNodeState(executionId, task.id, {
      status: 'running',
    });

    // Update execution
    this.executions.set(
      executionId,
      updateWorkflowExecution(execution, {
        status: WorkflowExecutionStatus.RUNNING,
        nodeExecutions: new Map(execution.nodeExecutions).set(task.id, taskExecution.id),
      })
    );

    try {
      // Execute the task
      const result = await this.executor.executeTask(
        task,
        taskExecution,
        execution.input,
        execution.context
      );

      // Process result
      await this.processNodeResult(executionId, workflow, task, result);
    } catch (error) {
      // Handle execution error
      await this.processNodeError(executionId, workflow, task, error as Error);
    }
  }

  /**
   * Process node execution result
   */
  private async processNodeResult(
    executionId: string,
    workflow: Workflow,
    task: Task,
    result: TaskExecutionResult
  ): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return;
    }

    const state = this.getNodeState(executionId, task.id);
    if (!state) {
      return;
    }

    // Update state based on result
    const newState: NodeExecutionState['status'] = result.success ? 'completed' : 'failed';

    this.updateNodeState(executionId, task.id, {
      status: newState,
      execution: updateTaskExecution(state.execution, {
        status: result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
        output: result.output,
        error: result.error
          ? {
              code: result.error.code,
              message: result.error.message,
              details: result.error.details,
            }
          : undefined,
        finishedAt: Date.now(),
        duration: result.duration,
      }),
    });

    // Update execution record
    const currentNodeIds = execution.currentNodeIds.filter(id => id !== task.id);
    const completedNodeIds = [...execution.completedNodeIds];

    if (result.success) {
      completedNodeIds.push(task.id);

      // Update context with output
      if (result.output !== undefined) {
        execution.context[`node.${task.id}.output`] = result.output;
      }
    } else {
      execution.failedNodeIds.push(task.id);
    }

    this.executions.set(
      executionId,
      updateWorkflowExecution(execution, {
        currentNodeIds,
        completedNodeIds,
        context: execution.context,
      })
    );

    // Update dependencies for downstream nodes
    this.updateDependencyStatus(executionId, workflow, task.id);

    // Continue execution or handle completion
    if (result.success || this.config.continueOnError) {
      this.scheduleNextNodes(executionId, workflow);
    } else {
      this.handleWorkflowFailure(executionId, workflow, task.id, result.error);
    }
  }

  /**
   * Process node execution error
   */
  private async processNodeError(
    executionId: string,
    workflow: Workflow,
    task: Task,
    error: Error
  ): Promise<void> {
    const state = this.getNodeState(executionId, task.id);
    if (!state) {
      return;
    }

    const result: TaskExecutionResult = {
      success: false,
      error: {
        code: 'WF_003',
        message: error.message,
        details: error.stack,
      },
      duration: Date.now() - (state.execution.startedAt ?? Date.now()),
    };

    await this.processNodeResult(executionId, workflow, task, result);
  }

  /**
   * Update dependency status for downstream nodes
   */
  private updateDependencyStatus(
    executionId: string,
    workflow: Workflow,
    completedNodeId: string
  ): void {
    const nodeStates = this.nodeStates.get(executionId);
    if (!nodeStates) {
      return;
    }

    // Find nodes that depend on the completed node
    for (const [nodeId, state] of nodeStates) {
      if (state.status !== 'pending') {
        continue;
      }

      // Check if this node depends on the completed node
      const dependsOnCompleted = state.task.dependencies.some(
        dep => dep.taskId === completedNodeId
      );

      if (!dependsOnCompleted) {
        continue;
      }

      // Check if all dependencies are now completed
      const allDependenciesCompleted = state.task.dependencies.every(dep => {
        const depState = nodeStates.get(dep.taskId);
        if (!depState) {
          return false;
        }

        // Check required status
        if (dep.requiredStatus) {
          return depState.execution.status === dep.requiredStatus;
        }

        return depState.status === 'completed';
      });

      if (allDependenciesCompleted) {
        this.updateNodeState(executionId, nodeId, {
          dependenciesCompleted: true,
        });
      }
    }
  }

  /**
   * Check if workflow is complete
   */
  private checkWorkflowCompletion(executionId: string, workflow: Workflow): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return;
    }

    const nodeStates = this.nodeStates.get(executionId);
    if (!nodeStates) {
      return;
    }

    // Check if all nodes are in final state
    let allCompleted = true;
    let hasFailed = false;

    for (const state of nodeStates.values()) {
      if (state.status === 'pending' || state.status === 'running') {
        allCompleted = false;
        break;
      }
      if (state.status === 'failed') {
        hasFailed = true;
      }
    }

    if (!allCompleted) {
      return;
    }

    // Workflow is complete
    const finalStatus = hasFailed
      ? WorkflowExecutionStatus.FAILED
      : WorkflowExecutionStatus.COMPLETED;

    this.executions.set(
      executionId,
      updateWorkflowExecution(execution, {
        status: finalStatus,
        finishedAt: Date.now(),
        duration: Date.now() - (execution.startedAt ?? execution.createdAt),
        result: this.collectResults(executionId, workflow),
        error: hasFailed
          ? {
              code: 'WF_003',
              message: 'One or more tasks failed',
            }
          : undefined,
      })
    );

    this.emit('execution:completed', {
      execution: this.executions.get(executionId),
      success: !hasFailed,
    });

    // Cleanup
    this.cleanupExecution(executionId);
  }

  /**
   * Handle workflow failure
   */
  private handleWorkflowFailure(
    executionId: string,
    workflow: Workflow,
    failedNodeId: string,
    error?: { code: string; message: string; details?: unknown }
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return;
    }

    this.executions.set(
      executionId,
      updateWorkflowExecution(execution, {
        status: WorkflowExecutionStatus.FAILED,
        finishedAt: Date.now(),
        duration: Date.now() - (execution.startedAt ?? execution.createdAt),
        error: {
          code: error?.code ?? 'WF_003',
          message: error?.message ?? 'Workflow execution failed',
          nodeId: failedNodeId,
          details: error?.details,
        },
      })
    );

    this.emit('execution:failed', {
      execution: this.executions.get(executionId),
      failedNodeId,
    });

    this.cleanupExecution(executionId);
  }

  /**
   * Collect results from all completed nodes
   */
  private collectResults(executionId: string, _workflow: Workflow): Record<string, unknown> {
    const results: Record<string, unknown> = {};
    const nodeStates = this.nodeStates.get(executionId);

    if (!nodeStates) {
      return results;
    }

    for (const [nodeId, state] of nodeStates) {
      if (state.status === 'completed' && state.execution.output !== undefined) {
        results[nodeId] = state.execution.output;
      }
    }

    return results;
  }

  // ==================== Snapshot & Recovery ====================

  /**
   * Create execution snapshot
   */
  createSnapshot(executionId: string): WorkflowExecutionSnapshot | null {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return null;
    }

    return createWorkflowSnapshot(execution);
  }

  /**
   * Recover execution from snapshot
   */
  async recoverFromSnapshot(snapshot: WorkflowExecutionSnapshot): Promise<boolean> {
    const workflow = this.workflows.get(snapshot.data.status as unknown as string);
    if (!workflow) {
      // Need to restore from workflow ID stored in snapshot
      return false;
    }

    // Restore execution state
    const execution = this.executions.get(snapshot.executionId);
    if (!execution) {
      return false;
    }

    // Apply snapshot data
    Object.assign(execution, snapshot.data);

    // Resume execution
    if (execution.status === WorkflowExecutionStatus.PAUSED) {
      return this.resumeExecution(snapshot.executionId);
    }

    return false;
  }

  /**
   * Start snapshot timer
   */
  private startSnapshotTimer(): void {
    if (this.snapshotTimer) {
      return;
    }

    this.snapshotTimer = setInterval(() => {
      for (const execution of this.executions.values()) {
        if (execution.status === WorkflowExecutionStatus.RUNNING) {
          const snapshot = this.createSnapshot(execution.id);
          if (snapshot) {
            this.emit('execution:snapshot', { executionId: execution.id, snapshot });
          }
        }
      }
    }, this.config.snapshotInterval);
  }

  /**
   * Stop snapshot timer
   */
  private stopSnapshotTimer(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }
  }

  // ==================== Cleanup ====================

  /**
   * Cleanup execution resources
   */
  private cleanupExecution(executionId: string): void {
    // Remove node states
    this.nodeStates.delete(executionId);

    // Stop snapshot timer if no running executions
    let hasRunning = false;
    for (const exec of this.executions.values()) {
      if (exec.status === WorkflowExecutionStatus.RUNNING) {
        hasRunning = true;
        break;
      }
    }

    if (!hasRunning) {
      this.stopSnapshotTimer();
    }
  }

  /**
   * Forward executor events
   */
  private forwardExecutorEvents(): void {
    this.executor.on('task:start', data => {
      this.emit('task:start', data);
    });

    this.executor.on('task:complete', data => {
      this.emit('task:complete', data);
    });

    this.executor.on('task:error', data => {
      this.emit('task:error', data);
    });

    this.executor.on('task:timeout', data => {
      this.emit('task:timeout', data);
    });

    this.executor.on('task:cancelled', data => {
      this.emit('task:cancelled', data);
    });
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.stopSnapshotTimer();
    this.executor.clearActiveExecutions();
    this.workflows.clear();
    this.executions.clear();
    this.nodeStates.clear();
    this.removeAllListeners();
    this.logger.info('WorkflowEngine disposed');
  }
}
