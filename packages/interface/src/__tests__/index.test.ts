import { describe, it, expect } from 'vitest';
import { VERSION } from '../index.js';
/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  OperationType, OperationStatus, OperationResult,
  PermissionLevel, OperationContext,
  AgentStatus, IAgentSession, IAgentController,
  KernelStatus, IKernelFacade, IPluginManager,
  IToolExecutor, IStorageFacade,
  IEventBus, KernelEventData, AgentEventData,
  OperationEventData, PluginEventData,
} from '../index.js';
/* eslint-enable @typescript-eslint/no-unused-vars */

describe('@organic/interface', () => {
  it('should export VERSION constant', () => {
    expect(VERSION).toBe('0.1.0');
  });

  it('should be importable as a module', async () => {
    const mod = await import('../index.js');
    expect(mod).toBeDefined();
  });

  it('should export type interfaces at compile time', () => {
    // Type imports above verify compile-time type availability
    expect(true).toBe(true);
  });
});