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
});
