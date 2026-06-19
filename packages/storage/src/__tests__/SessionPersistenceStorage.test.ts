import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type {
  SessionPersistenceStorageConfig,
  SessionPersistence,
} from '../services/SessionPersistenceStorage.js';
import {
  SessionPersistenceStorage,
  SessionPersistenceStatus,
  SessionAdapter,
} from '../services/SessionPersistenceStorage.js';
import { StorageService } from '../services/StorageService.js';
import { MemoryStorage } from '../backends/MemoryStorage.js';

describe('SessionPersistenceStorage', () => {
  let storage: SessionPersistenceStorage;
  let storageService: StorageService;
  let backend: MemoryStorage;

  const createTestSession = (overrides?: Partial<SessionPersistence>): SessionPersistence => ({
    id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Session',
    status: SessionPersistenceStatus.ACTIVE,
    tags: ['test'],
    metadata: { key: 'value' },
    contextWindow: {
      windowSize: 50,
      windowType: 'recent_messages',
      includeSystemMessages: true,
      includeToolCalls: true,
    },
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    messageCount: 0,
    ...overrides,
  });

  beforeEach(async () => {
    backend = new MemoryStorage();
    storageService = new StorageService(backend);
    await storageService.initialize();

    const config: SessionPersistenceStorageConfig = {
      storage: storageService,
      autoSave: true,
      entityTtl: 24 * 60 * 60 * 1000,
    };

    storage = new SessionPersistenceStorage(config);
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('constructor', () => {
    it('should create SessionPersistenceStorage', () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const s = new SessionPersistenceStorage(config);
      expect(s).toBeDefined();
    });

    it('should create with autoSave false', () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
        autoSave: false,
      };
      const s = new SessionPersistenceStorage(config);
      expect(s).toBeDefined();
    });

    it('should create with custom entityTtl', () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
        entityTtl: 60 * 60 * 1000,
      };
      const s = new SessionPersistenceStorage(config);
      expect(s).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should be initialized after construction', () => {
      expect(storage.isInitialized()).toBe(true);
    });
  });

  describe('save', () => {
    it('should save session', async () => {
      const session = createTestSession();
      await storage.save(session);
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
        autoSave: true,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      const session = createTestSession();
      await expect(uninitStorage.save(session)).rejects.toThrow();
    });

    it('should update existing session', async () => {
      const session = createTestSession();
      await storage.save(session);

      session.title = 'Updated Title';
      await storage.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded?.title).toBe('Updated Title');
    });

    it('should not persist when autoSave is false', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
        autoSave: false,
      };
      const noAutoSaveStorage = new SessionPersistenceStorage(config);
      await noAutoSaveStorage.initialize();

      const session = createTestSession();
      await noAutoSaveStorage.save(session);

      const loadedFromCache = await noAutoSaveStorage.load(session.id);
      expect(loadedFromCache).not.toBeNull();

      const newStorage = new SessionPersistenceStorage(config);
      await newStorage.initialize();
      const loadedFromStorage = await newStorage.load(session.id);
      expect(loadedFromStorage).toBeNull();

      await noAutoSaveStorage.close();
      await newStorage.close();
    });
  });

  describe('load', () => {
    it('should load saved session', async () => {
      const session = createTestSession();
      await storage.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(session.id);
      expect(loaded?.title).toBe(session.title);
    });

    it('should return null for non-existent session', async () => {
      const loaded = await storage.load('non-existent-id');
      expect(loaded).toBeNull();
    });

    it('should return null for expired session', async () => {
      const session = createTestSession({
        expiresAt: Date.now() - 1000,
      });
      await storage.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded).toBeNull();
    });

    it('should return null for closed session', async () => {
      const session = createTestSession({
        status: SessionPersistenceStatus.CLOSED,
      });
      await storage.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded).toBeNull();
    });

    it('should return null for archived session', async () => {
      const session = createTestSession({
        status: SessionPersistenceStatus.ARCHIVED,
      });
      await storage.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded).toBeNull();
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      await expect(uninitStorage.load('any-id')).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete session', async () => {
      const session = createTestSession();
      await storage.save(session);

      await storage.delete(session.id);

      const loaded = await storage.load(session.id);
      expect(loaded).toBeNull();
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      await expect(uninitStorage.delete('any-id')).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should list all sessions', async () => {
      const session1 = createTestSession({ id: 'session-1' });
      const session2 = createTestSession({ id: 'session-2' });

      await storage.save(session1);
      await storage.save(session2);

      const sessions = await storage.list();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });

    it('should clean up expired sessions', async () => {
      const expiredSession = createTestSession({
        id: 'expired-session',
        expiresAt: Date.now() - 1000,
      });
      await storage.save(expiredSession);

      const validSession = createTestSession({ id: 'valid-session' });
      await storage.save(validSession);

      const sessions = await storage.list();
      const ids = sessions.map(s => s.id);
      expect(ids).not.toContain('expired-session');
      expect(ids).toContain('valid-session');
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      await expect(uninitStorage.list()).rejects.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all sessions', async () => {
      const session1 = createTestSession({ id: 'clear-1' });
      const session2 = createTestSession({ id: 'clear-2' });

      await storage.save(session1);
      await storage.save(session2);

      await storage.clear();

      const count = await storage.count();
      expect(count).toBe(0);
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      await expect(uninitStorage.clear()).rejects.toThrow();
    });
  });

  describe('count', () => {
    it('should return session count', async () => {
      const initialCount = await storage.count();

      const session = createTestSession();
      await storage.save(session);

      const newCount = await storage.count();
      expect(newCount).toBe(initialCount + 1);
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      await expect(uninitStorage.count()).rejects.toThrow();
    });
  });

  describe('close', () => {
    it('should close storage', async () => {
      await storage.close();
      expect(storage.isInitialized()).toBe(false);
    });

    it('should save pending changes on close', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
        autoSave: true,
      };
      const autoSaveStorage = new SessionPersistenceStorage(config);
      await autoSaveStorage.initialize();

      const session = createTestSession();
      await autoSaveStorage.save(session);

      await autoSaveStorage.close();
    });
  });

  describe('SessionAdapter', () => {
    describe('toPersistence', () => {
      it('should convert plugin session to persistence session', () => {
        const pluginSession = {
          id: 'plugin-session',
          title: 'Plugin Session',
          status: { toString: () => 'active' },
          tags: ['plugin'],
          metadata: { plugin: true },
          contextWindow: {
            windowSize: 100,
            windowType: 'all_messages',
            includeSystemMessages: false,
            includeToolCalls: false,
          },
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          messageCount: 10,
        };

        const persistence = SessionAdapter.toPersistence(pluginSession);

        expect(persistence.id).toBe('plugin-session');
        expect(persistence.title).toBe('Plugin Session');
        expect(persistence.status).toBe('active');
        expect(persistence.tags).toEqual(['plugin']);
        expect(persistence.metadata).toEqual({ plugin: true });
      });
    });

    describe('toPlugin', () => {
      it('should convert persistence session to plugin format', () => {
        const persistenceSession: SessionPersistence = {
          id: 'persistence-session',
          title: 'Persistence Session',
          status: SessionPersistenceStatus.ACTIVE,
          tags: ['persistence'],
          metadata: { persistence: true },
          contextWindow: {
            windowSize: 75,
            windowType: 'recent',
            includeSystemMessages: true,
            includeToolCalls: false,
          },
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          messageCount: 5,
        };

        const plugin = SessionAdapter.toPlugin(persistenceSession);

        expect(plugin.id).toBe('persistence-session');
        expect(plugin.title).toBe('Persistence Session');
        expect(plugin.status.toString()).toBe('active');
        expect(plugin.tags).toEqual(['persistence']);
      });

      it('should handle all optional fields in toPlugin', () => {
        const fullSession: SessionPersistence = {
          id: 'full-session',
          title: 'Full Session',
          status: SessionPersistenceStatus.IDLE,
          tags: ['tag1', 'tag2'],
          metadata: { complex: { nested: true } },
          contextWindow: {
            windowSize: 200,
            windowType: 'sliding_window',
            includeSystemMessages: false,
            includeToolCalls: true,
            maxTokens: 8000,
          },
          createdAt: 1000,
          lastActiveAt: 2000,
          expiresAt: 3000,
          messageCount: 42,
          projectId: 'project-123',
        };

        const plugin = SessionAdapter.toPlugin(fullSession);

        expect(plugin.id).toBe('full-session');
        expect(plugin.expiresAt).toBe(3000);
        expect(plugin.projectId).toBe('project-123');
        expect(plugin.messageCount).toBe(42);
      });
    });

    describe('toPersistence edge cases', () => {
      it('should convert all optional fields in toPersistence', () => {
        const pluginSession = {
          id: 'optional-session',
          title: 'Optional Fields Session',
          status: { toString: () => 'idle' } as { toString(): string },
          tags: ['opt1', 'opt2'],
          metadata: { key: 'value' },
          contextWindow: {
            windowSize: 150,
            windowType: 'custom',
            includeSystemMessages: false,
            includeToolCalls: true,
            maxTokens: 10000,
          },
          createdAt: 5000,
          lastActiveAt: 6000,
          expiresAt: 7000,
          messageCount: 99,
          projectId: 'proj-abc',
        };

        const persistence = SessionAdapter.toPersistence(pluginSession);

        expect(persistence.expiresAt).toBe(7000);
        expect(persistence.projectId).toBe('proj-abc');
        expect(persistence.messageCount).toBe(99);
        expect(persistence.contextWindow.maxTokens).toBe(10000);
      });
    });
  });

  describe('save with duplicate handling', () => {
    it('should handle create failure with duplicate error gracefully', async () => {
      // This test verifies the fallback logic when create fails due to duplicate
      const session = createTestSession({ id: 'dup-test-session' });
      await storage.save(session);

      // Save again - should use update path since session exists
      session.title = 'Updated after duplicate';
      await storage.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded?.title).toBe('Updated after duplicate');
    });
  });

  describe('load with edge cases', () => {
    it('should handle entity with minimal data using defaults', async () => {
      // entityToSession uses fallback defaults (|| operator), so even minimal data works
      const minimalEntity = {
        id: 'minimal-entity',
        data: {
          // Only provide id, everything else will use defaults
        } as unknown as Record<string, unknown>,
        metadata: { tags: ['session'] },
      };

      // Manually write minimal entity to backend
      await storageService.create('session', minimalEntity.data, {
        id: minimalEntity.id,
        metadata: minimalEntity.metadata,
      });

      // Should load successfully with default values
      const loaded = await storage.load(minimalEntity.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe('minimal-entity');
      expect(loaded?.title).toContain('Session'); // Default title format
      expect(loaded?.status).toBe(SessionPersistenceStatus.ACTIVE); // Default status
    });
  });

  describe('close without autoSave', () => {
    it('should not persist cache when autoSave is disabled on close', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
        autoSave: false,
      };
      const noAutoSaveStorage = new SessionPersistenceStorage(config);
      await noAutoSaveStorage.initialize();

      const session = createTestSession({ id: 'no-autosave-close' });
      await noAutoSaveStorage.save(session); // Only saves to cache

      await noAutoSaveStorage.close();

      // Verify session was not persisted to storage
      const newStorage = new SessionPersistenceStorage(config);
      await newStorage.initialize();
      const loaded = await newStorage.load(session.id);
      expect(loaded).toBeNull();

      await newStorage.close();
    });
  });

  describe('list with mixed valid and expired sessions', () => {
    it('should only return valid sessions and clean up expired ones', async () => {
      const valid1 = createTestSession({ id: 'valid-1' });
      const valid2 = createTestSession({ id: 'valid-2' });
      const expired1 = createTestSession({ id: 'expired-1', expiresAt: Date.now() - 1000 });
      const expired2 = createTestSession({ id: 'expired-2', expiresAt: Date.now() - 2000 });

      await storage.save(valid1);
      await storage.save(valid2);
      await storage.save(expired1);
      await storage.save(expired2);

      const sessions = await storage.list();

      const ids = sessions.map(s => s.id);
      expect(ids).toContain('valid-1');
      expect(ids).toContain('valid-2');
      expect(ids).not.toContain('expired-1');
      expect(ids).not.toContain('expired-2');

      // Expired sessions should be cleaned from storage
      const count = await storage.count();
      expect(count).toBe(2); // Only valid sessions remain
    });
  });

  describe('session validation edge cases', () => {
    it('should handle session with ARCHIVED status as invalid', async () => {
      const archivedSession = createTestSession({
        id: 'archived-test',
        status: SessionPersistenceStatus.ARCHIVED,
        // Don't set expiresAt to test status-based invalidation
      });
      delete (archivedSession as any).expiresAt;

      await storage.save(archivedSession);
      const loaded = await storage.load(archivedSession.id);
      expect(loaded).toBeNull();
    });

    it('should handle session with future expiration as valid', async () => {
      const futureSession = createTestSession({
        id: 'future-expiry',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
      });

      await storage.save(futureSession);
      const loaded = await storage.load(futureSession.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe('future-expiry');
    });
  });

  describe('entity conversion edge cases', () => {
    it('should handle session with minimal required fields', async () => {
      const minimalSession = createTestSession({
        id: 'minimal-session',
        title: '',
        tags: [],
        metadata: {},
      });

      await storage.save(minimalSession);
      const loaded = await storage.load(minimalSession.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.title).toBe('');
      expect(loaded?.tags).toEqual([]);
      expect(loaded?.metadata).toEqual({});
    });

    it('should preserve complex metadata structure', async () => {
      const complexMetadata = {
        nested: {
          deep: {
            value: [1, 2, 3],
          },
        },
        array: [{ a: 1 }, { b: 2 }],
      };

      const complexSession = createTestSession({
        id: 'complex-metadata',
        metadata: complexMetadata,
      });

      await storage.save(complexSession);
      const loaded = await storage.load(complexSession.id);

      expect(loaded?.metadata).toEqual(complexMetadata);
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple rapid saves', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) =>
        createTestSession({ id: `rapid-${i}` })
      );

      // Save all sessions rapidly
      await Promise.all(sessions.map(s => storage.save(s)));

      // Verify all were saved
      for (const session of sessions) {
        const loaded = await storage.load(session.id);
        expect(loaded).not.toBeNull();
        expect(loaded?.id).toBe(session.id);
      }
    });
  });
});
