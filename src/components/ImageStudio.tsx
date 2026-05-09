import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  Clock3,
  Download,
  Globe2,
  Grid2X2,
  History,
  Image as ImageIcon,
  Images,
  Layers3,
  ListPlus,
  Loader2,
  Maximize2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import {
  IMAGE_MODEL_OPTIONS,
  getImageModelAspectRatioOptions,
  getImageModelBackgroundOptions,
  getImageModelDefaultAspectRatio,
  getImageModelDefaultBackground,
  getImageModelDefaultImageDimensions,
  getImageModelDefaultImageQuality,
  getImageModelDefaultImageSize,
  getImageModelDefaultModeration,
  getImageModelDefaultOutputCompression,
  getImageModelDefaultOutputFormat,
  getImageModelDefaultSafetySetting,
  getImageModelDefaultThinkingLevel,
  getImageModelDimensionOptions,
  getImageModelLabel,
  getImageModelModerationOptions,
  getImageModelOption,
  getImageModelOutputFormatOptions,
  getImageModelQualityOptions,
  getImageModelSafetySettingOptions,
  getImageModelThinkingLevelOptions,
  getImageModelImageSizeOptions,
  imageModelSupportsAutoAspectRatio,
  imageModelSupportsGoogleSearch,
  imageModelSupportsIncludeThoughts,
  imageModelSupportsOutputCompression,
  isImageModelAspectRatioSupported,
  isImageModelBackgroundSupported,
  isImageModelImageSizeSupported,
  isImageModelModerationSupported,
  isImageModelOutputFormatSupported,
  isImageModelQualitySupported,
  isImageModelSafetySettingSupported,
  isImageModelThinkingLevelSupported,
  isAzureOpenAIImageModel,
} from '../../shared/image-models.js';
import { useStore } from '../store/useStore';
import { Attachment, MediaGenerationRequest, Message } from '../types';
import { buildImageHistory, type MediaHistoryEntry } from '../utils/media-gallery-history';
import {
  MediaField,
  MediaInput,
  MediaSelect,
  MediaTextarea,
  PrimaryActionButton,
  PromptSource,
  cn,
  type MediaStudioTone,
} from './MediaStudioLayout';

const imageTone: MediaStudioTone = {
  accent: '#9fe7c6',
  accentRgb: '159,231,198',
  accentInk: '#06110d',
  washRgb: '14,165,233',
  icon: ImageIcon,
};

interface ImageStudioProps {
  onGenerate: (prompt: string, request?: MediaGenerationRequest) => void;
  isLoading: boolean;
  messages: Message[];
  onImageClick: (url: string) => void;
  pendingAttachments: Attachment[];
  onAddAttachments: (files: FileList | File[]) => Promise<void>;
  onRemoveAttachment: (attachmentId: string) => void;
}

type PendingImageRun = {
  id: string;
  prompt: string;
  createdAt: number;
};

type CssVars = React.CSSProperties & Record<`--${string}`, string>;

function normalizePromptKey(value?: string) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function formatShortTime(timestamp: number) {
  if (!Number.isFinite(timestamp)) return '';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function buildPendingImageRuns(
  messages: Message[],
  images: MediaHistoryEntry[],
  isLoading: boolean,
): PendingImageRun[] {
  if (!isLoading) return [];

  const completedSourceIds = new Set(
    images
      .map((image) => image.sourceMessageId)
      .filter((id): id is string => Boolean(id)),
  );

  return [...messages]
    .sort((left, right) => left.createdAt - right.createdAt)
    .filter((message) => message.role === 'user' && message.content.trim().length > 0)
    .filter((message) => {
      if (completedSourceIds.has(message.id)) return false;

      const promptKey = normalizePromptKey(message.content);
      if (!promptKey) return false;

      return !images.some((image) => (
        image.createdAt >= message.createdAt
        && normalizePromptKey(image.prompt) === promptKey
      ));
    })
    .slice(-6)
    .reverse()
    .map((message) => ({
      id: message.id,
      prompt: message.content.trim(),
      createdAt: message.createdAt,
    }));
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
  onImageClick,
  pendingAttachments,
  onAddAttachments,
  onRemoveAttachment,
}) => {
  const { configs, setConfig } = useStore();
  const config = configs.image;
  const selectedModel = getImageModelOption(config.model);
  const isAzureImageModel = isAzureOpenAIImageModel(config.model);
  const supportsAutoRatio = imageModelSupportsAutoAspectRatio(config.model);
  const supportsGoogleSearch = imageModelSupportsGoogleSearch(config.model);
  const supportsIncludeThoughts = imageModelSupportsIncludeThoughts(config.model);
  const supportsCompression = imageModelSupportsOutputCompression(config.model);
  const aspectRatioOptions = getImageModelAspectRatioOptions(config.model);
  const imageSizeOptions = getImageModelImageSizeOptions(config.model);
  const qualityOptions = getImageModelQualityOptions(config.model);
  const dimensionOptions = getImageModelDimensionOptions(config.model);
  const outputFormatOptions = getImageModelOutputFormatOptions(config.model);
  const backgroundOptions = getImageModelBackgroundOptions(config.model);
  const moderationOptions = getImageModelModerationOptions(config.model);
  const safetySettingOptions = getImageModelSafetySettingOptions(config.model);
  const thinkingLevelOptions = getImageModelThinkingLevelOptions(config.model);

  const [prompt, setPrompt] = useState('');
  const [queuedPrompts, setQueuedPrompts] = useState<string[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allImages = useMemo(() => buildImageHistory(messages), [messages]);
  const pendingRuns = useMemo(
    () => buildPendingImageRuns(messages, allImages, isLoading),
    [allImages, isLoading, messages],
  );
  const featuredImage = useMemo(
    () => allImages.find((image) => image.id === selectedImageId) || allImages[0] || null,
    [allImages, selectedImageId],
  );
  const visibleHistoryImages = useMemo(
    () => allImages.filter((image) => image.id !== featuredImage?.id),
    [allImages, featuredImage?.id],
  );
  const sourceImages = useMemo(
    () => pendingAttachments.filter((attachment) => attachment.type === 'image'),
    [pendingAttachments],
  );

  const draftPrompt = prompt.trim();
  const promptsToSend = useMemo(
    () => [...queuedPrompts, ...(draftPrompt ? [draftPrompt] : [])],
    [draftPrompt, queuedPrompts],
  );
  const canSubmit = promptsToSend.length > 0;
  const selectedModelLabel = selectedModel?.label || getImageModelLabel(config.model);
  const currentOutputFormat = config.imageOutputFormat || getImageModelDefaultOutputFormat(config.model);
  const currentImageDimensions = config.imageDimensions || getImageModelDefaultImageDimensions(config.model);
  const currentImageQuality = config.imageQuality || getImageModelDefaultImageQuality(config.model);
  const currentImageSize = config.imageSize || getImageModelDefaultImageSize(config.model);
  const currentSafetySetting = config.safetySetting || getImageModelDefaultSafetySetting(config.model);
  const currentThinkingLevel = config.thinkingLevel || getImageModelDefaultThinkingLevel(config.model);
  const currentBackground = config.imageBackground || getImageModelDefaultBackground(config.model);
  const currentModeration = config.imageModeration || getImageModelDefaultModeration(config.model);
  const outputCount = Math.max(1, Math.round(config.numberOfImages || 1));
  const style: CssVars = {
    '--media-accent': imageTone.accent,
    '--media-accent-rgb': imageTone.accentRgb,
    '--media-accent-ink': imageTone.accentInk || '#06110d',
    '--media-wash-rgb': imageTone.washRgb || imageTone.accentRgb,
  };

  useEffect(() => {
    if (!allImages.length) {
      setSelectedImageId(null);
      return;
    }

    if (!selectedImageId || !allImages.some((image) => image.id === selectedImageId)) {
      setSelectedImageId(allImages[0].id);
    }
  }, [allImages, selectedImageId]);

  useEffect(() => {
    if (!supportsAutoRatio && !config.aspectRatio) {
      setConfig({ aspectRatio: getImageModelDefaultAspectRatio(config.model) as any || '1:1' });
    }
  }, [config.aspectRatio, config.model, setConfig, supportsAutoRatio]);

  useEffect(() => {
    const nextConfig: Record<string, unknown> = {};
    if (!isImageModelAspectRatioSupported(config.model, config.aspectRatio || '')) {
      nextConfig.aspectRatio = getImageModelDefaultAspectRatio(config.model);
    }
    if (imageSizeOptions.length > 0 && !isImageModelImageSizeSupported(config.model, config.imageSize || '')) {
      nextConfig.imageSize = getImageModelDefaultImageSize(config.model);
    }
    if (qualityOptions.length > 0 && !isImageModelQualitySupported(config.model, config.imageQuality || '')) {
      nextConfig.imageQuality = getImageModelDefaultImageQuality(config.model);
    }
    if (outputFormatOptions.length > 0 && !isImageModelOutputFormatSupported(config.model, config.imageOutputFormat || '')) {
      nextConfig.imageOutputFormat = getImageModelDefaultOutputFormat(config.model);
    }
    if (backgroundOptions.length > 0 && !isImageModelBackgroundSupported(config.model, config.imageBackground || '')) {
      nextConfig.imageBackground = getImageModelDefaultBackground(config.model);
    }
    if (moderationOptions.length > 0 && !isImageModelModerationSupported(config.model, config.imageModeration || '')) {
      nextConfig.imageModeration = getImageModelDefaultModeration(config.model);
    }
    if (safetySettingOptions.length > 0 && !isImageModelSafetySettingSupported(config.model, config.safetySetting || '')) {
      nextConfig.safetySetting = getImageModelDefaultSafetySetting(config.model);
    }
    if (thinkingLevelOptions.length > 0 && !isImageModelThinkingLevelSupported(config.model, config.thinkingLevel || '')) {
      nextConfig.thinkingLevel = getImageModelDefaultThinkingLevel(config.model);
    }
    if (!supportsGoogleSearch && config.googleSearch) {
      nextConfig.googleSearch = false;
    }
    if (!supportsIncludeThoughts && config.imageIncludeThoughts) {
      nextConfig.imageIncludeThoughts = false;
    }
    if (isAzureImageModel && config.imageBackground === 'transparent' && config.imageOutputFormat !== 'png') {
      nextConfig.imageOutputFormat = 'png';
    }
    if (!config.imageDimensions && dimensionOptions.length > 0) {
      nextConfig.imageDimensions = getImageModelDefaultImageDimensions(config.model);
    }
    if (!config.imageOutputCompression && supportsCompression) {
      nextConfig.imageOutputCompression = getImageModelDefaultOutputCompression(config.model);
    }

    if (Object.keys(nextConfig).length > 0) {
      setConfig(nextConfig as any);
    }
  }, [
    backgroundOptions.length,
    config.aspectRatio,
    config.googleSearch,
    config.imageBackground,
    config.imageDimensions,
    config.imageIncludeThoughts,
    config.imageModeration,
    config.imageOutputCompression,
    config.imageOutputFormat,
    config.imageQuality,
    config.imageSize,
    config.model,
    config.numberOfImages,
    config.safetySetting,
    config.thinkingLevel,
    dimensionOptions.length,
    imageSizeOptions.length,
    isAzureImageModel,
    moderationOptions.length,
    outputFormatOptions.length,
    qualityOptions.length,
    safetySettingOptions.length,
    setConfig,
    supportsCompression,
    supportsGoogleSearch,
    supportsIncludeThoughts,
    thinkingLevelOptions.length,
  ]);

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleSourceFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    await onAddAttachments(imageFiles);
  };

  const addDraftToQueue = () => {
    if (!draftPrompt) return;
    setQueuedPrompts((current) => [...current, draftPrompt]);
    setPrompt('');
  };

  const removeQueuedPrompt = (index: number) => {
    setQueuedPrompts((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const batch = promptsToSend.map((item) => item.trim()).filter(Boolean);
    if (batch.length === 0) return;
    for (const cleanPrompt of batch) {
      onGenerate(cleanPrompt, { originalPrompt: cleanPrompt });
    }
    setQueuedPrompts([]);
    setPrompt('');
  };

  const settings = (
    <div className="min-h-0 border-t border-white/[0.07] pt-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--app-text)]">
          <SlidersHorizontal size={14} className="text-[var(--media-accent)]" />
          Parametres
        </div>
        <div className="text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">
          {isAzureImageModel ? 'GPT' : 'Google'}
        </div>
      </div>

      <div className="grid max-h-44 min-h-0 grid-cols-2 gap-x-3 gap-y-2 overflow-y-auto pr-1">
        <MediaField label="Modele">
          <MediaSelect
            value={config.model}
            onChange={(event) => setConfig({ model: event.target.value })}
          >
            {IMAGE_MODEL_OPTIONS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </MediaSelect>
        </MediaField>

        <MediaField label="Sorties">
          <MediaInput
            type="number"
            min={1}
            step={1}
            value={config.numberOfImages || 1}
            onChange={(event) => {
              const raw = Number(event.target.value);
              const next = Number.isFinite(raw)
                ? Math.max(1, Math.round(raw))
                : 1;
              setConfig({ numberOfImages: next });
            }}
          />
        </MediaField>

        <MediaField label="Ratio">
          <MediaSelect
            value={config.aspectRatio || ''}
            onChange={(event) => setConfig({ aspectRatio: event.target.value as any })}
          >
            {aspectRatioOptions.map((option) => (
              <option key={option.value || 'auto'} value={option.value}>
                {option.label}
              </option>
            ))}
          </MediaSelect>
        </MediaField>

        {imageSizeOptions.length > 0 && (
          <MediaField label="Taille">
            <MediaSelect
              value={currentImageSize}
              onChange={(event) => setConfig({ imageSize: event.target.value as any })}
            >
              {imageSizeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </MediaSelect>
          </MediaField>
        )}

        {isAzureImageModel && (
          <MediaField label="Resolution">
            <MediaInput
              list="gpt-image-dimensions"
              value={currentImageDimensions}
              onChange={(event) => setConfig({ imageDimensions: event.target.value })}
              placeholder="auto ou 1536x1024"
            />
            <datalist id="gpt-image-dimensions">
              {dimensionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </datalist>
          </MediaField>
        )}

        {qualityOptions.length > 0 && (
          <MediaField label="Qualite">
            <MediaSelect
              value={currentImageQuality}
              onChange={(event) => setConfig({ imageQuality: event.target.value as any })}
            >
              {qualityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </MediaSelect>
          </MediaField>
        )}

        {outputFormatOptions.length > 0 && (
          <MediaField label="Format">
            <MediaSelect
              value={currentOutputFormat}
              onChange={(event) => setConfig({ imageOutputFormat: event.target.value as any })}
            >
              {outputFormatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </MediaSelect>
          </MediaField>
        )}

        {supportsCompression && currentOutputFormat === 'jpeg' && (
          <MediaField label="Compression">
            <MediaInput
              type="number"
              min={0}
              max={100}
              step={1}
              value={config.imageOutputCompression ?? getImageModelDefaultOutputCompression(config.model)}
              onChange={(event) => {
                const raw = Number(event.target.value);
                const next = Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 100;
                setConfig({ imageOutputCompression: next });
              }}
            />
          </MediaField>
        )}

        {backgroundOptions.length > 0 && (
          <MediaField label="Fond">
            <MediaSelect
              value={currentBackground}
              onChange={(event) => setConfig({ imageBackground: event.target.value as any })}
            >
              {backgroundOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </MediaSelect>
          </MediaField>
        )}

        {moderationOptions.length > 0 && (
          <MediaField label="Moderation">
            <MediaSelect
              value={currentModeration}
              onChange={(event) => setConfig({ imageModeration: event.target.value as any })}
            >
              {moderationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </MediaSelect>
          </MediaField>
        )}

        {safetySettingOptions.length > 0 && (
          <MediaField label="Securite">
            <MediaSelect
              value={currentSafetySetting}
              onChange={(event) => setConfig({ safetySetting: event.target.value })}
            >
              {safetySettingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </MediaSelect>
          </MediaField>
        )}

        {thinkingLevelOptions.length > 0 && (
          <MediaField label="Thinking">
            <MediaSelect
              value={currentThinkingLevel}
              onChange={(event) => setConfig({ thinkingLevel: event.target.value as any })}
            >
              {thinkingLevelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </MediaSelect>
          </MediaField>
        )}

        {supportsGoogleSearch && (
          <label className="flex h-9 min-w-0 items-center justify-between gap-3 border-b border-white/[0.12] text-xs font-semibold text-[var(--app-text)]">
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
              <Globe2 size={13} className="text-[var(--media-accent)]" />
              Search
            </span>
            <input
              type="checkbox"
              checked={Boolean(config.googleSearch)}
              onChange={(event) => setConfig({ googleSearch: event.target.checked })}
              className="h-4 w-4 accent-[var(--media-accent)]"
            />
          </label>
        )}

        {supportsIncludeThoughts && (
          <label className="flex h-9 min-w-0 items-center justify-between gap-3 border-b border-white/[0.12] text-xs font-semibold text-[var(--app-text)]">
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
              <Brain size={13} className="text-[var(--media-accent)]" />
              Thoughts
            </span>
            <input
              type="checkbox"
              checked={Boolean(config.imageIncludeThoughts)}
              onChange={(event) => setConfig({ imageIncludeThoughts: event.target.checked })}
              className="h-4 w-4 accent-[var(--media-accent)]"
            />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            void handleSourceFiles(event.target.files);
          }
          event.target.value = '';
        }}
      />

      <div
        data-image-studio-scroll="true"
        style={style}
        className="relative h-full w-full max-w-full overflow-y-auto overflow-x-hidden bg-[linear-gradient(118deg,rgba(var(--media-wash-rgb),0.09),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.018),transparent_44%),var(--app-bg)] lg:overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:64px_64px] opacity-50" />

        <div className="relative mx-auto grid min-h-full w-full max-w-[112rem] gap-3 px-3 py-3 sm:px-4 lg:h-full lg:grid-cols-[minmax(20rem,0.7fr)_minmax(0,1.5fr)_minmax(17rem,0.55fr)] lg:gap-4 lg:overflow-hidden lg:px-5">
          {allImages.length > 0 && (
            <div className="min-w-0 overflow-hidden border-b border-white/[0.08] pb-3 lg:hidden">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">
                  <History size={13} className="text-[var(--media-accent)]" />
                  Historique
                </div>
                <div className="text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">
                  {allImages.length} rendu{allImages.length > 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.slice(0, 10).map((image) => (
                  <button
                    key={`mobile-${image.id}`}
                    type="button"
                    onClick={() => setSelectedImageId(image.id)}
                    className={cn(
                      'h-16 w-16 shrink-0 overflow-hidden border',
                      selectedImageId === image.id
                        ? 'border-[var(--media-accent)]'
                        : 'border-white/[0.08]',
                    )}
                  >
                    <img src={image.url} alt={image.name || 'Image generee'} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <section className="flex min-h-[34rem] min-w-0 flex-col overflow-y-auto overflow-x-hidden border-b border-white/[0.08] pb-3 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">
                  <ImageIcon size={13} className="text-[var(--media-accent)]" />
                  Image
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-[var(--app-text)]">
                  {selectedModelLabel}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-right text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">
                <div>
                  <div className="text-[var(--app-text)]">{outputCount}</div>
                  <div>Sorties</div>
                </div>
                <div>
                  <div className="text-[var(--app-text)]">{config.aspectRatio || 'Auto'}</div>
                  <div>Ratio</div>
                </div>
                <div>
                  <div className="text-[var(--app-text)]">{sourceImages.length}</div>
                  <div>Refs</div>
                </div>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-rows-[minmax(6rem,0.82fr)_auto_auto_auto] gap-3 pt-3">
              <MediaField label="Prompt" className="min-h-0">
                <MediaTextarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="Decris l'image..."
                  rows={8}
                  className="border-l-[rgba(var(--media-accent-rgb),0.28)] text-[15px]"
                />
              </MediaField>

              <div className="min-h-0 border-t border-white/[0.07] pt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--app-text)]">
                    <Layers3 size={14} className="text-[var(--media-accent)]" />
                    Stack
                  </div>
                  <button
                    type="button"
                    onClick={addDraftToQueue}
                    disabled={!draftPrompt}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 border-b px-1 text-xs font-semibold',
                      draftPrompt
                        ? 'border-white/[0.18] text-[var(--app-text)] hover:border-[var(--media-accent)]'
                        : 'cursor-not-allowed border-white/[0.08] text-[var(--app-text-muted)]',
                    )}
                  >
                    <ListPlus size={14} />
                    Ajouter
                  </button>
                </div>

                {queuedPrompts.length > 0 ? (
                  <div className="grid max-h-24 gap-2 overflow-y-auto pr-1">
                    {queuedPrompts.map((queuedPrompt, index) => (
                      <div key={`${queuedPrompt}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-l border-white/[0.12] pl-2">
                        <span className="text-[10px] font-semibold tabular-nums text-[var(--media-accent)]">
                          {index + 1}
                        </span>
                        <span className="truncate text-xs text-[var(--app-text)]">
                          {queuedPrompt}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeQueuedPrompt(index)}
                          className="flex h-7 w-7 items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                          title="Retirer"
                          aria-label="Retirer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-10 items-center border-l border-white/[0.08] pl-3 text-xs text-[var(--app-text-muted)]">
                    Prompt direct
                  </div>
                )}
              </div>

              {settings}

              <div className="grid gap-3">
                <div className="min-h-0 border-t border-white/[0.07] pt-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-[var(--app-text)]">Refs</div>
                    <button
                      type="button"
                      onClick={handleOpenFilePicker}
                      className="inline-flex items-center gap-1.5 border-b border-white/[0.16] px-1 py-1 text-xs font-semibold text-[var(--app-text)] hover:border-[var(--media-accent)]"
                    >
                      <Upload size={15} />
                      +
                    </button>
                  </div>

                  {sourceImages.length > 0 ? (
                    <div className="grid max-h-20 grid-cols-5 gap-2 overflow-y-auto pr-1">
                      {sourceImages.map((attachment) => (
                        <div key={attachment.id} className="group relative overflow-hidden border border-white/[0.08]">
                          <button type="button" onClick={() => onImageClick(attachment.url)} className="block w-full">
                            <img src={attachment.url} alt={attachment.name || 'Image source'} className="aspect-square w-full object-cover" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveAttachment(attachment.id)}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            title="Retirer"
                            aria-label="Retirer"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenFilePicker}
                      className="flex h-12 w-full items-center justify-center border border-dashed border-white/[0.12] text-xs font-semibold text-[var(--app-text-muted)] hover:border-[rgba(var(--media-accent-rgb),0.42)] hover:text-[var(--app-text)]"
                    >
                      Deposer
                    </button>
                  )}
                </div>

                <PrimaryActionButton
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  loading={false}
                  loadingLabel="..."
                  idleLabel={promptsToSend.length > 1 ? `Generer ${promptsToSend.length}` : 'Generer'}
                  icon={Sparkles}
                  className="h-11"
                />
              </div>
            </div>
          </section>

          <main className="flex min-h-[36rem] min-w-0 flex-col overflow-hidden border-b border-white/[0.08] pb-3 lg:h-full lg:min-h-0 lg:border-b-0 lg:pb-0">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">
                  <Grid2X2 size={13} className="text-[var(--media-accent)]" />
                  Scene
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-[var(--app-text)]">
                  {featuredImage?.name || (isLoading ? 'Generation en cours' : 'Aucun rendu')}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--app-text-muted)]">
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-[var(--media-accent)]" />
                    Live
                  </>
                ) : featuredImage ? (
                  <>
                    <CheckCircle2 size={14} className="text-[var(--media-accent)]" />
                    Sauve
                  </>
                ) : (
                  <>
                    <Images size={14} />
                    Vide
                  </>
                )}
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 pt-3">
              <div className="group relative min-h-0 overflow-hidden border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),transparent_34%),rgba(0,0,0,0.2)]">
                {featuredImage ? (
                  <>
                    <button type="button" onClick={() => onImageClick(featuredImage.url)} className="block h-full w-full">
                      <img
                        src={featuredImage.url}
                        alt={featuredImage.name || 'Image generee'}
                        className="h-full w-full object-contain"
                      />
                    </button>
                    <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => onImageClick(featuredImage.url)}
                        className="inline-flex h-8 w-8 items-center justify-center bg-black/45 text-white/80 hover:text-white"
                        title="Agrandir"
                        aria-label="Agrandir"
                      >
                        <Maximize2 size={15} />
                      </button>
                      <a
                        href={featuredImage.url}
                        download={featuredImage.name || 'image-generee.png'}
                        className="inline-flex h-8 w-8 items-center justify-center bg-black/45 text-white/80 hover:text-white"
                        title="Telecharger"
                        aria-label="Telecharger"
                      >
                        <Download size={15} />
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full min-h-[22rem] flex-col items-center justify-center px-6 text-center">
                    {isLoading ? (
                      <>
                        <Loader2 size={28} className="animate-spin text-[var(--media-accent)]" />
                        <p className="mt-3 text-sm font-semibold text-[var(--app-text)]">Generation en cours</p>
                      </>
                    ) : (
                      <>
                        <Images size={28} className="text-[var(--media-accent)]" />
                        <p className="mt-3 text-sm font-semibold text-[var(--app-text)]">Aucun rendu image</p>
                      </>
                    )}
                  </div>
                )}

                {isLoading && (
                  <div className="absolute bottom-0 left-0 right-0 border-t border-white/[0.08] bg-[rgba(var(--app-bg-rgb),0.86)] px-3 py-2 backdrop-blur">
                    <div className="flex items-center gap-2 overflow-x-auto">
                      {(pendingRuns.length > 0 ? pendingRuns : Array.from({ length: Math.max(1, Math.min(4, promptsToSend.length || outputCount)) }).map((_, index) => ({
                        id: `loading-${index}`,
                        prompt: 'Generation',
                        createdAt: Date.now(),
                      }))).map((run) => (
                        <div key={run.id} className="flex min-w-[11rem] items-center gap-2 border-l border-[rgba(var(--media-accent-rgb),0.38)] pl-2">
                          <Loader2 size={13} className="shrink-0 animate-spin text-[var(--media-accent)]" />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-[var(--app-text)]">{run.prompt}</div>
                            <div className="text-[10px] text-[var(--app-text-muted)]">{formatShortTime(run.createdAt)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-2 border-t border-white/[0.07] pt-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">Prompt source</div>
                    <div className="mt-1 truncate text-xs text-[var(--app-text)]">
                      {featuredImage?.prompt || (pendingRuns[0]?.prompt ?? draftPrompt) || 'Vide'}
                    </div>
                  </div>
                  <PromptSource prompt={featuredImage?.prompt || pendingRuns[0]?.prompt || draftPrompt} title="Copie" className="shrink-0 border-t-0 pt-0" />
                </div>

                {visibleHistoryImages.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {visibleHistoryImages.slice(0, 8).map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setSelectedImageId(image.id)}
                        className="h-14 w-14 shrink-0 overflow-hidden border border-white/[0.08] hover:border-[rgba(var(--media-accent-rgb),0.55)]"
                      >
                        <img src={image.url} alt={image.name || 'Image generee'} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </main>

          <aside className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden lg:h-full lg:min-h-0 lg:border-l lg:border-white/[0.08] lg:pl-4">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">
                  <History size={13} className="text-[var(--media-accent)]" />
                  Historique
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-[var(--app-text)]">
                  {allImages.length} rendu{allImages.length > 1 ? 's' : ''}
                </div>
              </div>
              <div className="text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">
                Session
              </div>
            </div>

            {allImages.length > 0 ? (
              <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-2 content-start gap-2 overflow-y-auto pt-3 pr-1">
                {allImages.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedImageId(image.id)}
                    className={cn(
                      'group relative min-w-0 overflow-hidden border bg-black/20 text-left',
                      selectedImageId === image.id
                        ? 'border-[var(--media-accent)]'
                        : 'border-white/[0.08] hover:border-[rgba(var(--media-accent-rgb),0.5)]',
                    )}
                  >
                    <img src={image.url} alt={image.name || 'Image generee'} className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 to-transparent px-2 pb-2 pt-7">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold tabular-nums text-white/86">
                          {String(allImages.length - index).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] text-white/62">{formatShortTime(image.createdAt)}</span>
                      </div>
                      <div className="mt-1 truncate text-[11px] font-semibold text-white/90">
                        {image.shotLabel || image.name || image.prompt || 'Image'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 text-center">
                <Clock3 size={22} className="text-[var(--media-accent)]" />
                <p className="mt-3 text-sm font-semibold text-[var(--app-text)]">Aucune image dans ce fil</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
};
