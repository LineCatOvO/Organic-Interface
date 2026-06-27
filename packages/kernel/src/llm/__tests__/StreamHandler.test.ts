import { describe, it, expect } from 'vitest';
import { StreamHandler } from '../StreamHandler.js';
import type { StreamChunk } from '../LLMProvider.js';

describe('StreamHandler', () => {
  // ========== parseSSELine tests ==========

  it('should parse valid SSE line with content', () => {
    const line = 'data: {"choices":[{"delta":{"content":"hello"}}]}';
    const result = StreamHandler.parseSSELine(line);
    expect(result).not.toBeNull();
    expect(result!.content).toBe('hello');
  });

  it('should parse SSE line with finishReason', () => {
    const line = 'data: {"choices":[{"delta":{"content":"end"},"finish_reason":"stop"}]}';
    const result = StreamHandler.parseSSELine(line);
    expect(result).not.toBeNull();
    expect(result!.content).toBe('end');
    expect(result!.finishReason).toBe('stop');
  });

  it('should return null for [DONE] signal', () => {
    const result = StreamHandler.parseSSELine('data: [DONE]');
    expect(result).toBeNull();
  });

  it('should return null for non-data line', () => {
    expect(StreamHandler.parseSSELine('event: message')).toBeNull();
    expect(StreamHandler.parseSSELine('')).toBeNull();
    expect(StreamHandler.parseSSELine(':comment')).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    expect(StreamHandler.parseSSELine('data: {invalid')).toBeNull();
  });

  it('should return null for missing choices', () => {
    expect(StreamHandler.parseSSELine('data: {"x":1}')).toBeNull();
  });

  it('should return null for missing delta.content', () => {
    const line = 'data: {"choices":[{"delta":{}}]}';
    expect(StreamHandler.parseSSELine(line)).toBeNull();
  });

  // ========== iterateSSE tests ==========

  async function* makeSource(lines: string[]): AsyncIterable<string> {
    for (const line of lines) yield line;
  }

  it('should iterate SSE chunks from source', async () => {
    const src = makeSource([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n',
      'data: {"choices":[{"delta":{"content":"!"}}]}\n',
    ]);
    const chunks: StreamChunk[] = [];
    for await (const c of StreamHandler.iterateSSE(src)) {
      chunks.push(c);
    }
    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe('hi');
    expect(chunks[1].content).toBe('!');
  });

  it('should handle empty source', async () => {
    const chunks: StreamChunk[] = [];
    for await (const c of StreamHandler.iterateSSE(makeSource([]))) {
      chunks.push(c);
    }
    expect(chunks).toHaveLength(0);
  });

  it('should handle partial lines across chunks', async () => {
    const src = makeSource([
      'data: {"choices":[{"delta":{"content":"part1"}}]}\n',
      'data: {"choices":[{"delta":{"content":"part2"}}]}\n',
    ]);
    const chunks: StreamChunk[] = [];
    for await (const c of StreamHandler.iterateSSE(src)) {
      chunks.push(c);
    }
    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe('part1');
    expect(chunks[1].content).toBe('part2');
  });

  it('should skip non-data lines in iterateSSE', async () => {
    const src = makeSource([
      'event: message\n',
      'data: {"choices":[{"delta":{"content":"real"}}]}\n',
      ':comment\n',
      'data: [DONE]\n',
    ]);
    const chunks: StreamChunk[] = [];
    for await (const c of StreamHandler.iterateSSE(src)) {
      chunks.push(c);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('real');
  });
});