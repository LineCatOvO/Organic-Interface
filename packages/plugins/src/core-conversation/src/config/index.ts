import { glmProvider } from './providers/glm.js';
import { glmModels } from './models/glm.js';

export { glmProvider, glmModels };

export const providers = {
  zhipu: glmProvider,
} as const;

export const models = {
  glm: glmModels,
} as const;