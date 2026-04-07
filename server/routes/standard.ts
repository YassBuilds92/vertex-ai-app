import { type Express, type Response } from 'express';

import { normalizeLatexProvider, resolveLatexProviderBaseUrl } from '../pdf/latex.js';
import { generateAgentBlueprintFromBrief } from '../lib/agents.js';
import { createGeneratedAppFromBrief, createGeneratedAppFromBriefWithProgress, publishGeneratedApp } from '../lib/generated-apps.js';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_LYRIA_MODEL,
  DEFAULT_TTS_MODEL,
  generateGeminiTtsBinary,
  generateImageBinary,
  generateImageBinaries,
  generateLyriaBinary,
} from '../lib/media-generation.js';
import { normalizeConfiguredModelId } from '../lib/config.js';
import { buildThinkingConfig, createGoogleAI, getVertexConfig, parseApiError, retryWithBackoff } from '../lib/google-genai.js';
import { log } from '../lib/logger.js';
import {
  AgentCreateSchema,
  AudioGenRequestSchema,
  ChatRefineSchema,
  ChatSchema,
  GeneratedAppCreateSchema,
  GeneratedAppPublishSchema,
  ImageGenRequestSchema,
  MusicGenRequestSchema,
  UploadSchema,
  VideoGenSchema,
} from '../lib/schemas.js';
import { getServiceAccountEmail, uploadToGCSWithMetadata } from '../lib/storage.js';
import { buildModelContentsFromRequest } from '../lib/chat-parts.js';

const REFINER_PROMPTS: Record<string, string> = {
  image: `Tu es un expert en direction artistique et generation d'images par IA.
Reecris ce prompt pour le rendre plus riche, precis et evocateur.
Ajoute : style photographique ou artistique, lumiere, palette de couleurs, texture, composition, profondeur de champ, ambiance.
Retourne UNIQUEMENT le prompt reecrit. Pas d'explication, pas de guillemets.`,

  video: `Tu es un directeur de la photographie et un expert en generation video IA.
Reecris ce prompt pour le rendre cinematographique.
Ajoute : mouvement de camera (travelling, panoramique, plan fixe...), rythme, atmosphere, lumiere, couleur, espace sonore implicite.
Retourne UNIQUEMENT le prompt reecrit. Pas d'explication.`,

  audio: `Tu es un directeur artistique audio et un expert en synthese vocale.
Reecris ce texte pour le rendre plus naturel a lire a voix haute : rythme, ponctuation, fluidite.
Ne change pas le sens. Retourne UNIQUEMENT le texte ameliore.`,

  lyria: `Tu es un compositeur et un prompt engineer expert en generation musicale par IA.
Reecris ce prompt pour le rendre plus precis musicalement.
Ajoute : instruments, tempo, dynamique, texture sonore, ambiance emotionnelle, influences stylistiques.
Retourne UNIQUEMENT le prompt reecrit. Pas d'explication.`,

  chat: `Tu es un expert en communication avec les LLMs.
Reecris ce message pour le rendre plus clair, precis et actionnable pour un modele IA.
Conserve l'intention originale. Retourne UNIQUEMENT le message reecrit.`,

  cowork: `Tu es un expert en orchestration d'agents IA autonomes.
Reecris cette mission pour la rendre plus precise, avec des objectifs clairs et mesurables.
Retourne UNIQUEMENT la mission reecrite.`,
};
const ICON_PROMPT_SYSTEM_PROMPT = `Genere un prompt d'image pour un logo minimaliste representant ce role IA.`;

function createUploadFileName(prefix: string, extension: string) {
  const safeExtension = extension.startsWith('.') ? extension : `.${extension}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExtension}`;
}

function extractYouTubeVideoId(url: string) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, '');

    if (hostname.includes('youtu.be')) {
      const candidate = pathname.split('/').filter(Boolean)[0];
      return candidate || null;
    }

    if (hostname.includes('youtube.com')) {
      const watchId = parsed.searchParams.get('v');
      if (watchId) return watchId;

      const segments = pathname.split('/').filter(Boolean);
      const index = segments.findIndex((segment) => ['shorts', 'live', 'embed'].includes(segment));
      if (index >= 0 && segments[index + 1]) {
        return segments[index + 1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getYouTubeThumbnailUrl(url: string) {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;
}

function writeSseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeSseData(res: Response, data: unknown) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function createTraceId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type GeneratedAppStreamBuilder = (
  brief: string,
  source: 'manual' | 'cowork',
  options?: Parameters<typeof createGeneratedAppFromBriefWithProgress>[2]
) => ReturnType<typeof createGeneratedAppFromBriefWithProgress>;

export async function streamGeneratedAppCreation(options: {
  res: Response;
  brief: string;
  transcript?: Parameters<typeof createGeneratedAppFromBriefWithProgress>[2]['transcript'];
  source?: 'manual' | 'cowork';
  createManifest?: GeneratedAppStreamBuilder;
}) {
  const {
    res,
    brief,
    transcript,
    source = 'manual',
    createManifest = createGeneratedAppFromBriefWithProgress,
  } = options;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let closed = false;
  const heartbeat = setInterval(() => {
    if (!closed) {
      res.write(': keep-alive\n\n');
    }
  }, 15000);

  res.on('close', () => {
    closed = true;
    clearInterval(heartbeat);
  });

  const emit = (event: string, data: unknown) => {
    if (closed) return;
    writeSseEvent(res, event, data);
  };

  try {
    const result = await createManifest(brief, source, {
      transcript,
      onProgress: (progress) => emit('generated_app_creation', progress),
    });

    if (result.status === 'clarification_requested') {
      emit('generated_app_clarification', {
        question: result.question,
        transcript: result.transcript,
      });
      emit('done', { ok: true, status: 'clarification_requested' });
      return;
    }

    emit('generated_app_manifest', { manifest: result.manifest });
    emit('done', { ok: true, manifestId: result.manifest.id, status: 'completed' });
  } catch (error) {
    emit('error', {
      message: parseApiError(error),
    });
  } finally {
    clearInterval(heartbeat);
    if (!closed) {
      res.end();
    }
  }
}

export function registerStandardApiRoutes(app: Express) {
  app.get('/api/status', (_req, res) => {
    const config = getVertexConfig();
    const latexProvider = normalizeLatexProvider(process.env.LATEX_RENDER_PROVIDER);
    res.json({
      isVertexConfigured: config.isConfigured,
      isGcsConfigured: !!process.env.VERTEX_GCS_OUTPUT_URI,
      latexRenderer: {
        provider: latexProvider,
        baseUrl: resolveLatexProviderBaseUrl(latexProvider, process.env.LATEX_RENDER_BASE_URL),
        timeoutMs: Number(process.env.LATEX_RENDER_TIMEOUT_MS || 30000),
      },
      serviceAccount: getServiceAccountEmail(),
      envKeys: Object.keys(process.env).filter(k => ['VERTEX_PROJECT_ID', 'VERTEX_LOCATION', 'GOOGLE_APPLICATION_CREDENTIALS_JSON', 'LATEX_RENDER_PROVIDER', 'LATEX_RENDER_BASE_URL', 'LATEX_RENDER_TIMEOUT_MS'].includes(k))
    });
  });

  app.post('/api/refine', async (req, res) => {
    try {
      const { prompt, type, mode } = ChatRefineSchema.parse(req.body);
      const modelId = 'gemini-3.1-flash-lite-preview';
      const ai = createGoogleAI(modelId);
      const systemPrompt = type === 'icon'
        ? ICON_PROMPT_SYSTEM_PROMPT
        : (REFINER_PROMPTS[mode || 'chat'] || REFINER_PROMPTS.chat);

      const result = await retryWithBackoff(() => ai.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
        }
      }));

      res.json({ refinedInstruction: result.text || '' });
    } catch (error) {
      const cleanError = parseApiError(error);
      log.error('Refine error', cleanError);
      res.status(500).json({ error: 'Refine failed', message: "Echec de l'optimisation", details: cleanError });
    }
  });

  app.post('/api/generate-image', async (req, res) => {
    try {
      const { prompt, aspectRatio, numberOfImages, imageSize, personGeneration, safetySetting, thinkingLevel } = ImageGenRequestSchema.parse(req.body);
      const modelId = req.body.model || DEFAULT_IMAGE_MODEL;
      log.info(`Generating image for: ${prompt.substring(0, 100)}...`, { modelId, aspectRatio, numberOfImages });

      if (numberOfImages && numberOfImages > 1) {
        const artifacts = await generateImageBinaries({
          prompt, model: modelId, aspectRatio, numberOfImages, imageSize, personGeneration, safetySetting, thinkingLevel,
        });
        const images = await Promise.all(artifacts.map(async (artifact) => {
          const fileName = createUploadFileName('generated-image', artifact.fileExtension);
          const uploaded = await uploadToGCSWithMetadata(artifact.buffer, fileName, artifact.mimeType);
          return {
            url: uploaded.url,
            storageUri: uploaded.storageUri,
            mimeType: artifact.mimeType,
          };
        }));
        res.json({ images, model: modelId });
      } else {
        const artifact = await generateImageBinary({
          prompt, model: modelId, aspectRatio, numberOfImages, imageSize, personGeneration, safetySetting, thinkingLevel,
        });
        const fileName = createUploadFileName('generated-image', artifact.fileExtension);
        const uploaded = await uploadToGCSWithMetadata(artifact.buffer, fileName, artifact.mimeType);
        res.json({
          url: uploaded.url,
          storageUri: uploaded.storageUri,
          mimeType: artifact.mimeType,
          model: artifact.model,
        });
      }
    } catch (error) {
      const cleanError = parseApiError(error);
      log.error('Image gen error', cleanError);
      res.status(500).json({
        error: 'Image failed',
        message: "Echec de la generation d'image",
        details: cleanError
      });
    }
  });

  app.post('/api/generate-audio', async (req, res) => {
    try {
      const {
        prompt,
        model,
        ttsVoice,
        ttsLanguageCode,
        ttsStyleInstructions,
        temperature,
      } = AudioGenRequestSchema.parse(req.body);
      const directedPrompt = ttsStyleInstructions
        ? [
            `Style instructions: ${ttsStyleInstructions}.`,
            'Text:',
            prompt,
          ].join('\n')
        : prompt;
      const artifact = await generateGeminiTtsBinary({
        prompt: directedPrompt,
        model: model || DEFAULT_TTS_MODEL,
        voice: ttsVoice,
        languageCode: ttsLanguageCode,
        temperature,
      });
      const fileName = createUploadFileName('generated-audio', artifact.fileExtension);
      const uploaded = await uploadToGCSWithMetadata(artifact.buffer, fileName, artifact.mimeType);

      res.json({
        url: uploaded.url,
        storageUri: uploaded.storageUri,
        mimeType: artifact.mimeType,
        model: artifact.model,
        voice: artifact.metadata?.voice,
        languageCode: artifact.metadata?.languageCode,
      });
    } catch (error) {
      const cleanError = parseApiError(error);
      log.error('Audio gen error', cleanError);
      res.status(500).json({
        error: 'Audio failed',
        message: "Echec de la generation audio",
        details: cleanError,
      });
    }
  });

  app.post('/api/generate-music', async (req, res) => {
    try {
      const { prompt, model, negativePrompt, seed, sampleCount, location } = MusicGenRequestSchema.parse(req.body);
      const artifact = await generateLyriaBinary({
        prompt,
        model: model || DEFAULT_LYRIA_MODEL,
        negativePrompt,
        seed,
        sampleCount,
        location,
      });
      const fileName = createUploadFileName('generated-music', artifact.fileExtension);
      const uploaded = await uploadToGCSWithMetadata(artifact.buffer, fileName, artifact.mimeType);

      res.json({
        url: uploaded.url,
        storageUri: uploaded.storageUri,
        mimeType: artifact.mimeType,
        model: artifact.model,
        location: artifact.metadata?.location,
      });
    } catch (error) {
      const cleanError = parseApiError(error);
      log.error('Music gen error', cleanError);
      res.status(500).json({
        error: 'Music failed',
        message: "Echec de la generation musicale",
        details: cleanError,
      });
    }
  });

  app.post('/api/generate-video', async (req, res) => {
    try {
      VideoGenSchema.parse(req.body);
      res.status(501).json({ error: 'Non implemente', message: 'La generation video Veo necessite une configuration GCS specifique.' });
    } catch (error) {
      res.status(500).json({ error: 'Video failed', message: String(error) });
    }
  });

  app.post('/api/agents/create', async (req, res) => {
    try {
      const { brief, source } = AgentCreateSchema.parse(req.body);
      const blueprint = await generateAgentBlueprintFromBrief(brief, source || 'manual');
      res.json({ blueprint });
    } catch (error) {
      const cleanError = parseApiError(error);
      log.error('Agent create error', cleanError);
      res.status(500).json({ error: 'Agent create failed', message: "Echec de creation d'agent", details: cleanError });
    }
  });

  app.post('/api/generated-apps/create', async (req, res) => {
    try {
      const { brief = '', source } = GeneratedAppCreateSchema.parse(req.body);
      const manifest = await createGeneratedAppFromBrief(brief, source || 'manual');
      res.json({ manifest });
    } catch (error) {
      const cleanError = parseApiError(error);
      log.error('Generated app create error', cleanError);
      const status = /demande encore une clarification/i.test(cleanError) ? 409 : 500;
      res.status(status).json({ error: 'Generated app create failed', message: "Echec de creation d'app", details: cleanError });
    }
  });

  app.post('/api/generated-apps/create/stream', async (req, res) => {
    try {
      const { brief = '', transcript, source } = GeneratedAppCreateSchema.parse(req.body);
      await streamGeneratedAppCreation({
        res,
        brief,
        transcript,
        source: source || 'manual',
      });
    } catch (error) {
      const cleanError = parseApiError(error);
      log.error('Generated app create stream error', cleanError);
      res.status(500).json({ error: 'Generated app create stream failed', message: "Echec de creation stream d'app", details: cleanError });
    }
  });

  app.post('/api/generated-apps/publish', async (req, res) => {
    try {
      const { manifest } = GeneratedAppPublishSchema.parse(req.body);
      const publishedManifest = publishGeneratedApp(manifest as Parameters<typeof publishGeneratedApp>[0]);
      res.json({ manifest: publishedManifest });
    } catch (error) {
      const cleanError = parseApiError(error);
      log.error('Generated app publish error', cleanError);
      res.status(500).json({ error: 'Generated app publish failed', message: "Echec de publication d'app", details: cleanError });
    }
  });

  app.get('/api/metadata', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).json({ error: 'URL manquante' });

      let title = 'Video YouTube';
      let thumbnail = getYouTubeThumbnailUrl(url);

      if (/^(https?:\/\/)?((www|m)\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const oembedResponse = await fetch(oembedUrl, {
          headers: { Accept: 'application/json' },
        });

        if (oembedResponse.ok) {
          const payload = await oembedResponse.json().catch(() => null);
          if (payload && typeof payload.title === 'string' && payload.title.trim()) {
            title = payload.title.trim();
          }
          if (payload && typeof payload.thumbnail_url === 'string' && payload.thumbnail_url.trim()) {
            thumbnail = payload.thumbnail_url.trim();
          }
        }
      }

      if (title === 'Video YouTube') {
        const response = await fetch(url);
        const html = await response.text();
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const thumbnailMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i);
        title = titleMatch ? titleMatch[1] : 'Video YouTube';
        title = title.replace(/ - YouTube$/i, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
        if (!thumbnail && thumbnailMatch?.[1]) {
          thumbnail = thumbnailMatch[1];
        }
      }

      res.json({ title, thumbnail });
    } catch (error) {
      log.error('Metadata fetch error', error);
      res.status(500).json({ error: 'Failed to fetch metadata' });
    }
  });

  app.post('/api/upload', async (req, res) => {
    try {
      const { base64, fileName, mimeType } = UploadSchema.parse(req.body);

      const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
      const buffer = Buffer.from(pureBase64, 'base64');
      const uploaded = await uploadToGCSWithMetadata(buffer, fileName, mimeType);

      res.json({
        url: uploaded.url,
        storageUri: uploaded.storageUri,
      });
    } catch (error) {
      log.error('Upload error', error);
      res.status(500).json({ error: 'Upload failed', message: String(error) });
    }
  });

  app.post('/api/chat', async (req, res) => {
    let headersSent = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const traceId = createTraceId('chat');
    res.on('close', () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    });
    try {
      const { message, history, attachments, config, refinedSystemInstruction } = ChatSchema.parse(req.body);

      const modelId = normalizeConfiguredModelId(config.model, 'gemini-3.1-pro-preview');
      const ai = createGoogleAI(modelId);
      const systemPromptText = refinedSystemInstruction || config.systemInstruction || '';

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Studio-Trace-Id', traceId);
      headersSent = true;
      res.flushHeaders?.();
      writeSseData(res, {
        debug: {
          traceId,
          stage: 'request_accepted',
          modelId,
          historyCount: history.length,
          attachmentCount: attachments?.length || 0,
        },
      });
      heartbeat = setInterval(() => {
        res.write(': keep-alive\n\n');
      }, 15000);

      log.info('Chat request accepted', {
        traceId,
        modelId,
        historyCount: history.length,
        attachmentCount: attachments?.length || 0,
      });

      const contents = await buildModelContentsFromRequest({
        history,
        message,
        attachments,
      });

      writeSseData(res, {
        debug: {
          traceId,
          stage: 'contents_built',
          turnCount: contents.length,
          currentPartCount: contents[contents.length - 1]?.parts?.length || 0,
        },
      });

      const tools: any[] = [];
      if (config.googleSearch) tools.push({ googleSearch: {} });
      if (config.codeExecution) tools.push({ codeExecution: {} });

      const genConfig: any = {
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        maxOutputTokens: config.maxOutputTokens || 65536,
      };
      const thinkingConfig = buildThinkingConfig(modelId, {
        thinkingLevel: config.thinkingLevel,
        maxThoughtTokens: config.maxThoughtTokens,
        includeThoughts: true,
      });
      if (systemPromptText) genConfig.systemInstruction = systemPromptText;
      if (tools.length > 0) genConfig.tools = tools;
      if (thinkingConfig) genConfig.thinkingConfig = thinkingConfig;

      writeSseData(res, {
        debug: {
          traceId,
          stage: 'model_stream_start',
          toolCount: tools.length,
          thinkingLevel: config.thinkingLevel || 'high',
        },
      });

      const response = await ai.models.generateContentStream({
        model: modelId,
        contents,
        config: genConfig,
      });

      let sawFirstChunk = false;
      for await (const chunk of response) {
        if (!sawFirstChunk) {
          sawFirstChunk = true;
          writeSseData(res, {
            debug: {
              traceId,
              stage: 'first_chunk_received',
            },
          });
        }

        const candidates = (chunk as any).candidates;
        if (candidates?.[0]?.finishReason && candidates[0].finishReason !== 'STOP' && candidates[0].finishReason !== 'FINISH_REASON_UNSPECIFIED') {
          log.warn(`Stream finished with reason: ${candidates[0].finishReason}`, { model: modelId });
          if (candidates[0].finishReason === 'MAX_TOKENS') {
            res.write(`data: ${JSON.stringify({ error: 'Limite de tokens atteinte. La reponse est peut-etre incomplete.' })}\n\n`);
          }
        }

        if (candidates?.[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.thought) {
              const thoughtText = (part as any).text || part.text || '';
              if (thoughtText) {
                res.write(`data: ${JSON.stringify({ thoughts: thoughtText })}\n\n`);
              }
            } else if (part.text) {
              res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
            }
          }
        } else if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      writeSseData(res, {
        debug: {
          traceId,
          stage: 'stream_completed',
        },
      });
      if (heartbeat) clearInterval(heartbeat);
      res.end();
    } catch (error) {
      const cleanError = parseApiError(error);
      if (heartbeat) clearInterval(heartbeat);
      log.error('Chat error', {
        traceId,
        error: cleanError,
      });
      if (!headersSent) {
        res.status(500).json({ error: 'Chat failed', message: cleanError });
      } else {
        writeSseData(res, {
          error: cleanError,
          debug: {
            traceId,
            stage: 'error',
            message: cleanError,
          },
        });
        res.end();
      }
    }
  });
}
