import assert from 'node:assert/strict';
import 'dotenv/config';

import { buildModelContentsFromRequestWithDebug } from './server/lib/chat-parts.ts';
import { createGoogleAI, getVertexConfig, parseApiError } from './server/lib/google-genai.ts';

const model = process.env.YOUTUBE_SMOKE_MODEL || 'gemini-3.1-flash-lite-preview';
const url = process.env.YOUTUBE_SMOKE_URL || 'https://youtu.be/3KtWfp0UopM';

const vertexConfig = getVertexConfig();
if (!vertexConfig.isConfigured) {
  console.log('verify-youtube-gemini-smoke: SKIP (VERTEX_PROJECT_ID / VERTEX_LOCATION not configured)');
  process.exit(0);
}

const { contents, debug } = await buildModelContentsFromRequestWithDebug({
  history: [],
  message: 'Reponds en francais. Decris deux details concrets visibles ou audibles dans cette video. Ne reponds pas avec des generalites.',
  attachments: [
    {
      type: 'youtube',
      url,
      mimeType: 'video/mp4',
      name: 'Official Gemini YouTube smoke video',
    },
  ],
});

assert.equal(debug.youtubeNativeCount, 1);
assert.equal(debug.youtubeDemotedCount, 0);
assert.match(String(contents[0]?.parts[0]?.fileData?.fileUri || ''), /^https:\/\/www\.youtube\.com\/watch\?v=/);

try {
  const ai = createGoogleAI(model);
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      temperature: 0,
      maxOutputTokens: 512,
    },
  });

  const text = String((response as any).text || '').trim();
  assert.ok(text.length > 80, `Smoke response too short: ${text}`);
  assert.doesNotMatch(
    text.toLowerCase(),
    /(cannot|can't|unable|not able|je ne peux pas|impossible d'acceder|pas acces|pas capable)/,
  );

  console.log('verify-youtube-gemini-smoke: OK');
  console.log(text.slice(0, 500));
} catch (error) {
  console.error('verify-youtube-gemini-smoke: FAILED');
  console.error(parseApiError(error));
  process.exitCode = 1;
}
