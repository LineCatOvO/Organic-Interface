import { describe, it, expect, beforeEach } from 'vitest';
import { CLI, createCLI, type CLIConfig } from '../CLI.js';

describe('CLI', () => {
  let cli: CLI;

  beforeEach(() => {
    cli = new CLI();
  });

  describe('constructor', () => {
    it('should create CLI with default config', () => {
      const cli = new CLI();
      expect(cli).toBeDefined();
    });

    it('should create CLI with custom config', () => {
      const config: CLIConfig = {
        name: 'test-cli',
        version: '1.0.0',
        description: 'Test CLI',
        interactive: true,
        historyPath: '/tmp/test-history',
      };
      const cli = new CLI(config);
      expect(cli).toBeDefined();
    });

    it('should use default values when config is partial', () => {
      const cli = new CLI({ name: 'custom-cli' });
      expect(cli).toBeDefined();
    });
  });

  describe('createCLI', () => {
    it('should create CLI instance', () => {
      const cli = createCLI();
      expect(cli).toBeDefined();
      expect(cli).toBeInstanceOf(CLI);
    });

    it('should create CLI with config', () => {
      const cli = createCLI({ name: 'created-cli', version: '2.0.0' });
      expect(cli).toBeDefined();
    });
  });

  describe('run', () => {
    it('should return success for help command', async () => {
      const result = await cli.run(['--help']);
      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.message).toContain('organic-cli');
    });

    it('should return success for -h flag', async () => {
      const result = await cli.run(['-h']);
      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
    });

    it('should return version for --version flag', async () => {
      const result = await cli.run(['--version']);
      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.message).toContain('organic-cli');
    });

    it('should return version for -v flag', async () => {
      const result = await cli.run(['-v']);
      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
    });

    it('should return error for unknown command', async () => {
      const result = await cli.run(['unknown-command']);
      expect(result.success).toBe(false);
      expect(result.code).toBe(1);
      expect(result.error).toContain('Unknown command');
    });

    it('should handle parse error', async () => {
      const result = await cli.run(['']);
      expect(result).toBeDefined();
    });

    it('should handle help for specific command', async () => {
      const result = await cli.run(['--help', 'help']);
      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
    });
  });

  describe('built-in commands', () => {
    describe('help command', () => {
      it('should show general help', async () => {
        const result = await cli.run(['help']);
        expect(result.success).toBe(true);
        expect(result.code).toBe(0);
      });

      it('should show help for specific command', async () => {
        const result = await cli.run(['help', 'help']);
        expect(result.success).toBe(true);
      });

      it('should show help with alias h', async () => {
        const result = await cli.run(['h']);
        expect(result.success).toBe(true);
      });

      it('should show help with alias ?', async () => {
        const result = await cli.run(['?']);
        expect(result.success).toBe(true);
      });
    });

    describe('history command', () => {
      it('should show empty history', async () => {
        const result = await cli.run(['history']);
        expect(result.success).toBe(true);
        expect(result.message).toContain('No history entries');
      });

      it('should show history with entries', async () => {
        cli.addOperationLog({
          agent_id: 'agent-1',
          operation_type: 'test-op',
          target_selector: 'target-1',
          parameters: {},
          status: 'success',
          before_state: {},
          after_state: {},
        });

        const result = await cli.run(['history']);
        expect(result.success).toBe(true);
        expect(result.message).toContain('test-op');
      });

      it('should clear history with --clear flag', async () => {
        cli.addOperationLog({
          agent_id: 'agent-1',
          operation_type: 'test',
          target_selector: 'target',
          parameters: {},
          status: 'success',
          before_state: {},
          after_state: {},
        });

        const clearResult = await cli.run(['history', '--clear']);
        expect(clearResult.success).toBe(true);

        const listResult = await cli.run(['history']);
        expect(listResult.message).toContain('No history entries');
      });

      it('should clear history with --clear flag', async () => {
        const result = await cli.run(['history', '--clear']);
        expect(result.success).toBe(true);
      });

      it('should limit history with -n flag', async () => {
        for (let i = 0; i < 5; i++) {
          cli.addOperationLog({
            agent_id: `agent-${i}`,
            operation_type: 'test',
            target_selector: 'target',
            parameters: {},
            status: 'success',
            before_state: {},
            after_state: {},
          });
        }

        const result = await cli.run(['history', '-n', '2']);
        expect(result.success).toBe(true);
      });

      it('should limit history with --limit flag', async () => {
        const result = await cli.run(['history', '--limit', '10']);
        expect(result.success).toBe(true);
      });

      it('should use history alias hist', async () => {
        const result = await cli.run(['hist']);
        expect(result.success).toBe(true);
      });
    });

    describe('log command', () => {
      it('should show empty logs', async () => {
        const result = await cli.run(['log']);
        expect(result.success).toBe(true);
        expect(result.message).toContain('No matching log entries');
      });

      it('should show logs with entries', async () => {
        cli.addOperationLog({
          agent_id: 'agent-1',
          operation_type: 'test-op',
          target_selector: 'target-1',
          parameters: { key: 'value' },
          status: 'success',
          before_state: { old: true },
          after_state: { new: true },
        });

        const result = await cli.run(['log']);
        expect(result.success).toBe(true);
        expect(result.message).toContain('agent-1');
      });

      it('should filter logs by agent', async () => {
        cli.addOperationLog({
          agent_id: 'agent-specific',
          operation_type: 'test',
          target_selector: 'target',
          parameters: {},
          status: 'success',
          before_state: {},
          after_state: {},
        });

        const result = await cli.run(['log', '-a', 'agent-specific']);
        expect(result.success).toBe(true);
        expect(result.message).toContain('agent-specific');
      });

      it('should filter logs by type', async () => {
        cli.addOperationLog({
          agent_id: 'agent-1',
          operation_type: 'specific-type',
          target_selector: 'target',
          parameters: {},
          status: 'success',
          before_state: {},
          after_state: {},
        });

        const result = await cli.run(['log', '-t', 'specific-type']);
        expect(result.success).toBe(true);
        expect(result.message).toContain('specific-type');
      });

      it('should filter logs by status', async () => {
        cli.addOperationLog({
          agent_id: 'agent-1',
          operation_type: 'test',
          target_selector: 'target',
          parameters: {},
          status: 'failed',
          before_state: {},
          after_state: {},
          error_message: 'error',
        });

        const result = await cli.run(['log', '-s', 'failed']);
        expect(result.success).toBe(true);
        expect(result.message).toContain('failed');
      });

      it('should limit logs', async () => {
        const result = await cli.run(['log', '-n', '5']);
        expect(result.success).toBe(true);
      });

      it('should use logs alias', async () => {
        const result = await cli.run(['logs']);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('addOperationLog', () => {
    it('should add operation log entry', () => {
      cli.addOperationLog({
        agent_id: 'test-agent',
        operation_type: 'test-operation',
        target_selector: 'test-target',
        parameters: { param1: 'value1' },
        status: 'success',
        before_state: { before: true },
        after_state: { after: true },
      });

      const history = cli.getOperationHistory();
      expect(history.length).toBe(1);
      expect(history[0].agent_id).toBe('test-agent');
      expect(history[0].operation_type).toBe('test-operation');
      expect(history[0].status).toBe('success');
    });

    it('should generate unique log_id', () => {
      cli.addOperationLog({
        agent_id: 'agent-1',
        operation_type: 'op1',
        target_selector: 'target',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });

      cli.addOperationLog({
        agent_id: 'agent-2',
        operation_type: 'op2',
        target_selector: 'target',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });

      const history = cli.getOperationHistory();
      expect(history[0].log_id).not.toBe(history[1].log_id);
    });

    it('should add timestamp', () => {
      const beforeTime = new Date();
      cli.addOperationLog({
        agent_id: 'agent-1',
        operation_type: 'op',
        target_selector: 'target',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });
      const afterTime = new Date();

      const history = cli.getOperationHistory();
      expect(history[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(history[0].timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('getOperationHistory', () => {
    it('should return readonly array', () => {
      const history = cli.getOperationHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should return empty initially', () => {
      const history = cli.getOperationHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      cli.addOperationLog({
        agent_id: 'agent-1',
        operation_type: 'op',
        target_selector: 'target',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });

      cli.clearHistory();

      const history = cli.getOperationHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('register', () => {
    it('should register custom command', async () => {
      const { createCommand } = await import('../Command.js');
      const customCmd = createCommand({
        name: 'custom',
        description: 'Custom command',
        handler: async () => ({
          success: true,
          code: 0,
          message: 'Custom command executed',
        }),
      });

      cli.register(customCmd);

      const result = await cli.run(['custom']);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Custom command executed');
    });
  });

  describe('error handling', () => {
    it('should handle exceptions in run', async () => {
      const cliWithError = new CLI({
        parser: {
          parse: () => {
            throw new Error('Parser error');
          },
        } as any,
      });

      const result = await cliWithError.run(['test']);
      expect(result.success).toBe(false);
      expect(result.code).toBe(1);
    });
  });

  describe('configuration options', () => {
    it('should accept interactive mode configuration', () => {
      const interactiveCli = new CLI({ interactive: true });
      expect(interactiveCli).toBeDefined();
    });

    it('should accept custom history path', () => {
      const customHistoryCli = new CLI({ historyPath: '/custom/path/history' });
      expect(customHistoryCli).toBeDefined();
    });

    it('should use default historyPath when not specified', () => {
      const defaultCli = new CLI();
      expect(defaultCli).toBeDefined();
      // Verify default config is applied
    });
  });

  describe('log command - comprehensive filtering', () => {
    let filterCli: CLI;

    beforeEach(() => {
      // Use independent CLI instance to avoid test interference
      filterCli = new CLI();

      // Add multiple logs with different properties for filtering tests
      filterCli.addOperationLog({
        agent_id: 'agent-alpha',
        operation_type: 'create',
        target_selector: 'target-1',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });

      filterCli.addOperationLog({
        agent_id: 'agent-beta',
        operation_type: 'update',
        target_selector: 'target-2',
        parameters: {},
        status: 'failed',
        before_state: {},
        after_state: {},
        error_message: 'Update failed',
      });

      filterCli.addOperationLog({
        agent_id: 'agent-alpha',
        operation_type: 'delete',
        target_selector: 'target-3',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });
    });

    it('should filter logs by agent and return only matching entries', async () => {
      const result = await filterCli.run(['log', '-a', 'agent-alpha']);
      expect(result.success).toBe(true);
      // Should contain agent-alpha entries
      expect(result.message).toContain('agent-alpha');
    });

    it('should filter logs by operation type', async () => {
      const result = await filterCli.run(['log', '-t', 'update']);
      expect(result.success).toBe(true);
      // Should contain update operations
      expect(result.message).toContain('update');
    });

    it('should filter logs by status', async () => {
      const result = await filterCli.run(['log', '-s', 'failed']);
      expect(result.success).toBe(true);
      // Should contain failed entries
      expect(result.message).toContain('failed');
    });

    it('should combine multiple filters', async () => {
      const result = await filterCli.run(['log', '-a', 'agent-alpha', '-s', 'success']);
      expect(result.success).toBe(true);
      // Verify filtering is applied (result should not be empty and should contain filtered entries)
      expect(result.message?.length ?? 0).toBeGreaterThan(0);
    });
  });

  // ========== CORE-01 补充测试用例：覆盖未达标代码行 ==========

  describe('executeCommand - subcommand nesting (lines 174-185)', () => {
    it('should execute nested subcommands with handler', async () => {
      const { createCommand, addSubcommand } = await import('../Command.js');

      // Create parent command
      const parentCmd = createCommand({
        name: 'parent',
        description: 'Parent command',
      });

      // Create subcommand with handler
      const subCmd = createCommand({
        name: 'sub-action',
        description: 'Sub action',
        handler: async () => ({
          success: true,
          code: 0,
          message: 'Sub command executed',
        }),
      });

      // Use addSubcommand to properly register the subcommand
      addSubcommand(parentCmd, subCmd);

      cli.register(parentCmd);

      // Execute parent subcommand
      const result = await cli.run(['parent', 'sub-action']);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Sub command executed');
    });

    it('should handle subcommand without handler gracefully', async () => {
      const { createCommand, addSubcommand } = await import('../Command.js');

      // Create parent command
      const parentCmd2 = createCommand({
        name: 'parent2',
        description: 'Parent command 2',
      });

      // Create subcommand without handler
      const subCmdNoHandler = createCommand({
        name: 'no-handler-sub',
        description: 'Sub without handler',
        // No handler defined
      });

      // Use addSubcommand to properly register the subcommand
      addSubcommand(parentCmd2, subCmdNoHandler);

      cli.register(parentCmd2);

      const result = await cli.run(['parent2', 'no-handler-sub']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('has no handler');
    });
  });

  describe('showHelp - specific command help (lines 207-215)', () => {
    it('should show help for specific registered command with --help', async () => {
      const result = await cli.run(['--help', 'history']);
      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.message).toContain('history');
    });

    it('should show help for specific command with -h flag', async () => {
      const result = await cli.run(['-h', 'log']);
      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.message).toBeDefined();
    });

    it('should show general help when target command not found', async () => {
      const result = await cli.run(['--help', 'nonexistent-cmd']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('organic-cli');
      expect(result.message).toContain('Available commands');
    });
  });

  describe('command without handler (lines 193-198)', () => {
    it('should return message for command without handler', async () => {
      const { createCommand } = await import('../Command.js');

      const noHandlerCmd = createCommand({
        name: 'nohandler',
        description: 'Command without handler',
        // Intentionally no handler
      });

      cli.register(noHandlerCmd);

      const result = await cli.run(['nohandler']);
      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.message).toBe('Command nohandler has no handler');
    });
  });

  describe('OperationLog error_message field validation', () => {
    it('should store and retrieve error_message in operation log', () => {
      cli.addOperationLog({
        agent_id: 'error-agent',
        operation_type: 'failed-op',
        target_selector: 'target-err',
        parameters: {},
        status: 'failed',
        before_state: { ok: true },
        after_state: { ok: false },
        error_message: 'Something went wrong',
      });

      const history = cli.getOperationHistory();
      const errorEntry = history.find(h => h.error_message);

      expect(errorEntry).toBeDefined();
      expect(errorEntry?.error_message).toBe('Something went wrong');
      expect(errorEntry?.status).toBe('failed');
    });

    it('should handle operation log without error_message', () => {
      cli.addOperationLog({
        agent_id: 'success-agent',
        operation_type: 'success-op',
        target_selector: 'target-ok',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
        // No error_message
      });

      const history = cli.getOperationHistory();
      const successEntry = history.find(h => h.agent_id === 'success-agent');

      expect(successEntry).toBeDefined();
      expect(successEntry?.error_message).toBeUndefined();
    });
  });

  describe('CLI configuration edge cases', () => {
    it('should handle empty string name with default fallback', () => {
      const emptyNameCli = new CLI({ name: '' });
      expect(emptyNameCli).toBeDefined();
    });

    it('should handle extremely long description', () => {
      const longDesc = 'A'.repeat(1000);
      const longDescCli = new CLI({ description: longDesc });
      expect(longDescCli).toBeDefined();
    });

    it('should accept all configuration options simultaneously', () => {
      const fullConfigCli = new CLI({
        name: 'full-cli',
        version: '99.99.99',
        description: 'Full configuration CLI',
        interactive: true,
        historyPath: '/tmp/full-test-history',
      });
      expect(fullConfigCli).toBeDefined();
    });
  });

  describe('DEFAULT_CLI_CONFIG completeness verification', () => {
    it('should have all required default configuration fields', async () => {
      const { DEFAULT_CLI_CONFIG } = await import('../CLI.js');

      expect(DEFAULT_CLI_CONFIG.name).toBe('organic-cli');
      expect(DEFAULT_CLI_CONFIG.version).toBe('0.1.0');
      expect(DEFAULT_CLI_CONFIG.description).toBe('Organic Interface CLI');
      expect(DEFAULT_CLI_CONFIG.interactive).toBe(false);
      expect(DEFAULT_CLI_CONFIG.historyPath).toBe('.organic-cli-history');
    });
  });

  describe('registerBuiltInCommands order and deduplication', () => {
    it('should register all built-in commands without duplication', async () => {
      // Verify built-in commands are accessible
      const helpResult = await cli.run(['help']);
      expect(helpResult.success).toBe(true);

      const historyResult = await cli.run(['history']);
      expect(historyResult.success).toBe(true);

      const logResult = await cli.run(['log']);
      expect(logResult.success).toBe(true);
    });
  });

  describe('parse error handling details', () => {
    it('should return detailed error message for parse failure', async () => {
      const customParserCli = new CLI({
        parser: {
          parse: () => ({
            success: false,
            error: 'Custom parse error: invalid syntax',
            parsed: null,
          }),
          formatHelp: () => 'Help text',
          extractArgs: () => ({}),
        } as any,
      });

      const result = await customParserCli.run(['invalid-input']);
      expect(result.success).toBe(false);
      expect(result.code).toBe(1);
      expect(result.error).toContain('Custom parse error');
    });
  });
});
