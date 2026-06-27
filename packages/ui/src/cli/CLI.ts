/**
 * CLI main class
 */

import { createLogger, type Logger } from '@organic/utils';
import { type Command, type CommandResult, createCommand, addSubcommand } from './Command.js';
import type { CommandParser } from './CommandParser.js';
import { defaultParser } from './CommandParser.js';
import { createUIAgent } from '../core/UIAgent.js';

/**
 * CLI configuration
 */
export interface CLIConfig {
  /** CLI name */
  name?: string;
  /** CLI version */
  version?: string;
  /** CLI description */
  description?: string;
  /** Custom logger */
  logger?: Logger;
  /** Custom parser */
  parser?: CommandParser;
  /** Enable interactive mode */
  interactive?: boolean;
  /** History file path for interactive mode */
  historyPath?: string;
}

/**
 * Default CLI configuration
 */
export const DEFAULT_CLI_CONFIG: Omit<CLIConfig, 'logger' | 'parser'> & {
  logger?: Logger;
  parser?: CommandParser;
} = {
  name: 'organic-cli',
  version: '0.1.0',
  description: 'Organic Interface CLI',
  interactive: false,
  historyPath: '.organic-cli-history',
};

/**
 * Operation log entry for audit
 */
export interface OperationLog {
  log_id: string;
  agent_id: string;
  operation_type: string;
  target_selector: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed';
  before_state: object;
  after_state: object;
  error_message?: string;
  timestamp: Date;
}

/**
 * CLI main class
 */
export class CLI {
  private readonly config: CLIConfig & {
    name: string;
    version: string;
    description: string;
    interactive: boolean;
    historyPath: string;
  };
  private readonly logger: Logger;
  private readonly parser: CommandParser;
  private readonly rootCommand: Command;
  private operationHistory: OperationLog[] = [];

  constructor(config: CLIConfig = {}) {
    this.config = {
      name: config.name ?? 'organic-cli',
      version: config.version ?? '0.1.0',
      description: config.description ?? 'Organic Interface CLI',
      logger: config.logger,
      parser: config.parser,
      interactive: config.interactive ?? false,
      historyPath: config.historyPath ?? '.organic-cli-history',
    };

    this.logger = this.config.logger ?? createLogger({ prefix: 'cli' });
    this.parser = this.config.parser ?? defaultParser;

    // Create root command
    this.rootCommand = createCommand({
      name: this.config.name,
      description: this.config.description,
      handler: async () => ({
        success: true,
        code: 0,
        message: 'Use --help for usage information',
      }),
    });

    this.registerBuiltInCommands();
  }

  /**
   * Register the CLI command
   */
  register(command: Command): void {
    addSubcommand(this.rootCommand, command);
  }

  /**
   * Run CLI with arguments
   */
  async run(args: string[]): Promise<CommandResult> {
    try {
      // Show help when no arguments provided
      if (args.length === 0 || args.every(a => a.trim() === '')) {
        return this.showHelp([]);
      }

      const input = args.join(' ');
      this.logger.debug(`Running CLI with input: ${input}`);

      // Handle built-in options
      if (args.includes('--help') || args.includes('-h')) {
        return this.showHelp(args);
      }

      if (args.includes('--version') || args.includes('-v')) {
        return this.showVersion();
      }

      // Parse input
      const parseResult = this.parser.parse(input);
      if (!parseResult.success || !parseResult.parsed) {
        return {
          success: false,
          code: 1,
          error: parseResult.error ?? 'Parse error',
        };
      }

      // Find and execute command
      const result = await this.executeCommand(parseResult.parsed);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`CLI error: ${errorMessage}`);
      return {
        success: false,
        code: 1,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a command from parsed input
   */
  private async executeCommand(parsed: {
    command: string;
    args: Record<string, string>;
    options: Record<string, string | boolean | number>;
    raw: string[];
  }): Promise<CommandResult> {
    // Find command
    const subcommands = this.rootCommand.subcommands ?? new Map();
    const command = subcommands.get(parsed.command);

    if (!command) {
      return {
        success: false,
        code: 1,
        error: `Unknown command: ${parsed.command}`,
      };
    }

    // Check for subcommand
    if (command.subcommands && command.subcommands.size > 0 && parsed.raw.length > 0) {
      const subcommandName = parsed.raw[0];
      const subcommand = command.subcommands.get(subcommandName);

      if (subcommand) {
        // Execute subcommand
        const subArgs = this.parser.extractArgs(parsed, command);
        if (subcommand.handler) {
          return await subcommand.handler(subArgs, this.logger);
        }
      }
    }

    // Execute main command
    if (command.handler) {
      const args = this.parser.extractArgs(parsed, command);
      return await command.handler(args, this.logger);
    }

    return {
      success: true,
      code: 0,
      message: `Command ${command.name} has no handler`,
    };
  }

  /**
   * Show help information
   */
  private showHelp(args: string[]): CommandResult {
    const target = args[args.indexOf('--help') + 1] ?? args[args.indexOf('-h') + 1];
    const subcommands = this.rootCommand.subcommands ?? new Map();

    if (target && subcommands.has(target)) {
      const command = subcommands.get(target)!;
      const help = this.parser.formatHelp(command);
      return {
        success: true,
        code: 0,
        message: help,
      };
    }

    // Show general help
    const help = [
      `\n${this.config.name} - ${this.config.description}`,
      `Version: ${this.config.version}`,
      '',
      'Available commands:',
      ...Array.from(subcommands.keys())
        .filter((name, index, arr) => arr.indexOf(name) === index) // Unique
        .map(name => {
          const cmd = subcommands.get(name)!;
          return `  ${name.padEnd(20)} ${cmd.description}`;
        }),
      '',
      'Use --help <command> for detailed command usage.',
      '',
    ].join('\n');

    return {
      success: true,
      code: 0,
      message: help,
    };
  }

  /**
   * Show version information
   */
  private showVersion(): CommandResult {
    return {
      success: true,
      code: 0,
      message: `${this.config.name} v${this.config.version}`,
    };
  }

  /**
   * Register built-in commands
   */
  private registerBuiltInCommands(): void {
    // Help command
    this.register(
      createCommand({
        name: 'help',
        description: 'Show help information',
        aliases: ['h', '?'],
        arguments: [{ name: 'command', description: 'Command to show help for', required: false }],
        handler: async args => {
          const cmd = args.command as string | undefined;
          const subcommands = this.rootCommand.subcommands ?? new Map();
          if (cmd && subcommands.has(cmd)) {
            const command = subcommands.get(cmd)!;
            return {
              success: true,
              code: 0,
              message: this.parser.formatHelp(command),
            };
          }
          return this.showHelp([]);
        },
      })
    );

    // History command
    this.register(
      createCommand({
        name: 'history',
        description: 'Show command history',
        aliases: ['hist'],
        options: [
          { short: 'c', long: 'clear', description: 'Clear history', valueType: 'boolean' },
          {
            short: 'n',
            long: 'limit',
            description: 'Limit number of entries',
            valueType: 'number',
          },
        ],
        handler: async (args, logger) => {
          if (args.clear) {
            this.operationHistory = [];
            logger.info('History cleared');
            return { success: true, code: 0, message: 'History cleared' };
          }

          const limit = (args.limit as number) ?? this.operationHistory.length;
          const entries = this.operationHistory.slice(-limit);

          if (entries.length === 0) {
            return { success: true, code: 0, message: 'No history entries' };
          }

          const output = entries
            .map(
              (entry, i) => `[${i + 1}] ${entry.timestamp.toISOString()} - ${entry.operation_type}`
            )
            .join('\n');

          return { success: true, code: 0, message: output };
        },
      })
    );

    // Log command for audit
    this.register(
      createCommand({
        name: 'log',
        description: 'Show operation logs',
        aliases: ['logs'],
        options: [
          { short: 'a', long: 'agent', description: 'Filter by agent ID', valueType: 'string' },
          {
            short: 't',
            long: 'type',
            description: 'Filter by operation type',
            valueType: 'string',
          },
          { short: 's', long: 'status', description: 'Filter by status', valueType: 'string' },
          {
            short: 'n',
            long: 'limit',
            description: 'Limit number of entries',
            valueType: 'number',
          },
        ],
        handler: async args => {
          let logs = [...this.operationHistory];

          if (args.agent) {
            logs = logs.filter(l => l.agent_id === args.agent);
          }
          if (args.type) {
            logs = logs.filter(l => l.operation_type === args.type);
          }
          if (args.status) {
            logs = logs.filter(l => l.status === args.status);
          }

          const limit = (args.limit as number) ?? logs.length;
          const entries = logs.slice(-limit);

          if (entries.length === 0) {
            return { success: true, code: 0, message: 'No matching log entries' };
          }

          const output = entries
            .map(
              entry =>
                `[${entry.log_id}] ${entry.agent_id} - ${entry.operation_type} (${entry.status})`
            )
            .join('\n');

          return { success: true, code: 0, message: output };
        },
      })
    );

    // TUI command - interactive mode
    this.register(
      createCommand({
        name: 'tui',
        description: 'Launch interactive TUI mode',
        handler: async (_args, logger) => {
          if (!process.stdin.isTTY) {
            return {
              success: true,
              code: 0,
              message: 'TUI mode requires an interactive terminal',
            };
          }

          const agent = createUIAgent({ name: 'TUI-Session' });
          await agent.start();
          const session = agent.startSession();

          const readline = await import('readline');

          const result = await new Promise<CommandResult>(resolve => {
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
              prompt: 'organic> ',
            });

            logger.info(`\nOrganic Interface TUI v${this.config.version}`);
            logger.info(`Agent: ${agent.getConfig().name}`);
            logger.info(`Session: ${session.sessionId}`);
            logger.info('Type "help" for commands, "exit" to quit\n');

            rl.prompt();

            rl.on('line', async (line: string) => {
              const input = line.trim();
              if (input === 'exit' || input === 'quit') {
                rl.close();
              } else if (input === 'help') {
                logger.info(
                  'Commands:\n  help    Show this help\n' +
                    '  status  Show agent status\n' +
                    '  exit    Exit TUI mode'
                );
              } else if (input === 'status') {
                const state = agent.getState();
                logger.info(
                  `Status: ${state.status}\n` +
                    `Operations: ${state.totalOperations} total, ` +
                    `${state.successfulOperations} ok, ` +
                    `${state.failedOperations} failed`
                );
              } else if (input) {
                logger.info(`Unknown: ${input}`);
              }
              rl.prompt();
            });

            rl.on('close', async () => {
              await agent.endSession(session.sessionId);
              await agent.stop();
              resolve({
                success: true,
                code: 0,
                message: 'TUI session ended',
              });
            });
          });

          return result;
        },
      })
    );

    // Web command (placeholder)
    this.register(
      createCommand({
        name: 'web',
        description: 'Launch Web interface (等待制作)',
        handler: async () => ({
          success: true,
          code: 0,
          message: 'Web interface coming soon - 等待制作',
        }),
      })
    );
  }

  /**
   * Add operation to log (for audit)
   */
  addOperationLog(entry: Omit<OperationLog, 'log_id' | 'timestamp'>): void {
    this.operationHistory.push({
      ...entry,
      log_id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    });
  }

  /**
   * Get operation history
   */
  getOperationHistory(): ReadonlyArray<OperationLog> {
    return this.operationHistory;
  }

  /**
   * Clear operation history
   */
  clearHistory(): void {
    this.operationHistory = [];
  }
}

/**
 * Create a CLI instance with common configuration
 */
export function createCLI(config?: CLIConfig): CLI {
  return new CLI(config);
}
