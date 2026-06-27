/**
 * ConversationMemory - Conversation history storage and retrieval
 */
import type { Message } from '../context/Message.js';
import { ContextCompressor } from '../context/ContextCompressor.js';
import { TokenBudget } from '../context/TokenBudget.js';

export interface ConversationMemoryConfig {
  maxHistoryPerSession?: number;
  enableSummarization?: boolean;
  summaryThreshold?: number;
  maxTokens?: number;
}

export interface MemoryEntry {
  sessionId: string;
  message: Message;
  timestamp: number;
  summary?: string;
}

export interface RelevanceResult {
  entries: MemoryEntry[];
  scores: number[];
}

export const DEFAULT_MEMORY_CONFIG: ConversationMemoryConfig = {
  maxHistoryPerSession: 100,
  enableSummarization: true,
  summaryThreshold: 50,
  maxTokens: 4096,
};

export class ConversationMemory {
  private config: ConversationMemoryConfig;
  private sessions: Map<string, MemoryEntry[]> = new Map();
  private compressor: ContextCompressor;
  private tokenBudget: TokenBudget;

  constructor(config: ConversationMemoryConfig = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.compressor = new ContextCompressor();
    this.tokenBudget = new TokenBudget();
  }

  addMessage(sessionId: string, message: Message): void {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
    const session = this.sessions.get(sessionId)!;
    session.push({ sessionId, message, timestamp: Date.now() });
    const max = this.config.maxHistoryPerSession ?? 100;
    if (session.length > max) {
      session.splice(0, session.length - max);
    }
    if (this.config.enableSummarization && session.length > (this.config.summaryThreshold ?? 50)) {
      this.generateSummary(sessionId);
    }
  }

  getHistory(sessionId: string, limit?: number): Message[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    const entries = limit ? session.slice(-limit) : session;
    return entries.map(e => e.message);
  }

  generateSummary(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session || session.length === 0) return '';
    const messages = session.map(e => e.message);
    const summary = this.compressor.summarize(messages);
    for (const entry of session) {
      entry.summary = summary;
    }
    return summary;
  }

  searchRelevant(sessionId: string, query: string, topK: number = 5): RelevanceResult {
    const session = this.sessions.get(sessionId);
    if (!session || session.length === 0) {
      return { entries: [], scores: [] };
    }
    const queryLower = query.toLowerCase();
    const scored = session.map(entry => {
      const text = entry.message.content.text ?? '';
      const textLower = text.toLowerCase();
      let score = 0;
      if (textLower.includes(queryLower)) score += 10;
      for (const word of queryLower.split(/\s+/)) {
        if (textLower.includes(word)) score += 1;
      }
      return { entry, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK).filter(s => s.score > 0);
    return {
      entries: top.map(s => s.entry),
      scores: top.map(s => s.score),
    };
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  getEntryCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.length ?? 0;
  }
}