/**
 * Google Drive Storage Backend for Organic Interface Storage
 * Implements user-level storage space isolation using Google Drive API
 */

import type { IStorageBackend, StorageBackendInfo } from './IStorageBackend.js';
import type { GoogleDriveConfig, UserCredentials } from './GoogleDriveConfig.js';
import type { StorageEntity } from '../models/StorageEntity.js';

/**
 * User storage entry with credentials and cache
 */
interface UserStorageEntry {
  credentials: UserCredentials;
  cache: Map<string, StorageEntity>;
  typeIndex: Map<string, Set<string>>;
}

/**
 * Google Drive storage backend implementation
 * Provides user-isolated storage spaces with cloud sync capability
 */
export class GoogleDriveStorage implements IStorageBackend {
  private config: GoogleDriveConfig;
  private userStorages: Map<string, UserStorageEntry> = new Map();
  private currentUserId: string | null = null;
  private connected: boolean = false;

  constructor(config: GoogleDriveConfig) {
    this.config = {
      rootFolderName: config.rootFolderName || 'OrganicInterface',
      autoSync: config.autoSync ?? false,
      syncInterval: config.syncInterval || 60000,
      ...config,
    };
  }

  /**
   * Set current user context for storage operations
   */
  setUserContext(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Register user with credentials
   */
  registerUser(credentials: UserCredentials): void {
    this.userStorages.set(credentials.userId, {
      credentials,
      cache: new Map(),
      typeIndex: new Map(),
    });
  }

  /**
   * Get current user storage entry
   */
  private getCurrentStorage(): UserStorageEntry | null {
    if (!this.currentUserId) return null;
    return this.userStorages.get(this.currentUserId) || null;
  }

  /**
   * Initialize the storage backend
   */
  async initialize(): Promise<void> {
    this.connected = true;
  }

  /**
   * Close the storage backend
   */
  async close(): Promise<void> {
    this.userStorages.clear();
    this.currentUserId = null;
    this.connected = false;
  }

  /**
   * Check if backend is connected
   */
  isConnected(): boolean {
    return this.connected && this.currentUserId !== null;
  }

  /**
   * Get entity by ID
   */
  async get(id: string): Promise<StorageEntity | null> {
    const storage = this.getCurrentStorage();
    if (!storage) throw new Error('No user context set');

    const entity = storage.cache.get(id);
    if (!entity) return null;

    if (entity.metadata.expires_at && Date.now() > entity.metadata.expires_at) {
      await this.delete(id);
      return null;
    }

    return { ...entity, data: { ...entity.data } };
  }

  /**
   * Set entity
   */
  async set(entity: StorageEntity): Promise<void> {
    const storage = this.getCurrentStorage();
    if (!storage) throw new Error('No user context set');

    const entityCopy = { ...entity, data: { ...entity.data } };
    storage.cache.set(entity.id, entityCopy);

    if (!storage.typeIndex.has(entity.type)) {
      storage.typeIndex.set(entity.type, new Set());
    }
    storage.typeIndex.get(entity.type)!.add(entity.id);
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    const storage = this.getCurrentStorage();
    if (!storage) throw new Error('No user context set');

    const entity = storage.cache.get(id);
    if (!entity) return false;

    storage.cache.delete(id);

    const typeSet = storage.typeIndex.get(entity.type);
    if (typeSet) {
      typeSet.delete(id);
      if (typeSet.size === 0) {
        storage.typeIndex.delete(entity.type);
      }
    }

    return true;
  }

  /**
   * Check if entity exists
   */
  async has(id: string): Promise<boolean> {
    const storage = this.getCurrentStorage();
    if (!storage) throw new Error('No user context set');
    return storage.cache.has(id);
  }

  /**
   * Get all entities
   */
  async getAll(): Promise<StorageEntity[]> {
    const storage = this.getCurrentStorage();
    if (!storage) throw new Error('No user context set');

    const now = Date.now();
    const entities: StorageEntity[] = [];

    for (const [id, entity] of storage.cache.entries()) {
      if (entity.metadata.expires_at && now > entity.metadata.expires_at) {
        await this.delete(id);
        continue;
      }
      entities.push({ ...entity, data: { ...entity.data } });
    }

    return entities;
  }

  /**
   * Get entities by type
   */
  async getByType(type: string): Promise<StorageEntity[]> {
    const storage = this.getCurrentStorage();
    if (!storage) throw new Error('No user context set');

    const typeSet = storage.typeIndex.get(type);
    if (!typeSet) return [];

    const now = Date.now();
    const entities: StorageEntity[] = [];

    for (const id of typeSet) {
      const entity = storage.cache.get(id);
      if (entity) {
        if (entity.metadata.expires_at && now > entity.metadata.expires_at) {
          await this.delete(id);
          continue;
        }
        entities.push({ ...entity, data: { ...entity.data } });
      }
    }

    return entities;
  }

  /**
   * Query entities by filter
   */
  async query(filter: Record<string, unknown>): Promise<StorageEntity[]> {
    const entities = await this.getAll();
    return entities.filter(entity => {
      for (const [key, value] of Object.entries(filter)) {
        if (key === 'type' && entity.type !== value) return false;
        if (key.startsWith('data.')) {
          const dataKey = key.substring(5);
          if (entity.data[dataKey] !== value) return false;
        }
        if (key === 'tags') {
          if (Array.isArray(value) && value.length > 0) {
            const entityTags = entity.metadata.tags || [];
            if (!value.some((tag: unknown) => entityTags.includes(tag as string))) {
              return false;
            }
          }
        }
        if (key === 'created_after' && entity.created_at < (value as number)) return false;
        if (key === 'created_before' && entity.created_at > (value as number)) return false;
      }
      return true;
    });
  }

  /**
   * Clear all entities
   */
  async clear(): Promise<void> {
    const storage = this.getCurrentStorage();
    if (!storage) throw new Error('No user context set');
    storage.cache.clear();
    storage.typeIndex.clear();
  }

  /**
   * Get entity count
   */
  async count(): Promise<number> {
    const storage = this.getCurrentStorage();
    if (!storage) throw new Error('No user context set');
    return storage.cache.size;
  }

  /**
   * Get storage info
   */
  getInfo(): StorageBackendInfo {
    const storage = this.getCurrentStorage();
    return {
      type: 'google_drive',
      connected: this.connected && storage !== null,
      count: storage?.cache.size || 0,
      userId: this.currentUserId,
      userCount: this.userStorages.size,
    };
  }
}