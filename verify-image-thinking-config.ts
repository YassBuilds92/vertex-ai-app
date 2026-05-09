import assert from 'node:assert/strict';

import { buildThinkingConfig } from './server/lib/google-genai.ts';
import {
  getImageModelThinkingLevelOptions,
  isImageModelThinkingLevelSupported,
} from './shared/image-models.ts';

function thinkingValues(model: string) {
  return getImageModelThinkingLevelOptions(model).map((option) => option.value);
}

assert.deepEqual(thinkingValues('gemini-3.1-flash-image-preview'), ['minimal', 'high']);
assert.deepEqual(thinkingValues('gemini-3-pro-image-preview'), ['high']);

assert.equal(isImageModelThinkingLevelSupported('gemini-3.1-flash-image-preview', 'low'), false);
assert.equal(isImageModelThinkingLevelSupported('gemini-3-pro-image-preview', 'medium'), false);

assert.deepEqual(
  buildThinkingConfig('gemini-3.1-flash-image-preview', { thinkingLevel: 'minimal' }),
  { thinkingLevel: 'minimal' },
);
assert.deepEqual(
  buildThinkingConfig('gemini-3.1-flash-image-preview', { thinkingLevel: 'medium' }),
  { thinkingLevel: 'high' },
);
assert.deepEqual(
  buildThinkingConfig('gemini-3-pro-image-preview', { thinkingLevel: 'low' }),
  { thinkingLevel: 'high' },
);
assert.deepEqual(
  buildThinkingConfig('gemini-3.1-pro-preview', { thinkingLevel: 'minimal' }),
  { thinkingLevel: 'low' },
);

console.log('verify-image-thinking-config: OK');
