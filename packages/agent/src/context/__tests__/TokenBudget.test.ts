import { describe, it, expect } from 'vitest';
import { TokenBudget } from '../TokenBudget.js';
import { createUserMessage } from '../Message.js';

describe('TokenBudget', () => {
  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      const tb = new TokenBudget();
      expect(tb.getMaxTokens()).toBe(4096);
    });

    it('should merge custom config with defaults', () => {
      const tb = new TokenBudget({ modelMaxTokens: 8192 });
      expect(tb.getMaxTokens()).toBe(8192);
    });
  });

  describe('estimateMessageTokens', () => {
    it('should add overhead per message', () => {
      const tb = new TokenBudget({ charsPerToken: 4, overheadPerMessage: 5 });
      const msg = createUserMessage('u1', 'A', 'hello world');
      expect(tb.estimateMessageTokens(msg)).toBeGreaterThan(0);
    });

    it('should handle message with empty text', () => {
      const tb = new TokenBudget();
      const msg = createUserMessage('u1', 'A', '');
      expect(tb.estimateMessageTokens(msg)).toBe(5);
    });
  });

  describe('allocateBudget', () => {
    it('should allocate by priority order', () => {
      const tb = new TokenBudget();
      const result = tb.allocateBudget(100, [
        { name: 'core', minTokens: 10, maxTokens: 50, priority: 3 },
        { name: 'extra', minTokens: 10, maxTokens: 50, priority: 1 },
      ]);
      expect(result.allocations.get('core')).toBe(50);
      expect(result.allocations.get('extra')).toBe(50);
    });

    it('should enforce minTokens when insufficient budget', () => {
      const tb = new TokenBudget();
      const result = tb.allocateBudget(10, [
        { name: 'a', minTokens: 8, maxTokens: 20, priority: 2 },
        { name: 'b', minTokens: 8, maxTokens: 20, priority: 1 },
      ]);
      expect(result.allocations.get('a')).toBe(10);
      expect(result.allocations.get('b')).toBe(8);
    });

    it('should track totalUsed and remaining', () => {
      const tb = new TokenBudget();
      const result = tb.allocateBudget(100, [
        { name: 'x', minTokens: 0, maxTokens: 30, priority: 1 },
      ]);
      expect(result.totalUsed).toBe(30);
      expect(result.remaining).toBe(70);
    });
  });

  describe('getMaxTokens', () => {
    it('should return modelMaxTokens', () => {
      expect(new TokenBudget({ modelMaxTokens: 8192 }).getMaxTokens()).toBe(8192);
    });
  });

  describe('getRemainingBudget', () => {
    it('should calculate remaining budget', () => {
      const tb = new TokenBudget({ charsPerToken: 4, overheadPerMessage: 0, modelMaxTokens: 100 });
      const msgs = [createUserMessage('u1', 'A', 'aaaaaaaa')];
      expect(tb.getRemainingBudget(msgs)).toBe(98);
    });

    it('should return 0 when over budget', () => {
      const tb = new TokenBudget({ charsPerToken: 1, overheadPerMessage: 0, modelMaxTokens: 5 });
      const msgs = [createUserMessage('u1', 'A', 'long text')];
      expect(tb.getRemainingBudget(msgs)).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset usedTokens to 0', () => {
      const tb = new TokenBudget();
      tb.reset();
      expect(tb.getRemainingBudget([])).toBe(4096);
    });
  });
});