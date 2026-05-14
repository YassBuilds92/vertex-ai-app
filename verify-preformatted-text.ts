import { detectPlainTextBlockKind, normalizeTextLineEndings } from './src/utils/preformatted-text';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const rawSrt = [
  '1',
  '00:00:00,000 --> 00:00:02,500',
  'Premiere phrase.',
  '',
  '2',
  '00:00:02,500 --> 00:00:05,000',
  'Deuxieme phrase.',
  '',
].join('\r\n');

assert(detectPlainTextBlockKind(rawSrt) === 'srt', 'raw SRT should be detected');
assert(
  normalizeTextLineEndings(rawSrt).includes('\n\n2\n00:00:02,500'),
  'SRT blank cue separators should be preserved',
);
assert(detectPlainTextBlockKind('Voici une reponse normale avec 00:00:00 sans cue.') === null, 'plain prose should stay markdown-rendered');
assert(
  detectPlainTextBlockKind('00:00:00,000 --> 00:00:02,500\nExemple de timestamp sans index.') === null,
  'bare SRT-like timestamps without cue indexes should stay markdown-rendered',
);

console.log('preformatted text detection OK');
