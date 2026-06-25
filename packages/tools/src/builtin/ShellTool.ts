/**
 * ShellTool - Built-in tool for shell command execution
 */

import { spawn } from 'child_process';
import {
  type Tool,
  type ToolDefinition,
  type ToolResult,
  type ToolExecutionContext,
  type ToolValidationError,
} from '../types/index.js';

/**
 * ShellTool input schema
 */
interface ShellToolInput {
  /** Command to execute */
  command: string;

  /** Command arguments */
  args?: string[];

  /** Working directory */
  cwd?: string;

  /** Environment variables */
  env?: Record<string, string>;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Whether to capture stdout */
  captureStdout?: boolean;

  /** Whether to capture stderr */
  captureStderr?: boolean;
}

/**
 * ShellTool execution result
 */
interface ShellToolResult {
  /** Exit code */
  exitCode: number | null;

  /** Standard output */
  stdout: string;

  /** Standard error */
  stderr: string;

  /** Signal that terminated the process */
  signal?: string;
}

/**
 * ShellTool - Built-in shell command execution tool
 */
export class ShellTool implements Tool {
  private definition: ToolDefinition;

  constructor() {
    this.definition = {
      id: 'builtin:shell',
      name: 'ShellTool',
      description:
        'Built-in tool for executing shell commands with controlled environment and timeout',
      category: 'shell',
      inputSchema: {
        type: 'object',
        required: ['command'],
        properties: {
          command: {
            type: 'string',
            description: 'Shell command to execute',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Command arguments',
          },
          cwd: {
            type: 'string',
            description: 'Working directory for command execution',
          },
          env: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Environment variables',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds',
          },
          captureStdout: {
            type: 'boolean',
            description: 'Whether to capture stdout (default: true)',
          },
          captureStderr: {
            type: 'boolean',
            description: 'Whether to capture stderr (default: true)',
          },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              exitCode: { type: ['number', 'null'] },
              stdout: { type: 'string' },
              stderr: { type: 'string' },
              signal: { type: 'string' },
            },
          },
          error: { type: 'string' },
        },
      },
      enabled: true,
      timeout: 60000,
      permissions: [{ type: 'execute', scope: 'shell', granted: true }],
    };
  }

  getDefinition(): ToolDefinition {
    return this.definition;
  }

  /** Blocklisted dangerous commands */
  private static readonly BLOCKLISTED_COMMANDS = new Set([
    'sudo',
    'su',
    'chown',
    'chmod',
    'passwd',
    'mkfs',
    'dd',
    'fdisk',
    'reboot',
    'shutdown',
    'init',
  ]);

  validate(input: unknown): ToolValidationError[] {
    const errors: ToolValidationError[] = [];
    const data = input as Partial<ShellToolInput>;

    if (!data.command) {
      errors.push({
        path: 'command',
        message: 'Command is required',
        expected: 'string',
        actual: data.command,
      });
    } else if (ShellTool.BLOCKLISTED_COMMANDS.has(data.command.trim().split(/\s+/)[0]!)) {
      errors.push({
        path: 'command',
        message: `Command '${data.command.trim().split(/\s+/)[0]}' is not permitted for security reasons`,
        expected: 'safe command',
        actual: data.command,
      });
    }

    if (data.args !== undefined && !Array.isArray(data.args)) {
      errors.push({
        path: 'args',
        message: 'Args must be an array',
        expected: 'array',
        actual: typeof data.args,
      });
    }

    if (data.timeout !== undefined && (typeof data.timeout !== 'number' || data.timeout <= 0)) {
      errors.push({
        path: 'timeout',
        message: 'Timeout must be a positive number',
        expected: 'number > 0',
        actual: data.timeout,
      });
    }

    return errors;
  }

  async execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const data = input as ShellToolInput;
    const startTime = Date.now();

    // Check permission level for shell execution
    if (context.permissionLevel === 'L1') {
      return {
        success: false,
        error: 'Shell execution not permitted at L1 permission level',
        executionTime: Date.now() - startTime,
      };
    }

    return new Promise(resolve => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      const captureStdout = data.captureStdout !== false;
      const captureStderr = data.captureStderr !== false;

      const proc = spawn(data.command, data.args ?? [], {
        cwd: data.cwd ?? context.workingDirectory,
        env: { ...context.environment, ...data.env },
        shell: true,
      });

      // Set up timeout
      const timeout = data.timeout ?? this.definition.timeout;
      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
      }, timeout);

      // Set up event handlers
      if (captureStdout && proc.stdout) {
        proc.stdout.on('data', (chunk: Buffer) => {
          stdoutChunks.push(chunk.toString());
        });
      }

      if (captureStderr && proc.stderr) {
        proc.stderr.on('data', (chunk: Buffer) => {
          stderrChunks.push(chunk.toString());
        });
      }

      proc.on('close', (code, signal) => {
        clearTimeout(timeoutId);

        const result: ShellToolResult = {
          exitCode: code,
          stdout: stdoutChunks.join(''),
          stderr: stderrChunks.join(''),
          signal: signal ?? undefined,
        };

        resolve({
          success: code === 0,
          data: result,
          executionTime: Date.now() - startTime,
          metadata: {
            exitCode: code,
            signal,
          },
        });
      });

      proc.on('error', error => {
        clearTimeout(timeoutId);

        resolve({
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime,
        });
      });
    });
  }
}

/**
 * Create a ShellTool instance
 */
export function createShellTool(): ShellTool {
  return new ShellTool();
}
