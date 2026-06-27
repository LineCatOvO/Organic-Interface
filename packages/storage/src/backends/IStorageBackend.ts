/**
 * Storage Backend Interface for Organic Interface Storage
 */

import type { StorageEntity } from '../models/StorageEntity.js';

/**
 * Storage backend interface
 * Defines the contract for different storage implementations
 */
export interface IStorageBackend {
  /**
   * Initialize the storage backend
   */
  initialize(): Promise<void>;

  /**
   * Close the storage backend
   */
  close(): Promise<void>;

  /**
   * Check if the backend is connected
   */
  isConnected(): boolean;

  /**
   * Get entity by ID
   */
  get(id: string): Promise<StorageEntity | null>;

  /**
   * Set entity
   */
  set(entity: StorageEntity): Promise<void>;

  /**
   * Delete entity by ID
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if entity exists
   */
  has(id: string): Promise<boolean>;

  /**
   * Get all entities
   */
  getAll(): Promise<StorageEntity[]>;

  /**
   * Get entities by type
   */
  getByType(type: string): Promise<StorageEntity[]>;

  /**
   * Query entities by filter
   */
  query(filter: Record<string, unknown>): Promise<StorageEntity[]>;

  /**
   * Clear all entities
   */
  clear(): Promise<void>;

  /**
   * Get the count of entities
   */
  count(): Promise<number>;

  /**
   * Get storage info
   */
  getInfo(): StorageBackendInfo;
}

/**
 * Storage backend information
 */
export interface StorageBackendInfo {
  /** Backend type */
  type: string;
  /** Whether backend is connected */
  connected: boolean;
  /** Entity count */
  count: number;
  /** Additional info */
  [key: string]: unknown;
}

/**
 * Backend type enumeration
 */
export enum StorageBackendType {
  MEMORY = 'memory',
  FILE = 'file',
  DATABASE = 'database',
  GOOGLE_DRIVE = 'google_drive',
}
