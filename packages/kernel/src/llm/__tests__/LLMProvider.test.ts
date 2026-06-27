import { describe, it, expect } from 'vitest';
import {
  BaseLLMProvider,
  type ChatRole,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type StreamChunk,
} from '../LLMProvider.js';
import type { LLMProvider, LLMModel } from '@organic/utils';

function makeConfig(id: string): LLMProvider {
  return {
    id, name: id, apiBaseUrl: 'https://api.test',
    apiKeyEnvVar: 'KEY', description: 'test', website: 'https://test',
  };
}

describe('LLMProvider', () => {
  // ========== Type tests ==========

  it('should accept valid ChatRole values', () => {
    const roles: ChatRole[] = ['system', 'user', 'assistant'];
    expect(roles).toHaveLength(3);
  });

  it('should create ChatOptions with all fields', () => {
    const opts: ChatOptions = { model: 'gpt-4', temperature: 0.7, maxTokens: 100, stopSequences: ['END'] };
    expect(opts.model).toBe('gpt-4');
    expect(opts.temperature).toBe(0.7);
    expect(opts.maxTokens).toBe(100);
    expect(opts.stopSequences).toEqual(['END']);
  });

  it('should create ChatResponse with usage', () => {
    const resp: ChatResponse = {
      id: '1', model: 'm', content: 'hi',
      finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5 },
    };
    expect(resp.content).toBe('hi');
    expect(resp.usage?.promptTokens).toBe(10);
    expect(resp.usage?.completionTokens).toBe(5);
  });

  it('should create StreamChunk with finishReason', () => {
    const chunk: StreamChunk = { content: 'part', finishReason: 'stop' };
    expect(chunk.content).toBe('part');
    expect(chunk.finishReason).toBe('stop');
  });

  it('should create StreamChunk without finishReason', () => {
    const chunk: StreamChunk = { content: 'part' };
    expect(chunk.finishReason).toBeUndefined();
  });

  // ========== Mock implementation tests ==========

  class MockProvider extends BaseLLMProvider {
    config: LLMProvider;
    private _models: LLMModel[];
    constructor(id: string, models?: LLMModel[]) {
      super();
      this.config = makeConfig(id);
      this._models = models ?? [];
    }
    async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResponse> {
      return {
        id: 'mock-1', model: opts?.model ?? 'default',
        content: messages.map(m => m.content).join(' '),
        finishReason: 'stop',
      };
    }
    async *chatStream(messages: ChatMessage[], _opts?: ChatOptions): AsyncIterable<StreamChunk> {
      for (const m of messages) {
        yield { content: m.content };
      }
      yield { content: '', finishReason: 'stop' };
    }
    async listModels(): Promise<LLMModel[]> {
      return this._models;
    }
  }

  it('mock provider should expose config', () => {
    const p = new MockProvider('test');
    expect(p.config.id).toBe('test');
    expect(p.config.apiBaseUrl).toBe('https://api.test');
  });

  it('mock provider chat() should join messages', async () => {
    const p = new MockProvider('test');
    const resp = await p.chat([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ]);
    expect(resp.content).toBe('Hello Hi');
    expect(resp.finishReason).toBe('stop');
  });

  it('mock provider chatStream() should yield chunks', async () => {
    const p = new MockProvider('test');
    const chunks: StreamChunk[] = [];
    for await (const c of p.chatStream([
      { role: 'user', content: 'A' },
      { role: 'user', content: 'B' },
    ])) {
      chunks.push(c);
    }
    expect(chunks).toHaveLength(3);
    expect(chunks[0].content).toBe('A');
    expect(chunks[1].content).toBe('B');
    expect(chunks[2].finishReason).toBe('stop');
  });

  it('mock provider listModels() should return models', async () => {
    const model: LLMModel = {
      id: 'm1', name: 'Model1', providerId: 'test',
      contextWindow: 4096, maxTokens: 1024,
      pricing: { input: 0.001, output: 0.002, currency: 'CNY' },
    };
    const p = new MockProvider('test', [model]);
    const models = await p.listModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('m1');
    expect(models[0].providerId).toBe('test');
  });

  it('mock provider listModels() should return empty', async () => {
    const p = new MockProvider('test');
    const models = await p.listModels();
    expect(models).toHaveLength(0);
  });
});