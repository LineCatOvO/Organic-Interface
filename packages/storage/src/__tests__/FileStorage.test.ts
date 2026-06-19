import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { FileStorage } from '../backends/FileStorage.js';
import { StorageBackendType } from '../backends/IStorageBackend.js';
import type { StorageEntity } from '../models/StorageEntity.js';

describe('FileStorage', () => {
  let basePath: string;
  let storage: FileStorage;

  beforeEach(async () => {
    basePath = path.join(os.tmpdir(), `filestorage-test-${Date.now()}-${Math.random()}`);
    storage = new FileStorage({ basePath });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
    try {
      await fs.rm(basePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  function createTestEntity(
    id: string,
    type: string,
    data: Record<string, unknown>
  ): StorageEntity {
    return {
      id,
      type,
      data,
      metadata: {
        created_by: 'test',
        tags: [],
      },
      created_at: Date.now(),
      updated_at: Date.now(),
      version: 1,
    };
  }

  describe('constructor', () => {
    it('should create FileStorage with valid config', () => {
      const storage = new FileStorage({ basePath: '/tmp/test' });
      expect(storage).toBeDefined();
    });

    it('should throw error for missing basePath', () => {
      expect(() => new FileStorage({ basePath: '' })).toThrow(
        'FileStorage requires a basePath configuration'
      );
    });

    it('should use default file extension', () => {
      const storage = new FileStorage({ basePath: '/tmp/test' });
      expect((storage as any).fileExtension).toBe('.json');
    });

    it('should accept custom file extension', () => {
      const storage = new FileStorage({ basePath: '/tmp/test', fileExtension: '.txt' });
      expect((storage as any).fileExtension).toBe('.txt');
    });

    it('should enable autoFlush by default', () => {
      const storage = new FileStorage({ basePath: '/tmp/test' });
      expect((storage as any).autoFlush).toBe(true);
    });

    it('should accept custom flush interval', () => {
      const storage = new FileStorage({ basePath: '/tmp/test', flushInterval: 10000 });
      expect((storage as any).flushInterval).toBe(10000);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      expect(storage.isConnected()).toBe(true);
    });

    it('should create base directory', async () => {
      const stat = await fs.stat(basePath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create entities directory', async () => {
      const entitiesDir = path.join(basePath, 'entities');
      const stat = await fs.stat(entitiesDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should load existing entities into cache', async () => {
      await storage.set(createTestEntity('load-test', 'user', { name: 'Test' }));
      await storage.close();

      const newStorage = new FileStorage({ basePath, autoFlush: true });
      await newStorage.initialize();

      const entity = await newStorage.get('load-test');
      expect(entity).toBeDefined();
      expect(entity?.data.name).toBe('Test');
    });
  });

  describe('get', () => {
    it('should get existing entity', async () => {
      const entity = createTestEntity('get-test', 'user', { name: 'Alice' });
      await storage.set(entity);

      const result = await storage.get('get-test');

      expect(result).toBeDefined();
      expect(result?.id).toBe('get-test');
      expect(result?.data.name).toBe('Alice');
    });

    it('should return null for non-existent entity', async () => {
      const result = await storage.get('non-existent');
      expect(result).toBeNull();
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new FileStorage({ basePath: '/tmp/uninit' });
      await expect(uninitStorage.get('test')).rejects.toThrow('File storage is not initialized');
    });

    it('should return null for expired entity', async () => {
      const entity = createTestEntity('expired-test', 'user', { name: 'Bob' });
      entity.metadata.expires_at = Date.now() - 1000;
      await storage.set(entity);

      const result = await storage.get('expired-test');

      expect(result).toBeNull();
    });

    it('should return copy of entity data', async () => {
      const entity = createTestEntity('copy-test', 'user', { name: 'Test' });
      await storage.set(entity);

      const result = await storage.get('copy-test');
      result!.data.name = 'Modified';

      const result2 = await storage.get('copy-test');
      expect(result2?.data.name).toBe('Test');
    });
  });

  describe('set', () => {
    it('should set entity', async () => {
      const entity = createTestEntity('set-test', 'product', { price: 100 });
      await storage.set(entity);

      const result = await storage.get('set-test');
      expect(result?.data.price).toBe(100);
    });

    it('should update existing entity', async () => {
      const entity = createTestEntity('update-test', 'product', { price: 100 });
      await storage.set(entity);

      entity.data.price = 200;
      await storage.set(entity);

      const result = await storage.get('update-test');
      expect(result?.data.price).toBe(200);
    });

    it('should mark entity as dirty', async () => {
      const entity = createTestEntity('dirty-test', 'user', {});
      await storage.set(entity);

      expect((storage as any).dirty.has('dirty-test')).toBe(true);
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new FileStorage({ basePath: '/tmp/uninit' });
      await expect(uninitStorage.set(createTestEntity('test', 'user', {}))).rejects.toThrow(
        'File storage is not initialized'
      );
    });

    it('should write to file immediately when autoFlush is false', async () => {
      const noFlushStorage = new FileStorage({ basePath, autoFlush: false });
      await noFlushStorage.initialize();

      const entity = createTestEntity('noflush-test', 'user', { name: 'NoFlush' });
      await noFlushStorage.set(entity);

      const filePath = path.join(basePath, 'entities', 'noflush-test.json');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('NoFlush');

      await noFlushStorage.close();
    });
  });

  describe('delete', () => {
    it('should delete existing entity', async () => {
      const entity = createTestEntity('delete-test', 'user', { name: 'Delete Me' });
      await storage.set(entity);

      const result = await storage.delete('delete-test');

      expect(result).toBe(true);
      expect(await storage.get('delete-test')).toBeNull();
    });

    it('should return false for non-existent entity', async () => {
      const result = await storage.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new FileStorage({ basePath: '/tmp/uninit' });
      await expect(uninitStorage.delete('test')).rejects.toThrow('File storage is not initialized');
    });
  });

  describe('has', () => {
    it('should return true for existing entity', async () => {
      const entity = createTestEntity('has-test', 'user', {});
      await storage.set(entity);

      expect(await storage.has('has-test')).toBe(true);
    });

    it('should return false for non-existent entity', async () => {
      expect(await storage.has('non-existent')).toBe(false);
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new FileStorage({ basePath: '/tmp/uninit' });
      await expect(uninitStorage.has('test')).rejects.toThrow('File storage is not initialized');
    });
  });

  describe('getAll', () => {
    it('should get all entities', async () => {
      await storage.set(createTestEntity('all-1', 'type1', {}));
      await storage.set(createTestEntity('all-2', 'type2', {}));
      await storage.set(createTestEntity('all-3', 'type1', {}));

      const entities = await storage.getAll();

      expect(entities.length).toBe(3);
    });

    it('should exclude expired entities', async () => {
      await storage.set(createTestEntity('valid', 'user', {}));
      const expired = createTestEntity('expired', 'user', {});
      expired.metadata.expires_at = Date.now() - 1000;
      await storage.set(expired);

      const entities = await storage.getAll();

      expect(entities.length).toBe(1);
      expect(entities[0].id).toBe('valid');
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new FileStorage({ basePath: '/tmp/uninit' });
      await expect(uninitStorage.getAll()).rejects.toThrow('File storage is not initialized');
    });
  });

  describe('getByType', () => {
    it('should get entities by type', async () => {
      await storage.set(createTestEntity('type-1', 'cat', { name: 'Whiskers' }));
      await storage.set(createTestEntity('type-2', 'dog', { name: 'Buddy' }));
      await storage.set(createTestEntity('type-3', 'cat', { name: 'Felix' }));

      const cats = await storage.getByType('cat');

      expect(cats.length).toBe(2);
      expect(cats.every(c => c.type === 'cat')).toBe(true);
    });

    it('should return empty array for non-existent type', async () => {
      const result = await storage.getByType('non-existent');
      expect(result).toEqual([]);
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new FileStorage({ basePath: '/tmp/uninit' });
      await expect(uninitStorage.getByType('user')).rejects.toThrow(
        'File storage is not initialized'
      );
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await storage.set(createTestEntity('q1', 'user', { name: 'Alice', age: 25 }));
      await storage.set(createTestEntity('q2', 'user', { name: 'Bob', age: 30 }));
      await storage.set(createTestEntity('q3', 'product', { name: 'Widget' }));
    });

    it('should query by type', async () => {
      const result = await storage.query({ type: 'user' });

      expect(result.length).toBe(2);
      expect(result.every(e => e.type === 'user')).toBe(true);
    });

    it('should query by data field', async () => {
      const result = await storage.query({ 'data.name': 'Alice' });

      expect(result.length).toBe(1);
      expect(result[0].data.name).toBe('Alice');
    });

    it('should query by tags', async () => {
      const tagged = createTestEntity('tagged', 'user', {});
      tagged.metadata.tags = ['important', 'urgent'];
      await storage.set(tagged);

      const result = await storage.query({ tags: ['important'] });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('tagged');
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new FileStorage({ basePath: '/tmp/uninit' });
      await expect(uninitStorage.query({ type: 'user' })).rejects.toThrow(
        'File storage is not initialized'
      );
    });
  });

  describe('clear', () => {
    it('should clear all entities', async () => {
      await storage.set(createTestEntity('clear-1', 'user', {}));
      await storage.set(createTestEntity('clear-2', 'user', {}));

      await storage.clear();

      const count = await storage.count();
      expect(count).toBe(0);
    });

    it('should delete all entity files', async () => {
      await storage.set(createTestEntity('clear-file-1', 'user', {}));
      await storage.set(createTestEntity('clear-file-2', 'user', {}));

      await storage.clear();

      const files = await fs.readdir(path.join(basePath, 'entities'));
      expect(files.length).toBe(0);
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new FileStorage({ basePath: '/tmp/uninit' });
      await expect(uninitStorage.clear()).rejects.toThrow('File storage is not initialized');
    });
  });

  describe('count', () => {
    it('should return entity count', async () => {
      expect(await storage.count()).toBe(0);

      await storage.set(createTestEntity('count-1', 'user', {}));
      await storage.set(createTestEntity('count-2', 'user', {}));

      expect(await storage.count()).toBe(2);
    });
  });

  describe('getInfo', () => {
    it('should return storage info', () => {
      const info = storage.getInfo();

      expect(info.type).toBe(StorageBackendType.FILE);
      expect(info.connected).toBe(true);
      expect(info.basePath).toBe(basePath);
      expect(info.autoFlush).toBe(true);
    });

    it('should return correct count and dirty count', async () => {
      await storage.set(createTestEntity('info-1', 'user', {}));
      await storage.set(createTestEntity('info-2', 'user', {}));

      const info = storage.getInfo();

      expect(info.count).toBe(2);
      expect(info.dirtyCount).toBe(2);
    });
  });

  describe('close', () => {
    it('should flush dirty entities before close', async () => {
      await storage.set(createTestEntity('close-test', 'user', { name: 'Close' }));

      await storage.close();

      const newStorage = new FileStorage({ basePath });
      await newStorage.initialize();

      const entity = await newStorage.get('close-test');
      expect(entity?.data.name).toBe('Close');
    });

    it('should clear cache after close', async () => {
      await storage.set(createTestEntity('cache-test', 'user', {}));
      await storage.close();

      expect((storage as any).cache.size).toBe(0);
      expect((storage as any).connected).toBe(false);
    });
  });

  describe('file not exists handling', () => {
    it('should handle non-existent entity directory gracefully', async () => {
      const emptyBasePath = path.join(os.tmpdir(), `empty-test-${Date.now()}`);
      await fs.mkdir(emptyBasePath, { recursive: true });

      const newStorage = new FileStorage({ basePath: emptyBasePath });
      await newStorage.initialize();

      const result = await newStorage.getAll();
      expect(result).toEqual([]);

      await newStorage.close();
      await fs.rm(emptyBasePath, { recursive: true, force: true });
    });
  });

  describe('flush - delete entity files', () => {
    it('should delete file when entity was removed from cache during flush', async () => {
      // Create and store an entity
      await storage.set(createTestEntity('flush-delete-test', 'user', { name: 'FlushDelete' }));

      // Close storage to trigger flush (which writes the file)
      await storage.close();

      // Verify file exists after first flush
      const filePath = path.join(basePath, 'entities', 'flush-delete-test.json');
      const fileExistsBefore = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExistsBefore).toBe(true);

      // Re-initialize and delete the entity
      await storage.initialize();
      await storage.delete('flush-delete-test');

      // Close again to trigger flush (which should delete the file this time)
      await storage.close();

      // Verify file no longer exists after second flush
      const fileExistsAfter = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExistsAfter).toBe(false);

      // Re-initialize for cleanup in afterEach
      await storage.initialize();
    });
  });

  describe('delete without autoFlush', () => {
    it('should delete file immediately when autoFlush is disabled', async () => {
      const noFlushStorage = new FileStorage({ basePath, autoFlush: false });
      await noFlushStorage.initialize();

      await noFlushStorage.set(
        createTestEntity('delete-noflush-test', 'user', { name: 'NoFlush' })
      );

      const filePath = path.join(basePath, 'entities', 'delete-noflush-test.json');
      const fileExistsBefore = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExistsBefore).toBe(true);

      // Delete should immediately remove the file in non-autoFlush mode
      await noFlushStorage.delete('delete-noflush-test');

      const fileExistsAfter = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExistsAfter).toBe(false);

      await noFlushStorage.close();
    });

    it('should handle deleting non-existent file gracefully in non-autoFlush mode', async () => {
      const noFlushStorage = new FileStorage({ basePath, autoFlush: false });
      await noFlushStorage.initialize();

      // Try to delete an entity that was never saved to disk
      const result = await noFlushStorage.delete('non-existent-noflush');
      expect(result).toBe(false);

      await noFlushStorage.close();
    });
  });

  describe('getByType with expired entities', () => {
    it('should exclude expired entities from type query results', async () => {
      await storage.set(createTestEntity('valid-type', 'product', { name: 'ValidProduct' }));

      const expired = createTestEntity('expired-type', 'product', { name: 'ExpiredProduct' });
      expired.metadata.expires_at = Date.now() - 1000; // Already expired
      await storage.set(expired);

      const products = await storage.getByType('product');

      expect(products.length).toBe(1);
      expect(products[0].id).toBe('valid-type');
      expect(products[0].data.name).toBe('ValidProduct');
    });
  });

  describe('query - time-based filters', () => {
    beforeEach(async () => {
      const now = Date.now();
      const oldEntity = createTestEntity('old-entity', 'user', { name: 'Old' });
      oldEntity.created_at = now - 100000; // Created 100 seconds ago
      oldEntity.updated_at = now - 50000; // Updated 50 seconds ago
      await storage.set(oldEntity);

      const newEntity = createTestEntity('new-entity', 'user', { name: 'New' });
      newEntity.created_at = now - 1000; // Created 1 second ago
      newEntity.updated_at = now - 500; // Updated 0.5 seconds ago
      await storage.set(newEntity);
    });

    it('should filter by created_after', async () => {
      const threshold = Date.now() - 50000;
      const result = await storage.query({ created_after: threshold });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('new-entity');
    });

    it('should filter by created_before', async () => {
      const threshold = Date.now() - 50000;
      const result = await storage.query({ created_before: threshold });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('old-entity');
    });

    it('should filter by updated_after', async () => {
      const threshold = Date.now() - 10000;
      const result = await storage.query({ updated_after: threshold });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('new-entity');
    });

    it('should filter by updated_before', async () => {
      const threshold = Date.now() - 10000;
      const result = await storage.query({ updated_before: threshold });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('old-entity');
    });
  });

  describe('query - generic field matching', () => {
    beforeEach(async () => {
      await storage.set(createTestEntity('generic-1', 'user', { name: 'Generic1' }));
      await storage.set(createTestEntity('generic-2', 'product', { name: 'Generic2' }));
    });

    it('should match against top-level entity fields', async () => {
      const result = await storage.query({ version: 1 });

      // All test entities have version: 1
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('autoFlush configuration', () => {
    it('should disable autoFlush when explicitly set to false', () => {
      const manualFlushStorage = new FileStorage({
        basePath: '/tmp/test-manual',
        autoFlush: false,
      });
      expect((manualFlushStorage as any).autoFlush).toBe(false);
    });

    it('should not start flush timer when autoFlush is disabled', async () => {
      const manualFlushStorage = new FileStorage({ basePath, autoFlush: false });
      await manualFlushStorage.initialize();

      // Timer should not be started
      expect((manualFlushStorage as any).flushTimer).toBeUndefined();

      await manualFlushStorage.close();
    });
  });

  describe('entity data isolation', () => {
    it('should return independent copy of top-level data properties', async () => {
      const entity = createTestEntity('isolation-test', 'config', {
        name: 'TestConfig',
        enabled: true,
      });
      await storage.set(entity);

      // Modify original object reference after setting
      entity.data.name = 'Modified';
      entity.data.enabled = false;

      // Get should return unmodified copy of top-level properties
      const retrieved = await storage.get('isolation-test');
      expect(retrieved?.data.name).toBe('TestConfig');
      expect(retrieved?.data.enabled).toBe(true);
    });

    it('should return independent copies from getAll for top-level properties', async () => {
      await storage.set(createTestEntity('all-copy-1', 'test', { value: 'first' }));
      await storage.set(createTestEntity('all-copy-2', 'test', { value: 'second' }));

      const entities = await storage.getAll();
      entities[0].data.value = 'modified';

      // Original should not be affected (top-level property isolation)
      const entities2 = await storage.getAll();
      expect(entities2[0].data.value).toBe('first');
    });
  });
});
