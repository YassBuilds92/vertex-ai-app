import { type Express } from 'express';

import { normalizeLatexProvider, resolveLatexProviderBaseUrl } from '../pdf/latex.js';
import { generateAgentBlueprintFromBrief } from '../lib/agents.js';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_LYRIA_MODEL,
  DEFAULT_TTS_MODEL,
  generateGeminiTtsBinary,
  generateImageBinary,
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
  ImageGenRequestSchema,
  MusicGenRequestSchema,
  UploadSchema,
  VideoGenSchema,
} from '../lib/schemas.js';
import { getServiceAccountEmail, uploadToGCS } from '../lib/storage.js';
import { buildModelContentsFromRequest } from '../lib/chat-parts.js';

const REFINER_SYSTEM_PROMPT = `Optimise l'instruction systeme suivante pour un modele IA puissant. Sois concis.`;
const ICON_PROMPT_SYSTEM_PROMPT = `Genere un prompt d'image pour un logo minimaliste representant ce role IA.`;

function createUploadFileName(prefix: string, extension: string) {
  const safeExtension = extension.startsWith('.') ? extension : `.${extension}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExtension}`;
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
      const { prompt, type } = ChatRefineSchema.parse(req.body);
      const modelId = 'gemini-3.1-flash-lite-preview';
      const ai = createGoogleAI(modelId);
      const systemPrompt = type === 'icon' ? ICON_PROMPT_SYSTEM_PROMPT : REFINER_SYSTEM_PROMPT;

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
      const artifact = await generateImageBinary({
        prompt,
        model: modelId,
        aspectRatio,
        numberOfImages,
        imageSize,
        personGeneration,
        safetySetting,
        thinkingLevel,
      });
      const fileName = createUploadFileName('generated-image', artifact.fileExtension);
      const url = await uploadToGCS(artifact.buffer, fileName, artifact.mimeType);
      res.json({
        url,
        base64: `data:${artifact.mimeType};base64,${artifact.buffer.toString('base64')}`,
        mimeType: artifact.mimeType,
        model: artifact.model,
      });
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
      const url = await uploadToGCS(artifact.buffer, fileName, artifact.mimeType);

      res.json({
        url,
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
      const url = await uploadToGCS(artifact.buffer, fileName, artifact.mimeType);

      res.json({
        url,
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

  app.get('/api/metadata', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).json({ error: 'URL manquante' });

      let title = 'Video YouTube';

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
        }
      }

      if (title === 'Video YouTube') {
        const response = await fetch(url);
        const html = await response.text();
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        title = titleMatch ? titleMatch[1] : 'Video YouTube';
        title = title.replace(/ - YouTube$/i, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
      }

      res.json({ title });
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
      const url = await uploadToGCS(buffer, fileName, mimeType);

      res.json({ url });
    } catch (error) {
      log.error('Upload error', error);
      res.status(500).json({ error: 'Upload failed', message: String(error) });
    }
  });

  app.post('/api/chat', async (req, res) => {
    let headersSent = false;
    try {
      const { message, history, attachments, config, refinedSystemInstruction } = ChatSchema.parse(req.body);

      const modelId = normalizeConfiguredModelId(config.model, 'gemini-3.1-pro-preview');
      const ai = createGoogleAI(modelId);
      const systemPromptText = refinedSystemInstruction || config.systemInstruction || '';
      const contents = await buildModelContentsFromRequest({
        history,
        message,
        attachments,
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

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      headersSent = true;

      const response = await ai.models.generateContentStream({
        model: modelId,
        contents,
        config: genConfig,
      });

      for await (const chunk of response) {
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

      res.end();
    } catch (error) {
      log.error('Chat error', error);
      if (!headersSent) {
        res.status(500).json({ error: 'Chat failed', message: String(error) });
      } else {
        res.write(`data: ${JSON.stringify({ error: String(error) })}\n\n`);
        res.end();
      }
    }
  });
}
