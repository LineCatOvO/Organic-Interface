import type { LLMProvider } from '@organic/utils';

/**
 * Zhipu AI (GLM series) provider configuration
 */
export const glmProvider: LLMProvider = {
  id: 'zhipu',
  name: '智谱 AI (Zhipu AI)',
  apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  apiKeyEnvVar: 'ZHIPU_API_KEY',
  description: '智谱 AI 是由北京智谱华章科技有限公司开发的大语言模型系列，提供 GLM 系列模型',
  website: 'https://open.bigmodel.cn',
};