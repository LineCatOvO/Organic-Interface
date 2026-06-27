/**
 * LLM Provider type definitions
 */

/**
 * LLM Provider configuration interface
 */
export interface LLMProvider {
  /** Unique provider identifier */
  id: string;
  /** Display name of the provider */
  name: string;
  /** Base URL for the provider's API */
  apiBaseUrl: string;
  /** Environment variable name for the API key */
  apiKeyEnvVar: string;
  /** Description of the provider */
  description: string;
  /** Official website URL */
  website: string;
  /** Custom HTTP headers for API requests */
  headers?: Record<string, string>;
  /** Default model ID to use when none is specified */
  defaultModel?: string;
  /** Organization ID for multi-org accounts */
  organizationId?: string;
}