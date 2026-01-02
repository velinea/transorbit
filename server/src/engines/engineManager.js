import { OpenAIEngine } from './openai.js';
import * as mock from './mock.js';

export function createEngine(config) {
  if (config.type === 'openai') {
    return new OpenAIEngine({
      apiKey: config.apiKey,
      model: config.model,
    });
  }
  return mock;
}
