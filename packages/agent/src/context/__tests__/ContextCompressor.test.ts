import { describe, it, expect } from 'vitest';
import { ContextCompressor, CompressionStrategy } from '../ContextCompressor.js';
import { createUserMessage, createSystemMessage } from '../Message.js';

function makeMsg(text: string, id = 'u1'): ReturnType<typeof createUserMessage> {
  return createUserMessage(id, 'Test', text);
}

describe('ContextCompressor', () => {
  it('should use default config', () => {
    const cc = new ContextCompressor();
    expect(cc).toBeDefined();
  });

  it('should accept custom config', () => {
    const cc = new ContextCompressor({
      strategy: CompressionStrategy.SUMMARIZE,
      maxTokens: 512,
    });
    expect(cc).toBeDefined();
  });

  it('should return unchanged when under token limit', () => {
    const cc = new ContextCompressor({ maxTokens: 10000, strategy: CompressionStrategy.TRUNCATE });
    const msgs = [makeMsg('hello')];
    const result = cc.compress(msgs);
    expect(result.messages).toHaveLength(1);
    expect(result.summary).toBe('');
  });

  it('should truncate oldest messages when over limit', () => {
    const cc = new ContextCompressor({
      strategy: CompressionStrategy.TRUNCATE,
      maxTokens: 15,
      preserveRecent: 1,
    });
    const msgs = [makeMsg('very long message that exceeds budget'), makeMsg('hi')];
    const result = cc.compress(msgs);
    expect(result.messages.length).toBeLessThan(msgs.length);
  });

  it('should use SUMMARIZE strategy', () => {
    const cc = new ContextCompressor({
      strategy: CompressionStrategy.SUMMARIZE,
      maxTokens: 15,
      preserveRecent: 1,
    });
    const msgs = [makeMsg('very long message that exceeds budget'), makeMsg('hi')];
    const result = cc.compress(msgs);
    expect(result.summary).toBeTruthy();
  });

  it('should use PRIORITY strategy', () => {
    const cc = new ContextCompressor({
      strategy: CompressionStrategy.PRIORITY,
      maxTokens: 30,
    });
    const s1 = createSystemMessage('system info');
    const m1 = makeMsg('user text');
    const result = cc.compress([m1, s1]);
    expect(result.messages).toBeDefined();
  });

  it('should generate summary for messages', () => {
    const cc = new ContextCompressor();
    const msgs = [makeMsg('hello'), makeMsg('world')];
    const summary = cc.summarize(msgs);
    expect(summary).toContain('Summary');
    expect(summary).toContain('2 msgs');
  });

  it('should return empty summary for empty messages', () => {
    const cc = new ContextCompressor();
    expect(cc.summarize([])).toBe('');
  });

  it('should handle empty messages array', () => {
    const cc = new ContextCompressor();
    const result = cc.compress([]);
    expect(result.messages).toHaveLength(0);
  });

  it('should default to TRUNCATE strategy', () => {
    const cc = new ContextCompressor({
      strategy: CompressionStrategy.TRUNCATE,
      maxTokens: 5,
      preserveRecent: 0,
    });
    const msgs = [makeMsg('a very long message that exceeds'), makeMsg('limit')];
    const result = cc.compress(msgs);
    expect(result.summary).toContain('Truncated');
  });
});