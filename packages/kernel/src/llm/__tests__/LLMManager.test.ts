import { describe, it, expect, beforeEach } from 'vitest';
import { LLMManager } from '../LLMManager.js';
import { BaseLLMProvider } from '../LLMProvider.js';
import type {
  ChatMessage, ChatOptions, ChatResponse, StreamChunk,
} from '../LLMProvider.js';
import type { LLMProvider, LLMModel } from '@organic/utils';

function makeConfig(id: string): LLMProvider {
  return {
    id, name: id, apiBaseUrl: 'https://api.test',
    apiKeyEnvVar: 'KEY', description: 'test', website: 'https://test',
  };
}

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
      content: `[${this.config.id}] ${messages.map(m => m.content).join(' ')}`,
      finishReason: 'stop',
    };
  }
  async *chatStream(_msgs: ChatMessage[], _opts?: ChatOptions): AsyncIterable<StreamChunk> {
    yield { content: `[${this.config.id}]`, finishReason: 'stop' };
  }
  async listModels(): Promise<LLMModel[]> {
    return this._models;
  }
}

describe('LLMManager', () => {
  let manager: LLMManager;

  beforeEach(() => {
    manager = new LLMManager();
  });

  it('should register a provider and set it as default', () => {
    const p = new MockProvider('a');
    manager.registerProvider(p);
    expect(manager.getProvider('a')).toBe(p);
  });

  it('should unregister provider and fallback to next', () => {
    manager.registerProvider(new MockProvider('a'));
    manager.registerProvider(new MockProvider('b'));
    manager.unregisterProvider('a');
    expect(manager.getProvider('a')).toBeUndefined();
    expect(manager.getProvider('b')).toBeDefined();
  });

  it('should unregister last provider', () => {
    manager.registerProvider(new MockProvider('a'));
    manager.unregisterProvider('a');
    expect(manager.getProvider('a')).toBeUndefined();
  });

  it('should set default provider', () => {
    manager.registerProvider(new MockProvider('a'));
    manager.registerProvider(new MockProvider('b'));
    manager.setDefaultProvider('b');
    expect(manager.getProvider('b')).toBeDefined();
  });

  it('should throw for unregistered default provider', () => {
    expect(() => manager.setDefaultProvider('x'))
      .toThrow('Provider "x" not registered');
  });

  it('should chat through default provider', async () => {
    manager.registerProvider(new MockProvider('a'));
    const resp = await manager.chat([
      { role: 'user', content: 'hi' },
    ]);
    expect(resp.content).toContain('[a]');
    expect(resp.content).toContain('hi');
  });

  it('should chat through explicit provider', async () => {
    manager.registerProvider(new MockProvider('a'));
    manager.registerProvider(new MockProvider('b'));
    const resp = await manager.chat(
      [{ role: 'user', content: 'hi' }],
      { providerId: 'b' },
    );
    expect(resp.content).toContain('[b]');
  });

  it('should throw chat when no provider registered', async () => {
    await expect(manager.chat([{ role: 'user', content: 'hi' }]))
      .rejects.toThrow('No LLM provider registered');
  });

  it('should chatStream through default provider', async () => {
    manager.registerProvider(new MockProvider('a'));
    const chunks: StreamChunk[] = [];
    for await (const c of manager.chatStream(
      [{ role: 'user', content: 'hi' }],
    )) {
      chunks.push(c);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('[a]');
  });

  it('should chatStream through explicit provider', async () => {
    manager.registerProvider(new MockProvider('a'));
    manager.registerProvider(new MockProvider('b'));
    const chunks: StreamChunk[] = [];
    for await (const c of manager.chatStream(
      [{ role: 'user', content: 'hi' }],
      { providerId: 'b' },
    )) {
      chunks.push(c);
    }
    expect(chunks[0].content).toContain('[b]');
  });

  it('should listModels from all providers', async () => {
    const m: LLMModel = {
      id: 'm1', name: 'M1', providerId: 'a',
      contextWindow: 4096, maxTokens: 1024,
      pricing: { input: 0.001, output: 0.002, currency: 'CNY' },
    };
    manager.registerProvider(new MockProvider('a', [m]));
    manager.registerProvider(new MockProvider('b', [m]));
    const models = await manager.listModels();
    expect(models).toHaveLength(2);
  });

  it('should listModels from specific provider', async () => {
    manager.registerProvider(new MockProvider('a', []));
    const models = await manager.listModels('a');
    expect(models).toHaveLength(0);
  });
});