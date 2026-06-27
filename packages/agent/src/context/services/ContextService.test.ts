import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ContextService,
  PropagationMode,
  DEFAULT_CONTEXT_SERVICE_CONFIG,
} from './ContextService.js';
import { ContextItemType } from '../models/ContextItem.js';
import { ContentFormat, MessageType, MessageStatus } from '../Message.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ContextService', () => {
  let service: ContextService;

  const createTestParticipants = () => [
    { id: 'user-1', type: 'user' as const, name: 'Test User', joinedAt: Date.now() },
    {
      id: 'agent-1',
      type: 'agent' as const,
      name: 'Test Agent',
      role: 'assistant',
      joinedAt: Date.now(),
    },
  ];

  beforeEach(() => {
    service = new ContextService({ autoCleanup: false });
  });

  afterEach(() => {
    service.dispose();
  });

  describe('constructor', () => {
    it('should create service with default config', () => {
      expect(service).toBeInstanceOf(ContextService);
    });

    it('should accept custom config', () => {
      const customService = new ContextService({
        maxWindowSize: 50,
        ttl: 60000,
        enablePropagation: false,
        maxNestingDepth: 10,
      });
      expect(customService).toBeInstanceOf(ContextService);
      customService.dispose();
    });
  });

  describe('createContext', () => {
    it('should create new context', () => {
      const context = service.createContext('session-1', createTestParticipants());

      expect(context).not.toBeNull();
      expect(typeof context.id).toBe('string');
      expect(context.sessionId).toBe('session-1');
      expect(context.status).toBe('active');
    });

    it('should create context with metadata', () => {
      const context = service.createContext('session-1', createTestParticipants(), {
        createdBy: 'test-creator',
        tags: ['test', 'unit'],
      });

      expect(context.metadata.createdBy).toBe('test-creator');
      expect(context.metadata.tags).toContain('test');
    });

    it('should emit context:created event', () => {
      const handler = vi.fn();
      service.on('context:created', handler);

      service.createContext('session-1', createTestParticipants());

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getContext', () => {
    it('should return context by ID', () => {
      const created = service.createContext('session-1', createTestParticipants());
      const retrieved = service.getContext(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent context', () => {
      const result = service.getContext('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('deleteContext', () => {
    it('should delete existing context', () => {
      const context = service.createContext('session-1', createTestParticipants());
      const result = service.deleteContext(context.id);

      expect(result).toBe(true);
      expect(service.getContext(context.id)).toBeNull();
    });

    it('should return false for non-existent context', () => {
      const result = service.deleteContext('non-existent-id');
      expect(result).toBe(false);
    });

    it('should emit context:deleted event', () => {
      const context = service.createContext('session-1', createTestParticipants());
      const handler = vi.fn();
      service.on('context:deleted', handler);

      service.deleteContext(context.id);

      expect(handler).toHaveBeenCalledWith(context.id);
    });
  });

  describe('archiveContext', () => {
    it('should archive existing context', () => {
      const context = service.createContext('session-1', createTestParticipants());
      const result = service.archiveContext(context.id);

      expect(result).toBe(true);
    });
  });

  describe('restoreContext', () => {
    it('should restore archived context', () => {
      const context = service.createContext('session-1', createTestParticipants());
      service.archiveContext(context.id);

      const restored = service.restoreContext(context.id);
      expect(restored).not.toBeNull();
      expect(restored?.status).toBe('active');
    });
  });

  describe('addMessage', () => {
    it('should add message to context', () => {
      const context = service.createContext('session-1', createTestParticipants());
      const message = {
        id: 'msg-1',
        sender: { id: 'user-1', type: 'user' as const, name: 'User' },
        content: { text: 'Hello', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
        timestamp: Date.now(),
        status: MessageStatus.SENT,
        flags: [],
      };

      const result = service.addMessage(context.id, message);
      expect(result).toBe(true);
    });
  });

  describe('getMessages', () => {
    it('should return messages with pagination', () => {
      const context = service.createContext('session-1', createTestParticipants());

      for (let i = 0; i < 5; i++) {
        service.addMessage(context.id, {
          id: `msg-${i}`,
          sender: { id: 'user-1', type: 'user' as const, name: 'User' },
          content: { text: `Message ${i}`, format: ContentFormat.PLAIN_TEXT },
          type: MessageType.USER_MESSAGE,
          timestamp: Date.now(),
          status: MessageStatus.SENT,
          flags: [],
        });
      }

      const messages = service.getMessages(context.id, { offset: 2, limit: 2 });
      expect(messages).toHaveLength(2);
    });
  });

  describe('getRecentMessages', () => {
    it('should return last N messages', () => {
      const context = service.createContext('session-1', createTestParticipants());

      for (let i = 0; i < 5; i++) {
        service.addMessage(context.id, {
          id: `msg-${i}`,
          sender: { id: 'user-1', type: 'user' as const, name: 'User' },
          content: { text: `Message ${i}`, format: ContentFormat.PLAIN_TEXT },
          type: MessageType.USER_MESSAGE,
          timestamp: Date.now(),
          status: MessageStatus.SENT,
          flags: [],
        });
      }

      const recent = service.getRecentMessages(context.id, 3);
      expect(recent).toHaveLength(3);
    });
  });

  describe('context item management', () => {
    it('should add context item', () => {
      const context = service.createContext('session-1', createTestParticipants());
      const item = {
        id: 'item-1',
        type: ContextItemType.MESSAGE,
        content: { text: 'test' },
        contextId: context.id,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      service.addContextItem(item);
      const retrieved = service.getContextItem(context.id, 'item-1');
      expect(retrieved).not.toBeNull();
    });

    it('should get all context items with filter', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.addContextItem({
        id: 'item-1',
        type: ContextItemType.MESSAGE,
        content: { text: 'test' },
        contextId: context.id,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { tags: ['important'] },
      });

      const items = service.getContextItems(context.id, { tags: ['important'] });
      expect(items.length).toBeGreaterThan(0);
    });

    it('should update context item', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.addContextItem({
        id: 'item-1',
        type: ContextItemType.STATE,
        content: 'initial',
        contextId: context.id,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      });

      const updated = service.updateContextItem(context.id, 'item-1', {
        content: 'updated',
      });

      expect(updated?.content).toBe('updated');
    });

    it('should delete context item', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.addContextItem({
        id: 'item-1',
        type: ContextItemType.STATE,
        content: 'test',
        contextId: context.id,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      });

      const result = service.deleteContextItem(context.id, 'item-1');
      expect(result).toBe(true);
    });

    it('should return null for non-existent context item', () => {
      const context = service.createContext('session-1', createTestParticipants());
      const item = service.getContextItem(context.id, 'non-existent');
      expect(item).toBeNull();
    });

    it('should return null for context item from non-existent context', () => {
      const item = service.getContextItem('non-existent', 'item-1');
      expect(item).toBeNull();
    });

    it('should filter expired items when includeExpired is false', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.addContextItem({
        id: 'expired-item',
        type: ContextItemType.MESSAGE,
        content: { text: 'expired' },
        contextId: context.id,
        createdAt: Date.now() - 2000,
        accessedAt: Date.now() - 2000,
        updatedAt: Date.now() - 2000,
        expiresAt: Date.now() - 1000,
        metadata: {},
      });

      const items = service.getContextItems(context.id, { includeExpired: false });
      expect(items.length).toBe(0);
    });

    it('should filter items by time range', () => {
      const context = service.createContext('session-1', createTestParticipants());
      const now = Date.now();

      service.addContextItem({
        id: 'old-item',
        type: ContextItemType.MESSAGE,
        content: { text: 'old' },
        contextId: context.id,
        createdAt: now - 5000,
        accessedAt: now - 5000,
        updatedAt: now - 5000,
        metadata: {},
      });

      service.addContextItem({
        id: 'new-item',
        type: ContextItemType.MESSAGE,
        content: { text: 'new' },
        contextId: context.id,
        createdAt: now,
        accessedAt: now,
        updatedAt: now,
        metadata: {},
      });

      const items = service.getContextItems(context.id, {
        timeRange: { start: now - 1000, end: now + 1000 },
      });
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('new-item');
    });

    it('should update non-existent context item returns null', () => {
      const context = service.createContext('session-1', createTestParticipants());
      const result = service.updateContextItem(context.id, 'non-existent', { content: 'new' });
      expect(result).toBeNull();
    });

    it('should delete item from non-existent context returns false', () => {
      const result = service.deleteContextItem('non-existent', 'item-1');
      expect(result).toBe(false);
    });
  });

  describe('state management', () => {
    it('should set and get state', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.setState(context.id, 'key1', 'value1');
      const value = service.getState(context.id, 'key1');

      expect(value).toBe('value1');
    });

    it('should delete state', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.setState(context.id, 'key1', 'value1');
      const result = service.deleteState(context.id, 'key1');

      expect(result).toBe(true);
      expect(service.getState(context.id, 'key1')).toBeUndefined();
    });

    it('should get all states in namespace', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.setState(context.id, 'key1', 'value1', { namespace: 'ns1' });
      service.setState(context.id, 'key2', 'value2', { namespace: 'ns1' });

      const states = service.getStates(context.id, 'ns1');
      expect(states.size).toBe(2);
    });
  });

  describe('execution context stack', () => {
    it('should push execution frame', () => {
      const context = service.createContext('session-1', createTestParticipants());

      const frame = service.pushExecutionFrame(context.id, 'agent-1');
      expect(frame).not.toBeNull();
      expect(frame?.agentId).toBe('agent-1');
      expect(frame?.contextId).toBe(context.id);
    });

    it('should pop execution frame', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.pushExecutionFrame(context.id, 'agent-1');
      const popped = service.popExecutionFrame(context.id, 'result');

      expect(popped).not.toBeNull();
      expect(popped?.result).toBe('result');
      expect(popped?.status).toBe('completed');
    });

    it('should handle pop with error', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.pushExecutionFrame(context.id, 'agent-1');
      const popped = service.popExecutionFrame(context.id, undefined, {
        code: 'ERR_001',
        message: 'Error occurred',
      });

      expect(popped?.status).toBe('failed');
      expect(popped?.error).not.toBeUndefined();
    });

    it('should return null when popping empty stack', () => {
      const context = service.createContext('session-1', createTestParticipants());

      const popped = service.popExecutionFrame(context.id);
      expect(popped).toBeNull();
    });

    it('should get current frame', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.pushExecutionFrame(context.id, 'agent-1');
      const frame = service.getCurrentFrame(context.id);

      expect(frame).not.toBeNull();
      expect(frame?.agentId).toBe('agent-1');
    });

    it('should return null for current frame from empty stack', () => {
      const context = service.createContext('session-1', createTestParticipants());
      const frame = service.getCurrentFrame(context.id);
      expect(frame).toBeNull();
    });

    it('should get execution stack', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.pushExecutionFrame(context.id, 'agent-1');
      const stack = service.getExecutionStack(context.id);

      expect(stack).not.toBeNull();
      expect(stack?.stack.length).toBe(1);
    });

    it('should return null for non-existent execution stack', () => {
      const stack = service.getExecutionStack('non-existent');
      expect(stack).toBeNull();
    });

    it('should respect max nesting depth', () => {
      const customService = new ContextService({
        maxNestingDepth: 2,
        autoCleanup: false,
      });
      const context = customService.createContext('session-1', createTestParticipants());

      customService.pushExecutionFrame(context.id, 'agent-1');
      customService.pushExecutionFrame(context.id, 'agent-2');
      const third = customService.pushExecutionFrame(context.id, 'agent-3');

      expect(third).toBeNull();
      customService.dispose();
    });
  });

  describe('context propagation', () => {
    it('should propagate context directly', () => {
      const context = service.createContext('session-1', createTestParticipants());

      const result = service.propagateContext(context.id, 'target-agent', PropagationMode.DIRECT, {
        includeMessages: true,
        includeStates: true,
        includeToolCalls: true,
        includeAttachments: true,
      });

      expect(result.contextId).toBe(context.id);
    });

    it('should propagate context by reference', () => {
      const context = service.createContext('session-1', createTestParticipants());

      const result = service.propagateContext(
        context.id,
        'target-agent',
        PropagationMode.REFERENCE,
        {
          includeMessages: true,
          includeStates: true,
          includeToolCalls: true,
          includeAttachments: true,
        }
      );

      expect(result.referenceId).toBe(context.id);
    });

    it('should propagate context incrementally', () => {
      const context = service.createContext('session-1', createTestParticipants());

      const result = service.propagateContext(
        context.id,
        'target-agent',
        PropagationMode.INCREMENTAL,
        {
          includeMessages: true,
          includeStates: true,
          includeToolCalls: true,
          includeAttachments: true,
        }
      );

      expect(result.incremental).not.toBeNull();
      expect(result.incremental?.messages).toBeInstanceOf(Array);
      expect(result.incremental?.states).toBeInstanceOf(Array);
      expect(result.incremental?.items).toBeInstanceOf(Array);
    });

    it('should select mode based on size in hybrid mode', () => {
      const context = service.createContext('session-1', createTestParticipants());

      const result = service.propagateContext(context.id, 'target-agent', PropagationMode.HYBRID, {
        includeMessages: true,
        includeStates: true,
        includeToolCalls: true,
        includeAttachments: true,
      });

      expect(result.contextId !== undefined || result.incremental !== undefined).toBe(true);
    });

    it('should throw error for non-existent source context', () => {
      expect(() => {
        service.propagateContext('non-existent-id', 'target-agent', PropagationMode.DIRECT, {
          includeMessages: true,
          includeStates: true,
          includeToolCalls: true,
          includeAttachments: true,
        });
      }).toThrow('Source context not found');
    });

    it('should propagate with message time range', () => {
      const context = service.createContext('session-1', createTestParticipants());
      const now = Date.now();

      service.addMessage(context.id, {
        id: 'msg-1',
        sender: { id: 'user-1', type: 'user' as const, name: 'User' },
        content: { text: 'Old message', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
        timestamp: now - 5000,
        status: MessageStatus.SENT,
        flags: [],
      });

      service.addMessage(context.id, {
        id: 'msg-2',
        sender: { id: 'user-1', type: 'user' as const, name: 'User' },
        content: { text: 'New message', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
        timestamp: now,
        status: MessageStatus.SENT,
        flags: [],
      });

      const result = service.propagateContext(
        context.id,
        'target-agent',
        PropagationMode.INCREMENTAL,
        {
          includeMessages: true,
          includeStates: false,
          includeToolCalls: false,
          includeAttachments: false,
          messageTimeRange: { start: now - 1000, end: now + 1000 },
        }
      );

      expect(result.incremental?.messages).toHaveLength(1);
    });

    it('should propagate with message limit', () => {
      const context = service.createContext('session-1', createTestParticipants());

      for (let i = 0; i < 10; i++) {
        service.addMessage(context.id, {
          id: `msg-${i}`,
          sender: { id: 'user-1', type: 'user' as const, name: 'User' },
          content: { text: `Message ${i}`, format: ContentFormat.PLAIN_TEXT },
          type: MessageType.USER_MESSAGE,
          timestamp: Date.now() + i,
          status: MessageStatus.SENT,
          flags: [],
        });
      }

      const result = service.propagateContext(
        context.id,
        'target-agent',
        PropagationMode.INCREMENTAL,
        {
          includeMessages: true,
          includeStates: false,
          includeToolCalls: false,
          includeAttachments: false,
          messageLimit: 3,
        }
      );

      expect(result.incremental?.messages).toHaveLength(3);
    });
  });

  describe('statistics', () => {
    it('should get context stats', () => {
      const context = service.createContext('session-1', createTestParticipants());

      service.addMessage(context.id, {
        id: 'msg-1',
        sender: { id: 'user-1', type: 'user' as const, name: 'User' },
        content: { text: 'Hello', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
        timestamp: Date.now(),
        status: MessageStatus.SENT,
        flags: [],
      });

      const stats = service.getStats(context.id);
      expect(stats).not.toBeNull();
      expect(stats?.messageCount).toBe(1);
      expect(stats?.participantCount).toBe(2);
    });

    it('should return null for non-existent context stats', () => {
      const stats = service.getStats('non-existent-id');
      expect(stats).toBeNull();
    });

    it('should get all context IDs', () => {
      service.createContext('session-1', createTestParticipants());
      service.createContext('session-2', createTestParticipants());

      const ids = service.getAllContextIds();
      expect(ids).toHaveLength(2);
    });

    it('should get active context count', () => {
      service.createContext('session-1', createTestParticipants());
      service.createContext('session-2', createTestParticipants());

      expect(service.getActiveContextCount()).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired contexts and items', () => {
      const customService = new ContextService({
        ttl: -1000,
        autoCleanup: false,
      });
      const context = customService.createContext('session-1', createTestParticipants());

      customService.addContextItem({
        id: 'item-1',
        type: ContextItemType.MESSAGE,
        content: 'test',
        contextId: context.id,
        createdAt: Date.now() - 2000,
        accessedAt: Date.now() - 2000,
        updatedAt: Date.now() - 2000,
        expiresAt: Date.now() - 1000,
        metadata: {},
      });

      const result = customService.cleanup();
      expect(result.deletedContexts).toBeGreaterThanOrEqual(0);
      expect(result.archivedContexts).toBeGreaterThanOrEqual(0);
      customService.dispose();
    });

    it('should stop cleanup timer', () => {
      const customService = new ContextService({ autoCleanup: true });
      customService.stopCleanupTimer();
      customService.dispose();
    });
  });

  describe('dispose', () => {
    it('should dispose service and cleanup', () => {
      service.dispose();
      expect(service.getAllContextIds()).toHaveLength(0);
    });
  });
});

describe('DEFAULT_CONTEXT_SERVICE_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CONTEXT_SERVICE_CONFIG.maxWindowSize).toBe(100);
    expect(DEFAULT_CONTEXT_SERVICE_CONFIG.ttl).toBe(3600000);
    expect(DEFAULT_CONTEXT_SERVICE_CONFIG.enablePropagation).toBe(true);
    expect(DEFAULT_CONTEXT_SERVICE_CONFIG.maxNestingDepth).toBe(5);
    expect(DEFAULT_CONTEXT_SERVICE_CONFIG.autoCleanup).toBe(true);
    expect(DEFAULT_CONTEXT_SERVICE_CONFIG.cleanupInterval).toBe(60000);
    expect(DEFAULT_CONTEXT_SERVICE_CONFIG.enableCompression).toBe(false);
  });
});
