/**
 * CLI Interactive Flow E2E Tests
 *
 * Covers complete CLI interactive command flows including:
 * - Command parsing and execution
 * - History navigation
 * - Context-sensitive help
 * - Multi-level command interaction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CLI } from '../packages/ui/src/cli/CLI.js';

describe('CLI Interactive Flow', () => {
  let cli: CLI;

  beforeEach(() => {
    cli = new CLI({
      name: 'interactive-test-cli',
      version: '1.0.0',
      description: 'Interactive Test CLI',
    });
  });

  describe('command parsing flow', () => {
    it('should parse and execute simple command sequence', async () => {
      const result = await cli.run(['help']);
      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
    });

    it('should handle command with multiple arguments', async () => {
      cli.addOperationLog({
        agent_id: 'test-agent',
        operation_type: 'multi-arg-test',
        target_selector: 'target',
        parameters: { arg1: 'val1', arg2: 'val2' },
        status: 'success',
        before_state: {},
        after_state: {},
      });

      const result = await cli.run(['log', '-a', 'test-agent', '-n', '10']);
      expect(result.success).toBe(true);
    });

    it('should handle flag combinations correctly', async () => {
      // Test multiple flags in single command
      const result = await cli.run(['--version']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('interactive-test-cli');
    });
  });

  describe('history navigation', () => {
    it('should maintain operation history across multiple operations', async () => {
      // Add multiple operations
      for (let i = 0; i < 5; i++) {
        cli.addOperationLog({
          agent_id: `agent-${i}`,
          operation_type: `operation-${i}`,
          target_selector: `target-${i}`,
          parameters: {},
          status: 'success',
          before_state: {},
          after_state: {},
        });
      }

      // Verify history is maintained
      const history = cli.getOperationHistory();
      expect(history.length).toBe(5);

      // Navigate through history with limit
      const result = await cli.run(['history', '--limit', '3']);
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should clear history and verify empty state', async () => {
      // Populate history
      cli.addOperationLog({
        agent_id: 'agent',
        operation_type: 'op',
        target_selector: 'target',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });

      expect(cli.getOperationHistory().length).toBe(1);

      // Clear history
      await cli.run(['history', '--clear']);

      // Verify empty
      const emptyResult = await cli.run(['history']);
      expect(emptyResult.message).toContain('No history entries');
    });
  });

  describe('context-sensitive help', () => {
    it('should provide general help when no specific command', async () => {
      const result = await cli.run(['--help']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('interactive-test-cli');
      expect(result.message).toContain('Available commands');
    });

    it('should provide specific help for built-in commands', async () => {
      const helpResult = await cli.run(['--help', 'help']);
      expect(helpResult.success).toBe(true);

      const logResult = await cli.run(['-h', 'log']);
      expect(logResult.success).toBe(true);
    });

    it('should provide help through help command alias', async () => {
      const hResult = await cli.run(['h']);
      expect(hResult.success).toBe(true);

      const qResult = await cli.run(['?']);
      expect(qResult.success).toBe(true);
    });
  });

  describe('error recovery flow', () => {
    it('should gracefully handle unknown commands', async () => {
      const result = await cli.run(['nonexistent-command']);
      expect(result.success).toBe(false);
      expect(result.code).toBe(1);
      expect(result.error).toContain('Unknown command');
    });

    it('should recover from parse errors without crashing', async () => {
      const invalidInputResult = await cli.run(['']);
      expect(invalidInputResult).toBeDefined(); // Should not throw
    });

    it('should continue functioning after error', async () => {
      // Trigger error
      await cli.run(['invalid']);

      // Should still work
      const validResult = await cli.run(['--version']);
      expect(validResult.success).toBe(true);
    });
  });

  describe('custom command interaction', () => {
    it('should register and interact with custom commands', async () => {
      const { createCommand } = await import('../packages/ui/src/cli/Command.js');

      const customCmd = createCommand({
        name: 'greet',
        description: 'Greeting command',
        handler: async () => ({
          success: true,
          code: 0,
          message: 'Hello from custom command!',
        }),
      });

      cli.register(customCmd);

      const result = await cli.run(['greet']);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Hello from custom command!');
    });

    it('should provide help for custom commands', async () => {
      const { createCommand } = await import('../packages/ui/src/cli/Command.js');

      cli.register(
        createCommand({
          name: 'custom-help-test',
          description: 'Custom command for help testing',
          handler: async () => ({ success: true, code: 0, message: 'Test' }),
        })
      );

      const helpResult = await cli.run(['--help', 'custom-help-test']);
      expect(helpResult.success).toBe(true);
    });
  });

  describe('state consistency', () => {
    it('should maintain consistent state across multiple operations', async () => {
      // Perform series of operations
      await cli.run(['help']);
      await cli.run(['--version']);

      cli.addOperationLog({
        agent_id: 'consistent-agent',
        operation_type: 'consistent-op',
        target_selector: 'target',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });

      const historyResult = await cli.run(['log']);
      expect(historyResult.success).toBe(true);

      // State should be consistent
      expect(cli.getOperationHistory().length).toBeGreaterThanOrEqual(1);
    });
  });
});
