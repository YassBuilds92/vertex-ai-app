import assert from 'node:assert/strict';

import { buildApiHistoryFromMessages } from './src/utils/chat-parts.ts';
import { buildModelContentsFromRequest } from './server/lib/chat-parts.ts';

type Message = import('./src/types.ts').Message;

{
  const contents = await buildModelContentsFromRequest({
    history: [],
    message: 'Analyse cette video.',
    attachments: [
      {
        type: 'video',
        url: 'https://storage.googleapis.com/videosss92/uploaded/demo-video.mp4?x-goog-signature=abc',
        mimeType: 'video/mp4',
        storageUri: 'gs://videosss92/uploaded/demo-video.mp4',
        name: 'demo-video.mp4',
      },
    ],
  });

  assert.equal(contents.length, 1);
  assert.deepEqual(contents[0]?.parts[1], {
    fileData: {
      mimeType: 'video/mp4',
      fileUri: 'gs://videosss92/uploaded/demo-video.mp4',
    },
  });
}

{
  const contents = await buildModelContentsFromRequest({
    history: [],
    message: 'Lis ce PDF.',
    attachments: [
      {
        type: 'document',
        url: 'https://storage.googleapis.com/videosss92/uploaded/demo.pdf?GoogleAccessId=test',
        mimeType: 'application/pdf',
        name: 'demo.pdf',
      },
    ],
  });

  assert.equal(contents.length, 1);
  assert.deepEqual(contents[0]?.parts[1], {
    fileData: {
      mimeType: 'application/pdf',
      fileUri: 'gs://videosss92/uploaded/demo.pdf',
    },
  });
}

{
  const textBuffer = Buffer.from('BONJOUR TXT TEST\nLigne 2', 'utf8');
  const contents = await buildModelContentsFromRequest({
    history: [],
    message: 'Que dit ce fichier texte ?',
    attachments: [
      {
        type: 'document',
        mimeType: 'text/plain',
        base64: textBuffer.toString('base64'),
        name: 'sample.txt',
      },
    ],
  });

  const textPart = contents[0]?.parts[1];
  assert.ok('text' in (textPart || {}));
  assert.match((textPart as { text: string }).text, /BONJOUR TXT TEST/);
  assert.match((textPart as { text: string }).text, /sample\.txt/);
}

{
  const jsonBuffer = Buffer.from('{"title":"JSON TEST","count":2}', 'utf8');
  const contents = await buildModelContentsFromRequest({
    history: [],
    message: 'Lis ce JSON.',
    attachments: [
      {
        type: 'document',
        mimeType: 'application/json',
        base64: jsonBuffer.toString('base64'),
        name: 'sample.json',
      },
    ],
  });

  const textPart = contents[0]?.parts[1];
  assert.ok('text' in (textPart || {}));
  assert.match((textPart as { text: string }).text, /JSON TEST/);
  assert.match((textPart as { text: string }).text, /sample\.json/);
}

{
  const historyMessage: Message = {
    id: 'msg-1',
    role: 'user',
    content: 'Voici une video',
    createdAt: Date.now(),
    attachments: [
      {
        id: 'att-1',
        type: 'video',
        url: 'https://storage.googleapis.com/videosss92/uploaded/history-video.mp4?x-goog-signature=abc',
        storageUri: 'gs://videosss92/uploaded/history-video.mp4',
        mimeType: 'video/mp4',
        name: 'history-video.mp4',
      },
    ],
  };

  const history = buildApiHistoryFromMessages([historyMessage]);
  assert.equal(history[0]?.parts[1]?.attachment?.storageUri, 'gs://videosss92/uploaded/history-video.mp4');
}

console.log('verify-chat-parts: OK');
