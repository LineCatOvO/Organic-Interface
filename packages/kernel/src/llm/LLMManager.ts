/**
 * LLMManager - Multi-provider registry and unified LLM access
 */

import type { LLMModel } from '@organic/utils';
import type {
  BaseLLMProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
} from './LLMProvider.js';

/**
 * Manages multiple LLM providers, model switching, and unified access.
 */
export class LLMManager {
  private providers = new Map<string, BaseLLMProvider>();
  private defaultProviderId: string | null = null;

  /** Register a new provider */
  registerProvider(provider: BaseLLMProvider): void {
    this.providers.set(provider.config.id, provider);
    if (!this.defaultProviderId) {
      this.defaultProviderId = provider.config.id;
    }
  }

  /** Remove a provider by ID */
  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
    if (this.defaultProviderId === providerId) {
      this.defaultProviderId =
        this.providers.keys().next().value ?? null;
    }
  }

  /** Get a registered provider */
  getProvider(providerId: string): BaseLLMProvider | undefined {
    return this.providers.get(providerId);
  }

  /** Set the default provider */
  setDefaultProvider(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Provider "${providerId}" not registered`);
    }
    this.defaultProviderId = providerId;
  }

  /** Resolve provider to use (explicit or default) */
  private resolveProvider(providerId?: string): BaseLLMProvider {
    const id = providerId ?? this.defaultProviderId;
    if (!id) throw new Error('No LLM provider registered');
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Provider ${id} not found`);
    return provider;
  }

  /** Unified non-streaming chat */
  async chat(
    messages: ChatMessage[],
    options?: ChatOptions & { providerId?: string }
  ): Promise<ChatResponse> {
    const { providerId, ...chatOpts } = options ?? {};
    return this.resolveProvider(providerId).chat(messages, chatOpts);
  }

  /** Unified streaming chat */
  chatStream(
    messages: ChatMessage[],
    options?: ChatOptions & { providerId?: string }
  ): AsyncIterable<StreamChunk> {
    const { providerId, ...chatOpts } = options ?? {};
    return this.resolveProvider(providerId).chatStream(
      messages,
      chatOpts
    );
  }

  /** List models from all or a specific provider */
  async listModels(providerId?: string): Promise<LLMModel[]> {
    if (providerId) {
      return this.resolveProvider(providerId).listModels();
    }
    const results: LLMModel[] = [];
    for (const p of this.providers.values()) {
      results.push(...(await p.listModels()));
    }
    return results;
  }
}