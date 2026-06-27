/** Storage entity for generic data storage */
export interface StorageEntity {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** Storage query options */
export interface StorageQueryOptions {
  type?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/** Storage facade interface */
export interface IStorageFacade {
  get(id: string): Promise<StorageEntity | null>;
  set(entity: StorageEntity): Promise<void>;
  delete(id: string): Promise<void>;
  has(id: string): Promise<boolean>;
  getAll(): Promise<StorageEntity[]>;
  getByType(type: string): Promise<StorageEntity[]>;
  query(options: StorageQueryOptions): Promise<StorageEntity[]>;
  count(): Promise<number>;
  clear(): Promise<void>;
}