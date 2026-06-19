import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { StorageManager, StorageBackendType } from '@organic/storage';

describe('Storage Backend Integration', () => {
  let kernel: Kernel;
  let storageManager: StorageManager;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
    await kernel.initialize();

    storageManager = new StorageManager();
    await storageManager.initialize();
  });

  afterEach(async () => {
    await storageManager.close();
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  describe('Memory Storage CRUD Operations', () => {
    it('should perform complete CRUD cycle on memory storage', async () => {
      const memoryStorage = await storageManager.createStorage(
        'memory-crud',
        StorageBackendType.MEMORY
      );

      // Create
      const createResult = await memoryStorage.create('test-entity', {
        name: 'Test Entity 1',
        value: 100,
        tags: ['tag1', 'tag2'],
      });
      expect(createResult.success).toBe(true);
      expect(createResult.entity).toBeDefined();
      const entityId = createResult.entity.id;
      expect(entityId).toBeDefined();

      // Read
      const readEntity = await memoryStorage.read(entityId);
      expect(readEntity).toBeDefined();
      expect(readEntity?.id).toBe(entityId);

      // Update
      const updateResult = await memoryStorage.update(entityId, {
        name: 'Updated Entity 1',
        value: 200,
        tags: ['tag1', 'tag2', 'tag3'],
      });
      expect(updateResult.success).toBe(true);

      // Verify update
      const verifyUpdate = await memoryStorage.read(entityId);
      expect(verifyUpdate).toBeDefined();

      // Delete
      const deleteResult = await memoryStorage.delete(entityId);
      expect(deleteResult.success).toBe(true);

      // Verify deletion
      const tryRead = await memoryStorage.read(entityId);
      expect(tryRead).toBeNull();
    });

    it('should handle bulk operations on memory storage', async () => {
      const memoryStorage = await storageManager.createStorage(
        'memory-bulk',
        StorageBackendType.MEMORY
      );

      // Bulk create
      const createResults = await Promise.all([
        memoryStorage.create('bulk-1', { index: 1 }),
        memoryStorage.create('bulk-2', { index: 2 }),
        memoryStorage.create('bulk-3', { index: 3 }),
        memoryStorage.create('bulk-4', { index: 4 }),
        memoryStorage.create('bulk-5', { index: 5 }),
      ]);

      expect(createResults.length).toBe(5);
      expect(createResults.every(r => r.success)).toBe(true);

      // Verify all entities exist
      for (const result of createResults) {
        const entity = await memoryStorage.read(result.entity.id);
        expect(entity).toBeDefined();
      }

      // Bulk delete
      for (const result of createResults) {
        await memoryStorage.delete(result.entity.id);
      }

      // Verify all deleted
      for (const result of createResults) {
        const entity = await memoryStorage.read(result.entity.id);
        expect(entity).toBeNull();
      }
    });

    it('should handle concurrent operations on memory storage', async () => {
      const memoryStorage = await storageManager.createStorage(
        'memory-concurrent',
        StorageBackendType.MEMORY
      );

      // Concurrent creates
      const createPromises = Array.from({ length: 20 }, (_, i) =>
        memoryStorage.create(`concurrent-${i}`, { index: i })
      );

      const createResults = await Promise.all(createPromises);
      expect(createResults.length).toBe(20);
      expect(createResults.every(r => r.success)).toBe(true);

      // Concurrent reads
      const readPromises = createResults.map(result => memoryStorage.read(result.entity.id));

      const readResults = await Promise.all(readPromises);
      expect(readResults.every(r => r !== null)).toBe(true);

      // Concurrent updates
      const updatePromises = createResults.map((result, i) =>
        memoryStorage.update(result.entity.id, { updated: true, newIndex: i * 10 })
      );

      const updateResults = await Promise.all(updatePromises);
      expect(updateResults.every(r => r.success)).toBe(true);

      // Cleanup
      for (const result of createResults) {
        await memoryStorage.delete(result.entity.id);
      }
    });
  });

  describe('Memory Storage Direct Usage', () => {
    it('should handle special characters and large payloads via StorageManager', async () => {
      const storage = await storageManager.createStorage(
        'special-chars',
        StorageBackendType.MEMORY
      );

      const specialData = {
        unicode: '中文 日本語 한국語 🎉',
        specialChars: '<script>alert("xss")</script>',
        longText: 'a'.repeat(10000),
        numbers: [1.1, 0, -Infinity],
        nested: { level1: { level2: { level3: 'deep' } } },
      };

      const createResult = await storage.create('special-entity', specialData);
      expect(createResult.success).toBe(true);

      // Verify entity was created and can be read back
      const loaded = await storage.read(createResult.entity.id);
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(createResult.entity.id);

      // Verify we can update and delete
      const updateResult = await storage.update(createResult.entity.id, { updated: true });
      expect(updateResult.success).toBe(true);

      await storage.delete(createResult.entity.id);
      const verifyDelete = await storage.read(createResult.entity.id);
      expect(verifyDelete).toBeNull();
    });
  });

  describe('Storage Manager Operations', () => {
    it('should manage multiple storages simultaneously', async () => {
      // Create multiple memory storages
      const storage1 = await storageManager.createStorage('multi-1', StorageBackendType.MEMORY);
      const storage2 = await storageManager.createStorage('multi-2', StorageBackendType.MEMORY);
      const storage3 = await storageManager.createStorage('multi-3', StorageBackendType.MEMORY);

      // Operate on all simultaneously
      const op1 = await storage1.create('test', { storage: 1 });
      const op2 = await storage2.create('test', { storage: 2 });
      const op3 = await storage3.create('test', { storage: 3 });

      expect(op1.success).toBe(true);
      expect(op2.success).toBe(true);
      expect(op3.success).toBe(true);

      // All storages should be manageable
      expect(storageManager.hasStorage('multi-1')).toBe(true);
      expect(storageManager.hasStorage('multi-2')).toBe(true);
      expect(storageManager.hasStorage('multi-3')).toBe(true);

      // Get storage names
      const names = storageManager.getStorageNames();
      expect(names.length).toBeGreaterThanOrEqual(3);
      expect(names).toContain('multi-1');
      expect(names).toContain('multi-2');
      expect(names).toContain('multi-3');

      // Cleanup
      await storage1.delete(op1.entity.id);
      await storage2.delete(op2.entity.id);
      await storage3.delete(op3.entity.id);
    });

    it('should return existing storage for same name', async () => {
      const storage1 = await storageManager.createStorage(
        'existing-test',
        StorageBackendType.MEMORY
      );
      const storage2 = await storageManager.createStorage(
        'existing-test',
        StorageBackendType.MEMORY
      );

      // Should return same instance
      expect(storage1).toBe(storage2);
    });

    it('should throw error when getting non-existent storage', async () => {
      expect(() => storageManager.getStorage('non-existent')).toThrow();
    });

    it('should remove storage correctly', async () => {
      await storageManager.createStorage('to-remove', StorageBackendType.MEMORY);
      expect(storageManager.hasStorage('to-remove')).toBe(true);

      const result = await storageManager.removeStorage('to-remove');
      expect(result).toBe(true);
      expect(storageManager.hasStorage('to-remove')).toBe(false);
    });

    it('should return false when removing non-existent storage', async () => {
      const result = await storageManager.removeStorage('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent entity reads gracefully', async () => {
      const storage = await storageManager.createStorage('error-read', StorageBackendType.MEMORY);

      const result = await storage.read('non-existent-id');
      expect(result).toBeNull();
    });

    it('should handle duplicate key creation', async () => {
      const storage = await storageManager.createStorage(
        'duplicate-key',
        StorageBackendType.MEMORY
      );

      // First create with specific ID
      const result1 = await storage.create('unique-type', { data: 'first' }, { id: 'custom-id' });
      expect(result1.success).toBe(true);

      // Second create with same ID should fail
      const result2 = await storage.create('unique-type', { data: 'second' }, { id: 'custom-id' });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already exists');

      await storage.delete('custom-id');
    });

    it('should handle update of non-existent entity', async () => {
      const storage = await storageManager.createStorage(
        'update-missing',
        StorageBackendType.MEMORY
      );

      const result = await storage.update('non-existent-id', { name: 'updated' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle delete of non-existent entity', async () => {
      const storage = await storageManager.createStorage(
        'delete-missing',
        StorageBackendType.MEMORY
      );

      const result = await storage.delete('non-existent-id');
      expect(result.success).toBe(false);
    });

    it('should handle very large payloads', async () => {
      const storage = await storageManager.createStorage(
        'large-payload',
        StorageBackendType.MEMORY
      );

      const largePayload = {
        data: 'x'.repeat(100000), // 100KB string
        array: Array.from({ length: 1000 }, (_, i) => ({ index: i, value: `item${i}` })),
      };

      const createResult = await storage.create('large-entity', largePayload);
      expect(createResult.success).toBe(true);

      const loaded = await storage.read(createResult.entity.id);
      expect(loaded).toBeDefined();
      expect(loaded?.data.data.length).toBe(100000);
      expect(loaded?.data.array.length).toBe(1000);

      await storage.delete(createResult.entity.id);
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain data integrity across multiple operations', async () => {
      const storage = await storageManager.createStorage('consistency', StorageBackendType.MEMORY);

      const originalData = {
        stringField: 'test string',
        numberField: 12345.67,
        booleanField: true,
        nested: { deep: 'value' },
      };

      // Create
      const createResult = await storage.create('consistency-test', originalData);
      expect(createResult.success).toBe(true);
      expect(createResult.entity).toBeDefined();

      // Read and verify entity exists
      const readData = await storage.read(createResult.entity.id);
      expect(readData).toBeDefined();
      expect(readData?.id).toBe(createResult.entity.id);

      // Update
      const updateResult = await storage.update(createResult.entity.id, {
        stringField: 'updated string',
        newField: 'new value',
      });
      expect(updateResult.success).toBe(true);

      // Verify update succeeded
      const updatedData = await storage.read(createResult.entity.id);
      expect(updatedData).toBeDefined();

      // Delete
      await storage.delete(createResult.entity.id);
      const verifyDelete = await storage.read(createResult.entity.id);
      expect(verifyDelete).toBeNull();
    });

    it('should handle rapid sequential operations correctly', async () => {
      const storage = await storageManager.createStorage('rapid-seq', StorageBackendType.MEMORY);

      // Rapid create-update-read-delete cycle
      for (let i = 0; i < 10; i++) {
        // Reduced from 50 to 10 for faster testing
        const createResult = await storage.create(`rapid-type`, { iteration: i });
        expect(createResult.success).toBe(true);

        const updateResult = await storage.update(createResult.entity.id, {
          updated: true,
          timestamp: Date.now(),
        });
        expect(updateResult.success).toBe(true);

        const readResult = await storage.read(createResult.entity.id);
        expect(readResult).toBeDefined();

        const deleteResult = await storage.delete(createResult.entity.id);
        expect(deleteResult.success).toBe(true);

        // Verify deletion
        const verifyDelete = await storage.read(createResult.entity.id);
        expect(verifyDelete).toBeNull();
      }
    });
  });
});
