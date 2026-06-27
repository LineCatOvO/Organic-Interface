/**
 * SandboxManager - Manages a pool of Docker sandboxes with reuse strategy
 */
import { createLogger, type Logger } from '@organic/utils';
import { DockerSandbox, type DockerSandboxConfig } from './DockerSandbox.js';

/** Sandbox pool entry */
interface PoolEntry {
  sandbox: DockerSandbox;
  inUse: boolean;
  lastUsed: number;
  useCount: number;
}

/** SandboxManager configuration */
export interface SandboxManagerConfig {
  /** Maximum pool size */
  maxPoolSize?: number;
  /** Minimum idle sandboxes to keep */
  minIdle?: number;
  /** Max reuse count per sandbox */
  maxReuse?: number;
  /** Max age of sandbox in ms before recycling */
  maxAge?: number;
  /** Default sandbox config */
  sandboxConfig?: DockerSandboxConfig;
}

/** Default manager config */
export const DEFAULT_MANAGER_CONFIG: Required<SandboxManagerConfig> = {
  maxPoolSize: 10,
  minIdle: 1,
  maxReuse: 50,
  maxAge: 30 * 60 * 1000,
  sandboxConfig: {},
};

/**
 * SandboxManager - Manages sandbox pool with reuse and recycle strategies
 */
export class SandboxManager {
  private pool: PoolEntry[] = [];
  private config: Required<SandboxManagerConfig>;
  private logger: Logger;
  private initialized: boolean = false;

  constructor(config: SandboxManagerConfig = {}) {
    this.config = { ...DEFAULT_MANAGER_CONFIG, ...config };
    this.logger = createLogger({ prefix: 'sandbox-manager' });
  }

  /** Initialize pool with minimum idle sandboxes */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.logger.info('Initializing sandbox pool');
    for (let i = 0; i < this.config.minIdle; i++) {
      await this.createAndAddToPool();
    }
    this.initialized = true;
    this.logger.info(`Pool initialized (${this.pool.length} sandboxes)`);
  }

  /** Acquire an available sandbox from the pool */
  async acquire(): Promise<DockerSandbox> {
    if (!this.initialized) await this.initialize();
    this.recycleStaleEntries();
    let entry = this.findAvailableEntry();
    if (!entry) {
      if (this.pool.length >= this.config.maxPoolSize) {
        throw new Error('Pool exhausted: no sandbox available');
      }
      entry = await this.createAndAddToPool();
    }
    entry.inUse = true;
    entry.lastUsed = Date.now();
    entry.useCount++;
    if (entry.sandbox.getState() !== 'running') {
      await entry.sandbox.start();
    }
    this.logger.debug(`Sandbox acquired: ${entry.sandbox.getContainerId()}`);
    return entry.sandbox;
  }

  /** Release a sandbox back to the pool */
  async release(sandbox: DockerSandbox): Promise<void> {
    const entry = this.pool.find(e => e.sandbox === sandbox);
    if (!entry) {
      await sandbox.remove();
      return;
    }
    entry.inUse = false;
    entry.lastUsed = Date.now();
    if (entry.useCount >= this.config.maxReuse) {
      this.logger.info('Max reuse reached, removing sandbox');
      await this.removeFromPool(entry);
      return;
    }
    this.logger.debug(`Sandbox released: ${sandbox.getContainerId()}`);
  }

  /** Shutdown and cleanup all sandboxes */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down sandbox pool');
    const removals = this.pool.map(entry => entry.sandbox.remove());
    await Promise.all(removals);
    this.pool = [];
    this.initialized = false;
    this.logger.info('Pool shutdown complete');
  }

  /** Get pool status */
  getPoolStatus(): {
    total: number;
    inUse: number;
    idle: number;
    maxPoolSize: number;
  } {
    return {
      total: this.pool.length,
      inUse: this.pool.filter(e => e.inUse).length,
      idle: this.pool.filter(e => !e.inUse).length,
      maxPoolSize: this.config.maxPoolSize,
    };
  }

  /** Create a new sandbox and add to pool */
  private async createAndAddToPool(): Promise<PoolEntry> {
    const sandbox = new DockerSandbox(this.config.sandboxConfig);
    await sandbox.create();
    const entry: PoolEntry = {
      sandbox, inUse: false,
      lastUsed: Date.now(), useCount: 0,
    };
    this.pool.push(entry);
    return entry;
  }

  /** Find an available idle entry */
  private findAvailableEntry(): PoolEntry | undefined {
    return this.pool.find(e => !e.inUse && e.sandbox.getState() !== 'error');
  }

  /** Remove stale entries from pool */
  private recycleStaleEntries(): void {
    const now = Date.now();
    for (const entry of [...this.pool]) {
      if (!entry.inUse && now - entry.lastUsed > this.config.maxAge) {
        this.removeFromPool(entry);
      }
    }
  }

  /** Remove an entry from pool */
  private async removeFromPool(entry: PoolEntry): Promise<void> {
    const idx = this.pool.indexOf(entry);
    if (idx !== -1) this.pool.splice(idx, 1);
    await entry.sandbox.remove();
  }
}