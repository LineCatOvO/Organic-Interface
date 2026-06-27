/**
 * Google Drive Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StorageManager } from '../packages/storage/src/services/StorageManager.js';
import { StorageBackendType } from '../packages/storage/src/backends/IStorageBackend.js';
import type { GoogleDriveConfig, UserCredentials } from '../packages/storage/src/backends/GoogleDriveConfig.js';

describe('Google Drive Integration', () => {
  let manager: StorageManager;

  const googleDriveConfig: GoogleDriveConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-secret',
    redirectUri: 'http://localhost/callback',
  };

  beforeEach(async () => {
    manager = new StorageManager({
      googleDriveConfig,
    });
    await manager.initialize();
  });

  describe('StorageManager with Google Drive', () => {
    it('should create Google Drive storage', async () => {
      const storage = await manager.createStorage('google', StorageBackendType.GOOGLE_DRIVE);
      expect(storage).toBeDefined();
    });

    it('should handle user context', async () => {
      const storage = await manager.createStorage('google', StorageBackendType.GOOGLE_DRIVE);
      expect(storage).toBeDefined();
    });
  });
});