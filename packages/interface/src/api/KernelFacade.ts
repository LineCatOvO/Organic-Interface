/** Kernel runtime status */
export type KernelStatus = 'initializing' | 'ready' | 'running' | 'stopped' | 'error';

/** Kernel configuration snapshot */
export interface KernelConfig {
  name: string;
  version: string;
  plugins?: string[];
  tools?: string[];
  options?: Record<string, unknown>;
}

/** Plugin metadata for plugin management */
export interface PluginInfo {
  name: string;
  version: string;
  enabled: boolean;
  registeredAt: number;
}

/** Plugin manager interface */
export interface IPluginManager {
  register(name: string, plugin: unknown): Promise<void>;
  unregister(name: string): Promise<void>;
  list(): PluginInfo[];
  get(name: string): PluginInfo | undefined;
}

/** Kernel facade interface for frontend-agnostic kernel access */
export interface IKernelFacade {
  getStatus(): KernelStatus;
  getConfig(): KernelConfig;
  getVersion(): string;
  executeTool(name: string, params: Record<string, unknown>): Promise<unknown>;
  getPluginManager(): IPluginManager;
}