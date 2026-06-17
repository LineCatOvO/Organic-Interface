import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UIOperationManager, OPERATION_PERMISSIONS, SENSITIVE_OPERATIONS } from '../UIOperation.js';

type UIOperationType =
  | 'click'
  | 'input'
  | 'select'
  | 'scroll'
  | 'hover'
  | 'wait'
  | 'getText'
  | 'getAttribute'
  | 'screenshot';
type UIOperationStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const OP_TYPES = {
  click: 'click' as UIOperationType,
  input: 'input' as UIOperationType,
  select: 'select' as UIOperationType,
  scroll: 'scroll' as UIOperationType,
  hover: 'hover' as UIOperationType,
  wait: 'wait' as UIOperationType,
  getText: 'getText' as UIOperationType,
  getAttribute: 'getAttribute' as UIOperationType,
  screenshot: 'screenshot' as UIOperationType,
};

const OP_STATUS = {
  pending: 'pending' as UIOperationStatus,
  running: 'running' as UIOperationStatus,
  success: 'success' as UIOperationStatus,
  failed: 'failed' as UIOperationStatus,
  cancelled: 'cancelled' as UIOperationStatus,
};

describe('UIOperation', () => {
  describe('UIOperationType', () => {
    it('should have correct operation types', () => {
      expect(OP_TYPES.click).toBe('click');
      expect(OP_TYPES.input).toBe('input');
      expect(OP_TYPES.select).toBe('select');
      expect(OP_TYPES.scroll).toBe('scroll');
      expect(OP_TYPES.hover).toBe('hover');
      expect(OP_TYPES.wait).toBe('wait');
      expect(OP_TYPES.getText).toBe('getText');
      expect(OP_TYPES.getAttribute).toBe('getAttribute');
      expect(OP_TYPES.screenshot).toBe('screenshot');
    });
  });

  describe('UIOperationStatus', () => {
    it('should have correct statuses', () => {
      expect(OP_STATUS.pending).toBe('pending');
      expect(OP_STATUS.running).toBe('running');
      expect(OP_STATUS.success).toBe('success');
      expect(OP_STATUS.failed).toBe('failed');
      expect(OP_STATUS.cancelled).toBe('cancelled');
    });
  });

  describe('OPERATION_PERMISSIONS', () => {
    it('should define permissions for all operations', () => {
      expect(OPERATION_PERMISSIONS.click).toBe('L2');
      expect(OPERATION_PERMISSIONS.input).toBe('L2');
      expect(OPERATION_PERMISSIONS.select).toBe('L2');
      expect(OPERATION_PERMISSIONS.scroll).toBe('L1');
      expect(OPERATION_PERMISSIONS.hover).toBe('L1');
    });
  });

  describe('SENSITIVE_OPERATIONS', () => {
    it('should include input and click as sensitive', () => {
      expect(SENSITIVE_OPERATIONS).toContain('input');
      expect(SENSITIVE_OPERATIONS).toContain('click');
    });
  });
});

describe('UIOperationManager', () => {
  let manager: UIOperationManager;

  beforeEach(() => {
    manager = new UIOperationManager();
  });

  describe('constructor', () => {
    it('should create manager instance', () => {
      expect(manager).toBeDefined();
    });
  });

  describe('registerHandler', () => {
    it('should register operation handler', () => {
      const mockHandler = {
        getType: () => OP_TYPES.click,
        supports: (op: UIOperationType) => op === OP_TYPES.click,
        execute: vi.fn().mockResolvedValue({
          operationId: 'op-1',
          type: OP_TYPES.click,
          success: true,
          executionTime: 10,
          status: 'success',
          timestamp: Date.now(),
        }),
        validate: () => [],
      };

      manager.registerHandler(mockHandler as any);
      const handler = manager.getHandler(OP_TYPES.click);
      expect(handler).toBeDefined();
    });
  });

  describe('unregisterHandler', () => {
    it('should unregister handler', () => {
      const mockHandler = {
        getType: () => OP_TYPES.click,
        supports: vi.fn(),
        execute: vi.fn(),
        validate: () => [],
      };

      manager.registerHandler(mockHandler as any);
      const result = manager.unregisterHandler(OP_TYPES.click);
      expect(result).toBe(true);
    });

    it('should return false for non-existent handler', () => {
      const result = manager.unregisterHandler(OP_TYPES.click);
      expect(result).toBe(false);
    });
  });

  describe('getHandler', () => {
    it('should get registered handler', () => {
      const mockHandler = {
        getType: () => OP_TYPES.click,
        supports: vi.fn(),
        execute: vi.fn(),
        validate: () => [],
      };

      manager.registerHandler(mockHandler as any);
      const handler = manager.getHandler(OP_TYPES.click);
      expect(handler).toBeDefined();
    });

    it('should return undefined for non-existent handler', () => {
      const handler = manager.getHandler(OP_TYPES.click);
      expect(handler).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('should return error for unregistered operation', async () => {
      const result = await manager.execute(
        OP_TYPES.click,
        { selector: '#button' },
        {
          operationId: 'op-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          permissionLevel: 'L2',
          timeout: 5000,
          retryCount: 0,
          sandboxEnabled: true,
          metadata: {},
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler registered');
    });

    it('should execute registered operation', async () => {
      const mockHandler = {
        getType: () => OP_TYPES.click,
        supports: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue({
          operationId: 'op-1',
          type: OP_TYPES.click,
          success: true,
          executionTime: 10,
          status: 'success',
          timestamp: Date.now(),
        }),
        validate: () => [],
      };

      manager.registerHandler(mockHandler as any);

      const result = await manager.execute(
        OP_TYPES.click,
        { selector: '#button' },
        {
          operationId: 'op-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          permissionLevel: 'L2',
          timeout: 5000,
          retryCount: 0,
          sandboxEnabled: true,
          metadata: {},
        }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('requiresConfirmation', () => {
    it('should return true for sensitive operations', () => {
      expect(manager.requiresConfirmation(OP_TYPES.input)).toBe(true);
      expect(manager.requiresConfirmation(OP_TYPES.click)).toBe(true);
    });

    it('should return false for non-sensitive operations', () => {
      expect(manager.requiresConfirmation(OP_TYPES.scroll)).toBe(false);
      expect(manager.requiresConfirmation(OP_TYPES.getText)).toBe(false);
    });
  });

  describe('isAllowed', () => {
    it('should return true when permission level is sufficient', () => {
      expect(manager.isAllowed(OP_TYPES.click, 'L2')).toBe(true);
      expect(manager.isAllowed(OP_TYPES.scroll, 'L1')).toBe(true);
    });

    it('should return false when permission level is insufficient', () => {
      expect(manager.isAllowed(OP_TYPES.click, 'L1')).toBe(false);
    });
  });

  describe('getSupportedOperations', () => {
    it('should return empty array when no handlers registered', () => {
      const operations = manager.getSupportedOperations();
      expect(operations).toEqual([]);
    });

    it('should return registered operation types', () => {
      const mockHandler = {
        getType: () => OP_TYPES.click,
        supports: vi.fn(),
        execute: vi.fn(),
        validate: () => [],
      };

      manager.registerHandler(mockHandler as any);
      const operations = manager.getSupportedOperations();
      expect(operations).toContain(OP_TYPES.click);
    });

    it('should return multiple registered operation types', () => {
      manager.registerHandler({
        getType: () => OP_TYPES.click,
        supports: vi.fn(),
        execute: vi.fn(),
        validate: () => [],
      } as any);
      manager.registerHandler({
        getType: () => OP_TYPES.scroll,
        supports: vi.fn(),
        execute: vi.fn(),
        validate: () => [],
      } as any);

      const operations = manager.getSupportedOperations();
      expect(operations).toHaveLength(2);
      expect(operations).toContain(OP_TYPES.click);
      expect(operations).toContain(OP_TYPES.scroll);
    });
  });

  // Traceability: ST-07 covers execute validation failure path
  describe('execute validation failure', () => {
    it('should return error when validation fails', async () => {
      const mockHandler = {
        getType: () => OP_TYPES.click,
        supports: vi.fn().mockReturnValue(true),
        execute: vi.fn(),
        validate: () => [
          { path: 'selector', message: 'Selector is required', expected: 'string', actual: null },
        ],
      };

      manager.registerHandler(mockHandler as any);

      const result = await manager.execute(
        OP_TYPES.click,
        { selector: '' },
        {
          operationId: 'op-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          permissionLevel: 'L2',
          timeout: 5000,
          retryCount: 0,
          sandboxEnabled: true,
          metadata: {},
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(result.error).toContain('Selector is required');
      expect(result.metadata?.validationErrors).toHaveLength(1);
    });
  });

  // Traceability: ST-07 covers execute retry logic
  describe('execute retry logic', () => {
    it('should retry on failure and succeed on retry', async () => {
      const executeMock = vi.fn();
      executeMock
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({
          operationId: 'op-1',
          type: OP_TYPES.click,
          success: true,
          executionTime: 10,
          status: 'success',
          timestamp: Date.now(),
        });

      const mockHandler = {
        getType: () => OP_TYPES.click,
        supports: vi.fn().mockReturnValue(true),
        execute: executeMock,
        validate: () => [],
      };

      manager.registerHandler(mockHandler as any);

      const result = await manager.execute(
        OP_TYPES.click,
        { selector: '#button' },
        {
          operationId: 'op-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          permissionLevel: 'L2',
          timeout: 5000,
          retryCount: 2,
          sandboxEnabled: true,
          metadata: {},
        }
      );

      expect(result.success).toBe(true);
      expect(executeMock).toHaveBeenCalledTimes(2);
    });

    it('should fail after all retries exhausted', async () => {
      const executeMock = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const mockHandler = {
        getType: () => OP_TYPES.click,
        supports: vi.fn().mockReturnValue(true),
        execute: executeMock,
        validate: () => [],
      };

      manager.registerHandler(mockHandler as any);

      const result = await manager.execute(
        OP_TYPES.click,
        { selector: '#button' },
        {
          operationId: 'op-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          permissionLevel: 'L2',
          timeout: 5000,
          retryCount: 1,
          sandboxEnabled: true,
          metadata: {},
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent failure');
      expect(executeMock).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should handle non-Error thrown values during retry', async () => {
      const executeMock = vi.fn().mockRejectedValue('String error');

      const mockHandler = {
        getType: () => OP_TYPES.click,
        supports: vi.fn().mockReturnValue(true),
        execute: executeMock,
        validate: () => [],
      };

      manager.registerHandler(mockHandler as any);

      const result = await manager.execute(
        OP_TYPES.click,
        { selector: '#button' },
        {
          operationId: 'op-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          permissionLevel: 'L2',
          timeout: 5000,
          retryCount: 0,
          sandboxEnabled: true,
          metadata: {},
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  // Traceability: ST-07 covers execute events
  describe('execute events', () => {
    it('should emit operation:start and operation:complete events', async () => {
      const mockHandler = {
        getType: () => OP_TYPES.click,
        supports: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue({
          operationId: 'op-1',
          type: OP_TYPES.click,
          success: true,
          executionTime: 10,
          status: 'success',
          timestamp: Date.now(),
        }),
        validate: () => [],
      };

      manager.registerHandler(mockHandler as any);

      const startHandler = vi.fn();
      const completeHandler = vi.fn();
      manager.on('operation:start', startHandler);
      manager.on('operation:complete', completeHandler);

      await manager.execute(
        OP_TYPES.click,
        { selector: '#button' },
        {
          operationId: 'op-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          permissionLevel: 'L2',
          timeout: 5000,
          retryCount: 0,
          sandboxEnabled: true,
          metadata: {},
        }
      );

      expect(startHandler).toHaveBeenCalled();
      expect(completeHandler).toHaveBeenCalled();
    });
  });

  // Traceability: ST-07 covers isAllowed with all permission levels
  describe('isAllowed all permission levels', () => {
    it('should allow L3 and L4 for L2 operations', () => {
      expect(manager.isAllowed(OP_TYPES.click, 'L3')).toBe(true);
      expect(manager.isAllowed(OP_TYPES.click, 'L4')).toBe(true);
    });

    it('should allow L2, L3, L4 for L1 operations', () => {
      expect(manager.isAllowed(OP_TYPES.scroll, 'L1')).toBe(true);
      expect(manager.isAllowed(OP_TYPES.scroll, 'L2')).toBe(true);
      expect(manager.isAllowed(OP_TYPES.scroll, 'L3')).toBe(true);
      expect(manager.isAllowed(OP_TYPES.scroll, 'L4')).toBe(true);
    });

    it('should not allow L1 for L2 operations', () => {
      expect(manager.isAllowed(OP_TYPES.input, 'L1')).toBe(false);
      expect(manager.isAllowed(OP_TYPES.select, 'L1')).toBe(false);
    });
  });

  // Traceability: ST-07 covers requiresConfirmation for all operation types
  describe('requiresConfirmation all operations', () => {
    it('should return true for all sensitive operations', () => {
      expect(manager.requiresConfirmation(OP_TYPES.input)).toBe(true);
      expect(manager.requiresConfirmation(OP_TYPES.click)).toBe(true);
    });

    it('should return false for all non-sensitive operations', () => {
      expect(manager.requiresConfirmation(OP_TYPES.select)).toBe(false);
      expect(manager.requiresConfirmation(OP_TYPES.scroll)).toBe(false);
      expect(manager.requiresConfirmation(OP_TYPES.hover)).toBe(false);
      expect(manager.requiresConfirmation(OP_TYPES.wait)).toBe(false);
      expect(manager.requiresConfirmation(OP_TYPES.getText)).toBe(false);
      expect(manager.requiresConfirmation(OP_TYPES.getAttribute)).toBe(false);
      expect(manager.requiresConfirmation(OP_TYPES.screenshot)).toBe(false);
    });
  });

  // Traceability: ST-07 covers OPERATION_PERMISSIONS for all operations
  describe('OPERATION_PERMISSIONS all operations', () => {
    it('should define L2 for click, input, select', () => {
      expect(OPERATION_PERMISSIONS.click).toBe('L2');
      expect(OPERATION_PERMISSIONS.input).toBe('L2');
      expect(OPERATION_PERMISSIONS.select).toBe('L2');
    });

    it('should define L1 for scroll, hover, wait, getText, getAttribute, screenshot', () => {
      expect(OPERATION_PERMISSIONS.scroll).toBe('L1');
      expect(OPERATION_PERMISSIONS.hover).toBe('L1');
      expect(OPERATION_PERMISSIONS.wait).toBe('L1');
      expect(OPERATION_PERMISSIONS.getText).toBe('L1');
      expect(OPERATION_PERMISSIONS.getAttribute).toBe('L1');
      expect(OPERATION_PERMISSIONS.screenshot).toBe('L1');
    });
  });
});
