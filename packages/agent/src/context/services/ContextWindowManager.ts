/**
 * ContextWindowManager - Manages context windows for agent processing
 *
 * Controls the message range visible to an agent at any given time,
 * handling window creation, sliding, and optimization.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import type { Message } from '../Message.js';
import type { ContextItem } from '../models/ContextItem.js';
import { TokenBudget } from '../TokenBudget.js';
import { ContextCompressor, CompressionStrategy, type CompressedResult } from '../ContextCompressor.js';

/**
 * Context window type enumeration
 */
export enum ContextWindowType {
  /** Recent N messages */
  RECENT_MESSAGES = 'recent_messages',
  /** Recent N minutes */
  RECENT_MINUTES = 'recent_minutes',
  /** Token-based window */
  TOKEN_BASED = 'token_based',
  /** Semantic-based window */
  SEMANTIC_BASED = 'semantic_based',
}

/**
 * Context window configuration
 */
export interface ContextWindowConfig {
  /** Window size (number of messages) */
  windowSize: number;
  /** Window type */
  windowType: ContextWindowType;
  /** Include system messages */
  includeSystemMessages: boolean;
  /** Include tool calls */
  includeToolCalls: boolean;
  /** Max token count limit */
  maxTokens?: number;
  /** Time window in minutes (for RECENT_MINUTES type) */
  timeWindowMinutes?: number;
  /** Overlap size for sliding window */
  overlapSize?: number;
}

/**
 * Default context window configuration
 */
export const DEFAULT_CONTEXT_WINDOW_CONFIG: ContextWindowConfig = {
  windowSize: 50,
  windowType: ContextWindowType.RECENT_MESSAGES,
  includeSystemMessages: true,
  includeToolCalls: true,
  maxTokens: 4096,
  timeWindowMinutes: 30,
  overlapSize: 5,
};

/**
 * Context window
 *
 * Represents a window of messages accessible to an agent.
 */
export interface ContextWindow {
  /** Window unique ID */
  id: string;
  /** Associated context ID */
  contextId: string;
  /** Window configuration */
  config: ContextWindowConfig;
  /** Messages in this window */
  messages: Message[];
  /** Context items in this window */
  items: ContextItem[];
  /** Token count estimate */
  tokenCount: number;
  /** Window start index */
  startIndex: number;
  /** Window end index */
  endIndex: number;
  /** Has previous window */
  hasPrevious: boolean;
  /** Has next window */
  hasNext: boolean;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Context window manager configuration
 */
export interface ContextWindowManagerConfig {
  /** Default window configuration */
  defaultConfig?: Partial<ContextWindowConfig>;
  /** Enable automatic window optimization */
  autoOptimize?: boolean;
  /** Maximum windows per context */
  maxWindowsPerContext?: number;
  /** Token estimation characters per token */
  charsPerToken?: number;
}

/**
 * Default context window manager configuration
 */
export const DEFAULT_CONTEXT_WINDOW_MANAGER_CONFIG: ContextWindowManagerConfig = {
  defaultConfig: {
    windowSize: 50,
    windowType: ContextWindowType.RECENT_MESSAGES,
    includeSystemMessages: true,
    includeToolCalls: true,
    maxTokens: 4096,
    timeWindowMinutes: 30,
    overlapSize: 5,
  },
  autoOptimize: true,
  maxWindowsPerContext: 10,
  charsPerToken: 4,
};

/**
 * ContextWindowManager
 *
 * Manages context windows for agent processing.
 * Handles window creation, sliding, and optimization.
 */
export class ContextWindowManager extends EventEmitter {
  private config: ContextWindowManagerConfig;
  private windows: Map<string, ContextWindow> = new Map();
  private logger: Logger;
  private tokenBudget: TokenBudget;
  private compressor: ContextCompressor;

  /**
   * Create a new ContextWindowManager
   */
  constructor(config: ContextWindowManagerConfig = {}) {
    super();
    this.config = {
      defaultConfig: config.defaultConfig ?? {
        windowSize: 50,
        windowType: ContextWindowType.RECENT_MESSAGES,
        includeSystemMessages: true,
        includeToolCalls: true,
        maxTokens: 4096,
        timeWindowMinutes: 30,
        overlapSize: 5,
      },
      autoOptimize: config.autoOptimize ?? true,
      maxWindowsPerContext: config.maxWindowsPerContext ?? 10,
      charsPerToken: config.charsPerToken ?? 4,
    };
    this.logger = createLogger({ prefix: 'context-window-manager' });
    this.tokenBudget = new TokenBudget({
      charsPerToken: this.config.charsPerToken,
    });
    this.compressor = new ContextCompressor({
      strategy: CompressionStrategy.TRUNCATE,
      maxTokens: this.config.defaultConfig?.maxTokens,
    });
  }

  // ==================== Window Creation ====================

  /**
   * Create a new context window
   */
  createWindow(
    contextId: string,
    allMessages: Message[],
    config?: Partial<ContextWindowConfig>
  ): ContextWindow {
    const defaults = this.config.defaultConfig ?? {};
    const windowConfig: ContextWindowConfig = {
      windowSize: config?.windowSize ?? defaults.windowSize ?? 50,
      windowType: config?.windowType ?? defaults.windowType ?? ContextWindowType.RECENT_MESSAGES,
      includeSystemMessages:
        config?.includeSystemMessages ?? defaults.includeSystemMessages ?? true,
      includeToolCalls: config?.includeToolCalls ?? defaults.includeToolCalls ?? true,
      maxTokens: config?.maxTokens ?? defaults.maxTokens ?? 4096,
      timeWindowMinutes: config?.timeWindowMinutes ?? defaults.timeWindowMinutes ?? 30,
      overlapSize: config?.overlapSize ?? defaults.overlapSize ?? 5,
    };

    const windowId = `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    // Filter and slice messages based on window type
    const filteredMessages = this.filterMessages(allMessages, windowConfig);
    const windowedMessages = this.createMessageSlice(filteredMessages, 0, windowConfig);

    // Calculate window bounds
    const startIndex = 0;
    const endIndex = windowedMessages.length - 1;

    // Estimate token count
    const tokenCount = this.estimateTokenCount(windowedMessages);

    const window: ContextWindow = {
      id: windowId,
      contextId,
      config: windowConfig,
      messages: windowedMessages,
      items: [],
      tokenCount,
      startIndex,
      endIndex,
      hasPrevious: false,
      hasNext: filteredMessages.length > windowedMessages.length,
      createdAt: now,
    };

    this.windows.set(windowId, window);
    this.cleanupOldWindows(contextId);

    this.logger.debug(`Window created: ${windowId} with ${windowedMessages.length} messages`);
    this.emit('window:created', window);

    return window;
  }

  /**
   * Get window by ID
   */
  getWindow(windowId: string): ContextWindow | null {
    return this.windows.get(windowId) ?? null;
  }

  /**
   * Get windows for a context
   */
  getWindowsForContext(contextId: string): ContextWindow[] {
    const result: ContextWindow[] = [];
    for (const window of this.windows.values()) {
      if (window.contextId === contextId) {
        result.push(window);
      }
    }
    return result;
  }

  // ==================== Window Sliding ====================

  /**
   * Slide window forward (get next messages)
   */
  slideForward(windowId: string, allMessages: Message[]): ContextWindow | null {
    const currentWindow = this.windows.get(windowId);
    if (!currentWindow) {
      return null;
    }

    const filteredMessages = this.filterMessages(allMessages, currentWindow.config);
    const newStartIndex = currentWindow.endIndex + 1 - (currentWindow.config.overlapSize ?? 0);
    const newEndIndex = Math.min(
      newStartIndex + currentWindow.config.windowSize - 1,
      filteredMessages.length - 1
    );

    if (newStartIndex >= filteredMessages.length) {
      return null; // No more messages
    }

    const windowedMessages = filteredMessages.slice(newStartIndex, newEndIndex + 1);

    const updatedWindow: ContextWindow = {
      ...currentWindow,
      messages: windowedMessages,
      tokenCount: this.estimateTokenCount(windowedMessages),
      startIndex: newStartIndex,
      endIndex: newEndIndex,
      hasPrevious: newStartIndex > 0,
      hasNext: newEndIndex < filteredMessages.length - 1,
    };

    this.windows.set(windowId, updatedWindow);
    this.emit('window:slid', { window: updatedWindow, direction: 'forward' });

    return updatedWindow;
  }

  /**
   * Slide window backward (get previous messages)
   */
  slideBackward(windowId: string, allMessages: Message[]): ContextWindow | null {
    const currentWindow = this.windows.get(windowId);
    if (!currentWindow) {
      return null;
    }

    const filteredMessages = this.filterMessages(allMessages, currentWindow.config);
    const overlapSize = currentWindow.config.overlapSize ?? 0;
    const newEndIndex = currentWindow.startIndex - 1 + overlapSize;
    const newStartIndex = Math.max(0, newEndIndex - currentWindow.config.windowSize + 1);

    if (newEndIndex < 0) {
      return null; // No previous messages
    }

    const windowedMessages = filteredMessages.slice(newStartIndex, newEndIndex + 1);

    const updatedWindow: ContextWindow = {
      ...currentWindow,
      messages: windowedMessages,
      tokenCount: this.estimateTokenCount(windowedMessages),
      startIndex: newStartIndex,
      endIndex: newEndIndex,
      hasPrevious: newStartIndex > 0,
      hasNext: newEndIndex < filteredMessages.length - 1,
    };

    this.windows.set(windowId, updatedWindow);
    this.emit('window:slid', { window: updatedWindow, direction: 'backward' });

    return updatedWindow;
  }

  // ==================== Window Optimization ====================

  /**
   * Optimize window based on token limit
   */
  optimizeWindow(windowId: string): ContextWindow | null {
    const window = this.windows.get(windowId);
    if (!window) {
      return null;
    }

    const maxTokens = window.config.maxTokens;
    if (!maxTokens) {
      return window;
    }

    if (window.tokenCount <= maxTokens) {
      return window; // No optimization needed
    }

    // Trim messages to fit token limit
    const optimizedMessages = this.trimToTokenLimit(window.messages, maxTokens);

    const optimizedWindow: ContextWindow = {
      ...window,
      messages: optimizedMessages,
      tokenCount: this.estimateTokenCount(optimizedMessages),
      endIndex: window.startIndex + optimizedMessages.length - 1,
      hasPrevious: window.startIndex > 0,
      hasNext: window.endIndex < window.endIndex,
    };

    this.windows.set(windowId, optimizedWindow);
    this.emit('window:optimized', optimizedWindow);

    return optimizedWindow;
  }

  /**
   * Get optimal window size for token limit
   */
  getOptimalWindowSize(tokenLimit: number): number {
    const charsPerToken = this.config.charsPerToken ?? 4;
    return Math.floor(tokenLimit / charsPerToken);
  }

  // ==================== Helper Methods ====================

  /**
   * Filter messages based on window config
   */
  private filterMessages(messages: Message[], config: ContextWindowConfig): Message[] {
    let filtered = messages;

    // Filter by type
    if (!config.includeSystemMessages) {
      filtered = filtered.filter(m => m.type !== 'system_message');
    }

    if (!config.includeToolCalls) {
      filtered = filtered.filter(m => m.type !== 'tool_call' && m.type !== 'tool_response');
    }

    // Filter by time window
    if (config.windowType === ContextWindowType.RECENT_MINUTES && config.timeWindowMinutes) {
      const cutoffTime = Date.now() - config.timeWindowMinutes * 60 * 1000;
      filtered = filtered.filter(m => m.timestamp >= cutoffTime);
    }

    return filtered;
  }

  /**
   * Create message slice for window
   */
  private createMessageSlice(
    messages: Message[],
    startIndex: number,
    config: ContextWindowConfig
  ): Message[] {
    if (config.windowType === ContextWindowType.RECENT_MESSAGES) {
      return messages.slice(startIndex, startIndex + config.windowSize);
    }

    // For token-based, calculate slice
    if (config.windowType === ContextWindowType.TOKEN_BASED) {
      return this.sliceByTokens(messages, startIndex, config.windowSize, config.maxTokens ?? 4096);
    }

    return messages.slice(startIndex, startIndex + config.windowSize);
  }

  /**
   * Slice messages by token count
   */
  private sliceByTokens(
    messages: Message[],
    startIndex: number,
    windowSize: number,
    maxTokens: number
  ): Message[] {
    const result: Message[] = [];
    let tokenCount = 0;
    const charsPerToken = this.config.charsPerToken ?? 4;

    for (let i = startIndex; i < messages.length && result.length < windowSize; i++) {
      const message = messages[i];
      const messageTokens = this.estimateMessageTokens(message, charsPerToken);

      if (tokenCount + messageTokens > maxTokens) {
        break;
      }

      result.push(message);
      tokenCount += messageTokens;
    }

    return result;
  }

  /**
   * Trim messages to fit token limit
   */
  private trimToTokenLimit(messages: Message[], maxTokens: number): Message[] {
    const result: Message[] = [];
    let tokenCount = 0;
    const charsPerToken = this.config.charsPerToken ?? 4;

    // Start from the most recent messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.estimateMessageTokens(message, charsPerToken);

      if (tokenCount + messageTokens <= maxTokens) {
        result.unshift(message);
        tokenCount += messageTokens;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Estimate token count for messages
   */
  private estimateTokenCount(messages: Message[]): number {
    return this.tokenBudget.estimateMessagesTokens(messages);
  }

  /**
   * Estimate tokens for a single message
   */
  private estimateMessageTokens(message: Message, _charsPerToken: number): number {
    return this.tokenBudget.estimateMessageTokens(message);
  }

  /**
   * Cleanup old windows for a context
   */
  private cleanupOldWindows(contextId: string): void {
    const windows = this.getWindowsForContext(contextId);
    const maxWindows = this.config.maxWindowsPerContext ?? 10;

    if (windows.length > maxWindows) {
      // Sort by creation time, oldest first
      windows.sort((a, b) => a.createdAt - b.createdAt);

      // Remove oldest windows
      const toRemove = windows.length - maxWindows;
      for (let i = 0; i < toRemove; i++) {
        this.windows.delete(windows[i].id);
      }

      this.logger.debug(`Cleaned up ${toRemove} old windows for context: ${contextId}`);
    }
  }

  // ==================== Management ====================

  /**
   * Delete a window
   */
  deleteWindow(windowId: string): boolean {
    const deleted = this.windows.delete(windowId);
    if (deleted) {
      this.emit('window:deleted', windowId);
    }
    return deleted;
  }

  /**
   * Delete all windows for a context
   */
  deleteWindowsForContext(contextId: string): number {
    const windowIds = this.getWindowsForContext(contextId).map(w => w.id);
    let count = 0;

    for (const windowId of windowIds) {
      if (this.deleteWindow(windowId)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get total window count
   */
  getWindowCount(): number {
    return this.windows.size;
  }

  /**
   * Clear all windows
   */
  clear(): void {
    const count = this.windows.size;
    this.windows.clear();
    this.emit('windows:cleared', count);
    this.logger.debug(`Cleared ${count} windows`);
  }
}
