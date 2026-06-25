import { describe, it, expect } from 'vitest';
import { ShellTool, createShellTool } from '../ShellTool.js';
import type { ToolExecutionContext } from '../../types/index.js';

describe('ShellTool', () => {
  const mockContext: ToolExecutionContext = {
    toolId: 'builtin:shell',
    executionId: 'exec-1',
    workingDirectory: '/tmp',
    environment: {},
    cancelled: false,
    permissionLevel: 'L2',
    metadata: {},
  };

  describe('constructor', () => {
    it('should create ShellTool instance', () => {
      const tool = new ShellTool();
      expect(tool).toBeDefined();
    });
  });

  describe('getDefinition', () => {
    it('should return tool definition', () => {
      const tool = new ShellTool();
      const definition = tool.getDefinition();
      expect(definition.id).toBe('builtin:shell');
      expect(definition.name).toBe('ShellTool');
      expect(definition.category).toBe('shell');
    });

    it('should have timeout configured', () => {
      const tool = new ShellTool();
      expect(tool.getDefinition().timeout).toBe(60000);
    });
  });

  describe('validate', () => {
    it('should require command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({});
      expect(errors.some(e => e.path === 'command')).toBe(true);
    });

    it('should accept valid input', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'ls -la' });
      expect(errors).toHaveLength(0);
    });

    it('should reject non-array args', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'ls', args: 'not-array' as any });
      expect(errors.some(e => e.path === 'args')).toBe(true);
    });

    it('should reject negative timeout', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'ls', timeout: -1 });
      expect(errors.some(e => e.path === 'timeout')).toBe(true);
    });

    it('should reject zero timeout', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'ls', timeout: 0 });
      expect(errors.some(e => e.path === 'timeout')).toBe(true);
    });

    it('should accept valid timeout', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'ls', timeout: 5000 });
      expect(errors).toHaveLength(0);
    });
  });

  describe('execute', () => {
    it('should reject L1 permission level', async () => {
      const tool = new ShellTool();
      const l1Context = { ...mockContext, permissionLevel: 'L1' as any };
      const result = await tool.execute({ command: 'ls' }, l1Context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not permitted');
    });

    it('should execute echo command', async () => {
      const tool = new ShellTool();
      const result = await tool.execute({ command: 'echo', args: ['hello'] }, mockContext);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).exitCode).toBe(0);
    });

    it('should capture stdout', async () => {
      const tool = new ShellTool();
      const result = await tool.execute({ command: 'echo', args: ['test'] }, mockContext);
      expect(result.success).toBe(true);
      expect((result.data as any).stdout).toContain('test');
    });

    it('should handle command with args', async () => {
      const tool = new ShellTool();
      const result = await tool.execute({ command: 'printf', args: ['hello'] }, mockContext);
      expect(result.success).toBe(true);
    });

    it('should handle environment variables', async () => {
      const tool = new ShellTool();
      const result = await tool.execute(
        { command: 'echo', args: ['$TEST_VAR'], env: { TEST_VAR: 'test-value' } },
        mockContext
      );
      expect(result.success).toBe(true);
    });

    it('should handle custom working directory', async () => {
      const tool = new ShellTool();
      const result = await tool.execute({ command: 'pwd', cwd: '/tmp' }, mockContext);
      expect(result.success).toBe(true);
    });

    it('should handle command failure', async () => {
      const tool = new ShellTool();
      const result = await tool.execute({ command: 'exit', args: ['1'] }, mockContext);
      expect(result.success).toBe(false);
      expect((result.data as any).exitCode).toBe(1);
    });

    it('should handle command not found', async () => {
      const tool = new ShellTool();
      const result = await tool.execute({ command: 'nonexistent-command-xyz' }, mockContext);
      expect(result.success).toBe(false);
    });

    it('should respect timeout', async () => {
      const tool = new ShellTool();
      const result = await tool.execute(
        { command: 'node', args: ['-e', 'setTimeout(() => {}, 10000)'], timeout: 50 },
        mockContext
      );
      expect(result.success).toBe(false);
    });
  });

  describe('security: command injection protection', () => {
    it('should block dangerous commands like sudo', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'sudo rm -rf /' });
      expect(errors.some(e => e.path === 'command')).toBe(true);
      expect(errors[0]?.message).toContain('not permitted');
    });

    it('should block su command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'su root' });
      expect(errors.some(e => e.path === 'command')).toBe(true);
    });

    it('should block chmod command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'chmod 777 /etc/passwd' });
      expect(errors.some(e => e.path === 'command')).toBe(true);
    });

    it('should block chown command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'chown root:root /etc/shadow' });
      expect(errors.some(e => e.path === 'command')).toBe(true);
    });

    it('should block reboot command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'reboot' });
      expect(errors.some(e => e.path === 'command')).toBe(true);
    });

    it('should block shutdown command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'shutdown -h now' });
      expect(errors.some(e => e.path === 'command')).toBe(true);
    });

    it('should block dd command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'dd if=/dev/zero of=/dev/sda' });
      expect(errors.some(e => e.path === 'command')).toBe(true);
    });

    it('should block mkfs command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'mkfs /dev/sda1' });
      expect(errors.some(e => e.path === 'command')).toBe(true);
    });

    it('should block fdisk command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'fdisk /dev/sda' });
      expect(errors.some(e => e.path === 'command')).toBe(true);
    });

    it('should allow safe commands like echo', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'echo hello' });
      expect(errors).toHaveLength(0);
    });

    it('should allow ls command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'ls -la /tmp' });
      expect(errors).toHaveLength(0);
    });

    it('should allow git command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'git status' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('createShellTool', () => {
    it('should create ShellTool instance', () => {
      const instance = createShellTool();
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(ShellTool);
    });
  });
});
