/**
 * LLM Provider abstract interface
 * Defines the contract for LLM provider implementations
 */

import type { LLMProvider, LLMModel } from '@organic/utils';

/**
 * Chat message role types
 */
export type ChatRole = 'system' | 'user' | 'assistant';

/**
 * Single chat message
 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * Options for chat requests
 */
export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

/**
 * Non-streaming chat response
 */
export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * Single streaming chunk
 */
export interface StreamChunk {
  content: string;
  finishReason?: string;
}

/**
 * Abstract base class for LLM provider implementations.
 * Uses P1-009 LLMProvider config type from @organic/utils.
 */
export abstract class BaseLLMProvider {
  abstract readonly config: LLMProvider;

  abstract chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse>;

  abstract chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncIterable<StreamChunk>;

  abstract listModels(): Promise<LLMModel[]>;
}