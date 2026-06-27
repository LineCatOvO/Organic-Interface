import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageManager, type StorageManagerConfig } from '../services/StorageManager.js';
import { StorageBackendType } from '../backends/index.js';

describe('StorageManager', () => {
  let manager: StorageManager;

  beforeEach(async () => {
    manager = new StorageManager();
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('constructor', () => {
    it('should create StorageManager with default config', () => {
      const mgr = new StorageManager();
      expect(mgr).toBeDefined();
    });

    it('should create StorageManager with custom config', () => {
      const config: StorageManagerConfig = {
        defaultBackend: StorageBackendType.MEMORY,
        autoInitialize: false,
      };
      const mgr = new StorageManager(config);
      expect(mgr).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize storage manager', async () => {
      const mgr = new StorageManager({ autoInitialize: false });
      expect(mgr.isInitialized()).toBe(false);
      await mgr.initialize();
      expect(mgr.isInitialized()).toBe(true);
      await mgr.close();
    });

    it('should not re-initialize if already initialized', async () => {
      const mgr = new StorageManager();
      await mgr.initialize();
      await mgr.initialize();
      expect(mgr.isInitialized()).toBe(true);
      await mgr.close();
    });
  });

  describe('createStorage', () => {
    it('should create memory storage', async () => {
      const storage = await manager.createStorage('test', StorageBackendType.MEMORY);
      expect(storage).toBeDefined();
    });

    it('should return existing storage for same name', async () => {
      const storage1 = await manager.createStorage('existing', StorageBackendType.MEMORY);
      const storage2 = await manager.createStorage('existing', StorageBackendType.MEMORY);
      expect(storage1).toBe(storage2);
    });

    it('should create multiple storages', async () => {
      await manager.createStorage('storage1', StorageBackendType.MEMORY);
      await manager.createStorage('storage2', StorageBackendType.MEMORY);
      expect(manager.hasStorage('storage1')).toBe(true);
      expect(manager.hasStorage('storage2')).toBe(true);
    });
  });

  describe('getStorage', () => {
    it('should get default storage', () => {
      const storage = manager.getStorage();
      expect(storage).toBeDefined();
    });

    it('should get named storage', async () => {
      await manager.createStorage('named', StorageBackendType.MEMORY);
      const storage = manager.getStorage('named');
      expect(storage).toBeDefined();
    });

    it('should throw for non-existent storage', () => {
      expect(() => manager.getStorage('non-existent')).toThrow();
    });
  });

  describe('hasStorage', () => {
    it('should return true for existing storage', async () => {
      await manager.createStorage('exists', StorageBackendType.MEMORY);
      expect(manager.hasStorage('exists')).toBe(true);
    });

    it('should return false for non-existent storage', () => {
      expect(manager.hasStorage('non-existent')).toBe(false);
    });
  });

  describe('removeStorage', () => {
    it('should remove existing storage', async () => {
      await manager.createStorage('to-remove', StorageBackendType.MEMORY);
      const result = await manager.removeStorage('to-remove');
      expect(result).toBe(true);
      expect(manager.hasStorage('to-remove')).toBe(false);
    });

    it('should return false for non-existent storage', async () => {
      const result = await manager.removeStorage('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getStorageNames', () => {
    it('should return all storage names', async () => {
      await manager.createStorage('first', StorageBackendType.MEMORY);
      await manager.createStorage('second', StorageBackendType.MEMORY);
      const names = manager.getStorageNames();
      expect(names).toContain('default');
      expect(names).toContain('first');
      expect(names).toContain('second');
    });
  });

  describe('getAllStorageInfo', () => {
    it('should return info for all storages', async () => {
      const infoMap = await manager.getAllStorageInfo();
      expect(infoMap.size).toBeGreaterThan(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all storages', async () => {
      await manager.createStorage('to-clear', StorageBackendType.MEMORY);
      const storage = manager.getStorage('to-clear');
      await storage.create('test', { data: 'value' });
      await manager.clearAll();
    });
  });

  describe('setDefaultStorage', () => {
    it('should set default storage', async () => {
      await manager.createStorage('new-default', StorageBackendType.MEMORY);
      manager.setDefaultStorage('new-default');
      expect(manager.getDefaultStorageName()).toBe('new-default');
    });

    it('should throw for non-existent storage', () => {
      expect(() => manager.setDefaultStorage('non-existent')).toThrow();
    });
  });

  describe('getDefaultStorageName', () => {
    it('should return default storage name', () => {
      expect(manager.getDefaultStorageName()).toBe('default');
    });
  });

  describe('isInitialized', () => {
    it('should return initialization status', () => {
      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('close', () => {
    it('should close all storages', async () => {
      await manager.createStorage('close-test', StorageBackendType.MEMORY);
      await manager.close();
      expect(manager.isInitialized()).toBe(false);
    });
  });

  describe('static factory methods', () => {
    describe('createMemoryStorage', () => {
      it('should create memory storage', () => {
        const storage = StorageManager.createMemoryStorage();
        expect(storage).toBeDefined();
      });
    });

    describe('createFileStorage', () => {
      it('should create file storage with config', () => {
        const storage = StorageManager.createFileStorage({ basePath: '/tmp/test-storage' });
        expect(storage).toBeDefined();
      });
    });

    describe('createDatabaseStorage', () => {
      it('should create database storage with config', () => {
        const storage = StorageManager.createDatabaseStorage({ dbPath: ':memory:' });
        expect(storage).toBeDefined();
      });
    });
  });

  describe('createBackend - error handling', () => {
    it('should throw when creating FILE storage without basePath', async () => {
      const mgr = new StorageManager({
        autoInitialize: false,
        fileConfig: {} as any,
      });
      await expect(mgr.createStorage('file-test', StorageBackendType.FILE)).rejects.toThrow(
        'FileStorage requires basePath configuration'
      );
    });

    it('should throw when creating DATABASE storage without dbPath', async () => {
      const mgr = new StorageManager({
        autoInitialize: false,
        databaseConfig: {} as any,
      });
      await expect(mgr.createStorage('db-test', StorageBackendType.DATABASE)).rejects.toThrow(
        'DatabaseStorage requires dbPath configuration'
      );
    });

    it('should throw for unknown storage backend type', async () => {
      const mgr = new StorageManager({ autoInitialize: false });
      await expect(mgr.createStorage('unknown', 'UNKNOWN' as any)).rejects.toThrow(
        'Unknown storage backend type'
      );
    });
  });
});
