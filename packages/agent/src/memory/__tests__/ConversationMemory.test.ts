import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationMemory } from '../ConversationMemory.js';
import { createUserMessage } from '../../context/Message.js';

function makeMsg(text: string, id = 'u1'): ReturnType<typeof createUserMessage> {
  return createUserMessage(id, 'Test', text);
}

describe('ConversationMemory', () => {
  let memory: ConversationMemory;

  beforeEach(() => {
    memory = new ConversationMemory();
  });

  it('should add and retrieve messages', () => {
    memory.addMessage('s1', makeMsg('hello'));
    memory.addMessage('s1', makeMsg('world'));
    const history = memory.getHistory('s1');
    expect(history).toHaveLength(2);
    expect(history[0].content.text).toBe('hello');
  });

  it('should return empty array for non-existent session', () => {
    expect(memory.getHistory('nonexistent')).toEqual([]);
  });

  it('should support limit on getHistory', () => {
    memory.addMessage('s1', makeMsg('a'));
    memory.addMessage('s1', makeMsg('b'));
    memory.addMessage('s1', makeMsg('c'));
    expect(memory.getHistory('s1', 2)).toHaveLength(2);
  });

  it('should generate summary for session', () => {
    memory.addMessage('s1', makeMsg('hello'));
    memory.addMessage('s1', makeMsg('world'));
    const summary = memory.generateSummary('s1');
    expect(summary).toContain('Summary');
  });

  it('should return empty string for unknown session summary', () => {
    expect(memory.generateSummary('unknown')).toBe('');
  });

  it('should search relevant messages by keyword', () => {
    memory.addMessage('s1', makeMsg('apple banana'));
    memory.addMessage('s1', makeMsg('cherry date'));
    const result = memory.searchRelevant('s1', 'apple');
    expect(result.entries).toHaveLength(1);
    expect(result.scores[0]).toBeGreaterThan(0);
  });

  it('should return empty for no match search', () => {
    memory.addMessage('s1', makeMsg('hello'));
    const result = memory.searchRelevant('s1', 'xyz');
    expect(result.entries).toHaveLength(0);
  });

  it('should clear session', () => {
    memory.addMessage('s1', makeMsg('hello'));
    memory.clear('s1');
    expect(memory.getHistory('s1')).toHaveLength(0);
  });

  it('should track session count', () => {
    memory.addMessage('s1', makeMsg('a'));
    memory.addMessage('s2', makeMsg('b'));
    expect(memory.getSessionCount()).toBe(2);
    expect(memory.getSessionIds()).toContain('s1');
  });

  it('should track entry count per session', () => {
    memory.addMessage('s1', makeMsg('a'));
    memory.addMessage('s1', makeMsg('b'));
    expect(memory.getEntryCount('s1')).toBe(2);
    expect(memory.getEntryCount('unknown')).toBe(0);
  });

  it('should enforce maxHistoryPerSession', () => {
    const mem = new ConversationMemory({ maxHistoryPerSession: 3, enableSummarization: false });
    mem.addMessage('s1', makeMsg('1'));
    mem.addMessage('s1', makeMsg('2'));
    mem.addMessage('s1', makeMsg('3'));
    mem.addMessage('s1', makeMsg('4'));
    expect(mem.getHistory('s1')).toHaveLength(3);
  });
});