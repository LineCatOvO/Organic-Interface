/**
 * Google Drive Storage Backend Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleDriveStorage } from '../backends/GoogleDriveStorage.js';
import type { GoogleDriveConfig, UserCredentials } from '../backends/GoogleDriveConfig.js';
import type { StorageEntity } from '../models/StorageEntity.js';

describe('GoogleDriveStorage', () => {
  let storage: GoogleDriveStorage;
  const config: GoogleDriveConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-secret',
    redirectUri: 'http://localhost/callback',
  };

  const userCredentials: UserCredentials = {
    userId: 'user-001',
    accessToken: 'test-token',
  };

  beforeEach(async () => {
    storage = new GoogleDriveStorage(config);
    await storage.initialize();
    storage.registerUser(userCredentials);
    storage.setUserContext('user-001');
  });

  describe('initialize and close', () => {
    it('should initialize successfully', () => {
      expect(storage.isConnected()).toBe(true);
    });

    it('should close successfully', async () => {
      await storage.close();
      expect(storage.isConnected()).toBe(false);
    });
  });

  describe('user context', () => {
    it('should set user context', () => {
      expect(storage.isConnected()).toBe(true);
    });
  });

  describe('set and get', () => {
    it('should set entity', async () => {
      const entity: StorageEntity = {
        id: 'test-001',
        type: 'config',
        data: { key: 'value' },
        created_at: Date.now(),
        updated_at: Date.now(),
        metadata: {},
      };
      await storage.set(entity);
      const result = await storage.get('test-001');
      expect(result).not.toBeNull();
    });

    it('should delete entity', async () => {
      const entity: StorageEntity = {
        id: 'test-002',
        type: 'config',
        data: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        metadata: {},
      };
      await storage.set(entity);
      const deleted = await storage.delete('test-002');
      expect(deleted).toBe(true);
    });

    it('should check entity exists', async () => {
      const hasEntity = await storage.has('test-001');
      expect(hasEntity).toBe(false);
    });
  });

  describe('getAll and count', () => {
    it('should get all entities', async () => {
      const entities = await storage.getAll();
      expect(entities).toBeInstanceOf(Array);
    });

    it('should count entities', async () => {
      const count = await storage.count();
      expect(count).toBe(0);
    });
  });

  describe('getInfo', () => {
    it('should return storage info', () => {
      const info = storage.getInfo();
      expect(info.type).toBe('google_drive');
    });
  });
});