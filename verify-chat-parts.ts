import assert from 'node:assert/strict';

import {
  buildApiAttachmentPayload,
  buildApiHistoryFromMessages,
} from './src/utils/chat-parts.ts';
import { buildModelContentsFromRequest } from './server/lib/chat-parts.ts';

type Message = import('./src/types.ts').Message;

{
  const audioBase64 = Buffer.from('fake webm audio payload', 'utf8').toString('base64');
  const payload = buildApiAttachmentPayload({
    id: 'audio-data-url',
    type: 'audio',
    url: `data:audio/webm;codecs=opus;base64,${audioBase64}`,
    name: 'voice-note',
  });

  assert.equal(payload.mimeType, 'audio/webm');
  assert.equal(payload.base64, audioBase64);
}

{
  const audioBase64 = Buffer.from('fake webm audio payload', 'utf8').toString('base64');
  const contents = await buildModelContentsFromRequest({
    history: [],
    message: 'Transcris cet enregistrement.',
    attachments: [
      buildApiAttachmentPayload({
        id: 'audio-inline',
        type: 'audio',
        url: `data:audio/webm;codecs=opus;base64,${audioBase64}`,
        name: 'voice-note',
      }),
    ],
  });

  assert.deepEqual(contents[0]?.parts[1], {
    inlineData: {
      mimeType: 'audio/webm',
      data: audioBase64,
    },
  });
}

{
  const contents = await buildModelContentsFromRequest({
    history: [],
    message: 'Analyse cette video YouTube.',
    attachments: [
      {
        type: 'youtube',
        url: 'https://www.youtube.com/watch?v=9hE5-98ZeCg',
        mimeType: 'video/mp4',
        name: 'Video YouTube',
        videoMetadata: {
          startOffsetSeconds: 40,
          endOffsetSeconds: 80,
          fps: 5,
        },
      },
    ],
  });

  assert.equal(contents.length, 1);
  assert.deepEqual(contents[0]?.parts[1], {
    fileData: {
      mimeType: 'video/mp4',
      fileUri: 'https://www.youtube.com/watch?v=9hE5-98ZeCg',
    },
    videoMetadata: {
      startOffset: '40s',
      endOffset: '80s',
      fps: 5,
    },
  });
}

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

{
  const historyMessage: Message = {
    id: 'msg-youtube-1',
    role: 'user',
    content: 'Voici une video YouTube',
    createdAt: Date.now(),
    attachments: [
      {
        id: 'att-youtube-1',
        type: 'youtube',
        url: 'https://www.youtube.com/watch?v=9hE5-98ZeCg',
        mimeType: 'video/mp4',
        name: 'Demo YouTube',
        thumbnail: 'https://i.ytimg.com/vi/9hE5-98ZeCg/hqdefault.jpg',
        videoMetadata: {
          startOffsetSeconds: 15,
          endOffsetSeconds: 45,
          fps: 2,
        },
      },
    ],
  };

  const history = buildApiHistoryFromMessages([historyMessage]);
  assert.deepEqual(history[0]?.parts[1]?.attachment?.videoMetadata, {
    startOffsetSeconds: 15,
    endOffsetSeconds: 45,
    fps: 2,
  });
}

console.log('verify-chat-parts: OK');
