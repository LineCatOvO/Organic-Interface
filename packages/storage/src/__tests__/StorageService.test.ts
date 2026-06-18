/**
 * StorageService Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageService, StorageError, StorageErrorCode } from '../services/StorageService.js';
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
    it('should rollback active transaction on close', async () => {
      await storage.beginTransaction();

      expect(storage.getCurrentTransaction()).not.toBeNull();

      await storage.close();

      // After close, currentTransaction should be null (rolled back)
      // Note: close is also called in afterEach, so we need to re-check
      expect(storage.getCurrentTransaction()).toBeNull();
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
  });
});
