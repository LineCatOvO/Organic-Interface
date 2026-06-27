/**
 * LLM Model type definitions
 */

/**
 * Pricing information for an LLM model
 */
export interface LLMModelPricing {
  /** Cost per 1K input tokens */
  input: number;
  /** Cost per 1K output tokens */
  output: number;
  /** Currency code (e.g., CNY, USD) */
  currency: string;
}

/**
 * LLM Model configuration interface
 */
export interface LLMModel {
  /** Unique model identifier */
  id: string;
  /** Display name of the model */
  name: string;
  /** Provider ID this model belongs to */
  providerId: string;
  /** Context window size in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxTokens: number;
  /** Pricing information */
  pricing: LLMModelPricing;
  /** Description of the model */
  description?: string;
  /** Capability tags (e.g., vision, function_calling) */
  capabilities?: string[];
  /** Whether this model is deprecated */
  deprecated?: boolean;
  /** Replacement model ID if deprecated */
  replacedBy?: string;
}