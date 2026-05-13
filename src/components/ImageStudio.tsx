import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Brain,
  CheckCircle2,
  ChevronDown,
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
  Settings2,
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
  accent: '#a78bfa',
  accentRgb: '167,139,250',
  accentInk: '#0d0718',
  washRgb: '99,102,241',
  icon: ImageIcon,
};

const IMAGE_TIMING_STORAGE_KEY = 'studio-image-generation-timing-v1';
const MIN_IMAGE_TIMING_SAMPLE_MS = 6_000;

interface ImageStudioProps {
  onGenerate: (prompt: string, request?: MediaGenerationRequest) => void;
  isLoading: boolean;
  messages: Message[];
  archiveImages?: MediaHistoryEntry[];
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

type TimingRecord = {
  averageMs: number;
  runs: number;
  updatedAt: number;
};

type ImageBatchInfo = {
  key: string;
  count: number;
  index: number;
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

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readTimingStore(): Record<string, TimingRecord> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(IMAGE_TIMING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, TimingRecord> : {};
  } catch {
    return {};
  }
}

function writeTimingStore(store: Record<string, TimingRecord>) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(IMAGE_TIMING_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Estimation only. Ignore quota/private-mode failures.
  }
}

function getStoredDurationMs(key: string) {
  const record = readTimingStore()[key];
  if (!record?.averageMs || !Number.isFinite(record.averageMs)) return null;
  return record.averageMs >= MIN_IMAGE_TIMING_SAMPLE_MS ? record.averageMs : null;
}

function recordGenerationDuration(key: string, durationMs: number) {
  if (!key || !Number.isFinite(durationMs) || durationMs < MIN_IMAGE_TIMING_SAMPLE_MS) return;
  const store = readTimingStore();
  const previous = store[key];
  const runs = Math.min(50, (previous?.runs || 0) + 1);
  const alpha = previous ? 0.35 : 1;
  const averageMs = previous
    ? Math.round(previous.averageMs * (1 - alpha) + durationMs * alpha)
    : Math.round(durationMs);
  store[key] = {
    averageMs,
    runs,
    updatedAt: Date.now(),
  };
  writeTimingStore(store);
}

function estimateFallbackDurationMs(model: string, outputCount: number, referenceCount: number, quality?: string, size?: string) {
  const isAzure = isAzureOpenAIImageModel(model);
  const base = isAzure ? 32_000 : 24_000;
  const qualityFactor = quality === 'high' ? 1.35 : quality === 'medium' ? 1.12 : 0.86;
  const sizeFactor = size === '4K' ? 1.75 : size === '2K' ? 1.28 : 1;
  const outputFactor = Math.max(1, Math.min(4, outputCount)) ** 0.72;
  const refsFactor = 1 + Math.min(8, referenceCount) * 0.08;
  return Math.round(base * qualityFactor * sizeFactor * outputFactor * refsFactor);
}

function mergeImageEntries(entries: MediaHistoryEntry[]) {
  const unique = new Map<string, MediaHistoryEntry>();
  for (const entry of [...entries].sort((left, right) => right.createdAt - left.createdAt)) {
    const key = entry.url || entry.id;
    if (!key || unique.has(key)) continue;
    unique.set(key, entry);
  }
  return Array.from(unique.values()).sort((left, right) => right.createdAt - left.createdAt);
}

function buildImageBatchKey(image: MediaHistoryEntry) {
  if (image.runId) return `run:${image.runId}`;
  if (image.sourceMessageId) return `source:${image.sourceMessageId}`;
  return `message:${image.messageId}:${normalizePromptKey(image.prompt) || image.messageId}`;
}

function buildImageBatchInfoMap(images: MediaHistoryEntry[]) {
  const groups = new Map<string, MediaHistoryEntry[]>();

  for (const image of images) {
    const key = buildImageBatchKey(image);
    groups.set(key, [...(groups.get(key) || []), image]);
  }

  const result = new Map<string, ImageBatchInfo>();
  for (const [key, batch] of groups) {
    const ordered = [...batch].sort((left, right) => {
      const createdDelta = left.createdAt - right.createdAt;
      if (createdDelta !== 0) return createdDelta;
      return left.id.localeCompare(right.id);
    });

    ordered.forEach((image, index) => {
      result.set(image.id, {
        key,
        count: ordered.length,
        index: index + 1,
      });
    });
  }

  return result;
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

function CompactControl({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn(
      'flex h-12 w-[7.5rem] shrink-0 flex-col justify-center border border-white/[0.08] bg-white/[0.035] px-3',
      className,
    )}>
      <span className="text-[10px] font-semibold text-[var(--app-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function AdaptiveImageLoader({
  elapsedMs,
  estimatedMs,
  progress,
}: {
  elapsedMs: number;
  estimatedMs: number;
  progress: number;
}) {
  const percentage = Math.round(Math.min(0.92, Math.max(0.06, progress)) * 100);
  const degrees = Math.round(percentage * 3.6);

  return (
    <div className="flex min-h-[22rem] h-full flex-col items-center justify-center px-6 text-center">
      <div className="relative h-28 w-28">
        <div
          className="absolute inset-0"
          style={{
            background: `conic-gradient(var(--media-accent) ${degrees}deg, rgba(255,255,255,0.08) 0deg)`,
          }}
        />
        <div className="absolute inset-2 bg-[rgba(var(--app-bg-rgb),0.88)]" />
        <div className="absolute inset-5 animate-spin border border-transparent border-t-[var(--media-accent)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles size={22} className="text-[var(--media-accent)]" />
        </div>
      </div>
      <div className="mt-5 h-1 w-52 overflow-hidden bg-white/[0.08]">
        <div
          className="h-full bg-[var(--media-accent)] transition-[width] duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-3 text-xs font-semibold tabular-nums text-[var(--app-text-muted)]">
        {formatDuration(elapsedMs)} / ~{formatDuration(estimatedMs)}
      </div>
    </div>
  );
}

function ImageBatchBadge({ info, compact = false }: { info?: ImageBatchInfo; compact?: boolean }) {
  if (!info || info.count <= 1) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 bg-black/62 font-bold tabular-nums text-white shadow-sm shadow-black/25 backdrop-blur',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
      )}
      title={`Image ${info.index} sur ${info.count} du meme prompt`}
    >
      <Layers3 size={compact ? 10 : 12} />
      {info.index}/{info.count}
    </span>
  );
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
  archiveImages = [],
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [loadingNow, setLoadingNow] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const generationStartRef = useRef<{
    startedAt: number;
    key: string;
    imageCount: number;
    latestImageCreatedAt: number;
  } | null>(null);
  const imageHistoryRef = useRef({ count: 0, latestCreatedAt: 0 });

  const allImages = useMemo(() => buildImageHistory(messages), [messages]);
  const latestImageCreatedAt = useMemo(
    () => allImages.reduce((latest, image) => Math.max(latest, image.createdAt || 0), 0),
    [allImages],
  );
  const archiveGalleryImages = useMemo(
    () => mergeImageEntries([...archiveImages, ...allImages]),
    [allImages, archiveImages],
  );
  const galleryImages = showArchive ? archiveGalleryImages : allImages;
  const pendingRuns = useMemo(
    () => buildPendingImageRuns(messages, allImages, isLoading),
    [allImages, isLoading, messages],
  );
  const featuredImage = useMemo(
    () => galleryImages.find((image) => image.id === selectedImageId) || galleryImages[0] || null,
    [galleryImages, selectedImageId],
  );
  const visibleHistoryImages = useMemo(
    () => galleryImages.filter((image) => image.id !== featuredImage?.id),
    [featuredImage?.id, galleryImages],
  );
  const batchInfoByImageId = useMemo(
    () => buildImageBatchInfoMap(galleryImages),
    [galleryImages],
  );
  const featuredBatchInfo = featuredImage ? batchInfoByImageId.get(featuredImage.id) : undefined;
  const sourceImages = useMemo(
    () => pendingAttachments.filter((attachment) => attachment.type === 'image'),
    [pendingAttachments],
  );

  const draftPrompt = prompt.trim();
  const promptsToSend = useMemo(
    () => [...queuedPrompts, ...(draftPrompt ? [draftPrompt] : [])],
    [draftPrompt, queuedPrompts],
  );
  const maxReferenceImages = selectedModel?.maxReferenceImages || 3;
  const referenceOverflow = sourceImages.length > maxReferenceImages;
  const canSubmit = promptsToSend.length > 0 && !referenceOverflow;
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
    '--media-accent-ink': imageTone.accentInk || '#0d0718',
    '--media-wash-rgb': imageTone.washRgb || imageTone.accentRgb,
  };

  const generationTimingKey = useMemo(() => [
    config.model,
    config.aspectRatio || 'auto',
    currentImageSize || '-',
    currentImageDimensions || '-',
    currentImageQuality || '-',
    currentOutputFormat || '-',
    currentBackground || '-',
    currentModeration || '-',
    currentSafetySetting || '-',
    outputCount,
    sourceImages.length,
    promptsToSend.length || 1,
  ].join('|'), [
    config.aspectRatio,
    config.model,
    currentBackground,
    currentImageDimensions,
    currentImageQuality,
    currentImageSize,
    currentModeration,
    currentOutputFormat,
    currentSafetySetting,
    outputCount,
    promptsToSend.length,
    sourceImages.length,
  ]);
  const estimatedDurationMs = getStoredDurationMs(generationTimingKey)
    ?? estimateFallbackDurationMs(config.model, outputCount, sourceImages.length, currentImageQuality, currentImageSize);
  const elapsedMs = generationStartRef.current ? Math.max(0, loadingNow - generationStartRef.current.startedAt) : 0;
  const loadingProgress = isLoading ? Math.min(0.92, Math.max(0.06, elapsedMs / estimatedDurationMs)) : 0;

  useEffect(() => {
    imageHistoryRef.current = {
      count: allImages.length,
      latestCreatedAt: latestImageCreatedAt,
    };
  }, [allImages.length, latestImageCreatedAt]);

  useEffect(() => {
    if (!galleryImages.length) {
      setSelectedImageId(null);
      return;
    }

    if (!selectedImageId || !galleryImages.some((image) => image.id === selectedImageId)) {
      setSelectedImageId(galleryImages[0].id);
    }
  }, [galleryImages, selectedImageId]);

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
    if (moderationOptions.length > 0 && config.imageModeration !== 'low') {
      nextConfig.imageModeration = 'low';
    }
    if (safetySettingOptions.length > 0 && config.safetySetting !== 'BLOCK_NONE') {
      nextConfig.safetySetting = 'BLOCK_NONE';
    }
    if (safetySettingOptions.length > 0 && !isImageModelSafetySettingSupported(config.model, config.safetySetting || '')) {
      nextConfig.safetySetting = getImageModelDefaultSafetySetting(config.model);
    }
    if (moderationOptions.length > 0 && !isImageModelModerationSupported(config.model, config.imageModeration || '')) {
      nextConfig.imageModeration = getImageModelDefaultModeration(config.model);
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

  useEffect(() => {
    if (isLoading && !generationStartRef.current) {
      generationStartRef.current = {
        startedAt: Date.now(),
        key: generationTimingKey,
        imageCount: allImages.length,
        latestImageCreatedAt,
      };
      setLoadingNow(Date.now());
    }

    if (!isLoading && generationStartRef.current) {
      const completedGeneration = generationStartRef.current;
      generationStartRef.current = null;
      setLoadingNow(Date.now());

      window.setTimeout(() => {
        const currentHistory = imageHistoryRef.current;
        const didCreateImage = currentHistory.count > completedGeneration.imageCount
          || currentHistory.latestCreatedAt > completedGeneration.latestImageCreatedAt;

        if (didCreateImage) {
          recordGenerationDuration(
            completedGeneration.key,
            Date.now() - completedGeneration.startedAt,
          );
        }
      }, 700);
    }

    return undefined;
  }, [allImages.length, generationTimingKey, isLoading, latestImageCreatedAt]);

  useEffect(() => {
    if (!isLoading) return undefined;
    const intervalId = window.setInterval(() => setLoadingNow(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, [isLoading]);

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleSourceFiles = async (files: FileList | File[]) => {
    const remainingSlots = Math.max(0, maxReferenceImages - sourceImages.length);
    if (remainingSlots <= 0) return;
    const imageFiles = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, remainingSlots);
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

  const settingsPanel = (
    <div className="absolute right-0 top-full z-30 mt-2 w-[min(92vw,42rem)] border border-white/[0.1] bg-[rgba(var(--app-bg-rgb),0.96)] p-4 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {imageSizeOptions.length > 0 && (
          <MediaField label="Taille">
            <MediaSelect
              value={currentImageSize}
              onChange={(event) => setConfig({ imageSize: event.target.value as any })}
            >
              {imageSizeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
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
                <option key={option.value} value={option.value}>{option.label}</option>
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
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </MediaSelect>
          </MediaField>
        )}

        {outputFormatOptions.length > 0 && (
          <MediaField label="Format">
            <MediaSelect
              value={currentOutputFormat}
              onChange={(event) => {
                const nextFormat = event.target.value as any;
                setConfig({
                  imageOutputFormat: nextFormat,
                  imageBackground: currentBackground === 'transparent' && nextFormat !== 'png'
                    ? 'auto'
                    : currentBackground as any,
                });
              }}
            >
              {outputFormatOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </MediaSelect>
          </MediaField>
        )}

        {backgroundOptions.length > 0 && (
          <MediaField label="Fond">
            <MediaSelect
              value={currentBackground}
              onChange={(event) => {
                const nextBackground = event.target.value as any;
                setConfig({
                  imageBackground: nextBackground,
                  imageOutputFormat: nextBackground === 'transparent' ? 'png' : currentOutputFormat as any,
                });
              }}
            >
              {backgroundOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
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

        {moderationOptions.length > 0 && (
          <MediaField label="Moderation">
            <MediaSelect
              value={currentModeration}
              onChange={(event) => setConfig({ imageModeration: event.target.value as any })}
            >
              {moderationOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
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
                <option key={option.value} value={option.value}>{option.label}</option>
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
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </MediaSelect>
          </MediaField>
        )}

        {supportsGoogleSearch && (
          <label className="flex h-10 items-center justify-between gap-3 border-b border-white/[0.12] text-xs font-semibold text-[var(--app-text)]">
            <span className="inline-flex items-center gap-2"><Globe2 size={14} /> Search</span>
            <input
              type="checkbox"
              checked={Boolean(config.googleSearch)}
              onChange={(event) => setConfig({ googleSearch: event.target.checked })}
              className="h-4 w-4 accent-[var(--media-accent)]"
            />
          </label>
        )}

        {supportsIncludeThoughts && (
          <label className="flex h-10 items-center justify-between gap-3 border-b border-white/[0.12] text-xs font-semibold text-[var(--app-text)]">
            <span className="inline-flex items-center gap-2"><Brain size={14} /> Thoughts</span>
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
          const files = event.target.files;
          if (files) void handleSourceFiles(files);
          event.currentTarget.value = '';
        }}
      />

      <div
        data-image-studio-scroll="true"
        style={style}
        className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-[linear-gradient(135deg,rgba(var(--media-wash-rgb),0.07),rgba(var(--app-bg-rgb),0)_34%),var(--app-bg)] lg:overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:64px_64px] opacity-40" />

        <div className="relative mx-auto flex min-h-full w-full max-w-[118rem] flex-col gap-3 px-3 py-3 sm:px-4 lg:h-full lg:px-5">
          <header className="relative flex shrink-0 flex-col gap-3 border-b border-white/[0.07] pb-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--media-accent)]">
                <ImageIcon size={26} />
              </div>
              <h1 className="text-2xl font-bold tracking-normal text-[var(--app-text)]">Image</h1>
            </div>

            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto">
              <CompactControl label="Modele" className="w-[15rem] max-w-full">
                <MediaSelect
                  value={config.model}
                  onChange={(event) => setConfig({ model: event.target.value })}
                  className="h-6 border-b-0 text-sm"
                >
                  {IMAGE_MODEL_OPTIONS.map((model) => (
                    <option key={model.id} value={model.id}>{model.label}</option>
                  ))}
                </MediaSelect>
              </CompactControl>

              <CompactControl label="Sorties" className="w-[5.5rem]">
                <MediaInput
                  type="number"
                  min={1}
                  step={1}
                  value={config.numberOfImages || 1}
                  onChange={(event) => {
                    const raw = Number(event.target.value);
                    const next = Number.isFinite(raw) ? Math.max(1, Math.round(raw)) : 1;
                    setConfig({ numberOfImages: next });
                  }}
                  className="h-6 border-b-0 text-sm"
                />
              </CompactControl>

              <CompactControl label="Ratio" className="w-[7rem]">
                <MediaSelect
                  value={config.aspectRatio || ''}
                  onChange={(event) => setConfig({ aspectRatio: event.target.value as any })}
                  className="h-6 border-b-0 text-sm"
                >
                  {aspectRatioOptions.map((option) => (
                    <option key={option.value || 'auto'} value={option.value}>{option.label}</option>
                  ))}
                </MediaSelect>
              </CompactControl>

              <button
                type="button"
                onClick={handleOpenFilePicker}
                className={cn(
                  'flex h-12 w-[5.75rem] shrink-0 flex-col justify-center border bg-white/[0.035] px-3 text-left',
                  referenceOverflow ? 'border-red-400/60' : 'border-white/[0.08] hover:border-[rgba(var(--media-accent-rgb),0.42)]',
                )}
                title="Ajouter des references"
                aria-label="Ajouter des references"
              >
                <span className="text-[10px] font-semibold text-[var(--app-text-muted)]">Refs</span>
                <span className="text-sm font-semibold tabular-nums text-[var(--app-text)]">{sourceImages.length} / {maxReferenceImages}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowArchive((value) => !value)}
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center border text-[var(--app-text)]',
                  showArchive
                    ? 'border-[var(--media-accent)] bg-[rgba(var(--media-accent-rgb),0.14)]'
                    : 'border-white/[0.08] bg-white/[0.035] hover:border-[rgba(var(--media-accent-rgb),0.42)]',
                )}
                title="Archives"
                aria-label="Archives"
              >
                <Archive size={18} />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((value) => !value)}
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center gap-2 border text-sm font-semibold text-[var(--app-text)]',
                    isSettingsOpen
                      ? 'border-[var(--media-accent)] bg-[rgba(var(--media-accent-rgb),0.14)]'
                      : 'border-white/[0.08] bg-white/[0.035] hover:border-[rgba(var(--media-accent-rgb),0.42)]',
                  )}
                >
                  <Settings2 size={16} />
                  <ChevronDown size={14} className={cn('transition-transform', isSettingsOpen && 'rotate-180')} />
                </button>
                {isSettingsOpen && settingsPanel}
              </div>
            </div>
          </header>

          {galleryImages.length > 0 && (
            <div className="min-w-0 overflow-hidden border-b border-white/[0.08] pb-3 lg:hidden">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">
                  {showArchive ? <Archive size={13} className="text-[var(--media-accent)]" /> : <History size={13} className="text-[var(--media-accent)]" />}
                  {showArchive ? 'Archives' : 'Historique'}
                </div>
                <div className="text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">{galleryImages.length}</div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galleryImages.slice(0, 12).map((image) => (
                  <button
                    key={`mobile-${image.id}`}
                    type="button"
                    onClick={() => setSelectedImageId(image.id)}
                    className={cn(
                      'relative h-16 w-16 shrink-0 overflow-hidden border',
                      selectedImageId === image.id
                        ? 'border-[var(--media-accent)]'
                        : 'border-white/[0.08]',
                    )}
                      >
                    <img src={image.url} alt={image.name || 'Image generee'} className="h-full w-full object-cover" />
                    <span className="absolute left-1 top-1">
                      <ImageBatchBadge info={batchInfoByImageId.get(image.id)} compact />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(18rem,0.62fr)_minmax(0,1.7fr)_minmax(16rem,0.52fr)] lg:gap-4 lg:overflow-hidden">
            <section className="flex min-h-[34rem] min-w-0 flex-col overflow-y-auto overflow-x-hidden border-b border-white/[0.08] pb-3 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
              <div className="grid min-h-0 flex-1 grid-rows-[minmax(9rem,0.95fr)_auto_auto] gap-4">
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
                    maxLength={3000}
                    className="border border-white/[0.1] border-l-[rgba(var(--media-accent-rgb),0.38)] bg-white/[0.03] px-4 py-3 text-[15px]"
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
                      <span className="hidden sm:inline">Ajouter</span>
                    </button>
                  </div>

                  {queuedPrompts.length > 0 ? (
                    <div className="grid max-h-28 gap-2 overflow-y-auto pr-1">
                      {queuedPrompts.map((queuedPrompt, index) => (
                        <div key={`${queuedPrompt}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-l border-white/[0.12] pl-2">
                          <span className="text-[10px] font-semibold tabular-nums text-[var(--media-accent)]">{index + 1}</span>
                          <span className="truncate text-xs text-[var(--app-text)]">{queuedPrompt}</span>
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
                    <div className="flex h-11 items-center border-l border-white/[0.08] pl-3 text-xs text-[var(--app-text-muted)]">
                      Prompt direct
                    </div>
                  )}
                </div>

                <div className="min-h-0 border-t border-white/[0.07] pt-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-[var(--app-text)]">Refs</div>
                    <button
                      type="button"
                      onClick={handleOpenFilePicker}
                      className="inline-flex h-8 w-8 items-center justify-center bg-white/[0.07] text-[var(--app-text)] hover:bg-white/[0.12]"
                      title="Ajouter"
                      aria-label="Ajouter"
                    >
                      <Upload size={15} />
                    </button>
                  </div>

                  {sourceImages.length > 0 ? (
                    <div className="grid max-h-24 grid-cols-5 gap-2 overflow-y-auto pr-1">
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
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        void handleSourceFiles(event.dataTransfer.files);
                      }}
                      className="flex h-24 w-full flex-col items-center justify-center gap-2 border border-dashed border-white/[0.14] text-xs font-semibold text-[var(--app-text-muted)] hover:border-[rgba(var(--media-accent-rgb),0.42)] hover:text-[var(--app-text)]"
                    >
                      <Upload size={21} />
                      Deposer
                    </button>
                  )}
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
                    {featuredImage?.name || selectedModelLabel}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--app-text-muted)]">
                  {isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-[var(--media-accent)]" />
                      <span className="hidden sm:inline">Live</span>
                    </>
                  ) : featuredImage ? (
                    <>
                      <CheckCircle2 size={14} className="text-[var(--media-accent)]" />
                      <span className="hidden sm:inline">Sauve</span>
                    </>
                  ) : (
                    <>
                      <Images size={14} />
                      <span className="hidden sm:inline">Vide</span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 pt-3">
                <div className="group relative min-h-0 overflow-hidden border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.045),transparent_34%),rgba(0,0,0,0.22)]">
                  {featuredImage ? (
                    <>
                      <button type="button" onClick={() => onImageClick(featuredImage.url)} className="block h-full w-full">
                        <img
                          src={featuredImage.url}
                          alt={featuredImage.name || 'Image generee'}
                          className="h-full w-full object-contain"
                        />
                      </button>
                      <div className="pointer-events-none absolute left-3 top-3">
                        <ImageBatchBadge info={featuredBatchInfo} />
                      </div>
                      <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => onImageClick(featuredImage.url)}
                          className="inline-flex h-9 w-9 items-center justify-center bg-black/45 text-white/80 hover:text-white"
                          title="Agrandir"
                          aria-label="Agrandir"
                        >
                          <Maximize2 size={16} />
                        </button>
                        <a
                          href={featuredImage.url}
                          download={featuredImage.name || 'image-generee.png'}
                          className="inline-flex h-9 w-9 items-center justify-center bg-black/45 text-white/80 hover:text-white"
                          title="Telecharger"
                          aria-label="Telecharger"
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    </>
                  ) : isLoading ? (
                    <AdaptiveImageLoader
                      elapsedMs={elapsedMs}
                      estimatedMs={estimatedDurationMs}
                      progress={loadingProgress}
                    />
                  ) : (
                    <div className="flex h-full min-h-[22rem] flex-col items-center justify-center px-6 text-center">
                      <Images size={44} className="text-[var(--app-text-muted)]/70" />
                      <p className="mt-4 text-sm font-semibold text-[var(--app-text)]">Votre image apparaitra ici</p>
                    </div>
                  )}

                  {isLoading && featuredImage && (
                    <div className="pointer-events-none absolute left-3 top-14 w-[min(16rem,calc(100%-1.5rem))] border border-white/[0.08] bg-[rgba(var(--app-bg-rgb),0.78)] px-3 py-2 backdrop-blur">
                      <div className="flex items-center gap-2">
                        <Loader2 size={13} className="shrink-0 animate-spin text-[var(--media-accent)]" />
                        <div className="h-1 min-w-0 flex-1 overflow-hidden bg-white/[0.08]">
                          <div
                            className="h-full bg-[var(--media-accent)] transition-[width] duration-300"
                            style={{ width: `${Math.round(loadingProgress * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold tabular-nums text-[var(--app-text-muted)]">
                          ~{formatDuration(estimatedDurationMs)}
                        </span>
                      </div>
                    </div>
                  )}

                  {isLoading && (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 border-t border-white/[0.08] bg-[rgba(var(--app-bg-rgb),0.88)] px-3 py-2 backdrop-blur">
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

                <div className="grid gap-3 border-t border-white/[0.07] pt-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.42fr)] md:items-center">
                    <PromptSource
                      prompt={featuredImage?.prompt || pendingRuns[0]?.prompt || draftPrompt}
                      title="Prompt"
                      className="border-t-0 pt-0"
                    />
                    <PrimaryActionButton
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      loading={false}
                      loadingLabel="..."
                      idleLabel={promptsToSend.length > 1 ? `Generer ${promptsToSend.length}` : 'Generer'}
                      icon={Sparkles}
                      className="h-12 bg-[rgba(var(--media-accent-rgb),0.86)] text-[var(--media-accent-ink)] hover:bg-[var(--media-accent)]"
                    />
                  </div>

                  {visibleHistoryImages.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {visibleHistoryImages.slice(0, 10).map((image) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => setSelectedImageId(image.id)}
                          className="relative h-14 w-14 shrink-0 overflow-hidden border border-white/[0.08] hover:border-[rgba(var(--media-accent-rgb),0.55)]"
                        >
                          <img src={image.url} alt={image.name || 'Image generee'} className="h-full w-full object-cover" />
                          <span className="absolute left-1 top-1">
                            <ImageBatchBadge info={batchInfoByImageId.get(image.id)} compact />
                          </span>
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
                    {showArchive ? <Archive size={13} className="text-[var(--media-accent)]" /> : <History size={13} className="text-[var(--media-accent)]" />}
                    {showArchive ? 'Archives' : 'Historique'}
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-[var(--app-text)]">
                    {galleryImages.length} rendu{galleryImages.length > 1 ? 's' : ''}
                  </div>
                </div>
                {showArchive && (
                  <button
                    type="button"
                    onClick={() => setShowArchive(false)}
                    className="text-[10px] font-semibold uppercase text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                  >
                    Session
                  </button>
                )}
              </div>

              {galleryImages.length > 0 ? (
                <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-2 content-start gap-2 overflow-y-auto pt-3 pr-1">
                  {galleryImages.map((image, index) => (
                    (() => {
                      const batchInfo = batchInfoByImageId.get(image.id);
                      return (
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
                      <div className="absolute left-2 top-2">
                        <ImageBatchBadge info={batchInfo} compact />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 to-transparent px-2 pb-2 pt-7">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold tabular-nums text-white/86">
                            {String(galleryImages.length - index).padStart(2, '0')}
                          </span>
                          <span className="text-[10px] text-white/62">{formatShortTime(image.createdAt)}</span>
                        </div>
                        <div className="mt-1 truncate text-[11px] font-semibold text-white/90">
                          {batchInfo && batchInfo.count > 1
                            ? `Prompt ${batchInfo.index}/${batchInfo.count}`
                            : (image.shotLabel || image.name || image.prompt || 'Image')}
                        </div>
                      </div>
                    </button>
                      );
                    })()
                  ))}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 text-center">
                  <Clock3 size={22} className="text-[var(--media-accent)]" />
                  <p className="mt-3 text-sm font-semibold text-[var(--app-text)]">Aucune image</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
};
