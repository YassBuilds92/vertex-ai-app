import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { GoogleAuth } from 'google-auth-library';

import {
  DEFAULT_GEMINI_TTS_DUO_VOICES,
  MAX_GEMINI_TTS_MULTI_SPEAKERS,
  modelSupportsGeminiTtsMultiSpeaker,
  normalizeGeminiTtsModelId,
  normalizeGeminiTtsVoiceName,
} from '../../shared/gemini-tts.js';
import { createGoogleAI, getVertexConfig, parseApiError, retryWithBackoff } from './google-genai.js';
import { getGcpCredentials } from './storage.js';

export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';
export const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-tts';
export const DEFAULT_TTS_VOICE = 'Kore';
export const DEFAULT_LYRIA_MODEL = 'lyria-002';
export const DEFAULT_PODCAST_TTS_MODEL = 'gemini-2.5-pro-tts';
export const DEFAULT_PODCAST_SCRIPT_MODEL = 'gemini-3.1-flash-lite-preview';

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const PCM_SAMPLE_RATE_HZ = 24_000;
const PCM_CHANNEL_COUNT = 1;
const PCM_SAMPLE_WIDTH_BYTES = 2;
const execFileAsync = promisify(execFile);

export type ImageGenerationOptions = {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  numberOfImages?: number;
  personGeneration?: string;
  safetySetting?: string;
  thinkingLevel?: string;
};

export type GeminiTtsOptions = {
  prompt: string;
  model?: string;
  voice?: string;
  languageCode?: string;
  temperature?: number;
  speakers?: GeminiTtsSpeakerSpec[];
};

export type LyriaGenerationOptions = {
  prompt: string;
  model?: string;
  negativePrompt?: string;
  seed?: number;
  sampleCount?: number;
  location?: string;
};

export type PodcastGenerationOptions = {
  brief?: string;
  script?: string;
  title?: string;
  hostStyle?: string;
  styleInstructions?: string;
  voice?: string;
  languageCode?: string;
  ttsModel?: string;
  speakers?: GeminiTtsSpeakerSpec[];
  musicModel?: string;
  musicPrompt?: string;
  negativeMusicPrompt?: string;
  musicSeed?: number;
  musicSampleCount?: number;
  musicLocation?: string;
  introSeconds?: number;
  outroSeconds?: number;
  musicVolume?: number;
  outputExtension?: 'mp3' | 'wav';
  approxDurationSeconds?: number;
};

export type GeminiTtsSpeakerSpec = {
  name: string;
  voice?: string;
  styleInstructions?: string;
};

export type GeneratedBinaryArtifact = {
  buffer: Buffer;
  mimeType: string;
  fileExtension: string;
  model: string;
  metadata?: Record<string, string | number | boolean | undefined>;
};

export type GeneratedPodcastEpisode = {
  finalArtifact: GeneratedBinaryArtifact;
  voiceArtifact: GeneratedBinaryArtifact;
  musicArtifact: GeneratedBinaryArtifact | null;
  narrationPrompt: string;
  narrationScript: string;
  musicPrompt: string;
  voiceDurationSeconds: number;
  finalDurationSeconds: number;
  mixStrategy: 'ffmpeg' | 'wav-fallback' | 'voice-only';
  warning?: string;
};

type ParsedWaveAudio = {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  formatTag: number;
  frameCount: number;
  samples: Float32Array;
};

function clipText(value: unknown, max = 240): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function sanitizeSpeakerName(value: unknown): string {
  return clipText(value, 40)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*:+\s*$/g, '')
    .trim();
}

function uniqueSpeakerNames(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.toLowerCase();
    if (!value || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(value);
  }
  return output;
}

function normalizeGeminiTtsSpeakers(
  speakers: GeminiTtsSpeakerSpec[] | null | undefined,
  fallbackVoices: readonly string[] = DEFAULT_GEMINI_TTS_DUO_VOICES,
): GeminiTtsSpeakerSpec[] {
  if (!Array.isArray(speakers)) return [];

  const normalized = speakers
    .map((speaker, index) => {
      const name = sanitizeSpeakerName(speaker?.name);
      if (!name) return null;
      return {
        name,
        voice: normalizeGeminiTtsVoiceName(speaker?.voice, fallbackVoices[index] || DEFAULT_GEMINI_TTS_DUO_VOICES[0]),
        styleInstructions: clipText(speaker?.styleInstructions, 220),
      } satisfies GeminiTtsSpeakerSpec;
    })
    .filter(Boolean) as GeminiTtsSpeakerSpec[];

  return uniqueSpeakerNames(normalized.map((speaker) => speaker.name))
    .map((name) => normalized.find((speaker) => speaker.name === name)!)
    .filter(Boolean);
}

function extractDialogSpeakerNames(script: string): string[] {
  const matches = [...String(script || '').matchAll(/^\s*([^:\n]{1,40})\s*:/gm)];
  return uniqueSpeakerNames(matches.map((match) => sanitizeSpeakerName(match[1])));
}

function resolvePodcastSpeakers(options: PodcastGenerationOptions): GeminiTtsSpeakerSpec[] {
  const explicitSpeakers = normalizeGeminiTtsSpeakers(options.speakers);
  if (explicitSpeakers.length > 0) {
    if (explicitSpeakers.length !== MAX_GEMINI_TTS_MULTI_SPEAKERS) {
      throw new Error(`Gemini TTS multi-speaker exige exactement ${MAX_GEMINI_TTS_MULTI_SPEAKERS} intervenants configures.`);
    }
    return explicitSpeakers;
  }

  const script = clipText(options.script, 12000);
  if (!script) return [];
  const detectedNames = extractDialogSpeakerNames(script);
  if (detectedNames.length > MAX_GEMINI_TTS_MULTI_SPEAKERS) {
    throw new Error(`Le script contient ${detectedNames.length} intervenants. Gemini TTS multi-speaker supporte exactement 2 voix, pas plus.`);
  }
  if (detectedNames.length !== MAX_GEMINI_TTS_MULTI_SPEAKERS) {
    return [];
  }
  return detectedNames.map((name, index) => ({
    name,
    voice: normalizeGeminiTtsVoiceName('', DEFAULT_GEMINI_TTS_DUO_VOICES[index] || DEFAULT_GEMINI_TTS_DUO_VOICES[0]),
  }));
}

function buildPodcastDeliveryNotes(options: PodcastGenerationOptions): string {
  return [
    clipText(options.hostStyle, 220),
    clipText(options.styleInstructions, 320),
  ].filter(Boolean).join(' | ');
}

function buildSpeakerInstructionBlock(speakers: GeminiTtsSpeakerSpec[]): string[] {
  return speakers.map((speaker) => {
    const notes = clipText(speaker.styleInstructions, 180);
    return notes
      ? `- ${speaker.name} -> voice ${speaker.voice}. Performance notes: ${notes}.`
      : `- ${speaker.name} -> voice ${speaker.voice}.`;
  });
}

function validateDialogueScriptAgainstSpeakers(script: string, speakers: GeminiTtsSpeakerSpec[]): void {
  if (speakers.length !== MAX_GEMINI_TTS_MULTI_SPEAKERS) return;
  const labels = extractDialogSpeakerNames(script);
  if (labels.length !== MAX_GEMINI_TTS_MULTI_SPEAKERS) {
    throw new Error(`Le script duo doit utiliser exactement deux labels "Nom:". Recu: ${labels.length || 0}.`);
  }
  const expected = speakers.map((speaker) => speaker.name.toLowerCase()).sort();
  const actual = labels.map((label) => label.toLowerCase()).sort();
  if (expected.join('|') !== actual.join('|')) {
    throw new Error(`Le script duo doit utiliser exactement les labels ${speakers.map((speaker) => `"${speaker.name}"`).join(' et ')}.`);
  }
}

function decodeBinaryData(data: unknown): Buffer {
  if (typeof data === 'string') {
    return Buffer.from(data, 'base64');
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }
  if (Array.isArray(data)) {
    return Buffer.from(data);
  }
  throw new Error("Aucune donnee binaire exploitable n'a ete retournee par le modele.");
}

function guessExtensionFromMimeType(mimeType: string): string {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('wav')) return 'wav';
  return 'bin';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function pcmToWavBuffer(
  pcmBuffer: Buffer,
  sampleRate = PCM_SAMPLE_RATE_HZ,
  channels = PCM_CHANNEL_COUNT,
  sampleWidthBytes = PCM_SAMPLE_WIDTH_BYTES
): Buffer {
  const blockAlign = channels * sampleWidthBytes;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8, 4, 'ascii');
  header.write('fmt ', 12, 4, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(sampleWidthBytes * 8, 34);
  header.write('data', 36, 4, 'ascii');
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function isWaveBuffer(buffer: Buffer): boolean {
  return buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WAVE';
}

function parseWaveBuffer(buffer: Buffer): ParsedWaveAudio {
  if (!isWaveBuffer(buffer)) {
    throw new Error("Le mix podcast local attend un fichier WAV valide.");
  }

  let formatTag = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  for (let offset = 12; offset + 8 <= buffer.length;) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    let chunkEnd = chunkStart + chunkSize;

    if (chunkEnd > buffer.length) {
      if (chunkId === 'data' && chunkStart < buffer.length) {
        chunkEnd = buffer.length;
      } else {
        throw new Error("Le fichier WAV semble tronque.");
      }
    }

    if (chunkId === 'fmt ') {
      if (chunkSize < 16) {
        throw new Error("Le chunk fmt du WAV est invalide.");
      }

      formatTag = buffer.readUInt16LE(chunkStart);
      if (formatTag === 0xfffe && chunkSize >= 40) {
        formatTag = buffer.readUInt16LE(chunkStart + 24);
      }
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === 'data' && dataOffset === -1) {
      dataOffset = chunkStart;
      dataLength = Math.max(0, chunkEnd - chunkStart);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!sampleRate || !channels || !bitsPerSample || dataOffset < 0 || dataLength <= 0) {
    throw new Error("Le WAV ne contient pas les informations audio minimales attendues.");
  }

  if (formatTag !== 1 && formatTag !== 3) {
    throw new Error(`Le format WAV ${formatTag} n'est pas supporte pour le mix podcast local.`);
  }

  const bytesPerSample = bitsPerSample / 8;
  if (!Number.isInteger(bytesPerSample) || bytesPerSample <= 0) {
    throw new Error(`Bits par sample non supportes: ${bitsPerSample}.`);
  }

  const frameSize = bytesPerSample * channels;
  const frameCount = Math.floor(dataLength / frameSize);
  if (!frameCount) {
    throw new Error("Le WAV ne contient aucune frame audio exploitable.");
  }

  const samples = new Float32Array(frameCount * channels);
  for (let index = 0; index < samples.length; index += 1) {
    const sampleOffset = dataOffset + (index * bytesPerSample);
    let value = 0;

    if (formatTag === 3 && bitsPerSample === 32) {
      value = buffer.readFloatLE(sampleOffset);
    } else if (bitsPerSample === 16) {
      value = buffer.readInt16LE(sampleOffset) / 32768;
    } else if (bitsPerSample === 24) {
      value = buffer.readIntLE(sampleOffset, 3) / 8388608;
    } else if (bitsPerSample === 32) {
      value = buffer.readInt32LE(sampleOffset) / 2147483648;
    } else {
      throw new Error(`Le WAV ${bitsPerSample} bits n'est pas supporte pour le mix podcast local.`);
    }

    samples[index] = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
  }

  return {
    sampleRate,
    channels,
    bitsPerSample,
    formatTag,
    frameCount,
    samples,
  };
}

function getWaveDurationSeconds(buffer: Buffer): number {
  const audio = parseWaveBuffer(buffer);
  return audio.frameCount / audio.sampleRate;
}

function resampleWaveAudio(audio: ParsedWaveAudio, targetSampleRate: number): ParsedWaveAudio {
  if (audio.sampleRate === targetSampleRate) {
    return audio;
  }

  const targetFrameCount = Math.max(1, Math.round(audio.frameCount * targetSampleRate / audio.sampleRate));
  const samples = new Float32Array(targetFrameCount * audio.channels);

  for (let channel = 0; channel < audio.channels; channel += 1) {
    for (let frame = 0; frame < targetFrameCount; frame += 1) {
      const sourcePosition = targetFrameCount === 1
        ? 0
        : (frame * (audio.frameCount - 1)) / (targetFrameCount - 1);
      const leftFrame = Math.floor(sourcePosition);
      const rightFrame = Math.min(audio.frameCount - 1, leftFrame + 1);
      const mix = sourcePosition - leftFrame;
      const leftValue = audio.samples[(leftFrame * audio.channels) + channel];
      const rightValue = audio.samples[(rightFrame * audio.channels) + channel];
      samples[(frame * audio.channels) + channel] = leftValue + ((rightValue - leftValue) * mix);
    }
  }

  return {
    ...audio,
    sampleRate: targetSampleRate,
    frameCount: targetFrameCount,
    samples,
  };
}

function convertWaveChannels(audio: ParsedWaveAudio, targetChannels: number): ParsedWaveAudio {
  if (audio.channels === targetChannels) {
    return audio;
  }

  const samples = new Float32Array(audio.frameCount * targetChannels);
  for (let frame = 0; frame < audio.frameCount; frame += 1) {
    const sourceOffset = frame * audio.channels;
    const targetOffset = frame * targetChannels;

    if (targetChannels === 1) {
      let sum = 0;
      for (let channel = 0; channel < audio.channels; channel += 1) {
        sum += audio.samples[sourceOffset + channel];
      }
      samples[targetOffset] = sum / audio.channels;
      continue;
    }

    if (audio.channels === 1) {
      const monoValue = audio.samples[sourceOffset];
      for (let channel = 0; channel < targetChannels; channel += 1) {
        samples[targetOffset + channel] = monoValue;
      }
      continue;
    }

    for (let channel = 0; channel < targetChannels; channel += 1) {
      const sourceChannel = Math.min(channel, audio.channels - 1);
      samples[targetOffset + channel] = audio.samples[sourceOffset + sourceChannel];
    }
  }

  return {
    ...audio,
    channels: targetChannels,
    samples,
  };
}

function applyHighPassFilterInPlace(samples: Float32Array, channels: number, sampleRate: number, cutoffHz: number): void {
  if (cutoffHz <= 0 || !samples.length) return;

  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);

  for (let channel = 0; channel < channels; channel += 1) {
    let previousInput = 0;
    let previousOutput = 0;

    for (let frame = 0; frame < samples.length / channels; frame += 1) {
      const index = (frame * channels) + channel;
      const input = samples[index];
      const output = alpha * (previousOutput + input - previousInput);
      previousInput = input;
      previousOutput = output;
      samples[index] = output;
    }
  }
}

function normalizePeakInPlace(samples: Float32Array, targetPeak: number): void {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }

  if (!peak || peak === targetPeak) return;
  const gain = targetPeak / peak;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] *= gain;
  }
}

function limitPeakInPlace(samples: Float32Array, targetPeak: number): void {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }

  if (!peak || peak <= targetPeak) return;

  const drive = Math.min(1.9, peak / targetPeak);
  const normalizer = Math.tanh(drive);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.tanh(samples[index] * drive) / normalizer;
  }

  let postPeak = 0;
  for (const sample of samples) {
    postPeak = Math.max(postPeak, Math.abs(sample));
  }

  if (!postPeak || postPeak <= targetPeak) return;
  const trim = targetPeak / postPeak;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] *= trim;
  }
}

function floatSamplesToWavBuffer(samples: Float32Array, sampleRate: number, channels: number): Buffer {
  const pcmBuffer = Buffer.alloc(samples.length * PCM_SAMPLE_WIDTH_BYTES);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, Number.isFinite(samples[index]) ? samples[index] : 0));
    const intValue = clamped < 0
      ? Math.round(clamped * 32768)
      : Math.round(clamped * 32767);
    pcmBuffer.writeInt16LE(intValue, index * PCM_SAMPLE_WIDTH_BYTES);
  }

  return pcmToWavBuffer(pcmBuffer, sampleRate, channels, PCM_SAMPLE_WIDTH_BYTES);
}

function mixPodcastEpisodeWavFallback(options: {
  voiceBuffer: Buffer;
  musicBuffer: Buffer;
  introSeconds: number;
  outroSeconds: number;
  musicVolume: number;
}): { buffer: Buffer; durationSeconds: number } {
  const voiceBase = parseWaveBuffer(options.voiceBuffer);
  const musicBase = parseWaveBuffer(options.musicBuffer);
  const targetSampleRateBase = Math.max(voiceBase.sampleRate, musicBase.sampleRate);
  const targetChannels = Math.max(voiceBase.channels, musicBase.channels);
  const voiceParsed = convertWaveChannels(
    resampleWaveAudio(voiceBase, targetSampleRateBase),
    targetChannels,
  );
  const musicParsed = convertWaveChannels(
    resampleWaveAudio(musicBase, targetSampleRateBase),
    targetChannels,
  );

  applyHighPassFilterInPlace(voiceParsed.samples, voiceParsed.channels, voiceParsed.sampleRate, 80);
  normalizePeakInPlace(voiceParsed.samples, 0.86);
  normalizePeakInPlace(musicParsed.samples, 0.92);

  const introSeconds = clampNumber(options.introSeconds, 0, 12, 1.2);
  const outroSeconds = clampNumber(options.outroSeconds, 0, 12, 1.6);
  const musicVolume = clampNumber(options.musicVolume, 0.02, 0.6, 0.18);

  const introFrames = Math.round(introSeconds * voiceParsed.sampleRate);
  const outroFrames = Math.round(outroSeconds * voiceParsed.sampleRate);
  const totalFrames = introFrames + voiceParsed.frameCount + outroFrames;
  const output = new Float32Array(totalFrames * voiceParsed.channels);

  const fadeInFrames = Math.max(1, Math.round(Math.min(Math.max(introSeconds, 0.25), 0.45) * voiceParsed.sampleRate));
  const fadeOutFrames = Math.max(1, Math.round(Math.min(Math.max(outroSeconds, 0.6), 3) * voiceParsed.sampleRate));
  const fadeOutStartFrame = Math.max(0, totalFrames - fadeOutFrames);
  const loopCrossfadeFrames = Math.max(1, Math.min(
    Math.round(0.18 * musicParsed.sampleRate),
    Math.floor(musicParsed.frameCount / 5),
  ));
  const minMusicGain = Math.max(0.028, musicVolume * 0.26);

  const attackCoefficient = Math.exp(-1 / (voiceParsed.sampleRate * 0.008));
  const releaseCoefficient = Math.exp(-1 / (voiceParsed.sampleRate * 0.22));
  let voiceEnvelope = 0;

  for (let frame = 0; frame < totalFrames; frame += 1) {
    const outputOffset = frame * voiceParsed.channels;
    const musicFrame = frame % musicParsed.frameCount;
    const musicOffset = musicFrame * musicParsed.channels;
    const musicFramesRemaining = musicParsed.frameCount - musicFrame;
    const shouldCrossfadeLoop = loopCrossfadeFrames > 1 && musicFramesRemaining <= loopCrossfadeFrames;
    const crossfadeAlpha = shouldCrossfadeLoop
      ? 1 - (musicFramesRemaining / loopCrossfadeFrames)
      : 0;
    const musicBlendOffset = shouldCrossfadeLoop
      ? (loopCrossfadeFrames - musicFramesRemaining) * musicParsed.channels
      : 0;

    const voiceFrame = frame - introFrames;
    let voicePeak = 0;

    for (let channel = 0; channel < voiceParsed.channels; channel += 1) {
      if (voiceFrame >= 0 && voiceFrame < voiceParsed.frameCount) {
        const voiceSample = voiceParsed.samples[(voiceFrame * voiceParsed.channels) + channel] * 1.08;
        voicePeak = Math.max(voicePeak, Math.abs(voiceSample));
      }
    }

    const envelopeTarget = Math.min(1, voicePeak / 0.12);
    const envelopeCoefficient = envelopeTarget > voiceEnvelope
      ? attackCoefficient
      : releaseCoefficient;
    voiceEnvelope = envelopeTarget + (envelopeCoefficient * (voiceEnvelope - envelopeTarget));

    let musicGain = Math.max(minMusicGain, musicVolume * (1 - (0.62 * voiceEnvelope)));
    if (frame < fadeInFrames) {
      musicGain *= frame / fadeInFrames;
    }
    if (frame >= fadeOutStartFrame) {
      musicGain *= Math.max(0, (totalFrames - frame) / fadeOutFrames);
    }

    for (let channel = 0; channel < voiceParsed.channels; channel += 1) {
      const index = outputOffset + channel;
      const voiceSample = (voiceFrame >= 0 && voiceFrame < voiceParsed.frameCount)
        ? voiceParsed.samples[(voiceFrame * voiceParsed.channels) + channel] * 1.08
        : 0;
      const musicSample = (() => {
        const baseSample = musicParsed.samples[musicOffset + channel];
        if (!shouldCrossfadeLoop) return baseSample;
        const loopSample = musicParsed.samples[musicBlendOffset + channel];
        return (baseSample * (1 - crossfadeAlpha)) + (loopSample * crossfadeAlpha);
      })();
      output[index] = voiceSample + (musicSample * musicGain);
    }
  }

  limitPeakInPlace(output, 0.94);
  return {
    buffer: floatSamplesToWavBuffer(output, voiceParsed.sampleRate, voiceParsed.channels),
    durationSeconds: totalFrames / voiceParsed.sampleRate,
  };
}

function buildPodcastNarrationPrompt(options: PodcastGenerationOptions): string {
  const title = clipText(options.title, 180);
  const brief = clipText(options.brief, 4000);
  const script = clipText(options.script, 8000);
  const languageCode = clipText(options.languageCode || 'fr-FR', 32) || 'fr-FR';
  const deliveryNotes = buildPodcastDeliveryNotes(options)
    || 'warm, vivid, polished, confident podcast delivery';
  const approxDurationSeconds = Math.round(clampNumber(options.approxDurationSeconds, 15, 600, 70));
  const speakers = normalizeGeminiTtsSpeakers(options.speakers);

  if (speakers.length === MAX_GEMINI_TTS_MULTI_SPEAKERS) {
    if (script) {
      validateDialogueScriptAgainstSpeakers(script, speakers);
      return [
        `Narrate the following two-speaker podcast dialogue in ${languageCode}.`,
        title ? `Episode title: ${title}.` : null,
        `Global style instructions: ${deliveryNotes}.`,
        'Use exactly these two speaker labels and no others:',
        ...speakers.map((speaker) => `- ${speaker.name}`),
        'Cast and performance notes:',
        ...buildSpeakerInstructionBlock(speakers),
        'Keep the exact wording and line order from the script.',
        'Do not add any narration before or after the script.',
        'Script:',
        script,
      ].filter(Boolean).join('\n');
    }

    if (!brief) {
      throw new Error("Le podcast a besoin d'un `brief` ou d'un `script`.");
    }

    return [
      `Create and speak a polished two-speaker podcast dialogue in ${languageCode}.`,
      title ? `Episode title: ${title}.` : null,
      `Write the spoken script yourself from the brief below, then perform it as a natural two-voice exchange.`,
      `Target length: around ${approxDurationSeconds} seconds of spoken audio.`,
      `Global style instructions: ${deliveryNotes}.`,
      'Use exactly these two speaker labels and no others:',
      ...speakers.map((speaker) => `- ${speaker.name}`),
      'Cast and performance notes:',
      ...buildSpeakerInstructionBlock(speakers),
      'Every spoken line must start with one of those labels followed by a colon.',
      'Keep it vivid, listenable, and built for real podcast/dialogue delivery, not for stage directions.',
      'Do not mention these instructions. Do not add markdown, bullet points, timestamps, sound effect labels, or narration outside the dialogue lines.',
      'Brief:',
      brief,
    ].filter(Boolean).join('\n');
  }

  if (script) {
    return [
      `Narrate the following single-host podcast script in ${languageCode}.`,
      title ? `Episode title: ${title}.` : null,
      `Style instructions: ${deliveryNotes}.`,
      "Speak naturally in one continuous take.",
      "Do not add extra commentary before or after the script.",
      "Script:",
      script,
    ].filter(Boolean).join('\n');
  }

  if (!brief) {
    throw new Error("Le podcast a besoin d'un `brief` ou d'un `script`.");
  }

  return [
    `Create and speak a polished single-host podcast segment in ${languageCode}.`,
    title ? `Episode title: ${title}.` : null,
    `Write the spoken script yourself from the brief below, then narrate it naturally in one continuous take.`,
    `Target length: around ${approxDurationSeconds} seconds of spoken audio.`,
    "Use a strong hook, a clear middle, and a concise closing.",
    "Do not mention these instructions. Do not add bullet points, timestamps, scene directions, or sound effect labels.",
    `Style instructions: ${deliveryNotes}.`,
    "Brief:",
    brief,
  ].filter(Boolean).join('\n');
}

function buildPodcastScriptPrompt(options: PodcastGenerationOptions): string {
  const title = clipText(options.title, 180);
  const brief = clipText(options.brief, 4000);
  const languageCode = clipText(options.languageCode || 'fr-FR', 32) || 'fr-FR';
  const deliveryNotes = buildPodcastDeliveryNotes(options)
    || 'warm, vivid, polished, confident podcast delivery';
  const approxDurationSeconds = Math.round(clampNumber(options.approxDurationSeconds, 15, 600, 70));
  const speakers = normalizeGeminiTtsSpeakers(options.speakers);

  if (!brief) {
    throw new Error("Le podcast a besoin d'un `brief` ou d'un `script`.");
  }

  if (speakers.length === MAX_GEMINI_TTS_MULTI_SPEAKERS) {
    return [
      `Write an original two-speaker podcast dialogue in ${languageCode}.`,
      title ? `Episode title: ${title}.` : null,
      `Target spoken duration: about ${approxDurationSeconds} seconds.`,
      `Global style instructions: ${deliveryNotes}.`,
      'Use exactly these two speaker labels and no others:',
      ...speakers.map((speaker) => `- ${speaker.name}`),
      'Cast and performance notes:',
      ...buildSpeakerInstructionBlock(speakers),
      'Every spoken line must start with one of those labels followed by a colon.',
      'Paraphrase facts in fresh spoken wording. Do not quote headlines, article sentences, lyrics, or source copy verbatim.',
      'Keep the exchange natural and listenable: a hook, a clear middle, and a concise closing.',
      'Return only the dialogue script to narrate. No markdown, no bullet points, no scene directions, no title label, no narrator lines.',
      'Brief:',
      brief,
    ].filter(Boolean).join('\n');
  }

  return [
    `Write an original single-host podcast script in ${languageCode}.`,
    title ? `Episode title: ${title}.` : null,
    `Target spoken duration: about ${approxDurationSeconds} seconds.`,
    `Style instructions: ${deliveryNotes}.`,
    "Paraphrase facts in fresh spoken wording. Do not quote headlines, article sentences, lyrics, or source copy verbatim.",
    "Keep the flow natural and spoken: a hook, a clear middle, and a concise closing.",
    "Return only the script to narrate. No markdown, no bullet points, no scene directions, no title label.",
    "Brief:",
    brief,
  ].filter(Boolean).join('\n');
}

function cleanGeneratedPodcastScript(value: string): string {
  let text = String(value || '').trim();
  text = text.replace(/^```[\w-]*\s*/i, '').replace(/\s*```$/i, '').trim();
  text = text.replace(/^(episode title|title|titre)\s*:\s.*$/gim, '').trim();
  text = text.replace(/^\s*[-*•]\s+/gm, '');
  return clipText(text, 8000);
}

function inferPodcastMusicMood(options: PodcastGenerationOptions): string {
  const signal = `${options.title || ''} ${options.brief || options.script || ''}`.toLowerCase();
  if (/(sport|football|foot|rugby|nba|tennis|match|coupe)/.test(signal)) {
    return 'Brisk, sporty, modern, clean, forward-driving but never overpowering.';
  }
  if (/(actu|actualité|actualite|news|politique|election|élection|france|monde|geopolit|econom|finance|crise)/.test(signal)) {
    return 'Editorial, current-affairs, modern, poised, slightly urgent but controlled.';
  }
  if (/(culture|cinema|cinéma|musique|art|serie|série|film)/.test(signal)) {
    return 'Cultural magazine, warm, elegant, slightly cinematic.';
  }
  return 'Contemporary spoken-word editorial, polished and supportive.';
}

function buildPodcastMusicPrompt(options: PodcastGenerationOptions): string {
  const explicitPrompt = clipText(options.musicPrompt, 2000);
  if (explicitPrompt) return explicitPrompt;

  const hostStyle = clipText(buildPodcastDeliveryNotes(options), 140);
  const moodFrame = inferPodcastMusicMood(options);

  return [
    "A subtle instrumental podcast background bed.",
    "Original, abstract, warm, modern, immersive, supportive and never distracting.",
    "Designed for spoken-word narration, Loop-friendly and seamless, with no hard stop or dramatic final sting.",
    "No vocals, no spoken word, no quote, no recognizable melody, no lead singer, no aggressive drop.",
    "Soft pulse, light texture, elegant intro, gentle ending.",
    `Mood frame: ${moodFrame}`,
    hostStyle ? `Mood cues: ${hostStyle}.` : null,
  ].filter(Boolean).join(' ');
}

function buildFallbackPodcastMusicPrompt(options: PodcastGenerationOptions): string {
  const hostStyle = clipText(buildPodcastDeliveryNotes(options), 140);
  return [
    "Original instrumental podcast background bed.",
    "Abstract, modern, subtle, supportive, loop-friendly, seamless and elegant.",
    "No vocals, no spoken words, no quotes, no recognizable melody, no dramatic sting, no aggressive percussion.",
    "Gentle intro, stable body, soft ending, built to sit under narration.",
    hostStyle ? `Host energy cues: ${hostStyle}.` : null,
  ].filter(Boolean).join(' ');
}

function isRecitationError(error: unknown): boolean {
  return parseApiError(error).toLowerCase().includes('recitation');
}

async function generatePodcastNarrationScript(
  options: PodcastGenerationOptions,
  model = DEFAULT_PODCAST_SCRIPT_MODEL,
): Promise<string> {
  const ai = createGoogleAI(model);
  const result = await retryWithBackoff(() => ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: buildPodcastScriptPrompt(options) }] }],
    config: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 1400,
    },
  }));

  const script = cleanGeneratedPodcastScript(String(result.text || ''));
  if (!script) {
    throw new Error("Le modele de script podcast n'a renvoye aucun texte exploitable.");
  }
  return script;
}

async function runLocalCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(command, args, {
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    });
    return {
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || ''),
    };
  } catch (error: any) {
    const detail = clipText(error?.stderr || error?.stdout || error?.message || String(error), 700);
    throw new Error(`${command} a echoue. ${detail}`);
  }
}

async function mixPodcastEpisodeAudio(options: {
  voicePath: string;
  musicPath: string;
  outputPath: string;
  voiceArtifact: GeneratedBinaryArtifact;
  musicArtifact: GeneratedBinaryArtifact;
  voiceDurationSeconds: number;
  introSeconds: number;
  outroSeconds: number;
  musicVolume: number;
  outputExtension: 'mp3' | 'wav';
}): Promise<{ buffer: Buffer; durationSeconds: number; mimeType: string; fileExtension: 'mp3' | 'wav'; mixStrategy: 'ffmpeg' | 'wav-fallback' }> {
  const introSeconds = clampNumber(options.introSeconds, 0, 12, 1.2);
  const outroSeconds = clampNumber(options.outroSeconds, 0, 12, 1.6);
  const musicVolume = clampNumber(options.musicVolume, 0.02, 0.6, 0.18);
  const totalDurationSeconds = Number((options.voiceDurationSeconds + introSeconds + outroSeconds).toFixed(3));
  const fadeOutDuration = Math.min(Math.max(outroSeconds, 0.6), 3);
  const fadeOutStart = Math.max(0, totalDurationSeconds - fadeOutDuration);
  const delayMs = Math.round(introSeconds * 1000);
  const filterGraph = [
    `[0:a]atrim=0:${totalDurationSeconds.toFixed(3)},aresample=48000,highpass=f=45,lowpass=f=13500,volume=${musicVolume.toFixed(3)},acompressor=threshold=0.18:ratio=1.8:attack=30:release=260:makeup=1.2,afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOutDuration.toFixed(3)}[bedraw]`,
    `[1:a]adelay=${delayMs}:all=true,aresample=48000,highpass=f=75,lowpass=f=16000,equalizer=f=250:t=q:w=1.1:g=-1.5,equalizer=f=3200:t=q:w=1.1:g=2.2,acompressor=threshold=0.085:ratio=2.6:attack=10:release=140:makeup=1.8,volume=1.03[voice]`,
    '[bedraw][voice]sidechaincompress=threshold=0.028:ratio=6:attack=18:release=360:makeup=1[bedduck]',
    "[bedduck][voice]amix=inputs=2:weights='1 1':duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.2:LRA=7,alimiter=limit=0.89[aout]",
  ].join(';');

  const ffmpegArgs = [
    '-y',
    '-stream_loop', '-1',
    '-i', options.musicPath,
    '-i', options.voicePath,
    '-filter_complex', filterGraph,
    '-map', '[aout]',
  ];

  if (options.outputExtension === 'wav') {
    ffmpegArgs.push('-c:a', 'pcm_s16le', options.outputPath);
  } else {
    ffmpegArgs.push('-c:a', 'libmp3lame', '-b:a', '192k', options.outputPath);
  }

  try {
    await runLocalCommand('ffmpeg', ffmpegArgs);
    return {
      buffer: fs.readFileSync(options.outputPath),
      durationSeconds: totalDurationSeconds,
      mimeType: options.outputExtension === 'wav' ? 'audio/wav' : 'audio/mpeg',
      fileExtension: options.outputExtension,
      mixStrategy: 'ffmpeg',
    };
  } catch (ffmpegError) {
    try {
      const mixed = mixPodcastEpisodeWavFallback({
        voiceBuffer: options.voiceArtifact.buffer,
        musicBuffer: options.musicArtifact.buffer,
        introSeconds,
        outroSeconds,
        musicVolume,
      });
      return {
        buffer: mixed.buffer,
        durationSeconds: mixed.durationSeconds,
        mimeType: 'audio/wav',
        fileExtension: 'wav',
        mixStrategy: 'wav-fallback',
      };
    } catch (fallbackError: any) {
      const ffmpegDetail = clipText(ffmpegError instanceof Error ? ffmpegError.message : String(ffmpegError), 260);
      const fallbackDetail = clipText(fallbackError?.message || String(fallbackError), 260);
      throw new Error(`Mix podcast impossible. ffmpeg: ${ffmpegDetail} | fallback WAV: ${fallbackDetail}`);
    }
  }
}

function extractFirstInlinePart(result: any, expectedKind: 'image' | 'audio') {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      if (!part?.inlineData) continue;
      const mimeType = String(part.inlineData.mimeType || '').toLowerCase();
      if (expectedKind === 'image' && mimeType.startsWith('image/')) return part;
      if (expectedKind === 'audio' && (mimeType.startsWith('audio/') || mimeType.includes('l16') || mimeType.includes('pcm'))) return part;
    }
  }
  return null;
}

async function getAccessToken(): Promise<string> {
  const credentials = getGcpCredentials() || undefined;
  const auth = new GoogleAuth({
    credentials,
    scopes: [CLOUD_PLATFORM_SCOPE],
  });
  const client = await auth.getClient();
  const headers = await client.getRequestHeaders();
  const headerValue = headers.Authorization || headers.authorization;

  if (!headerValue || !headerValue.startsWith('Bearer ')) {
    throw new Error("Impossible d'obtenir un token d'acces Google Cloud pour Vertex AI.");
  }

  return headerValue.slice('Bearer '.length);
}

function getAiplatformBaseUrl(location: string): string {
  return `https://${location === 'global' ? 'global-aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`}`;
}

function shouldRetryLyriaLocation(error: unknown): boolean {
  const normalized = parseApiError(error).toLowerCase();
  return normalized.includes('404')
    || normalized.includes('not found')
    || normalized.includes('location')
    || normalized.includes('unsupported')
    || normalized.includes('not supported');
}

function getLyriaLocations(explicitLocation?: string): string[] {
  if (explicitLocation) return [explicitLocation];

  const { location: vertexLocation } = getVertexConfig();
  const candidates = [
    process.env.LYRIA_LOCATION,
    vertexLocation,
    'us-central1',
    'global',
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

export async function generateImageBinary(options: ImageGenerationOptions): Promise<GeneratedBinaryArtifact> {
  const prompt = clipText(options.prompt, 4000);
  if (!prompt) {
    throw new Error("Le prompt image est vide.");
  }

  const model = String(options.model || DEFAULT_IMAGE_MODEL).trim() || DEFAULT_IMAGE_MODEL;
  const ai = createGoogleAI(model);
  const config: any = {
    ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
    ...(options.numberOfImages ? { candidateCount: options.numberOfImages } : {}),
  };

  if (model.includes('gemini-3') || model.includes('nano-banana')) {
    if (options.thinkingLevel) config.thinkingLevel = options.thinkingLevel;
  }

  if (model.includes('imagen') || model.includes('image-preview') || model.includes('gemini-2.5-flash-image')) {
    if (options.personGeneration) config.personGeneration = options.personGeneration;
    if (options.safetySetting) config.safetyFilterLevel = options.safetySetting;
    if (options.imageSize) config.imageSize = options.imageSize;
  }

  const result = await retryWithBackoff(() => ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config,
  }));

  const part = extractFirstInlinePart(result, 'image');
  if (!part?.inlineData?.data) {
    throw new Error("Le modele n'a renvoye aucune image exploitable.");
  }

  const mimeType = String(part.inlineData.mimeType || 'image/png');
  return {
    buffer: decodeBinaryData(part.inlineData.data),
    mimeType,
    fileExtension: guessExtensionFromMimeType(mimeType),
    model,
    metadata: {
      aspectRatio: options.aspectRatio,
      imageSize: options.imageSize,
      requestedCandidates: options.numberOfImages,
    },
  };
}

export async function generateGeminiTtsBinary(options: GeminiTtsOptions): Promise<GeneratedBinaryArtifact> {
  const prompt = clipText(options.prompt, 12000);
  if (!prompt) {
    throw new Error("Le texte TTS est vide.");
  }

  const model = normalizeGeminiTtsModelId(String(options.model || DEFAULT_TTS_MODEL).trim() || DEFAULT_TTS_MODEL) || DEFAULT_TTS_MODEL;
  const voice = normalizeGeminiTtsVoiceName(String(options.voice || DEFAULT_TTS_VOICE).trim() || DEFAULT_TTS_VOICE, DEFAULT_TTS_VOICE);
  const speakers = normalizeGeminiTtsSpeakers(options.speakers);
  if (speakers.length > 0) {
    if (!modelSupportsGeminiTtsMultiSpeaker(model)) {
      throw new Error(`Le modele ${model} ne supporte pas le multi-speaker. Utilise gemini-2.5-pro-tts ou gemini-2.5-flash-tts.`);
    }
    if (speakers.length !== MAX_GEMINI_TTS_MULTI_SPEAKERS) {
      throw new Error(`Gemini TTS multi-speaker exige exactement ${MAX_GEMINI_TTS_MULTI_SPEAKERS} intervenants configures.`);
    }
  }
  const ai = createGoogleAI(model);

  const result = await retryWithBackoff(() => ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        ...(options.languageCode ? { languageCode: options.languageCode } : {}),
        ...(speakers.length === MAX_GEMINI_TTS_MULTI_SPEAKERS
          ? {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: speakers.map((speaker) => ({
                  speaker: speaker.name,
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: speaker.voice || DEFAULT_TTS_VOICE,
                    },
                  },
                })),
              },
            }
          : {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice,
                },
              },
            }),
      },
      ...(typeof options.temperature === 'number' ? { temperature: options.temperature } : {}),
    },
  }));

  const part = extractFirstInlinePart(result, 'audio');
  if (!part?.inlineData?.data) {
    throw new Error("Le modele TTS n'a renvoye aucun flux audio exploitable.");
  }

  const sourceMimeType = String(part.inlineData.mimeType || '').toLowerCase();
  const rawAudioBuffer = decodeBinaryData(part.inlineData.data);
  const wavBuffer = isWaveBuffer(rawAudioBuffer)
    ? rawAudioBuffer
    : pcmToWavBuffer(rawAudioBuffer);

  return {
    buffer: wavBuffer,
    mimeType: 'audio/wav',
    fileExtension: 'wav',
    model,
    metadata: {
      voice: speakers.length === MAX_GEMINI_TTS_MULTI_SPEAKERS ? '' : voice,
      speakerMode: speakers.length === MAX_GEMINI_TTS_MULTI_SPEAKERS ? 'duo' : 'single',
      speakerNames: speakers.length === MAX_GEMINI_TTS_MULTI_SPEAKERS ? speakers.map((speaker) => speaker.name).join(' | ') : '',
      speakerVoices: speakers.length === MAX_GEMINI_TTS_MULTI_SPEAKERS ? speakers.map((speaker) => speaker.voice || '').join(' | ') : '',
      languageCode: options.languageCode,
      sourceMimeType,
      sampleRateHz: PCM_SAMPLE_RATE_HZ,
    },
  };
}

async function postJson(url: string, body: unknown, projectId: string): Promise<any> {
  const accessToken = await getAccessToken();
  return retryWithBackoff(async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': projectId,
      },
      body: JSON.stringify(body),
    });

    const raw = await response.text();
    let json: any = {};
    if (raw) {
      try {
        json = JSON.parse(raw);
      } catch {
        json = { raw };
      }
    }

    if (!response.ok) {
      throw new Error(
        typeof json?.error?.message === 'string'
          ? json.error.message
          : typeof json?.message === 'string'
            ? json.message
            : raw || `HTTP ${response.status}`
      );
    }

    return json;
  });
}

async function generateLyria2Binary(
  prompt: string,
  model: string,
  projectId: string,
  options: LyriaGenerationOptions
): Promise<GeneratedBinaryArtifact> {
  if (typeof options.seed === 'number' && typeof options.sampleCount === 'number') {
    throw new Error("Pour Lyria 2, utilise soit 'seed' soit 'sampleCount', pas les deux en meme temps.");
  }

  const locations = getLyriaLocations(options.location);
  let lastError: unknown = null;

  for (const location of locations) {
    const url = `${getAiplatformBaseUrl(location)}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;
    const body = {
      instances: [
        {
          prompt,
          ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
          ...(typeof options.seed === 'number' ? { seed: options.seed } : {}),
        },
      ],
      ...(typeof options.sampleCount === 'number'
        ? { parameters: { sample_count: options.sampleCount } }
        : {}),
    };

    try {
      const json = await postJson(url, body, projectId);
      const predictions = Array.isArray(json?.predictions) ? json.predictions : [];
      const firstPrediction = predictions[0];
      const encodedAudio = firstPrediction?.audioContent || firstPrediction?.bytesBase64Encoded;
      if (!encodedAudio) {
        throw new Error("Lyria 2 n'a renvoye aucun clip audio exploitable.");
      }

      const mimeType = String(firstPrediction.mimeType || 'audio/wav');
      return {
        buffer: decodeBinaryData(encodedAudio),
        mimeType,
        fileExtension: guessExtensionFromMimeType(mimeType),
        model,
        metadata: {
          location,
          generatedClips: predictions.length,
        },
      };
    } catch (error) {
      lastError = error;
      if (!options.location && shouldRetryLyriaLocation(error)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Lyria 2 n'a pas pu generer d'audio.");
}

async function generateLyria3Binary(
  prompt: string,
  model: string,
  projectId: string
): Promise<GeneratedBinaryArtifact> {
  const url = `${getAiplatformBaseUrl('global')}/v1beta1/projects/${projectId}/locations/global/interactions`;
  const json = await postJson(url, {
    model,
    input: [{ type: 'text', text: prompt }],
  }, projectId);

  const outputs = Array.isArray(json?.outputs) ? json.outputs : [];
  const audioOutput = outputs.find((item: any) => item?.type === 'audio' && item?.data);
  if (!audioOutput?.data) {
    throw new Error("Lyria 3 n'a renvoye aucun clip audio exploitable.");
  }

  const mimeType = String(audioOutput.mime_type || audioOutput.mimeType || 'audio/mpeg');
  return {
    buffer: decodeBinaryData(audioOutput.data),
    mimeType,
    fileExtension: guessExtensionFromMimeType(mimeType),
    model,
    metadata: {
      location: 'global',
      hasLyrics: outputs.some((item: any) => item?.type === 'text'),
    },
  };
}

export async function generateLyriaBinary(options: LyriaGenerationOptions): Promise<GeneratedBinaryArtifact> {
  const prompt = clipText(options.prompt, 4000);
  if (!prompt) {
    throw new Error("Le prompt musique est vide.");
  }

  const model = String(options.model || DEFAULT_LYRIA_MODEL).trim() || DEFAULT_LYRIA_MODEL;
  const { projectId } = getVertexConfig();
  if (!projectId) {
    throw new Error('Vertex AI non configure');
  }

  if (model.startsWith('lyria-3')) {
    return generateLyria3Binary(prompt, model, projectId);
  }

  return generateLyria2Binary(prompt, model, projectId, options);
}

export async function generatePodcastEpisode(options: PodcastGenerationOptions): Promise<GeneratedPodcastEpisode> {
  const ttsModel = normalizeGeminiTtsModelId(String(options.ttsModel || DEFAULT_PODCAST_TTS_MODEL).trim() || DEFAULT_PODCAST_TTS_MODEL)
    || DEFAULT_PODCAST_TTS_MODEL;
  const resolvedSpeakers = resolvePodcastSpeakers(options);
  if (resolvedSpeakers.length === MAX_GEMINI_TTS_MULTI_SPEAKERS && !modelSupportsGeminiTtsMultiSpeaker(ttsModel)) {
    throw new Error(`Le modele ${ttsModel} ne supporte pas le multi-speaker. Pour deux intervenants, utilise gemini-2.5-pro-tts ou gemini-2.5-flash-tts.`);
  }

  const narrationScript = options.script
    ? cleanGeneratedPodcastScript(String(options.script))
    : await generatePodcastNarrationScript({
        ...options,
        speakers: resolvedSpeakers,
      });

  if (resolvedSpeakers.length === MAX_GEMINI_TTS_MULTI_SPEAKERS) {
    validateDialogueScriptAgainstSpeakers(narrationScript, resolvedSpeakers);
  }

  const narrationPrompt = buildPodcastNarrationPrompt({
    ...options,
    script: narrationScript,
    speakers: resolvedSpeakers,
  });
  const musicModel = String(options.musicModel || DEFAULT_LYRIA_MODEL).trim() || DEFAULT_LYRIA_MODEL;
  const outputExtension = options.outputExtension === 'wav' ? 'wav' : 'mp3';
  const warnings: string[] = [];

  const voiceArtifact = await generateGeminiTtsBinary({
    prompt: narrationPrompt,
    model: ttsModel,
    voice: options.voice,
    languageCode: options.languageCode,
    speakers: resolvedSpeakers,
  });
  let musicPrompt = buildPodcastMusicPrompt(options);
  let musicArtifact: GeneratedBinaryArtifact | null = null;

  try {
    musicArtifact = await generateLyriaBinary({
      prompt: musicPrompt,
      model: musicModel,
      negativePrompt: options.negativeMusicPrompt,
      seed: options.musicSeed,
      sampleCount: options.musicSampleCount,
      location: options.musicLocation,
    });
  } catch (error) {
    if (!options.musicPrompt && isRecitationError(error)) {
      musicPrompt = buildFallbackPodcastMusicPrompt(options);
      warnings.push("Fond musical simplifie apres blocage de securite sur le premier prompt.");
      try {
        musicArtifact = await generateLyriaBinary({
          prompt: musicPrompt,
          model: musicModel,
          negativePrompt: options.negativeMusicPrompt,
          seed: options.musicSeed,
          sampleCount: options.musicSampleCount,
          location: options.musicLocation,
        });
      } catch (fallbackMusicError) {
        warnings.push(`Fond musical indisponible: ${clipText(parseApiError(fallbackMusicError), 180)}`);
      }
    } else {
      warnings.push(`Fond musical indisponible: ${clipText(parseApiError(error), 180)}`);
    }
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cowork-podcast-'));
  const voicePath = path.join(tempDir, `voice.${voiceArtifact.fileExtension}`);
  const outputPath = path.join(tempDir, `podcast.${outputExtension}`);
  fs.writeFileSync(voicePath, voiceArtifact.buffer);
  const voiceDurationSeconds = getWaveDurationSeconds(voiceArtifact.buffer);

  try {
    if (!musicArtifact) {
      return {
        finalArtifact: {
          ...voiceArtifact,
          model: ttsModel,
          metadata: {
            ...voiceArtifact.metadata,
            voiceDurationSeconds: Number(voiceDurationSeconds.toFixed(3)),
            finalDurationSeconds: Number(voiceDurationSeconds.toFixed(3)),
            mixStrategy: 'voice-only',
          },
        },
        voiceArtifact,
        musicArtifact: null,
        narrationPrompt,
        narrationScript,
        musicPrompt,
        voiceDurationSeconds,
        finalDurationSeconds: voiceDurationSeconds,
        mixStrategy: 'voice-only',
        warning: warnings.join(' | ') || undefined,
      };
    }

    const musicPath = path.join(tempDir, `music.${musicArtifact.fileExtension}`);
    fs.writeFileSync(musicPath, musicArtifact.buffer);

    try {
      const mixed = await mixPodcastEpisodeAudio({
        voicePath,
        musicPath,
        outputPath,
        voiceArtifact,
        musicArtifact,
        voiceDurationSeconds,
        introSeconds: clampNumber(options.introSeconds, 0, 12, 1.2),
        outroSeconds: clampNumber(options.outroSeconds, 0, 12, 1.6),
        musicVolume: clampNumber(options.musicVolume, 0.02, 0.6, 0.18),
        outputExtension,
      });

      return {
        finalArtifact: {
          buffer: mixed.buffer,
          mimeType: mixed.mimeType,
          fileExtension: mixed.fileExtension,
          model: `${ttsModel}+${musicModel}`,
          metadata: {
            voice: String(voiceArtifact.metadata?.voice || ''),
            languageCode: String(voiceArtifact.metadata?.languageCode || ''),
            voiceDurationSeconds: Number(voiceDurationSeconds.toFixed(3)),
            finalDurationSeconds: Number(mixed.durationSeconds.toFixed(3)),
            mixStrategy: mixed.mixStrategy,
          },
        },
        voiceArtifact,
        musicArtifact,
        narrationPrompt,
        narrationScript,
        musicPrompt,
        voiceDurationSeconds,
        finalDurationSeconds: mixed.durationSeconds,
        mixStrategy: mixed.mixStrategy,
        warning: warnings.join(' | ') || undefined,
      };
    } catch (mixError) {
      warnings.push(`Mix audio indisponible: ${clipText(parseApiError(mixError), 220)}`);
      return {
        finalArtifact: {
          ...voiceArtifact,
          model: ttsModel,
          metadata: {
            ...voiceArtifact.metadata,
            voiceDurationSeconds: Number(voiceDurationSeconds.toFixed(3)),
            finalDurationSeconds: Number(voiceDurationSeconds.toFixed(3)),
            mixStrategy: 'voice-only',
          },
        },
        voiceArtifact,
        musicArtifact,
        narrationPrompt,
        narrationScript,
        musicPrompt,
        voiceDurationSeconds,
        finalDurationSeconds: voiceDurationSeconds,
        mixStrategy: 'voice-only',
        warning: warnings.join(' | ') || undefined,
      };
    }
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

export const __podcastMediaInternals = {
  extractDialogSpeakerNames,
  normalizeGeminiTtsSpeakers,
  resolvePodcastSpeakers,
  validateDialogueScriptAgainstSpeakers,
  buildPodcastNarrationPrompt,
  buildPodcastScriptPrompt,
  buildPodcastMusicPrompt,
  buildFallbackPodcastMusicPrompt,
  cleanGeneratedPodcastScript,
  getWaveDurationSeconds,
  mixPodcastEpisodeWavFallback,
};
