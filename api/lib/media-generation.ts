import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { GoogleAuth } from 'google-auth-library';

import { createGoogleAI, getVertexConfig, parseApiError, retryWithBackoff } from './google-genai.js';
import { getGcpCredentials } from './storage.js';

export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';
export const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-tts';
export const DEFAULT_TTS_VOICE = 'Kore';
export const DEFAULT_LYRIA_MODEL = 'lyria-002';
export const DEFAULT_PODCAST_TTS_MODEL = 'gemini-2.5-pro-tts';

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
  voice?: string;
  languageCode?: string;
  ttsModel?: string;
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
  musicArtifact: GeneratedBinaryArtifact;
  narrationPrompt: string;
  musicPrompt: string;
  voiceDurationSeconds: number;
  finalDurationSeconds: number;
};

function clipText(value: unknown, max = 240): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
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

function buildPodcastNarrationPrompt(options: PodcastGenerationOptions): string {
  const title = clipText(options.title, 180);
  const brief = clipText(options.brief, 4000);
  const script = clipText(options.script, 8000);
  const languageCode = clipText(options.languageCode || 'fr-FR', 32) || 'fr-FR';
  const hostStyle = clipText(options.hostStyle, 280)
    || 'warm, vivid, polished, confident podcast host';
  const approxDurationSeconds = Math.round(clampNumber(options.approxDurationSeconds, 15, 600, 70));

  if (script) {
    return [
      `Narrate the following single-host podcast script in ${languageCode}.`,
      title ? `Episode title: ${title}.` : null,
      `Delivery style: ${hostStyle}.`,
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
    `Delivery style: ${hostStyle}.`,
    "Brief:",
    brief,
  ].filter(Boolean).join('\n');
}

function buildPodcastMusicPrompt(options: PodcastGenerationOptions): string {
  const explicitPrompt = clipText(options.musicPrompt, 2000);
  if (explicitPrompt) return explicitPrompt;

  const title = clipText(options.title, 140);
  const brief = clipText(options.brief || options.script, 240);
  const hostStyle = clipText(options.hostStyle, 140);
  const topicHint = [title, brief].filter(Boolean).join(' | ');

  return [
    "A subtle instrumental podcast background bed.",
    "Warm, modern, immersive, supportive and never distracting.",
    "No vocals, no spoken word, no lead singer, no aggressive drops.",
    "Soft pulse, light texture, elegant intro, gentle ending.",
    hostStyle ? `Mood cues: ${hostStyle}.` : null,
    topicHint ? `Topic cues: ${topicHint}.` : null,
  ].filter(Boolean).join(' ');
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

async function getAudioDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await runLocalCommand('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const durationSeconds = Number(stdout.trim());
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Impossible de mesurer la duree audio de ${filePath}.`);
  }
  return durationSeconds;
}

async function mixPodcastEpisodeAudio(options: {
  voicePath: string;
  musicPath: string;
  outputPath: string;
  introSeconds: number;
  outroSeconds: number;
  musicVolume: number;
  outputExtension: 'mp3' | 'wav';
}): Promise<{ buffer: Buffer; durationSeconds: number }> {
  const voiceDurationSeconds = await getAudioDurationSeconds(options.voicePath);
  const introSeconds = clampNumber(options.introSeconds, 0, 12, 1.2);
  const outroSeconds = clampNumber(options.outroSeconds, 0, 12, 1.6);
  const musicVolume = clampNumber(options.musicVolume, 0.02, 0.6, 0.12);
  const totalDurationSeconds = Number((voiceDurationSeconds + introSeconds + outroSeconds).toFixed(3));
  const fadeOutDuration = Math.min(Math.max(outroSeconds, 0.6), 3);
  const fadeOutStart = Math.max(0, totalDurationSeconds - fadeOutDuration);
  const delayMs = Math.round(introSeconds * 1000);
  const filterGraph = [
    `[0:a]volume=${musicVolume.toFixed(3)},atrim=0:${totalDurationSeconds.toFixed(3)},afade=t=in:st=0:d=0.35,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOutDuration.toFixed(3)}[bed]`,
    `[1:a]adelay=${delayMs}:all=true,volume=1.18[voice]`,
    '[bed][voice]amix=inputs=2:duration=first:dropout_transition=0,aresample=48000[aout]',
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

  await runLocalCommand('ffmpeg', ffmpegArgs);
  return {
    buffer: fs.readFileSync(options.outputPath),
    durationSeconds: totalDurationSeconds,
  };
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

  const model = String(options.model || DEFAULT_TTS_MODEL).trim() || DEFAULT_TTS_MODEL;
  const voice = String(options.voice || DEFAULT_TTS_VOICE).trim() || DEFAULT_TTS_VOICE;
  const ai = createGoogleAI(model);

  const result = await retryWithBackoff(() => ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        ...(options.languageCode ? { languageCode: options.languageCode } : {}),
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
      ...(typeof options.temperature === 'number' ? { temperature: options.temperature } : {}),
    },
  }));

  const part = extractFirstInlinePart(result, 'audio');
  if (!part?.inlineData?.data) {
    throw new Error("Le modele TTS n'a renvoye aucun flux audio exploitable.");
  }

  const sourceMimeType = String(part.inlineData.mimeType || '').toLowerCase();
  const pcmBuffer = decodeBinaryData(part.inlineData.data);
  const wavBuffer = sourceMimeType.includes('wav')
    ? pcmBuffer
    : pcmToWavBuffer(pcmBuffer);

  return {
    buffer: wavBuffer,
    mimeType: 'audio/wav',
    fileExtension: 'wav',
    model,
    metadata: {
      voice,
      languageCode: options.languageCode,
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
  const narrationPrompt = buildPodcastNarrationPrompt(options);
  const musicPrompt = buildPodcastMusicPrompt(options);
  const ttsModel = String(options.ttsModel || DEFAULT_PODCAST_TTS_MODEL).trim() || DEFAULT_PODCAST_TTS_MODEL;
  const musicModel = String(options.musicModel || DEFAULT_LYRIA_MODEL).trim() || DEFAULT_LYRIA_MODEL;
  const outputExtension = options.outputExtension === 'wav' ? 'wav' : 'mp3';

  const voiceArtifact = await generateGeminiTtsBinary({
    prompt: narrationPrompt,
    model: ttsModel,
    voice: options.voice,
    languageCode: options.languageCode,
  });
  const musicArtifact = await generateLyriaBinary({
    prompt: musicPrompt,
    model: musicModel,
    negativePrompt: options.negativeMusicPrompt,
    seed: options.musicSeed,
    sampleCount: options.musicSampleCount,
    location: options.musicLocation,
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cowork-podcast-'));
  const voicePath = path.join(tempDir, `voice.${voiceArtifact.fileExtension}`);
  const musicPath = path.join(tempDir, `music.${musicArtifact.fileExtension}`);
  const outputPath = path.join(tempDir, `podcast.${outputExtension}`);
  fs.writeFileSync(voicePath, voiceArtifact.buffer);
  fs.writeFileSync(musicPath, musicArtifact.buffer);
  const voiceDurationSeconds = await getAudioDurationSeconds(voicePath);

  try {
    const mixed = await mixPodcastEpisodeAudio({
      voicePath,
      musicPath,
      outputPath,
      introSeconds: clampNumber(options.introSeconds, 0, 12, 1.2),
      outroSeconds: clampNumber(options.outroSeconds, 0, 12, 1.6),
      musicVolume: clampNumber(options.musicVolume, 0.02, 0.6, 0.12),
      outputExtension,
    });

    return {
      finalArtifact: {
        buffer: mixed.buffer,
        mimeType: outputExtension === 'wav' ? 'audio/wav' : 'audio/mpeg',
        fileExtension: outputExtension,
        model: `${ttsModel}+${musicModel}`,
        metadata: {
          voice: String(voiceArtifact.metadata?.voice || ''),
          languageCode: String(voiceArtifact.metadata?.languageCode || ''),
          voiceDurationSeconds: Number(voiceDurationSeconds.toFixed(3)),
          finalDurationSeconds: Number(mixed.durationSeconds.toFixed(3)),
        },
      },
      voiceArtifact,
      musicArtifact,
      narrationPrompt,
      musicPrompt,
      voiceDurationSeconds,
      finalDurationSeconds: mixed.durationSeconds,
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

export const __podcastMediaInternals = {
  buildPodcastNarrationPrompt,
  buildPodcastMusicPrompt,
};
