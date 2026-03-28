import { type Express } from 'express';

import { normalizeLatexProvider, resolveLatexProviderBaseUrl } from '../../server/pdf/latex.js';
import { normalizeConfiguredModelId } from '../lib/config.js';
import { createGoogleAI, getVertexConfig, parseApiError, retryWithBackoff } from '../lib/google-genai.js';
import { log } from '../lib/logger.js';
import { ChatRefineSchema, ChatSchema, ImageGenRequestSchema, UploadSchema, VideoGenSchema } from '../lib/schemas.js';
import { getServiceAccountEmail, uploadToGCS } from '../lib/storage.js';

const REFINER_SYSTEM_PROMPT = `Optimise l'instruction systeme suivante pour un modele IA puissant. Sois concis.`;
const ICON_PROMPT_SYSTEM_PROMPT = `Genere un prompt d'image pour un logo minimaliste representant ce role IA.`;

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

      const modelId = req.body.model || 'gemini-2.5-flash-image';
      log.info(`Generating image for: ${prompt.substring(0, 100)}...`, { modelId, aspectRatio, numberOfImages });

      const ai = createGoogleAI(modelId);

      const config: any = {
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(numberOfImages ? { candidateCount: numberOfImages } : {}),
      };

      if (modelId.includes('gemini-3') || modelId.includes('nano-banana')) {
        if (thinkingLevel) config.thinkingLevel = thinkingLevel;
      }

      if (modelId.includes('imagen') || modelId.includes('image-preview') || modelId.includes('gemini-2.5-flash-image')) {
        if (personGeneration) config.personGeneration = personGeneration;
        if (safetySetting) config.safetyFilterLevel = safetySetting;
        if (imageSize) config.imageSize = imageSize;
      }

      const result = await retryWithBackoff(() => ai.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config
      }));

      if (!result.candidates || result.candidates.length === 0) {
        log.error('Image generation failed - no candidates', result);
        throw new Error("Le modele n'a pas genere d'image (possible blocage de securite ou quota).");
      }

      const part = result.candidates[0].content?.parts?.find((candidatePart: any) => candidatePart.inlineData);
      const base64 = (part as any)?.inlineData?.data;

      if (!base64) {
        log.error('No base64 data found in candidates', result.candidates[0]);
        throw new Error("Aucune donnee d'image (base64) n'a ete trouvee dans la reponse.");
      }

      const buffer = Buffer.from(base64, 'base64');
      const fileName = `generated-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      const url = await uploadToGCS(buffer, fileName, 'image/png');

      res.json({ url, base64: `data:image/png;base64,${base64}` });
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

  app.post('/api/generate-video', async (req, res) => {
    try {
      VideoGenSchema.parse(req.body);
      res.status(501).json({ error: 'Non implemente', message: 'La generation video Veo necessite une configuration GCS specifique.' });
    } catch (error) {
      res.status(500).json({ error: 'Video failed', message: String(error) });
    }
  });

  app.get('/api/metadata', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).json({ error: 'URL manquante' });

      const response = await fetch(url);
      const html = await response.text();
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      let title = titleMatch ? titleMatch[1] : 'Video YouTube';

      title = title.replace(/ - YouTube$/i, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

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
      const { message, history, config, refinedSystemInstruction } = ChatSchema.parse(req.body);

      const modelId = normalizeConfiguredModelId(config.model, 'gemini-3.1-pro-preview');
      const ai = createGoogleAI(modelId);
      const systemPromptText = refinedSystemInstruction || config.systemInstruction || '';

      const contents = [...history, { role: 'user' as const, parts: [{ text: message }] }].map((messageItem: any) => ({
        role: messageItem.role,
        parts: (messageItem.parts || []).map((partItem: any) => {
          const part: any = {};
          if (partItem.text) part.text = partItem.text;
          if (partItem.inlineData) part.inlineData = partItem.inlineData;
          if (partItem.fileData) part.fileData = partItem.fileData;
          return part;
        })
      }));

      const tools: any[] = [];
      if (config.googleSearch) tools.push({ googleSearch: {} });
      if (config.codeExecution) tools.push({ codeExecution: {} });

      const genConfig: any = {
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        maxOutputTokens: config.maxOutputTokens || 65536,
      };
      if (systemPromptText) genConfig.systemInstruction = systemPromptText;
      if (tools.length > 0) genConfig.tools = tools;

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
