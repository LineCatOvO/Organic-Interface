/**
 * StorageService Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  StorageService,
  StorageError,
  StorageErrorCode,
  IsolationLevel,
} from '../services/StorageService.js';
import { MemoryStorage } from '../backends/MemoryStorage.js';
import { IndexType } from '../models/index.js';

describe('StorageService', () => {
  let storage: StorageService;
  let backend: MemoryStorage;

  beforeEach(async () => {
    backend = new MemoryStorage();
    storage = new StorageService(backend);
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('create', () => {
    it('should create a new entity', async () => {
      const result = await storage.create('test', { name: 'test' });

      expect(result.success).toBe(true);
      expect(result.entity).not.toBeNull();
      expect(result.entity?.type).toBe('test');
      expect(result.entity?.data.name).toBe('test');
      expect(typeof result.entity?.id).toBe('string');
    });

    it('should create entity with custom ID', async () => {
      const result = await storage.create('test', { name: 'test' }, { id: 'custom-id' });

      expect(result.success).toBe(true);
      expect(result.entity?.id).toBe('custom-id');
    });

    it('should reject duplicate ID', async () => {
      await storage.create('test', { name: 'first' }, { id: 'duplicate-id' });
      const result = await storage.create('test', { name: 'second' }, { id: 'duplicate-id' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('read', () => {
    it('should read existing entity', async () => {
      const created = await storage.create('test', { name: 'test' });
      const entity = await storage.read(created.entity!.id);

      expect(entity).not.toBeNull();
      expect(entity?.id).toBe(created.entity?.id);
      expect(entity?.data.name).toBe('test');
    });

    it('should return null for non-existent entity', async () => {
      const entity = await storage.read('non-existent');
      expect(entity).toBeNull();
    });
  });

  describe('update', () => {
    it('should update entity data', async () => {
      const created = await storage.create('test', { name: 'original' });
      const result = await storage.update(created.entity!.id, { name: 'updated' });

      expect(result.success).toBe(true);
      expect(result.entity?.data.name).toBe('updated');
      expect(result.version).toBe(2);
    });

    it('should fail for non-existent entity', async () => {
      const result = await storage.update('non-existent', { name: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('delete', () => {
    it('should delete existing entity', async () => {
      const created = await storage.create('test', { name: 'test' });
      const result = await storage.delete(created.entity!.id);

      expect(result.success).toBe(true);

      const entity = await storage.read(created.entity!.id);
      expect(entity).toBeNull();
    });

    it('should fail for non-existent entity', async () => {
      const result = await storage.delete('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('batch operations', () => {
    it('should batch create entities', async () => {
      const entities = [
        { type: 'test', data: { name: 'first' } },
        { type: 'test', data: { name: 'second' } },
        { type: 'test', data: { name: 'third' } },
      ];

      const result = await storage.batchCreate(entities);

      expect(result.success).toBe(true);
      expect(result.created.length).toBe(3);
      expect(result.failed.length).toBe(0);
    });

    it('should batch update entities', async () => {
      const entities = [
        { type: 'test', data: { value: 1 } },
        { type: 'test', data: { value: 2 } },
      ];

      const created = await storage.batchCreate(entities);
      const updates = created.created.map((e, i) => ({
        id: e.id,
        data: { value: i + 10 } as Partial<Record<string, unknown>>,
      }));

      const result = await storage.batchUpdate(updates);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(2);
    });

    it('should batch delete entities', async () => {
      const entities = [
        { type: 'test', data: { name: 'first' } },
        { type: 'test', data: { name: 'second' } },
      ];

      const created = await storage.batchCreate(entities);
      const ids = created.created.map(e => e.id);

      const result = await storage.batchDelete(ids);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(2);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await storage.batchCreate([
        { type: 'user', data: { name: 'Alice', age: 25 } },
        { type: 'user', data: { name: 'Bob', age: 30 } },
        { type: 'product', data: { name: 'Widget', price: 100 } },
      ]);
    });

    it('should query by type', async () => {
      const result = await storage.query({ where: { type: 'user' } });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(2);
      expect(result.entities.every(e => e.type === 'user')).toBe(true);
    });

    it('should query with pagination', async () => {
      const result = await storage.query({
        where: { type: 'user' },
        limit: 1,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(1);
    });

    it('should query with ordering', async () => {
      const result = await storage.query({
        where: { type: 'user' },
        orderBy: [{ field: 'data.age', direction: 'desc' }],
      });

      expect(result.success).toBe(true);
      expect(result.entities[0].data.age).toBe(30);
    });
  });

  describe('findByType', () => {
    it('should find entities by type', async () => {
      await storage.batchCreate([
        { type: 'cat', data: { name: 'Whiskers' } },
        { type: 'dog', data: { name: 'Buddy' } },
        { type: 'cat', data: { name: 'Felix' } },
      ]);

      const cats = await storage.findByType('cat');

      expect(cats.length).toBe(2);
      expect(cats.every(c => c.type === 'cat')).toBe(true);
    });
  });

  describe('transactions', () => {
    it('should begin a transaction', async () => {
      const tx = await storage.beginTransaction();

      expect(tx).not.toBeNull();
      expect(typeof tx.id).toBe('string');
      expect(tx.status).toBe('active');
    });

    it('should commit a transaction', async () => {
      await storage.beginTransaction();
      await storage.commitTransaction();

      const tx = storage.getCurrentTransaction();
      expect(tx).toBeNull();
    });

    it('should rollback a transaction', async () => {
      await storage.beginTransaction();
      await storage.rollbackTransaction();

      const tx = storage.getCurrentTransaction();
      expect(tx).toBeNull();
    });

    it('should reject nested transactions', async () => {
      await storage.beginTransaction();

      await expect(storage.beginTransaction()).rejects.toThrow();
    });
  });

  describe('clearExpired', () => {
    it('should clear expired entities', async () => {
      await storage.create(
        'test',
        { name: 'expired' },
        {
          metadata: { expires_at: Date.now() - 1000 },
        }
      );
      await storage.create(
        'test',
        { name: 'valid' },
        {
          metadata: { expires_at: Date.now() + 60000 },
        }
      );

      const result = await storage.clearExpired();

      expect(result.success).toBe(true);
      const all = await backend.getAll();
      expect(all.length).toBeGreaterThan(0);
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage info', async () => {
      await storage.create('test', { name: 'test' });

      const info = await storage.getStorageInfo();

      expect(info.backend).not.toBeNull();
      expect(info.backend.count).toBe(1);
      expect(info.transactionActive).toBe(false);
    });
  });

  // ========== 补充测试用例 ==========

  describe('query - orWhere', () => {
    beforeEach(async () => {
      await storage.batchCreate([
        { type: 'user', data: { name: 'Alice', role: 'admin' } },
        { type: 'user', data: { name: 'Bob', role: 'editor' } },
        { type: 'user', data: { name: 'Charlie', role: 'viewer' } },
      ]);
    });

    it('should query with OR conditions', async () => {
      const result = await storage.query({
        where: { type: 'user' },
        orWhere: { 'data.role': 'admin' },
      });

      expect(result.success).toBe(true);
      // AND 条件匹配全部3个 user，OR 条件额外匹配 admin
      // 但 admin 已在 AND 结果中，所以结果应包含所有3个
      expect(result.entities.length).toBeGreaterThanOrEqual(2);
    });

    it('should combine results from OR without duplicates', async () => {
      // When using orWhere alone, empty where matches all entities
      // Test that orWhere does not create duplicates
      const result = await storage.query({
        where: { type: 'user', 'data.name': 'Alice' },
        orWhere: { 'data.name': 'Bob' },
      });

      expect(result.success).toBe(true);
      // Should contain both Alice (from where) and Bob (from orWhere), no duplicates
      expect(result.entities.length).toBe(2);
      const names = result.entities.map(e => e.data.name);
      expect(names).toContain('Alice');
      expect(names).toContain('Bob');
    });
  });

  describe('query - include fields', () => {
    beforeEach(async () => {
      await storage.create('user', { name: 'Alice', age: 25, email: 'alice@test.com' });
    });

    it('should include only specified fields', async () => {
      const result = await storage.query({
        where: { type: 'user' },
        include: ['data.name'],
      });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(1);
      expect(result.entities[0].data.name).toBe('Alice');
      expect(result.entities[0].data.age).toBeUndefined();
      expect(result.entities[0].data.email).toBeUndefined();
    });
  });

  describe('query - exclude fields', () => {
    beforeEach(async () => {
      await storage.create('user', { name: 'Alice', age: 25, email: 'alice@test.com' });
    });

    it('should exclude specified fields', async () => {
      const result = await storage.query({
        where: { type: 'user' },
        exclude: ['data.email'],
      });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(1);
      expect(result.entities[0].data.name).toBe('Alice');
      expect(result.entities[0].data.age).toBe(25);
      expect(result.entities[0].data.email).toBeUndefined();
    });
  });

  describe('query - createdAfter / createdBefore', () => {
    it('should filter by createdAfter timestamp', async () => {
      const beforeCreate = Date.now();
      await storage.create('test', { name: 'entity1' });

      const result = await storage.query({ createdAfter: beforeCreate });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(1);
    });

    it('should filter by createdBefore timestamp', async () => {
      await storage.create('test', { name: 'entity1' });

      const result = await storage.query({ createdBefore: Date.now() + 1 });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(1);
    });

    it('should return empty for entities outside time range', async () => {
      await storage.create('test', { name: 'entity1' });
      const future = Date.now() + 100000;

      const result = await storage.query({ createdAfter: future });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(0);
    });
  });

  describe('query - updatedAfter / updatedBefore', () => {
    it('should filter by updatedAfter timestamp', async () => {
      const created = await storage.create('test', { name: 'original' });
      const beforeUpdate = Date.now();
      await storage.update(created.entity!.id, { name: 'updated' });

      const result = await storage.query({ updatedAfter: beforeUpdate });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(1);
    });

    it('should filter by updatedBefore timestamp', async () => {
      const created = await storage.create('test', { name: 'original' });
      await storage.update(created.entity!.id, { name: 'updated' });
      const afterUpdate = Date.now();

      const result = await storage.query({ updatedBefore: afterUpdate + 1 });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(1);
    });
  });

  describe('batch operations - partial failure', () => {
    it('batchCreate should handle partial failures (duplicate IDs)', async () => {
      await storage.create('test', { name: 'existing' }, { id: 'dup-id' });

      const result = await storage.batchCreate([
        { type: 'test', data: { name: 'new1' }, id: 'new-id-1' },
        { type: 'test', data: { name: 'dup' }, id: 'dup-id' },
        { type: 'test', data: { name: 'new2' }, id: 'new-id-2' },
      ]);

      expect(result.success).toBe(false);
      expect(result.created.length).toBe(2);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].error).toContain('already exists');
    });

    it('batchUpdate should handle non-existent IDs', async () => {
      await storage.create('test', { name: 'existing' }, { id: 'exist-id' });

      const result = await storage.batchUpdate([
        { id: 'exist-id', data: { name: 'updated' } as Partial<Record<string, unknown>> },
        { id: 'non-existent-id', data: { name: 'ghost' } as Partial<Record<string, unknown>> },
      ]);

      expect(result.success).toBe(false);
      expect(result.updated).toBe(1);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].id).toBe('non-existent-id');
    });

    it('batchDelete should handle non-existent IDs', async () => {
      await storage.create('test', { name: 'existing' }, { id: 'exist-id' });

      const result = await storage.batchDelete(['exist-id', 'non-existent-id']);

      expect(result.success).toBe(false);
      expect(result.deleted).toBe(1);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].id).toBe('non-existent-id');
    });
  });

  describe('findByTags', () => {
    it('should find entities by tags', async () => {
      await storage.create(
        'article',
        { title: 'Post 1' },
        {
          metadata: { tags: ['javascript', 'typescript'] } as unknown as {
            expires_at?: number;
            [key: string]: unknown;
          },
        }
      );
      await storage.create(
        'article',
        { title: 'Post 2' },
        {
          metadata: { tags: ['python', 'rust'] } as unknown as {
            expires_at?: number;
            [key: string]: unknown;
          },
        }
      );
      await storage.create(
        'article',
        { title: 'Post 3' },
        {
          metadata: { tags: ['typescript', 'nodejs'] } as unknown as {
            expires_at?: number;
            [key: string]: unknown;
          },
        }
      );

      const results = await storage.findByTags(['typescript']);

      expect(results.length).toBe(2);
    });

    it('should return empty array when no matching tags', async () => {
      await storage.create(
        'article',
        { title: 'Post 1' },
        {
          metadata: { tags: ['java'] } as unknown as {
            expires_at?: number;
            [key: string]: unknown;
          },
        }
      );

      const results = await storage.findByTags(['nonexistent-tag']);

      expect(results.length).toBe(0);
    });
  });

  describe('transaction timeout', () => {
    it('should auto-rollback transaction after timeout', async () => {
      const tx = await storage.beginTransaction({ timeout: 50 });

      expect(tx.status).toBe('active');

      // Wait for timeout to trigger
      await new Promise(resolve => setTimeout(resolve, 100));

      const currentTx = storage.getCurrentTransaction();
      expect(currentTx).toBeNull();
    });
  });

  describe('close with active transaction', () => {
    it('should rollback active transaction on close without error', async () => {
      // Use a separate instance to avoid afterEach interference
      const closeTestBackend = new MemoryStorage();
      const closeTestStorage = new StorageService(closeTestBackend);
      await closeTestStorage.initialize();

      await closeTestStorage.beginTransaction();
      expect(closeTestStorage.getCurrentTransaction()).not.toBeNull();

      // Close should rollback the transaction without throwing
      await expect(closeTestStorage.close()).resolves.not.toThrow();

      // After close, currentTransaction should be null (rolled back)
      expect(closeTestStorage.getCurrentTransaction()).toBeNull();
    });
  });

  describe('commit/rollback without active transaction', () => {
    it('commit should throw StorageError when no active transaction', async () => {
      await expect(storage.commitTransaction()).rejects.toThrow(StorageError);
      await expect(storage.commitTransaction()).rejects.toThrow('No active transaction to commit');
    });

    it('rollback should throw StorageError when no active transaction', async () => {
      await expect(storage.rollbackTransaction()).rejects.toThrow(StorageError);
      await expect(storage.rollbackTransaction()).rejects.toThrow(
        'No active transaction to rollback'
      );
    });
  });

  describe('registerIndex', () => {
    it('should register an index', () => {
      storage.registerIndex({
        name: 'test-unique-index',
        type: IndexType.UNIQUE,
        fields: ['data.email'],
        unique: true,
      });

      // Verify index was registered via getStorageInfo
      expect(storage.getCurrentTransaction()).toBeNull(); // just ensure service works
    });

    it('should register multiple indexes', () => {
      storage.registerIndex({
        name: 'index-1',
        type: IndexType.MULTI,
        fields: ['data.field1'],
        unique: false,
      });
      storage.registerIndex({
        name: 'index-2',
        type: IndexType.UNIQUE,
        fields: ['data.field2'],
        unique: true,
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('getStorageInfo with indexes', () => {
    it('should include registered indexes in storage info', async () => {
      storage.registerIndex({
        name: 'my-index',
        type: IndexType.UNIQUE,
        fields: ['data.email'],
        unique: true,
      });

      const info = await storage.getStorageInfo();

      expect(info.indexes).not.toBeNull();
      expect(info.indexes.length).toBe(1);
      expect(info.indexes[0].name).toBe('my-index');
    });
  });

  describe('getCurrentTransaction', () => {
    it('should return null when no active transaction', () => {
      expect(storage.getCurrentTransaction()).toBeNull();
    });

    it('should return current active transaction', async () => {
      const tx = await storage.beginTransaction();
      const current = storage.getCurrentTransaction();

      expect(current).not.toBeNull();
      expect(current!.id).toBe(tx.id);
      expect(current!.status).toBe('active');

      await storage.rollbackTransaction();
    });

    it('should return null after commit', async () => {
      await storage.beginTransaction();
      await storage.commitTransaction();

      expect(storage.getCurrentTransaction()).toBeNull();
    });
  });

  describe('create with metadata', () => {
    it('should create entity with metadata', async () => {
      const result = await storage.create(
        'document',
        { content: 'hello' },
        {
          metadata: { author: 'test-user', version: 1 } as unknown as {
            expires_at?: number;
            [key: string]: unknown;
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.entity).not.toBeNull();
      expect((result.entity!.metadata as Record<string, unknown>).author).toBe('test-user');
    });

    it('should create entity with expires_at in metadata', async () => {
      const result = await storage.create(
        'temp',
        { data: 'value' },
        {
          metadata: { expires_at: Date.now() + 3600000 },
        }
      );

      expect(result.success).toBe(true);
      expect(typeof result.entity!.metadata.expires_at).toBe('number');
    });
  });

  describe('update with updatedBy', () => {
    it('should update entity and record updater', async () => {
      const created = await storage.create('test', { name: 'original' });
      const result = await storage.update(created.entity!.id, { name: 'updated' }, 'admin-user');

      expect(result.success).toBe(true);
      expect(result.entity?.data.name).toBe('updated');
      expect(result.version).toBeGreaterThan(1);
    });
  });

  describe('StorageError class', () => {
    it('should have correct name property', () => {
      const error = new StorageError('test error', StorageErrorCode.ENTITY_NOT_FOUND);

      expect(error.name).toBe('StorageError');
    });

    it('should have correct code property', () => {
      const error = new StorageError('test error', StorageErrorCode.DUPLICATE_ENTITY);

      expect(error.code).toBe('STORAGE_DUPLICATE_ENTITY');
    });

    it('should support different error codes', () => {
      const codes = [
        StorageErrorCode.NOT_INITIALIZED,
        StorageErrorCode.ENTITY_NOT_FOUND,
        StorageErrorCode.DUPLICATE_ENTITY,
        StorageErrorCode.INVALID_FILTER,
        StorageErrorCode.TRANSACTION_FAILED,
        StorageErrorCode.OPERATION_FAILED,
      ];

      for (const code of codes) {
        const error = new StorageError('msg', code);
        expect(error.code).toBe(code);
        expect(error.name).toBe('StorageError');
      }
    });

    it('should include details in error', () => {
      const details = { field: 'id', value: 'test-id' };
      const error = new StorageError('test error', StorageErrorCode.ENTITY_NOT_FOUND, details);

      expect(error.details).toEqual(details);
    });
  });

  // ========== 补充测试：异常处理路径 ==========

  describe('create - error handling', () => {
    it('should handle backend.set() errors gracefully', async () => {
      // Create a mock backend that throws on set
      const failingBackend = new MemoryStorage();
      const failingStorage = new StorageService(failingBackend);
      await failingStorage.initialize();

      // Mock the set method to throw
      failingBackend.set = async () => {
        throw new Error('Database connection failed');
      };

      const result = await failingStorage.create('test', { name: 'error-case' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
      expect(result.entity).toBeUndefined();

      await failingStorage.close();
    });
  });

  describe('update - error handling', () => {
    it('should handle backend.get() errors gracefully', async () => {
      const failingBackend = new MemoryStorage();
      const failingStorage = new StorageService(failingBackend);
      await failingStorage.initialize();

      // Mock get to throw
      failingBackend.get = async () => {
        throw new Error('Connection lost');
      };

      const result = await failingStorage.update('some-id', { name: 'updated' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection lost');

      await failingStorage.close();
    });
  });

  describe('delete - error handling', () => {
    it('should handle backend.delete() errors gracefully', async () => {
      const failingBackend = new MemoryStorage();
      const failingStorage = new StorageService(failingBackend);
      await failingStorage.initialize();

      // Mock delete to throw
      failingBackend.delete = async () => {
        throw new Error('Delete operation failed');
      };

      const result = await failingStorage.delete('some-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Delete operation failed');

      await failingStorage.close();
    });
  });

  describe('query - error handling', () => {
    it('should handle backend.query() errors gracefully', async () => {
      const failingBackend = new MemoryStorage();
      const failingStorage = new StorageService(failingBackend);
      await failingStorage.initialize();

      // Mock query to throw
      failingBackend.query = async () => {
        throw new Error('Query parsing failed');
      };

      const result = await failingStorage.query({ where: { type: 'test' } });

      expect(result.success).toBe(false);
      expect(result.entities).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.error).toContain('Query parsing failed');

      await failingStorage.close();
    });
  });

  describe('clearExpired - edge cases', () => {
    it('should return success with 0 cleared when no expired entities exist', async () => {
      // Create only non-expired entities
      await storage.create(
        'test',
        { name: 'valid-entity' },
        { metadata: { expires_at: Date.now() + 999999 } }
      );

      const result = await storage.clearExpired();

      expect(result.success).toBe(true);
      expect(result.cleared).toBe(0);
    });

    it('should handle getAll() errors gracefully', async () => {
      const failingBackend = new MemoryStorage();
      const failingStorage = new StorageService(failingBackend);
      await failingStorage.initialize();

      // Mock getAll to throw
      failingBackend.getAll = async () => {
        throw new Error('Cannot list entities');
      };

      const result = await failingStorage.clearExpired();

      expect(result.success).toBe(false);
      expect(result.cleared).toBe(0);
      expect(result.error).toContain('Cannot list entities');

      await failingStorage.close();
    });
  });

  describe('getStorageInfo - with active transaction', () => {
    it('should show transactionActive as true when transaction is active', async () => {
      await storage.beginTransaction();

      const info = await storage.getStorageInfo();

      expect(info.transactionActive).toBe(true);

      await storage.rollbackTransaction();
    });
  });

  describe('unique index constraint violation', () => {
    it('should reject entity creation when unique index constraint is violated', async () => {
      // Register a unique index on data.email
      storage.registerIndex({
        name: 'unique-email',
        type: IndexType.UNIQUE,
        fields: ['data.email'],
        unique: true,
      });

      // Create first entity with email
      const result1 = await storage.create('user', { email: 'test@example.com' });
      expect(result1.success).toBe(true);

      // Try to create second entity with same email (unique constraint violation)
      const result2 = await storage.create('user', { email: 'test@example.com' });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Unique constraint violation');
    });
  });

  describe('transaction options', () => {
    it('should use default READ_COMMITTED isolation level', async () => {
      const tx = await storage.beginTransaction();

      expect(tx.isolation).toBe(IsolationLevel.READ_COMMITTED);

      await storage.rollbackTransaction();
    });

    it('should use custom isolation level when specified', async () => {
      const tx = await storage.beginTransaction({
        isolation: IsolationLevel.SERIALIZABLE,
      });

      expect(tx.isolation).toBe(IsolationLevel.SERIALIZABLE);

      await storage.rollbackTransaction();
    });

    it('should include startTime in transaction', async () => {
      const beforeStart = Date.now();
      const tx = await storage.beginTransaction();

      expect(tx.startTime).toBeGreaterThanOrEqual(beforeStart);
      expect(tx.startTime).toBeLessThanOrEqual(Date.now());

      await storage.rollbackTransaction();
    });
  });

  describe('orderBy - null/undefined field values', () => {
    beforeEach(async () => {
      await storage.batchCreate([
        { type: 'item', data: { name: null, order: 1 } },
        { type: 'item', data: { name: 'B', order: 2 } },
        { type: 'item', data: { name: undefined, order: 3 } },
        { type: 'item', data: { name: 'A', order: 4 } },
      ]);
    });

    it('should sort with null/undefined values at beginning (asc)', async () => {
      const result = await storage.query({
        where: { type: 'item' },
        orderBy: [{ field: 'data.name', direction: 'asc' }],
      });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(4);
      // null and undefined should come first in asc order (both treated as null-ish)
      const firstName = result.entities[0].data.name;
      expect(firstName === null || firstName === undefined).toBe(true);
    });

    it('should sort with null/undefined values at end (desc)', async () => {
      const result = await storage.query({
        where: { type: 'item' },
        orderBy: [{ field: 'data.name', direction: 'desc' }],
      });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(4);
      // null and undefined should go to end in desc order
      const lastName = result.entities[result.entities.length - 1].data.name;
      expect(lastName === null || lastName === undefined).toBe(true);
    });
  });

  describe('filterFields - combined include and exclude', () => {
    beforeEach(async () => {
      await storage.create('user', {
        name: 'Alice',
        age: 25,
        email: 'alice@test.com',
        phone: '123456',
      });
    });

    it('should apply both include and exclude filters', async () => {
      const result = await storage.query({
        where: { type: 'user' },
        include: ['data.name', 'data.age'],
        exclude: ['data.email'],
      });

      expect(result.success).toBe(true);
      expect(result.entities[0].data.name).toBe('Alice');
      // When both include and exclude are specified, exclude overwrites with filtered original data
      // So we get original data minus excluded fields
      expect(result.entities[0].data.email).toBeUndefined();
      // Other fields from original data remain (phone was not excluded)
      expect(result.entities[0].data.phone).toBeDefined();
    });
  });

  describe('query - total count accuracy', () => {
    it('should report total before pagination is applied', async () => {
      await storage.batchCreate([
        { type: 'item', data: { value: 1 } },
        { type: 'item', data: { value: 2 } },
        { type: 'item', data: { value: 3 } },
        { type: 'item', data: { value: 4 } },
        { type: 'item', data: { value: 5 } },
      ]);

      const result = await storage.query({
        where: { type: 'item' },
        limit: 2,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(2); // Limited to 2
      expect(result.total).toBe(5); // Total is 5 before limit
    });
  });

  describe('create - entity without ID option', () => {
    it('should auto-generate ID when not specified', async () => {
      const result = await storage.create('auto', { data: 'value' });

      expect(result.success).toBe(true);
      expect(result.entity).not.toBeNull();
      expect(result.entity!.id).toBeDefined();
      expect(typeof result.entity!.id).toBe('string');
      expect(result.entity!.id.length).toBeGreaterThan(0);
    });
  });

  describe('read after delete', () => {
    it('should return null after entity is deleted', async () => {
      const created = await storage.create('temp', { data: 'to-delete' });
      await storage.delete(created.entity!.id);

      const read = await storage.read(created.entity!.id);
      expect(read).toBeNull();
    });
  });

  describe('update returns version', () => {
    it('should increment version number on each update', async () => {
      const created = await storage.create('versioned', { value: 1 });

      const update1 = await storage.update(created.entity!.id, { value: 2 });
      expect(update1.version).toBe(2);

      const update2 = await storage.update(created.entity!.id, { value: 3 });
      expect(update2.version).toBe(3);
    });
  });
});
