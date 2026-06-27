/**
 * Storage Manager for Organic Interface Storage
 * Manages multiple storage backends and provides factory methods
 */

import type { Logger } from '@organic/utils';
import { createLogger } from '@organic/utils';

import type {
  IStorageBackend,
  MemoryStorageConfig,
  FileStorageConfig,
  DatabaseStorageConfig,
  GoogleDriveConfig,
} from '../backends/index.js';
import {
  StorageBackendType,
  MemoryStorage,
  FileStorage,
  DatabaseStorage,
  GoogleDriveStorage,
} from '../backends/index.js';
import { StorageService, type StorageInfo } from './StorageService.js';

/**
 * Storage manager configuration
 */
export interface StorageManagerConfig {
  /** Default backend type */
  defaultBackend?: StorageBackendType;
  /** Memory storage config */
  memoryConfig?: MemoryStorageConfig;
  /** File storage config */
  fileConfig?: FileStorageConfig;
  /** Database storage config */
  databaseConfig?: DatabaseStorageConfig;
  /** Google Drive storage config */
  googleDriveConfig?: GoogleDriveConfig;
  /** Enable auto-initialization */
  autoInitialize?: boolean;
}

/**
 * Storage backend entry
 */
interface BackendEntry {
  backend: IStorageBackend;
  service: StorageService;
  type: StorageBackendType;
}

/**
 * Storage Manager
 * Central manager for creating and managing storage services
 */
export class StorageManager {
  private backends: Map<string, BackendEntry> = new Map();
  private defaultName: string = 'default';
  private config: StorageManagerConfig;
  private logger: Logger;
  private initialized: boolean = false;

  constructor(config: StorageManagerConfig = {}, logger?: Logger) {
    this.config = {
      defaultBackend: StorageBackendType.MEMORY,
      autoInitialize: config.autoInitialize ?? true,
      ...config,
    };
    this.logger = logger || createLogger({ prefix: 'StorageManager' });
  }

  /**
   * Initialize the storage manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Storage manager already initialized');
      return;
    }

    // Create default storage
    await this.createStorage(
      this.defaultName,
      this.config.defaultBackend || StorageBackendType.MEMORY
    );

    this.initialized = true;
    this.logger.info('Storage manager initialized');
  }

  /**
   * Close the storage manager and all backends
   */
  async close(): Promise<void> {
    for (const [name, entry] of this.backends.entries()) {
      try {
        await entry.service.close();
        this.logger.debug(`Closed storage: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to close storage ${name}: ${error}`);
      }
    }

    this.backends.clear();
    this.initialized = false;
    this.logger.info('Storage manager closed');
  }

  /**
   * Create a new storage with the specified type
   */
  async createStorage(name: string, type: StorageBackendType): Promise<StorageService> {
    if (this.backends.has(name)) {
      this.logger.warn(`Storage '${name}' already exists, returning existing`);
      return this.backends.get(name)!.service;
    }

    const backend = this.createBackend(type);
    const service = new StorageService(backend, this.logger);

    if (this.config.autoInitialize) {
      await backend.initialize();
      this.logger.debug(`Backend '${name}' (${type}) initialized`);
    }

    this.backends.set(name, { backend, service, type });
    this.logger.info(`Created storage: ${name} (${type})`);

    return service;
  }

  /**
   * Get a storage service by name
   */
  getStorage(name?: string): StorageService {
    const storageName = name || this.defaultName;
    const entry = this.backends.get(storageName);

    if (!entry) {
      throw new Error(`Storage '${storageName}' not found`);
    }

    return entry.service;
  }

  /**
   * Check if a storage exists
   */
  hasStorage(name: string): boolean {
    return this.backends.has(name);
  }

  /**
   * Remove a storage
   */
  async removeStorage(name: string): Promise<boolean> {
    const entry = this.backends.get(name);
    if (!entry) {
      return false;
    }

    await entry.service.close();
    this.backends.delete(name);
    this.logger.info(`Removed storage: ${name}`);
    return true;
  }

  /**
   * Get all storage names
   */
  getStorageNames(): string[] {
    return Array.from(this.backends.keys());
  }

  /**
   * Get storage info for all storages
   */
  async getAllStorageInfo(): Promise<Map<string, Promise<StorageInfo>>> {
    const infoMap = new Map<string, Promise<StorageInfo>>();

    for (const [name, entry] of this.backends.entries()) {
      infoMap.set(name, entry.service.getStorageInfo());
    }

    return infoMap;
  }

  /**
   * Clear all storages
   */
  async clearAll(): Promise<void> {
    for (const entry of this.backends.values()) {
      const info = entry.backend.getInfo();
      if (info.connected) {
        await entry.backend.clear();
      }
    }
    this.logger.info('All storages cleared');
  }

  /**
   * Create appropriate backend based on type
   */
  private createBackend(type: StorageBackendType): IStorageBackend {
    switch (type) {
      case StorageBackendType.MEMORY:
        return new MemoryStorage(this.config.memoryConfig || {});

      case StorageBackendType.FILE:
        if (!this.config.fileConfig?.basePath) {
          throw new Error('FileStorage requires basePath configuration');
        }
        return new FileStorage(this.config.fileConfig);

      case StorageBackendType.DATABASE:
        if (!this.config.databaseConfig?.dbPath) {
          throw new Error('DatabaseStorage requires dbPath configuration');
        }
        return new DatabaseStorage(this.config.databaseConfig);

      case StorageBackendType.GOOGLE_DRIVE:
        if (!this.config.googleDriveConfig?.clientId) {
          throw new Error('GoogleDriveStorage requires clientId configuration');
        }
        return new GoogleDriveStorage(this.config.googleDriveConfig);

      default:
        throw new Error(`Unknown storage backend type: ${type}`);
    }
  }

  /**
   * Set default storage name
   */
  setDefaultStorage(name: string): void {
    if (!this.backends.has(name)) {
      throw new Error(`Storage '${name}' not found`);
    }
    this.defaultName = name;
    this.logger.debug(`Default storage set to: ${name}`);
  }

  /**
   * Get default storage name
   */
  getDefaultStorageName(): string {
    return this.defaultName;
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create a memory storage with default configuration
   */
  static createMemoryStorage(config?: MemoryStorageConfig): StorageService {
    const backend = new MemoryStorage(config);
    return new StorageService(backend);
  }

  /**
   * Create a file storage with configuration
   */
  static createFileStorage(config: FileStorageConfig): StorageService {
    const backend = new FileStorage(config);
    return new StorageService(backend);
  }

  /**
   * Create a database storage with configuration
   */
  static createDatabaseStorage(config: DatabaseStorageConfig): StorageService {
    const backend = new DatabaseStorage(config);
    return new StorageService(backend);
  }
}
