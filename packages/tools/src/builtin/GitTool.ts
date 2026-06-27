/**
 * GitTool - Built-in tool for Git operations
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  type Tool,
  type ToolDefinition,
  type ToolResult,
  type ToolExecutionContext,
  type ToolValidationError,
} from '../types/index.js';

const execFileAsync = promisify(execFile);

type GitOperation = 'status' | 'diff' | 'log' | 'branch' | 'add' | 'commit';

interface GitToolInput {
  operation: GitOperation;
  cwd?: string;
  staged?: boolean;
  count?: number;
  files?: string[];
  message?: string;
}

export class GitTool implements Tool {
  private definition: ToolDefinition;

  constructor() {
    this.definition = {
      id: 'builtin:git',
      name: 'GitTool',
      description: 'Git operations: status, diff, log, branch, add, commit',
      category: 'git',
      inputSchema: {
        type: 'object',
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: ['status', 'diff', 'log', 'branch', 'add', 'commit'],
            description: 'Git operation to perform',
          },
          cwd: { type: 'string', description: 'Working directory' },
          staged: { type: 'boolean', description: 'Show staged changes (diff)' },
          count: { type: 'number', description: 'Number of entries (log)' },
          files: { type: 'array', items: { type: 'string' }, description: 'Files to add' },
          message: { type: 'string', description: 'Commit message' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'any' },
          error: { type: 'string' },
        },
      },
      enabled: true,
      timeout: 30000,
      permissions: [{ type: 'execute', scope: 'git', granted: true }],
    };
  }

  getDefinition(): ToolDefinition {
    return this.definition;
  }

  validate(input: unknown): ToolValidationError[] {
    const errors: ToolValidationError[] = [];
    const data = input as Partial<GitToolInput>;
    const validOps: GitOperation[] = ['status', 'diff', 'log', 'branch', 'add', 'commit'];

    if (!data.operation) {
      errors.push({ path: 'operation', message: 'Operation is required', expected: 'string', actual: data.operation });
    } else if (!validOps.includes(data.operation as GitOperation)) {
      errors.push({ path: 'operation', message: `Invalid: ${data.operation}`, expected: validOps.join('|'), actual: data.operation });
    }

    if (data.operation === 'commit' && !data.message) {
      errors.push({ path: 'message', message: 'Commit message is required', expected: 'string', actual: data.message });
    }

    return errors;
  }

  async execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const data = input as GitToolInput;
    const startTime = Date.now();
    const cwd = data.cwd ?? context.workingDirectory;

    try {
      const result = await this.runOperation(data, cwd);
      return { success: true, data: result, executionTime: Date.now() - startTime };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), executionTime: Date.now() - startTime };
    }
  }

  private async runOperation(input: GitToolInput, cwd: string): Promise<unknown> {
    switch (input.operation) {
      case 'status': return this.gitStatus(cwd);
      case 'diff': return this.gitDiff(cwd, input.staged);
      case 'log': return this.gitLog(cwd, input.count);
      case 'branch': return this.gitBranch(cwd);
      case 'add': return this.gitAdd(cwd, input.files);
      case 'commit': return this.gitCommit(cwd, input.message!);
      default: throw new Error(`Unknown operation: ${input.operation}`);
    }
  }

  private async gitStatus(cwd: string): Promise<Record<string, unknown>> {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd });
    const files = stdout.trim().split('\n').filter(Boolean).map(line => ({
      status: line.substring(0, 2).trim(),
      file: line.substring(3),
    }));
    return { files, count: files.length, raw: stdout };
  }

  private async gitDiff(cwd: string, staged?: boolean): Promise<Record<string, unknown>> {
    const args = ['diff'];
    if (staged) args.push('--staged');
    const { stdout } = await execFileAsync('git', args, { cwd });
    return { diff: stdout, hasChanges: stdout.length > 0 };
  }

  private async gitLog(cwd: string, count?: number): Promise<Record<string, unknown>> {
    const args = ['log', '--oneline', '--decorate'];
    if (count && count > 0) args.push(`-n${count}`);
    const { stdout } = await execFileAsync('git', args, { cwd });
    const entries = stdout.trim().split('\n').filter(Boolean);
    return { entries, count: entries.length };
  }

  private async gitBranch(cwd: string): Promise<Record<string, unknown>> {
    const { stdout } = await execFileAsync('git', ['branch', '--list'], { cwd });
    const branches = stdout.trim().split('\n').filter(Boolean).map(b => {
      const isCurrent = b.startsWith('*');
      return { name: isCurrent ? b.substring(2) : b.trim(), current: isCurrent };
    });
    const currentBranch = branches.find(b => b.current);
    return { branches, currentBranch: currentBranch?.name ?? null };
  }

  private async gitAdd(cwd: string, files?: string[]): Promise<Record<string, unknown>> {
    const args = ['add', ...(files && files.length > 0 ? files : ['.'])];
    const { stdout } = await execFileAsync('git', args, { cwd });
    return { success: true, files: files ?? ['.'], output: stdout };
  }

  private async gitCommit(cwd: string, message: string): Promise<Record<string, unknown>> {
    const { stdout } = await execFileAsync('git', ['commit', '-m', message], { cwd });
    return { success: true, message, output: stdout.trim() };
  }
}

/**
 * Create a GitTool instance
 */
export function createGitTool(): GitTool {
  return new GitTool();
}