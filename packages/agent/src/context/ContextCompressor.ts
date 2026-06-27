/**
 * ContextCompressor - Context summarization and smart trimming
 */
import type { Message } from './Message.js';
import { TokenBudget, type TokenBudgetConfig } from './TokenBudget.js';

export enum CompressionStrategy {
  TRUNCATE = 'truncate',
  SUMMARIZE = 'summarize',
  PRIORITY = 'priority',
}

export interface ContextCompressorConfig {
  strategy: CompressionStrategy;
  maxTokens?: number;
  preserveRecent?: number;
  tokenBudgetConfig?: TokenBudgetConfig;
}

export interface CompressedResult {
  messages: Message[];
  summary: string;
  originalCount: number;
  compressedCount: number;
}

export const DEFAULT_COMPRESSOR_CONFIG: ContextCompressorConfig = {
  strategy: CompressionStrategy.TRUNCATE,
  maxTokens: 4096,
  preserveRecent: 10,
};

export class ContextCompressor {
  private config: ContextCompressorConfig;
  private tokenBudget: TokenBudget;

  constructor(config: ContextCompressorConfig = DEFAULT_COMPRESSOR_CONFIG) {
    this.config = { ...DEFAULT_COMPRESSOR_CONFIG, ...config };
    this.tokenBudget = new TokenBudget(config.tokenBudgetConfig);
  }

  compress(messages: Message[], maxTokens?: number): CompressedResult {
    const limit = maxTokens ?? this.config.maxTokens ?? 4096;
    const originalCount = messages.length;
    const currentTokens = this.tokenBudget.estimateMessagesTokens(messages);

    if (currentTokens <= limit) {
      return { messages, summary: '', originalCount, compressedCount: originalCount };
    }

    switch (this.config.strategy) {
      case CompressionStrategy.SUMMARIZE:
        return this.summarizeAndCompress(messages, limit, originalCount);
      case CompressionStrategy.PRIORITY:
        return this.priorityCompress(messages, limit, originalCount);
      default:
        return this.truncateCompress(messages, limit, originalCount);
    }
  }

  private truncateCompress(
    messages: Message[],
    maxTokens: number,
    originalCount: number
  ): CompressedResult {
    const preserve = this.config.preserveRecent ?? 10;
    const recent = messages.slice(-preserve);
    const older = messages.slice(0, -preserve);
    const result: Message[] = [];
    let tokens = this.tokenBudget.estimateMessagesTokens(recent);

    for (let i = older.length - 1; i >= 0; i--) {
      const mt = this.tokenBudget.estimateMessageTokens(older[i]);
      if (tokens + mt > maxTokens) break;
      result.unshift(older[i]);
      tokens += mt;
    }
    result.push(...recent);

    return {
      messages: result,
      summary: `Truncated ${originalCount}→${result.length} messages`,
      originalCount,
      compressedCount: result.length,
    };
  }

  summarize(messages: Message[]): string {
    if (messages.length === 0) return '';
    const participants = new Set(messages.map(m => m.sender.name));
    const timeRange = `${new Date(messages[0].timestamp).toISOString()} ~ ${new Date(messages[messages.length - 1].timestamp).toISOString()}`;
    return `[Summary: ${messages.length} msgs, ${participants.size} participants, ${timeRange}]`;
  }

  private summarizeAndCompress(
    messages: Message[],
    maxTokens: number,
    originalCount: number
  ): CompressedResult {
    const preserve = this.config.preserveRecent ?? 10;
    const recent = messages.slice(-preserve);
    const older = messages.slice(0, -preserve);
    const summary = this.summarize(older);
    const summaryTokens = this.tokenBudget.estimateTokens(summary);
    const remaining = maxTokens - summaryTokens;
    const trimmed = this.tokenTrim(recent, Math.max(0, remaining));

    return {
      messages: trimmed,
      summary,
      originalCount,
      compressedCount: trimmed.length,
    };
  }

  private priorityCompress(
    messages: Message[],
    maxTokens: number,
    originalCount: number
  ): CompressedResult {
    const priorityOrder = ['system_message', 'user_message', 'assistant_message', 'tool_call', 'tool_response'];
    const sorted = [...messages].sort((a, b) => {
      const ai = priorityOrder.indexOf(a.type);
      const bi = priorityOrder.indexOf(b.type);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    const trimmed = this.tokenTrim(sorted, maxTokens);

    return {
      messages: trimmed,
      summary: `Priority-trimmed ${originalCount}→${trimmed.length} messages`,
      originalCount,
      compressedCount: trimmed.length,
    };
  }

  private tokenTrim(messages: Message[], maxTokens: number): Message[] {
    const result: Message[] = [];
    let tokens = 0;
    for (const msg of messages) {
      const mt = this.tokenBudget.estimateMessageTokens(msg);
      if (tokens + mt > maxTokens) break;
      result.push(msg);
      tokens += mt;
    }
    return result;
  }
}