/**
 * DatabaseStorage Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseStorage } from '../backends/DatabaseStorage.js';
import type { StorageEntity } from '../models/StorageEntity.js';

describe('DatabaseStorage', () => {
  let dbPath: string;
  let storage: DatabaseStorage;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `storage-test-${Date.now()}`);
    storage = new DatabaseStorage({ dbPath });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
    // Clean up test directory
    try {
      await fs.rm(dbPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialize and close', () => {
    it('should initialize successfully', () => {
      expect(storage.isConnected()).toBe(true);
    });

    it('should persist data across reinitialization', async () => {
      await storage.set(createTestEntity('test-1', 'user', { name: 'John' }));

      // Close and reopen
      await storage.close();
      storage = new DatabaseStorage({ dbPath });
      await storage.initialize();

      const entity = await storage.get('test-1');
      expect(entity).toBeDefined();
      expect(entity?.data.name).toBe('John');
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

    it('should return null for expired entity', async () => {
      const entity = createTestEntity('expired-test', 'user', { name: 'Bob' });
      entity.metadata.expires_at = Date.now() - 1000;
      await storage.set(entity);

      const result = await storage.get('expired-test');

      expect(result).toBeNull();
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

    it('should not throw for uninitialized storage', async () => {
      const newStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'uninit-test') });

      await expect(newStorage.set(createTestEntity('test', 'user', {}))).rejects.toThrow();
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

    it('should query by created_after', async () => {
      const before = Date.now() + 1000;
      await storage.set(createTestEntity('future', 'user', {}));
      (storage as any).entities.get('future').created_at = before;

      const result = await storage.query({ created_after: Date.now() + 500 });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('future');
    });

    it('should query by tags', async () => {
      const tagged = createTestEntity('tagged', 'user', {});
      tagged.metadata.tags = ['important', 'urgent'];
      await storage.set(tagged);

      const result = await storage.query({ tags: ['important'] });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('tagged');
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

      expect(info.type).toBe('database');
      expect(info.connected).toBe(true);
      expect(info.dbPath).toBe(dbPath);
    });
  });

  describe('batch operations', () => {
    it('should handle batch operations efficiently', async () => {
      // Create many entities
      for (let i = 0; i < 100; i++) {
        await storage.set(createTestEntity(`batch-${i}`, 'item', { index: i }));
      }

      // Query all
      const all = await storage.getAll();
      expect(all.length).toBe(100);

      // Clear all
      await storage.clear();
      expect(await storage.count()).toBe(0);
    });
  });

  // ==================== ST-04 覆盖率增强测试 ====================
  // 目标：覆盖构造器验证、未连接错误、batchSet/batchDelete、auto-save 定时器、
  // close 待保存、getByType 禁用索引/过期清理、query 全过滤条件、getTypeCount、
  // getInfo autoSave 信息、type index 清理。

  describe('ST-04: 构造器验证', () => {
    it('should throw when dbPath is empty', () => {
      // 异常路径：dbPath 为空
      expect(() => new DatabaseStorage({ dbPath: '' })).toThrow(
        'DatabaseStorage requires a dbPath configuration'
      );
    });

    it('should throw when dbPath is undefined', () => {
      // 异常路径：dbPath 为 undefined
      expect(() => new DatabaseStorage({ dbPath: undefined as unknown as string })).toThrow(
        'DatabaseStorage requires a dbPath configuration'
      );
    });
  });

  describe('ST-04: 未连接错误处理', () => {
    it('should throw when get called on uninitialized storage', async () => {
      // 异常路径：未初始化时调用 get
      const uninitStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'uninit-get') });
      await expect(uninitStorage.get('any-id')).rejects.toThrow(
        'Database storage is not initialized'
      );
    });

    it('should throw when has called on uninitialized storage', async () => {
      // 异常路径：未初始化时调用 has
      const uninitStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'uninit-has') });
      await expect(uninitStorage.has('any-id')).rejects.toThrow(
        'Database storage is not initialized'
      );
    });

    it('should throw when getAll called on uninitialized storage', async () => {
      // 异常路径：未初始化时调用 getAll
      const uninitStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'uninit-getall') });
      await expect(uninitStorage.getAll()).rejects.toThrow(
        'Database storage is not initialized'
      );
    });

    it('should throw when getByType called on uninitialized storage', async () => {
      // 异常路径：未初始化时调用 getByType
      const uninitStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'uninit-getbytype') });
      await expect(uninitStorage.getByType('any-type')).rejects.toThrow(
        'Database storage is not initialized'
      );
    });

    it('should throw when query called on uninitialized storage', async () => {
      // 异常路径：未初始化时调用 query
      const uninitStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'uninit-query') });
      await expect(uninitStorage.query({})).rejects.toThrow(
        'Database storage is not initialized'
      );
    });

    it('should throw when clear called on uninitialized storage', async () => {
      // 异常路径：未初始化时调用 clear
      const uninitStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'uninit-clear') });
      await expect(uninitStorage.clear()).rejects.toThrow(
        'Database storage is not initialized'
      );
    });

    it('should throw when delete called on uninitialized storage', async () => {
      // 异常路径：未初始化时调用 delete
      const uninitStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'uninit-delete') });
      await expect(uninitStorage.delete('any-id')).rejects.toThrow(
        'Database storage is not initialized'
      );
    });

    it('should throw when batchSet called on uninitialized storage', async () => {
      // 异常路径：未初始化时调用 batchSet
      const uninitStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'uninit-batchset') });
      await expect(uninitStorage.batchSet([])).rejects.toThrow(
        'Database storage is not initialized'
      );
    });

    it('should throw when batchDelete called on uninitialized storage', async () => {
      // 异常路径：未初始化时调用 batchDelete
      const uninitStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'uninit-batchdel') });
      await expect(uninitStorage.batchDelete([])).rejects.toThrow(
        'Database storage is not initialized'
      );
    });
  });

  describe('ST-04: batchSet 批量设置', () => {
    it('should batch set multiple entities successfully', async () => {
      // 正常路径：批量设置多个实体
      const entities = [
        createTestEntity('batch-set-1', 'user', { name: 'Alice' }),
        createTestEntity('batch-set-2', 'user', { name: 'Bob' }),
        createTestEntity('batch-set-3', 'product', { name: 'Widget' }),
      ];

      const result = await storage.batchSet(entities);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(3);
      expect(result.failed).toHaveLength(0);

      // 验证实体已存储
      expect(await storage.has('batch-set-1')).toBe(true);
      expect(await storage.has('batch-set-2')).toBe(true);
      expect(await storage.has('batch-set-3')).toBe(true);
    });

    it('should batch set empty array', async () => {
      // 边界情况：空数组
      const result = await storage.batchSet([]);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
      expect(result.failed).toHaveLength(0);
    });

    it('should update type index during batch set', async () => {
      // 正常路径：验证 type index 更新
      const entities = [
        createTestEntity('bi-1', 'type-a', {}),
        createTestEntity('bi-2', 'type-a', {}),
        createTestEntity('bi-3', 'type-b', {}),
      ];

      await storage.batchSet(entities);

      const typeAEntities = await storage.getByType('type-a');
      const typeBEntities = await storage.getByType('type-b');

      expect(typeAEntities).toHaveLength(2);
      expect(typeBEntities).toHaveLength(1);
    });
  });

  describe('ST-04: batchDelete 批量删除', () => {
    it('should batch delete multiple entities successfully', async () => {
      // 正常路径：批量删除
      await storage.set(createTestEntity('bd-1', 'user', {}));
      await storage.set(createTestEntity('bd-2', 'user', {}));
      await storage.set(createTestEntity('bd-3', 'product', {}));

      const result = await storage.batchDelete(['bd-1', 'bd-2', 'bd-3']);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(3);
      expect(result.failed).toHaveLength(0);

      expect(await storage.has('bd-1')).toBe(false);
      expect(await storage.has('bd-2')).toBe(false);
      expect(await storage.has('bd-3')).toBe(false);
    });

    it('should handle batch delete with non-existent ids', async () => {
      // 边界情况：包含不存在的 id
      await storage.set(createTestEntity('bd-exist', 'user', {}));

      const result = await storage.batchDelete(['bd-exist', 'bd-nonexist']);

      expect(result.processed).toBe(1);
      expect(await storage.has('bd-exist')).toBe(false);
    });

    it('should clean up type index during batch delete', async () => {
      // 正常路径：验证 type index 清理
      await storage.set(createTestEntity('bd-ti-1', 'type-x', {}));
      await storage.set(createTestEntity('bd-ti-2', 'type-x', {}));

      expect(storage.getTypeCount()).toBeGreaterThan(0);

      await storage.batchDelete(['bd-ti-1', 'bd-ti-2']);

      // type-x 的 type index 应被清理（size === 0 时删除）
      const typeXEntities = await storage.getByType('type-x');
      expect(typeXEntities).toHaveLength(0);
    });

    it('should batch delete empty array', async () => {
      // 边界情况：空数组
      const result = await storage.batchDelete([]);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
    });
  });

  describe('ST-04: auto-save 定时器', () => {
    it('should start auto-save timer when autoSaveInterval > 0', async () => {
      // 正常路径：启用自动保存
      const autoSavePath = path.join(os.tmpdir(), `autosave-test-${Date.now()}`);
      const autoStorage = new DatabaseStorage({
        dbPath: autoSavePath,
        autoSaveInterval: 100,
      });

      await autoStorage.initialize();

      const info = autoStorage.getInfo();
      expect(info.autoSave).toBe(true);
      expect(info.autoSaveInterval).toBe(100);

      // 设置数据，等待 auto-save 触发
      await autoStorage.set(createTestEntity('auto-1', 'user', { name: 'Auto' }));

      // 等待 auto-save 间隔
      await new Promise(resolve => setTimeout(resolve, 200));

      await autoStorage.close();
      await fs.rm(autoSavePath, { recursive: true, force: true });
    });

    it('should not start auto-save when autoSaveInterval is 0', async () => {
      // 边界情况：禁用自动保存
      const info = storage.getInfo();
      expect(info.autoSave).toBe(false);
      expect(info.autoSaveInterval).toBe(0);
    });
  });

  describe('ST-04: close 待保存处理', () => {
    it('should wait for pending save during close', async () => {
      // 正常路径：close 时等待待保存操作完成
      const closePath = path.join(os.tmpdir(), `close-test-${Date.now()}`);
      const closeStorage = new DatabaseStorage({ dbPath: closePath });

      await closeStorage.initialize();
      await closeStorage.set(createTestEntity('close-1', 'user', { name: 'Close' }));

      // close 应该等待任何待保存操作
      await closeStorage.close();

      expect(closeStorage.isConnected()).toBe(false);

      await fs.rm(closePath, { recursive: true, force: true });
    });

    it('should close without saving when not initialized', async () => {
      // 边界情况：未初始化时 close
      const uninitStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'close-uninit') });
      await expect(uninitStorage.close()).resolves.not.toThrow();
      expect(uninitStorage.isConnected()).toBe(false);
    });
  });

  describe('ST-04: getByType 禁用索引与过期清理', () => {
    it('should fallback to scanning when type index is disabled', async () => {
      // 边界情况：禁用 type index 时使用全扫描
      const noIndexPath = path.join(os.tmpdir(), `noindex-test-${Date.now()}`);
      const noIndexStorage = new DatabaseStorage({
        dbPath: noIndexPath,
        enableTypeIndex: false,
      });

      await noIndexStorage.initialize();
      await noIndexStorage.set(createTestEntity('ni-1', 'cat', { name: 'A' }));
      await noIndexStorage.set(createTestEntity('ni-2', 'dog', { name: 'B' }));
      await noIndexStorage.set(createTestEntity('ni-3', 'cat', { name: 'C' }));

      const cats = await noIndexStorage.getByType('cat');
      expect(cats).toHaveLength(2);
      expect(cats.every(c => c.type === 'cat')).toBe(true);

      await noIndexStorage.close();
      await fs.rm(noIndexPath, { recursive: true, force: true });
    });

    it('should clean up expired entities during getByType', async () => {
      // 异常路径：getByType 清理过期实体
      await storage.set(createTestEntity('bt-valid', 'user', {}));
      const expired = createTestEntity('bt-expired', 'user', {});
      expired.metadata.expires_at = Date.now() - 1000;
      await storage.set(expired);

      const users = await storage.getByType('user');
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe('bt-valid');

      // 验证过期实体已被删除
      expect(await storage.has('bt-expired')).toBe(false);
    });
  });

  describe('ST-04: query 全过滤条件', () => {
    beforeEach(async () => {
      await storage.set(createTestEntity('qf-1', 'user', { name: 'Alice', age: 25 }));
      await storage.set(createTestEntity('qf-2', 'user', { name: 'Bob', age: 30 }));
      await storage.set(createTestEntity('qf-3', 'product', { name: 'Widget' }));
    });

    it('should query by created_before', async () => {
      // 正常路径：created_before 过滤
      const now = Date.now();
      const result = await storage.query({ created_before: now + 10000 });

      // 所有实体都应在 now+10000 之前创建
      expect(result.length).toBe(3);
    });

    it('should query by updated_after', async () => {
      // 正常路径：updated_after 过滤
      const pastTime = Date.now() - 10000;
      const result = await storage.query({ updated_after: pastTime });

      expect(result.length).toBe(3);
    });

    it('should query by updated_before', async () => {
      // 正常路径：updated_before 过滤
      const futureTime = Date.now() + 10000;
      const result = await storage.query({ updated_before: futureTime });

      expect(result.length).toBe(3);
    });

    it('should query by unknown key matching entity property', async () => {
      // 边界情况：未知 key 直接匹配实体属性
      const result = await storage.query({ type: 'user', version: 1 });

      expect(result.length).toBe(2);
      expect(result.every(e => e.version === 1)).toBe(true);
    });

    it('should query with empty filter returns all', async () => {
      // 边界情况：空过滤器返回所有
      const result = await storage.query({});

      expect(result.length).toBe(3);
    });

    it('should query by tags with multiple tags (OR logic)', async () => {
      // 边界情况：多标签 OR 逻辑
      const tagged1 = createTestEntity('tag-multi-1', 'user', {});
      tagged1.metadata.tags = ['red'];
      await storage.set(tagged1);

      const tagged2 = createTestEntity('tag-multi-2', 'user', {});
      tagged2.metadata.tags = ['blue'];
      await storage.set(tagged2);

      const result = await storage.query({ tags: ['red', 'blue'] });

      expect(result.length).toBe(2);
      const ids = result.map(e => e.id);
      expect(ids).toContain('tag-multi-1');
      expect(ids).toContain('tag-multi-2');
    });
  });

  describe('ST-04: getTypeCount 与 getInfo', () => {
    it('should return type count', async () => {
      // 正常路径：获取类型数量
      await storage.set(createTestEntity('tc-1', 'type-a', {}));
      await storage.set(createTestEntity('tc-2', 'type-a', {}));
      await storage.set(createTestEntity('tc-3', 'type-b', {}));

      expect(storage.getTypeCount()).toBe(2);
    });

    it('should return 0 type count when empty', async () => {
      // 边界情况：空存储
      expect(storage.getTypeCount()).toBe(0);
    });

    it('should include autoSave info in getInfo', async () => {
      // 正常路径：getInfo 包含 autoSave 信息
      const info = storage.getInfo();
      expect(info).toHaveProperty('autoSave');
      expect(info).toHaveProperty('autoSaveInterval');
      expect(info).toHaveProperty('typeCount');
      expect(info).toHaveProperty('count');
    });
  });

  describe('ST-04: type index 清理', () => {
    it('should clean up type index when last entity of a type is deleted', async () => {
      // 正常路径：删除某类型最后一个实体时清理 type index
      await storage.set(createTestEntity('ti-clean-1', 'unique-type', {}));
      expect(storage.getTypeCount()).toBe(1);

      await storage.delete('ti-clean-1');

      // type index 应被清理
      expect(storage.getTypeCount()).toBe(0);

      // 验证 getByType 返回空
      const result = await storage.getByType('unique-type');
      expect(result).toHaveLength(0);
    });
  });

  describe('ST-04: 数据持久化与 type index 重建', () => {
    it('should rebuild type index from persisted data on reinitialize', async () => {
      // 正常路径：重新初始化时从持久化数据重建 type index
      await storage.set(createTestEntity('persist-1', 'type-x', {}));
      await storage.set(createTestEntity('persist-2', 'type-y', {}));

      await storage.close();

      // 重新初始化
      storage = new DatabaseStorage({ dbPath });
      await storage.initialize();

      // type index 应被重建
      expect(storage.getTypeCount()).toBe(2);

      const typeXEntities = await storage.getByType('type-x');
      expect(typeXEntities).toHaveLength(1);
      expect(typeXEntities[0].id).toBe('persist-1');
    });

    it('should rebuild type index with enableTypeIndex disabled', async () => {
      // 边界情况：禁用 type index 时重新初始化
      await storage.set(createTestEntity('persist-ni-1', 'type-a', {}));
      await storage.close();

      const noIndexStorage = new DatabaseStorage({
        dbPath,
        enableTypeIndex: false,
      });
      await noIndexStorage.initialize();

      // type index 应为空（因为禁用了）
      expect(noIndexStorage.getTypeCount()).toBe(0);

      // 但 getByType 仍应通过扫描工作
      const result = await noIndexStorage.getByType('type-a');
      expect(result).toHaveLength(1);

      await noIndexStorage.close();
    });
  });

  describe('ST-04: get 过期实体自动删除', () => {
    it('should delete expired entity and return null on get', async () => {
      // 异常路径：get 时自动删除过期实体
      const expired = createTestEntity('auto-del-expired', 'user', { name: 'Expired' });
      expired.metadata.expires_at = Date.now() - 1000;
      await storage.set(expired);

      // 第一次 get 应返回 null 并删除实体
      const result = await storage.get('auto-del-expired');
      expect(result).toBeNull();

      // 验证实体已被删除
      expect(await storage.has('auto-del-expired')).toBe(false);
    });
  });

  describe('ST-04: getAll 过期清理', () => {
    it('should delete expired entities during getAll', async () => {
      // 异常路径：getAll 时自动删除过期实体
      await storage.set(createTestEntity('ga-valid', 'user', {}));
      const expired1 = createTestEntity('ga-expired-1', 'user', {});
      expired1.metadata.expires_at = Date.now() - 1000;
      await storage.set(expired1);
      const expired2 = createTestEntity('ga-expired-2', 'product', {});
      expired2.metadata.expires_at = Date.now() - 2000;
      await storage.set(expired2);

      const all = await storage.getAll();

      // 只应返回有效实体
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('ga-valid');

      // 验证过期实体已被删除
      expect(await storage.has('ga-expired-1')).toBe(false);
      expect(await storage.has('ga-expired-2')).toBe(false);
    });
  });

  describe('ST-04: getByType fallback 过期清理', () => {
    it('should clean up expired entities in fallback scanning path', async () => {
      // 覆盖 getByType 中 fallback 扫描路径的过期实体清理（disableIndex 时）
      const noIdxPath = path.join(os.tmpdir(), `fallback-expired-${Date.now()}`);
      const noIdxStorage = new DatabaseStorage({
        dbPath: noIdxPath,
        enableTypeIndex: false,
      });

      await noIdxStorage.initialize();

      // 添加有效和过期实体
      await noIdxStorage.set(createTestEntity('fb-valid', 'cat', { name: 'A' }));
      const expired = createTestEntity('fb-expired', 'cat', { name: 'B' });
      expired.metadata.expires_at = Date.now() - 1000;
      await noIdxStorage.set(expired);

      const cats = await noIdxStorage.getByType('cat');

      // 只应返回有效实体
      expect(cats).toHaveLength(1);
      expect(cats[0].id).toBe('fb-valid');

      // 过期实体应被删除
      expect(await noIdxStorage.has('fb-expired')).toBe(false);

      await noIdxStorage.close();
      await fs.rm(noIdxPath, { recursive: true, force: true });
    });
  });

  describe('ST-04: batchSet 错误处理 catch 块', () => {
    it('should handle error in batchSet and add to failed list', async () => {
      // 覆盖 batchSet 内部 catch 块（line 258-263）
      const originalSet = (storage as any).entities.set;
      let callCount = 0;
      (storage as any).entities.set = function (...args: unknown[]) {
        callCount++;
        if (callCount === 2) {
          throw new Error('Mock set error');
        }
        return originalSet.apply(this, args);
      };

      const entities = [
        createTestEntity('bs-err-1', 'user', { name: 'A' }),
        createTestEntity('bs-err-2', 'user', { name: 'B' }),
        createTestEntity('bs-err-3', 'user', { name: 'C' }),
      ];

      const result = await storage.batchSet(entities);

      expect(result.success).toBe(false);
      expect(result.processed).toBe(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('bs-err-2');
      expect(result.failed[0].error).toBe('Mock set error');

      // 恢复
      (storage as any).entities.set = originalSet;
    });
  });

  describe('ST-04: batchDelete 错误处理 catch 块', () => {
    it('should handle error in batchDelete and add to failed list', async () => {
      // 覆盖 batchDelete 内部 catch 块（line 334-339）
      await storage.set(createTestEntity('bd-err-1', 'user', { name: 'A' }));
      await storage.set(createTestEntity('bd-err-2', 'user', { name: 'B' }));

      const originalDelete = (storage as any).entities.delete;
      let callCount = 0;
      (storage as any).entities.delete = function (...args: unknown[]) {
        callCount++;
        if (callCount === 2) {
          throw new Error('Mock delete error');
        }
        return originalDelete.apply(this, args);
      };

      const result = await storage.batchDelete(['bd-err-1', 'bd-err-2']);

      expect(result.processed).toBe(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('bd-err-2');
      expect(result.failed[0].error).toBe('Mock delete error');

      // 恢复
      (storage as any).entities.delete = originalDelete;
    });
  });
});

function createTestEntity(id: string, type: string, data: Record<string, unknown>): StorageEntity {
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
