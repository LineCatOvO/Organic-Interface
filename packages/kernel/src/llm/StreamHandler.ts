/**
 * StreamHandler - SSE parsing and AsyncIterator utilities
 */

import type { StreamChunk } from './LLMProvider.js';

/**
 * Handles Server-Sent Events (SSE) stream parsing
 * and provides AsyncIterator pattern support.
 */
export class StreamHandler {
  /**
   * Parse a single SSE line into a StreamChunk or null
   */
  static parseSSELine(line: string): StreamChunk | null {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6).trim();
    if (data === '[DONE]') return null;
    try {
      const parsed = JSON.parse(data);
      const choice = parsed.choices?.[0];
      if (!choice?.delta?.content) return null;
      return {
        content: choice.delta.content,
        finishReason: choice.finish_reason,
      };
    } catch {
      return null;
    }
  }

  /**
   * Create an async iterable from an SSE text stream
   */
  static async *iterateSSE(
    source: AsyncIterable<string>
  ): AsyncIterable<StreamChunk> {
    let buffer = '';
    for await (const chunk of source) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const parsed = StreamHandler.parseSSELine(line);
        if (parsed) yield parsed;
      }
    }
  }
}