/**
 * OutputFormatter Tests
 *
 * Tests for the OutputFormatter class which handles formatting
 * conversation output for display in various formats.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OutputFormatter } from '../OutputFormatter.js';
import { ConversationError, ConversationErrorCode } from '../errors/index.js';
import {
  ResultType,
  ResponseType,
  MessageSender,
  OutputFormat,
  ContentFormat,
  SessionStatus,
  ContextWindowType,
} from '../types/index.js';

// Helper to create test conversation results
function createMessageResult(text: string) {
  return {
    type: ResultType.MESSAGE,
    message: {
      id: 'msg-1',
      content: {
        text,
        format: ContentFormat.PLAIN_TEXT,
      },
      type: ResponseType.TEXT,
      sender: MessageSender.ASSISTANT,
      timestamp: Date.now(),
    },
  };
}

function createSessionResult(id: string, title: string) {
  return {
    type: ResultType.SESSION,
    session: {
      id,
      title,
      status: SessionStatus.ACTIVE,
      tags: [],
      metadata: {},
      contextWindow: {
        windowSize: 50,
        windowType: ContextWindowType.RECENT_MESSAGES,
        includeSystemMessages: true,
        includeToolCalls: true,
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      messageCount: 0,
    },
  };
}

function createSessionListResult(
  sessions: Array<{
    id: string;
    title: string;
    messageCount: number;
    status: SessionStatus;
    tags: string[];
    metadata: Record<string, unknown>;
    contextWindow: {
      windowSize: number;
      windowType: ContextWindowType;
      includeSystemMessages: boolean;
      includeToolCalls: boolean;
    };
    createdAt: number;
    lastActiveAt: number;
  }>
) {
  return {
    type: ResultType.SESSION_LIST,
    sessions,
  };
}

function createContextResult(sessionId: string, messageCount: number) {
  return {
    type: ResultType.CONTEXT,
    contextWindow: {
      id: `ctx-${sessionId}`,
      sessionId,
      messages: [],
      config: {
        windowSize: 50,
        windowType: ContextWindowType.RECENT_MESSAGES,
        includeSystemMessages: true,
        includeToolCalls: true,
      },
      tokenCount: 100,
      messageCount,
      createdAt: Date.now(),
    },
  };
}

describe('OutputFormatter', () => {
  let formatter: OutputFormatter;

  beforeEach(() => {
    formatter = new OutputFormatter({
      defaultFormat: OutputFormat.TERMINAL,
      enableColors: false,
      maxLineWidth: 80,
      includeTimestamps: true,
      includeMetadata: false,
    });
  });

  describe('format', () => {
    it('should format message result', () => {
      const result = createMessageResult('Hello, world!');
      const output = formatter.format(result);

      expect(output.text).toContain('Hello, world!');
      expect(output.format).toBe(OutputFormat.TERMINAL);
      expect(output.metadata).toBeDefined();
      expect(output.metadata.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should format session result', () => {
      const result = createSessionResult('sess-123', 'Test Session');
      const output = formatter.format(result);

      expect(output.text).toContain('sess-123');
      expect(output.text).toContain('Test Session');
      expect(output.text).toContain('Session Information');
    });

    it('should format session list result', () => {
      const result = createSessionListResult([
        {
          id: 'sess-1',
          title: 'Session 1',
          messageCount: 5,
          status: SessionStatus.ACTIVE,
          tags: [],
          metadata: {},
          contextWindow: {
            windowSize: 50,
            windowType: ContextWindowType.RECENT_MESSAGES,
            includeSystemMessages: true,
            includeToolCalls: true,
          },
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        },
        {
          id: 'sess-2',
          title: 'Session 2',
          messageCount: 10,
          status: SessionStatus.IDLE,
          tags: [],
          metadata: {},
          contextWindow: {
            windowSize: 50,
            windowType: ContextWindowType.RECENT_MESSAGES,
            includeSystemMessages: true,
            includeToolCalls: true,
          },
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        },
      ]);
      const output = formatter.format(result);

      expect(output.text).toContain('Active Sessions');
      expect(output.text).toContain('Session 1');
      expect(output.text).toContain('Session 2');
    });

    it('should format context result', () => {
      const result = createContextResult('sess-1', 25);
      const output = formatter.format(result);

      expect(output.text).toContain('Context Window');
      expect(output.text).toContain('sess-1');
      expect(output.text).toContain('25');
    });

    it('should handle empty session list', () => {
      const result = createSessionListResult([]);
      const output = formatter.format(result);

      expect(output.text).toContain('No active sessions');
    });

    it('should format confirmation result', () => {
      const result = {
        type: ResultType.CONFIRMATION,
        message: {
          id: 'msg-1',
          content: {
            text: 'Are you sure?',
            format: ContentFormat.PLAIN_TEXT,
          },
          type: ResponseType.CONFIRMATION,
          sender: MessageSender.SYSTEM,
          timestamp: Date.now(),
        },
      };
      const output = formatter.format(result);

      expect(output.text).toContain('Are you sure?');
      expect(output.text).toContain('confirm');
    });

    it('should include timestamps when enabled', () => {
      const result = createMessageResult('Test message');
      const output = formatter.format(result);

      // Should contain ISO timestamp
      expect(output.text).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });

    it('should include metadata in output', () => {
      const result = createMessageResult('Test');
      const output = formatter.format(result);

      expect(output.metadata.pluginVersion).toBe('1.0.0');
    });
  });

  describe('formatError', () => {
    it('should format ConversationError', () => {
      const error = new ConversationError(
        'Something went wrong',
        ConversationErrorCode.INVALID_INPUT
      );
      const output = formatter.formatError(error);

      expect(output.text).toContain('ERROR');
      expect(output.text).toContain('Something went wrong');
    });

    it('should include error details when available', () => {
      const error = new ConversationError('Error', 'CODE', {
        sessionId: 'sess-123',
        extra: 'info',
      });
      const output = formatter.formatError(error);

      expect(output.text).toContain('sess-123');
    });

    it('should handle error without details', () => {
      const error = new ConversationError('Simple error');
      const output = formatter.formatError(error);

      expect(output.text).toContain('Simple error');
      expect(output.text).not.toContain('Details:');
    });
  });

  describe('formatStream', () => {
    it('should format string chunks', () => {
      const output = formatter.formatStream('Hello');
      expect(output).toBe('Hello');
    });

    it('should format object with text property', () => {
      const output = formatter.formatStream({ text: 'Hello' });
      expect(output).toBe('Hello');
    });

    it('should format object with content property', () => {
      const output = formatter.formatStream({ content: 'Hello' });
      expect(output).toBe('Hello');
    });

    it('should format tool call objects', () => {
      const output = formatter.formatStream({
        tool_call: { name: 'test_tool', id: '123' },
      });

      expect(output).toContain('[TOOL]');
      expect(output).toContain('test_tool');
    });

    it('should format status updates', () => {
      const output = formatter.formatStream({ status: 'processing' });
      expect(output).toContain('[STATUS]');
      expect(output).toContain('processing');
    });

    it('should fallback to JSON string for unknown objects', () => {
      const output = formatter.formatStream({ unknown: 'data' });
      expect(output).toContain('unknown');
    });

    it('should format numbers as strings', () => {
      const output = formatter.formatStream(42);
      expect(output).toBe('42');
    });
  });

  describe('formatSuccess', () => {
    it('should format success message', () => {
      const output = formatter.formatSuccess('Operation completed');

      expect(output.text).toContain('[OK]');
      expect(output.text).toContain('Operation completed');
    });

    it('should include custom metadata', () => {
      const output = formatter.formatSuccess('Done', {
        sessionId: 'sess-123',
      });

      expect(output.metadata.sessionId).toBe('sess-123');
    });
  });

  describe('formatWarning', () => {
    it('should format warning message', () => {
      const output = formatter.formatWarning('Be careful');

      expect(output.text).toContain('[WARN]');
      expect(output.text).toContain('Be careful');
    });
  });

  describe('formatStatus', () => {
    it('should format status object', () => {
      const output = formatter.formatStatus({
        cpu: 50,
        memory: 1024,
      });

      expect(output.text).toContain('[STATUS]');
      expect(output.text).toContain('cpu');
      expect(output.text).toContain('memory');
    });
  });

  describe('formatToolResults', () => {
    it('should format successful tool results', () => {
      const results = [
        {
          callId: 'call-1',
          toolName: 'search',
          result: { found: 5 },
          success: true,
          executionTime: 100,
        },
      ];
      const output = formatter.formatToolResults(results);

      expect(output.text).toContain('[TOOL]');
      expect(output.text).toContain('search');
      expect(output.text).toContain('100ms');
    });

    it('should format failed tool results', () => {
      const results = [
        {
          callId: 'call-1',
          toolName: 'search',
          result: null,
          success: false,
          error: { code: 'NOT_FOUND', message: 'Item not found' },
          executionTime: 50,
        },
      ];
      const output = formatter.formatToolResults(results);

      expect(output.text).toContain('Error');
      expect(output.text).toContain('Item not found');
    });

    it('should format multiple tool results', () => {
      const results = [
        { callId: '1', toolName: 'tool1', result: {}, success: true, executionTime: 10 },
        { callId: '2', toolName: 'tool2', result: {}, success: true, executionTime: 20 },
      ];
      const output = formatter.formatToolResults(results);

      expect(output.text).toContain('tool1');
      expect(output.text).toContain('tool2');
    });
  });

  describe('color support', () => {
    it('should include ANSI color codes when enabled', () => {
      const coloredFormatter = new OutputFormatter({
        enableColors: true,
      });
      const output = coloredFormatter.formatSuccess('Success!');

      // Should contain ANSI escape codes
      expect(output.text).toMatch(/\x1b\[\d+m/);
    });

    it('should not include colors when disabled', () => {
      const noColorFormatter = new OutputFormatter({
        enableColors: false,
      });
      const output = noColorFormatter.formatSuccess('Success!');

      // Should not contain ANSI escape codes (except in specific places)
      expect(output.text).toContain('[OK]');
      expect(output.text).not.toMatch(/^\x1b\[\d+m/);
    });
  });

  describe('markdown formatting', () => {
    it('should apply markdown formatting when content format is markdown', () => {
      const result = {
        type: ResultType.MESSAGE,
        message: {
          id: 'msg-1',
          content: {
            text: '# Heading\n\n**bold** and `code`',
            format: ContentFormat.MARKDOWN,
          },
          type: ResponseType.TEXT,
          sender: MessageSender.ASSISTANT,
          timestamp: Date.now(),
        },
      };
      const output = formatter.format(result);

      expect(output.format).toBe(OutputFormat.MARKDOWN);
      expect(output.text).toContain('Heading');
    });
  });

  describe('line width handling', () => {
    it('should respect max line width for sections', () => {
      const narrowFormatter = new OutputFormatter({
        maxLineWidth: 40,
      });
      const result = createSessionResult('sess-123', 'A Very Long Session Title');
      const output = narrowFormatter.format(result);

      // Section separator length is min(title.length, maxLineWidth)
      // "Session Information" has 19 chars, so separator is 19 chars
      expect(output.text).toContain('─'.repeat(19));
    });
  });

  describe('JSON output format', () => {
    it('should format generic result as JSON', () => {
      const jsonFormatter = new OutputFormatter({
        defaultFormat: OutputFormat.JSON,
        includeTimestamps: false,
      });
      // Use formatGeneric via unknown type
      const result = {
        type: 'unknown' as ResultType,
        data: { key: 'value' },
      };
      const output = jsonFormatter.format(result as any);

      expect(output.format).toBe(OutputFormat.JSON);
      expect(() => JSON.parse(output.text)).not.toThrow();
    });
  });

  describe('timestamp handling', () => {
    it('should include timestamps when enabled', () => {
      const withTimestamps = new OutputFormatter({
        includeTimestamps: true,
      });
      const output = withTimestamps.format(createMessageResult('Test'));

      expect(output.text).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });

    it('should not include timestamps when disabled', () => {
      const noTimestamps = new OutputFormatter({
        includeTimestamps: false,
      });
      const result = createMessageResult('Test message');
      const output = noTimestamps.format(result);

      // Should not have ISO timestamp brackets
      expect(output.text).not.toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('message streaming', () => {
    it('should indicate non-final messages', () => {
      // Create a message result with stream info
      const streamResult = {
        type: ResultType.MESSAGE,
        message: {
          id: 'msg-1',
          content: {
            text: 'Partial response...',
            format: ContentFormat.PLAIN_TEXT,
          },
          type: ResponseType.TEXT,
          sender: MessageSender.ASSISTANT,
          timestamp: Date.now(),
          stream: { streamId: 'stream-1', chunkCount: 3, isFinal: false },
        },
      };

      const output = formatter.format(streamResult);

      expect(output.metadata.stream).toBe(true);
    });

    it('should not indicate stream for final messages', () => {
      // Create a message result with final stream info
      const streamResult = {
        type: ResultType.MESSAGE,
        message: {
          id: 'msg-1',
          content: {
            text: 'Complete response',
            format: ContentFormat.PLAIN_TEXT,
          },
          type: ResponseType.TEXT,
          sender: MessageSender.ASSISTANT,
          timestamp: Date.now(),
          stream: { streamId: 'stream-1', chunkCount: 5, isFinal: true },
        },
      };

      const output = formatter.format(streamResult);

      // When isFinal is true, stream is set to false (not streaming)
      expect(output.metadata.stream).toBe(false);
    });
  });

  describe('theme customization', () => {
    it('should use custom theme colors', () => {
      const customTheme = new OutputFormatter({
        enableColors: true,
        theme: {
          primary: '\x1b[94m', // Bright blue
          secondary: '\x1b[96m', // Bright cyan
          success: '\x1b[92m', // Bright green
          error: '\x1b[91m', // Bright red
          warning: '\x1b[93m', // Bright yellow
          info: '\x1b[95m', // Bright magenta
          muted: '\x1b[90m', // Bright black
        },
      });
      const output = customTheme.formatSuccess('Success');

      // Should use bright green for success
      expect(output.text).toContain('\x1b[92m');
    });
  });

  describe('ERROR result type handling', () => {
    it('should format ERROR type result with message', () => {
      const errorResult = {
        type: ResultType.ERROR,
        message: {
          id: 'msg-error',
          content: {
            text: 'Something went wrong',
            format: ContentFormat.PLAIN_TEXT,
          },
          type: ResponseType.ERROR,
          sender: MessageSender.SYSTEM,
          timestamp: Date.now(),
        },
      };
      const output = formatter.format(errorResult);

      expect(output.text).toContain('Something went wrong');
      expect(output.metadata).toBeDefined();
    });

    it('should format ERROR type result without message as generic', () => {
      const errorResult = {
        type: ResultType.ERROR,
        errorCode: 'INTERNAL_ERROR',
        data: { reason: 'unknown' },
      };
      const output = formatter.format(errorResult as any);

      expect(output.format).toBe(OutputFormat.JSON);
      expect(() => JSON.parse(output.text)).not.toThrow();
    });
  });

  describe('formatError with colors enabled', () => {
    it('should format error with ANSI colors when enabled', () => {
      const coloredFormatter = new OutputFormatter({ enableColors: true });
      const error = new ConversationError('Colored error', ConversationErrorCode.INVALID_INPUT, {
        sessionId: 'sess-color',
      });
      const output = coloredFormatter.formatError(error);

      expect(output.text).toContain('\x1b[31m'); // Red color for error
      expect(output.text).toContain('[ERROR]');
      expect(output.text).toContain('Details:');
      expect(output.metadata.sessionId).toBe('sess-color');
    });

    it('should format error without details in colored mode', () => {
      const coloredFormatter = new OutputFormatter({ enableColors: true });
      const error = new ConversationError('Simple colored error');
      const output = coloredFormatter.formatError(error);

      expect(output.text).toContain('\x1b[31m');
      expect(output.text).not.toContain('Details:');
    });
  });

  describe('formatMessage with tool calls', () => {
    it('should include tool calls in formatted output', () => {
      const resultWithTools = {
        type: ResultType.MESSAGE,
        message: {
          id: 'msg-tools',
          content: {
            text: 'I will use some tools',
            format: ContentFormat.PLAIN_TEXT,
          },
          type: ResponseType.TEXT,
          sender: MessageSender.ASSISTANT,
          timestamp: Date.now(),
          toolCalls: [
            { id: 'call-1', name: 'search', arguments: '{}', type: 'function' as const },
            {
              id: 'call-2',
              name: 'calculate',
              arguments: '{"expr":"2+2"}',
              type: 'function' as const,
            },
          ],
        },
      };
      const output = formatter.format(resultWithTools);

      expect(output.text).toContain('I will use some tools');
      expect(output.text).toContain('[TOOL]');
      expect(output.text).toContain('search');
      expect(output.text).toContain('calculate');
    });
  });

  describe('formatSession with tags', () => {
    it('should include tags when present', () => {
      const sessionWithTag = createSessionResult('sess-tags', 'Tagged Session');
      sessionWithTag.session.tags = ['important', 'work', 'project-alpha'];

      const output = formatter.format(sessionWithTag);

      expect(output.text).toContain('Tags:');
      expect(output.text).toContain('important');
      expect(output.text).toContain('work');
      expect(output.text).toContain('project-alpha');
    });
  });

  describe('formatContext without config', () => {
    it('should handle context without config object', () => {
      const contextWithoutConfig = {
        type: ResultType.CONTEXT,
        contextWindow: {
          id: 'ctx-no-config',
          sessionId: 'sess-1',
          messages: [],
          tokenCount: 50,
          messageCount: 5,
          createdAt: Date.now(),
          // No config property
        } as any,
      };
      const output = formatter.format(contextWithoutConfig);

      expect(output.text).toContain('Context Window');
      expect(output.text).toContain('ctx-no-config');
      expect(output.text).not.toContain('Configuration');
    });
  });

  describe('status icons for different session states', () => {
    it('should show filled circle for active session with colors', () => {
      const coloredFormatter = new OutputFormatter({ enableColors: true });
      const sessions = [
        {
          id: 'sess-active',
          title: 'Active Session',
          messageCount: 10,
          status: SessionStatus.ACTIVE,
          tags: [],
          metadata: {},
          contextWindow: {
            windowSize: 50,
            windowType: ContextWindowType.RECENT_MESSAGES,
            includeSystemMessages: true,
            includeToolCalls: true,
          },
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        },
      ];
      const result = createSessionListResult(sessions);
      const output = coloredFormatter.format(result);

      expect(output.text).toContain('\x1b[32m'); // Green for active
    });

    it('should show empty circle for idle session', () => {
      const sessions = [
        {
          id: 'sess-idle',
          title: 'Idle Session',
          messageCount: 0,
          status: SessionStatus.IDLE,
          tags: [],
          metadata: {},
          contextWindow: {
            windowSize: 50,
            windowType: ContextWindowType.RECENT_MESSAGES,
            includeSystemMessages: true,
            includeToolCalls: true,
          },
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        },
      ];
      const result = createSessionListResult(sessions);
      const output = formatter.format(result);

      expect(output.text).toContain('○');
    });

    it('should show dimmed circle for closed session', () => {
      const sessions = [
        {
          id: 'sess-closed',
          title: 'Closed Session',
          messageCount: 100,
          status: SessionStatus.CLOSED,
          tags: [],
          metadata: {},
          contextWindow: {
            windowSize: 50,
            windowType: ContextWindowType.RECENT_MESSAGES,
            includeSystemMessages: true,
            includeToolCalls: true,
          },
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        },
      ];
      const result = createSessionListResult(sessions);
      const output = formatter.format(result);

      expect(output.text).toContain('Closed Session');
    });

    it('should show empty circle for unknown status', () => {
      const sessions = [
        {
          id: 'sess-unknown',
          title: 'Unknown Status Session',
          messageCount: 5,
          status: 'unknown_status' as SessionStatus,
          tags: [],
          metadata: {},
          contextWindow: {
            windowSize: 50,
            windowType: ContextWindowType.RECENT_MESSAGES,
            includeSystemMessages: true,
            includeToolCalls: true,
          },
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        },
      ];
      const result = createSessionListResult(sessions);
      const output = formatter.format(result);

      expect(output.text).toContain('○'); // Default icon
    });
  });

  describe('formatConfirmation with colors', () => {
    it('should apply warning color when colors enabled', () => {
      const coloredFormatter = new OutputFormatter({ enableColors: true });
      const confirmationResult = {
        type: ResultType.CONFIRMATION,
        message: {
          id: 'msg-confirm',
          content: {
            text: 'Delete all files?',
            format: ContentFormat.PLAIN_TEXT,
          },
          type: ResponseType.CONFIRMATION,
          sender: MessageSender.SYSTEM,
          timestamp: Date.now(),
        },
      };
      const output = coloredFormatter.format(confirmationResult);

      expect(output.text).toContain('\x1b[33m'); // Warning color (yellow)
      expect(output.text).toContain('Delete all files?');
      expect(output.text).toContain('confirm (yes/no)');
    });
  });

  describe('formatSuccess and formatWarning with colors', () => {
    it('should format success with green color', () => {
      const coloredFormatter = new OutputFormatter({ enableColors: true });
      const output = coloredFormatter.formatSuccess('Great success!');

      expect(output.text).toContain('\x1b[32m'); // Success green
      expect(output.text).toContain('[OK]');
    });

    it('should format warning with yellow color', () => {
      const coloredFormatter = new OutputFormatter({ enableColors: true });
      const output = coloredFormatter.formatWarning('Caution advised');

      expect(output.text).toContain('\x1b[33m'); // Warning yellow
      expect(output.text).toContain('[WARN]');
    });
  });

  describe('formatStatus with colors', () => {
    it('should format status with info color when enabled', () => {
      const coloredFormatter = new OutputFormatter({ enableColors: true });
      const output = coloredFormatter.formatStatus({
        progress: 75,
        stage: 'processing',
      });

      expect(output.text).toContain('\x1b[36m'); // Info cyan
      expect(output.text).toContain('[STATUS]');
    });
  });

  describe('formatToolResults edge cases', () => {
    it('should handle failed tool result without error object', () => {
      const results = [
        {
          callId: 'call-fail',
          toolName: 'failing_tool',
          result: null,
          success: false,
          executionTime: 10,
          // No error property
        },
      ];
      const output = formatter.formatToolResults(results);

      expect(output.text).toContain('[TOOL]');
      expect(output.text).toContain('failing_tool');
    });

    it('should handle empty results array', () => {
      const output = formatter.formatToolResults([]);

      expect(output.text).toBe('');
      expect(output.format).toBe(OutputFormat.TERMINAL);
    });
  });

  describe('formatStream edge cases', () => {
    it('should handle null chunk', () => {
      const output = formatter.formatStream(null as any);
      expect(output).toBe('null');
    });

    it('should handle undefined chunk', () => {
      const output = formatter.formatStream(undefined as any);
      expect(output).toBe('undefined');
    });

    it('should handle boolean chunk', () => {
      const output = formatter.formatStream(true);
      expect(output).toBe('true');
    });
  });

  describe('formatSection with colors', () => {
    it('should apply secondary color to section header when enabled', () => {
      const coloredFormatter = new OutputFormatter({ enableColors: true });
      const sessionResult = createSessionResult('sess-section', 'Test');
      const output = coloredFormatter.format(sessionResult);

      expect(output.text).toContain('\x1b[90m'); // Secondary color (gray)
    });
  });

  describe('formatMarkdown without colors', () => {
    it('should not apply ANSI codes when colors disabled', () => {
      const noColorFormatter = new OutputFormatter({ enableColors: false });
      const mdResult = {
        type: ResultType.MESSAGE,
        message: {
          id: 'msg-md',
          content: {
            text: '**bold text** and `code`',
            format: ContentFormat.MARKDOWN,
          },
          type: ResponseType.TEXT,
          sender: MessageSender.ASSISTANT,
          timestamp: Date.now(),
        },
      };
      const output = noColorFormatter.format(mdResult);

      // When colors disabled, markdown should still work but without ANSI codes
      expect(output.format).toBe(OutputFormat.MARKDOWN);
      expect(output.text).toContain('bold text');
    });
  });

  describe('default options values', () => {
    it('should use default options when none provided', () => {
      const defaultFormatter = new OutputFormatter();
      const output = defaultFormatter.formatSuccess('Default test');

      expect(output.text).toContain('[OK]');
      expect(output.text).not.toMatch(/\x1b\[/); // No colors by default
    });

    it('should respect custom maxLineWidth', () => {
      const customWidth = new OutputFormatter({ maxLineWidth: 20 });
      const sessionResult = createSessionResult('sess-width', 'Width Test');
      const output = customWidth.format(sessionResult);

      // "Session Information" is 19 chars, limited to 20
      expect(output.text).toContain('─'.repeat(19));
    });
  });
});
