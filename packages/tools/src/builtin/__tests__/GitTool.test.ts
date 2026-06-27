import { describe, it, expect, beforeEach } from 'vitest';
import { GitTool, createGitTool } from '../GitTool.js';
import type { ToolExecutionContext } from '../../types/index.js';

const mockContext: ToolExecutionContext = {
  toolId: 'builtin:git',
  executionId: 'exec-1',
  workingDirectory: process.cwd(),
  environment: {},
  cancelled: false,
  permissionLevel: 'L2',
  metadata: {},
};

describe('GitTool', () => {
  let tool: GitTool;

  beforeEach(() => {
    tool = new GitTool();
  });

  // 2. getDefinition
  it('should return correct tool definition', () => {
    const def = tool.getDefinition();
    expect(def.id).toBe('builtin:git');
    expect(def.name).toBe('GitTool');
    expect(def.category).toBe('git');
    expect(def.enabled).toBe(true);
  });

  // 3. validate - valid operations
  it('should accept valid status operation', () => {
    expect(tool.validate({ operation: 'status' })).toHaveLength(0);
  });

  it('should accept valid add operation', () => {
    expect(tool.validate({ operation: 'add', files: ['a.txt'] })).toHaveLength(0);
  });

  // 4. validate - missing operation
  it('should require operation field', () => {
    const errors = tool.validate({});
    expect(errors.some(e => e.path === 'operation')).toBe(true);
  });

  // 5. validate - invalid operation
  it('should reject invalid operation', () => {
    const errors = tool.validate({ operation: 'invalid' });
    expect(errors.some(e => e.path === 'operation')).toBe(true);
  });

  // 6. validate - commit requires message
  it('should require message for commit operation', () => {
    const errors = tool.validate({ operation: 'commit' });
    expect(errors.some(e => e.path === 'message')).toBe(true);
  });

  // 7. execute - git status
  it('should execute git status successfully', async () => {
    const result = await tool.execute({ operation: 'status' }, mockContext);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect((result.data as { files: unknown[] }).files).toBeInstanceOf(Array);
  });

  // 8. execute - git branch
  it('should execute git branch successfully', async () => {
    const result = await tool.execute({ operation: 'branch' }, mockContext);
    expect(result.success).toBe(true);
    const data = result.data as { branches: unknown[]; currentBranch: string };
    expect(data.branches).toBeInstanceOf(Array);
    expect(typeof data.currentBranch).toBe('string');
  });

  // 9. execute - git log
  it('should execute git log successfully', async () => {
    const result = await tool.execute({ operation: 'log', count: 3 }, mockContext);
    expect(result.success).toBe(true);
    const data = result.data as { entries: unknown[]; count: number };
    expect(data.entries).toBeInstanceOf(Array);
    expect(typeof data.count).toBe('number');
  });

  // 10. execute - git diff
  it('should execute git diff successfully', async () => {
    const result = await tool.execute({ operation: 'diff' }, mockContext);
    expect(result.success).toBe(true);
    const data = result.data as { diff: string; hasChanges: boolean };
    expect(typeof data.hasChanges).toBe('boolean');
  });

  // 11. execute - error on invalid cwd
  it('should return error for invalid working directory', async () => {
    const result = await tool.execute(
      { operation: 'status', cwd: '/nonexistent/path' },
      mockContext,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // 12. factory function
  it('should create GitTool via factory', () => {
    const t = createGitTool();
    expect(t).toBeInstanceOf(GitTool);
    expect(t.getDefinition().id).toBe('builtin:git');
  });
});