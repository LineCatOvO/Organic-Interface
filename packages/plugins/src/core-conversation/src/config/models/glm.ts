import type { LLMModel } from '@organic/utils';

/**
 * GLM series model configurations
 */
export const glmModels: LLMModel[] = [
  {
    id: 'glm-4.7-flash',
    name: 'GLM 4.7 Flash',
    providerId: 'zhipu',
    contextWindow: 128000,
    maxTokens: 4096,
    pricing: { input: 0, output: 0, currency: 'CNY' },
    description: 'GLM 4.7 Flash 免费模型，适用于高频简单任务',
    capabilities: ['chat', 'completion'],
  },
  {
    id: 'glm-4.5',
    name: 'GLM 4.5',
    providerId: 'zhipu',
    contextWindow: 128000,
    maxTokens: 4096,
    pricing: { input: 0.1, output: 0.1, currency: 'CNY' },
    description: 'GLM 4.5 旗舰模型，适用于复杂推理与长文本处理',
    capabilities: ['chat', 'completion', 'function_calling'],
  },
  {
    id: 'glm-4.5-flash',
    name: 'GLM 4.5 Flash',
    providerId: 'zhipu',
    contextWindow: 128000,
    maxTokens: 4096,
    pricing: { input: 0.05, output: 0.05, currency: 'CNY' },
    description: 'GLM 4.5 Flash 轻量模型，适用于快速响应场景',
    capabilities: ['chat', 'completion'],
  },
];