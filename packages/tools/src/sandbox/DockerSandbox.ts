/**
 * DockerSandbox - Docker-based sandbox for isolated tool execution
 */
import { execFile, type ExecFileException } from 'child_process';
import { createLogger, type Logger } from '@organic/utils';

/** Docker sandbox configuration */
export interface DockerSandboxConfig {
  /** Docker image to use (default: node:20-slim) */
  image?: string;
  /** CPU limit (e.g. "1.0" for 1 core) */
  cpuLimit?: string;
  /** Memory limit (e.g. "256m") */
  memoryLimit?: string;
  /** Network mode (default: "none") */
  networkMode?: 'none' | 'bridge' | 'host';
  /** Volume mounts (hostPath:containerPath) */
  volumes?: string[];
  /** Container timeout in ms */
  timeout?: number;
}

/** Result of sandbox execution */
export interface SandboxExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

/** Docker sandbox lifecycle states */
export type SandboxState = 'creating' | 'running' | 'stopped' | 'removed' | 'error';

/** Default sandbox configuration */
export const DEFAULT_SANDBOX_CONFIG: Required<DockerSandboxConfig> = {
  image: 'node:20-slim',
  cpuLimit: '1.0',
  memoryLimit: '256m',
  networkMode: 'none',
  volumes: [],
  timeout: 30000,
};

/**
 * DockerSandbox - Manages a Docker container for isolated execution
 */
export class DockerSandbox {
  private config: Required<DockerSandboxConfig>;
  private containerId: string | null = null;
  private state: SandboxState = 'removed';
  private logger: Logger;
  private createdAt: number = 0;

  constructor(config: DockerSandboxConfig = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    this.logger = createLogger({ prefix: 'docker-sandbox' });
  }

  /** Get current sandbox state */
  getState(): SandboxState { return this.state; }

  /** Get container ID */
  getContainerId(): string | null { return this.containerId; }

  /** Get time since creation in ms */
  getAge(): number {
    return this.createdAt ? Date.now() - this.createdAt : 0;
  }

  /** Create the Docker container */
  async create(): Promise<void> {
    if (this.state !== 'removed') {
      throw new Error(`Cannot create: sandbox is in ${this.state} state`);
    }
    this.state = 'creating';
    const args = this.buildCreateArgs();
    this.logger.debug(`Creating container: docker ${args.join(' ')}`);
    try {
      const output = await this.execDocker(args);
      this.containerId = output.stdout.trim();
      this.createdAt = Date.now();
      this.state = 'stopped';
      this.logger.info(`Container created: ${this.containerId}`);
    } catch (err) {
      this.state = 'error';
      throw new Error(`Failed to create container: ${this.formatError(err)}`);
    }
  }

  /** Start the container */
  async start(): Promise<void> {
    if (!this.containerId) throw new Error('No container to start');
    if (this.state === 'running') return;
    try {
      await this.execDocker(['start', this.containerId]);
      this.state = 'running';
      this.logger.info(`Container started: ${this.containerId}`);
    } catch (err) {
      this.state = 'error';
      throw new Error(`Failed to start: ${this.formatError(err)}`);
    }
  }

  /** Stop the container */
  async stop(): Promise<void> {
    if (!this.containerId) return;
    if (this.state === 'stopped' || this.state === 'removed') return;
    try {
      await this.execDocker(['stop', '-t', '5', this.containerId]);
      this.state = 'stopped';
      this.logger.info(`Container stopped: ${this.containerId}`);
    } catch (err) {
      this.logger.warn(`Stop warning: ${this.formatError(err)}`);
    }
  }

  /** Remove the container */
  async remove(): Promise<void> {
    if (!this.containerId) return;
    if (this.state === 'running') await this.stop();
    if (this.state === 'removed') return;
    try {
      await this.execDocker(['rm', '-f', this.containerId]);
      this.state = 'removed';
      this.containerId = null;
      this.logger.info('Container removed');
    } catch (err) {
      this.logger.warn(`Remove warning: ${this.formatError(err)}`);
    }
  }

  /** Execute a command inside the sandbox */
  async execute(command: string): Promise<SandboxExecutionResult> {
    if (!this.containerId) throw new Error('No container available');
    if (this.state !== 'running') {
      throw new Error(`Sandbox not running (state: ${this.state})`);
    }
    const startTime = Date.now();
    try {
      const execArgs = ['exec', '-i', this.containerId, 'sh', '-c', command];
      const result = await this.execDocker(execArgs, this.config.timeout);
      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTime: Date.now() - startTime,
      };
    } catch (err) {
      const elapsed = Date.now() - startTime;
      return {
        success: false,
        stdout: '',
        stderr: this.formatError(err),
        exitCode: -1,
        executionTime: elapsed,
      };
    }
  }

  /** Build docker create arguments */
  private buildCreateArgs(): string[] {
    const args = ['create', '-i'];
    args.push('--cpus', this.config.cpuLimit);
    args.push('--memory', this.config.memoryLimit);
    args.push('--network', this.config.networkMode);
    args.push('--cap-drop', 'ALL');
    args.push('--security-opt', 'no-new-privileges');
    for (const vol of this.config.volumes) {
      args.push('-v', vol);
    }
    args.push(this.config.image);
    args.push('tail', '-f', '/dev/null');
    return args;
  }

  /** Execute a docker command */
  private execDocker(
    args: string[],
    timeout?: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      execFile('docker', args, { timeout: timeout ?? 30000, maxBuffer: 10 * 1024 * 1024 },
        (error: ExecFileException | null, stdout: string, stderr: string) => {
          if (error) {
            if (error.killed) reject(new Error('Command timed out'));
            else reject(error);
            return;
          }
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 });
        });
    });
  }

  /** Format error message */
  private formatError(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}