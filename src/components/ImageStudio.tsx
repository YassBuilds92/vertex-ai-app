import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Download,
  Globe2,
  Image as ImageIcon,
  Images,
  Loader2,
  Maximize2,
  SlidersHorizontal,
  Sparkles,
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
  getImageModelMaxOutputImages,
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
import { buildImageHistory } from '../utils/media-gallery-history';
import {
  EmptyOutput,
  IconAction,
  MediaField,
  MediaInput,
  MediaPanel,
  MediaPanelHeader,
  MediaSelect,
  MediaStudioShell,
  MediaTextarea,
  PrimaryActionButton,
  PromptSource,
  cn,
  type MediaStudioTone,
} from './MediaStudioLayout';

const imageTone: MediaStudioTone = {
  accent: '#8be8ff',
  accentRgb: '139,232,255',
  accentInk: '#061014',
  washRgb: '99,102,241',
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
  const maxOutputImages = getImageModelMaxOutputImages(config.model);

  const [prompt, setPrompt] = useState('');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allImages = useMemo(() => buildImageHistory(messages), [messages]);
  const featuredImage = useMemo(
    () => allImages.find((image) => image.id === selectedImageId) || allImages[0] || null,
    [allImages, selectedImageId],
  );
  const galleryImages = useMemo(
    () => allImages.filter((image) => image.id !== featuredImage?.id),
    [allImages, featuredImage?.id],
  );
  const sourceImages = useMemo(
    () => pendingAttachments.filter((attachment) => attachment.type === 'image'),
    [pendingAttachments],
  );
  const canSubmit = Boolean(prompt.trim()) && !isLoading;
  const selectedModelLabel = selectedModel?.label || getImageModelLabel(config.model);
  const currentOutputFormat = config.imageOutputFormat || getImageModelDefaultOutputFormat(config.model);
  const currentImageDimensions = config.imageDimensions || getImageModelDefaultImageDimensions(config.model);
  const currentImageQuality = config.imageQuality || getImageModelDefaultImageQuality(config.model);
  const currentImageSize = config.imageSize || getImageModelDefaultImageSize(config.model);
  const currentSafetySetting = config.safetySetting || getImageModelDefaultSafetySetting(config.model);
  const currentThinkingLevel = config.thinkingLevel || getImageModelDefaultThinkingLevel(config.model);
  const currentBackground = config.imageBackground || getImageModelDefaultBackground(config.model);
  const currentModeration = config.imageModeration || getImageModelDefaultModeration(config.model);

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
    if ((config.numberOfImages || 1) > maxOutputImages) {
      nextConfig.numberOfImages = maxOutputImages;
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
    maxOutputImages,
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

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const cleanPrompt = prompt.trim();
    onGenerate(cleanPrompt, { originalPrompt: cleanPrompt });
    setPrompt('');
  };

  const settings = (
    <div className="min-h-0 border-t border-white/[0.07] pt-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--app-text)]">
          <SlidersHorizontal size={14} className="text-[var(--media-accent)]" />
          Parametres
        </div>
        <div className="text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">
          {isAzureImageModel ? 'GPT' : 'Google'}
        </div>
      </div>

      <div className="grid max-h-72 min-h-0 grid-cols-2 gap-x-3 gap-y-2 overflow-y-auto pr-1">
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
            max={maxOutputImages}
            step={1}
            value={config.numberOfImages || 1}
            onChange={(event) => {
              const raw = Number(event.target.value);
              const next = Number.isFinite(raw)
                ? Math.max(1, Math.min(maxOutputImages, Math.round(raw)))
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

        {thinkingLevelOptions.length > 0 && (
          <MediaField label="Budget">
            <MediaInput
              type="number"
              min={0}
              max={24576}
              step={512}
              value={config.maxThoughtTokens ?? 4096}
              onChange={(event) => {
                const raw = Number(event.target.value);
                const next = Number.isFinite(raw) ? Math.max(0, Math.min(24576, Math.round(raw))) : 4096;
                setConfig({ maxThoughtTokens: next });
              }}
            />
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

  const composer = (
    <MediaPanel>
      <MediaPanelHeader
        label="Direction"
        title="Prompt image"
        detail={`${selectedModelLabel} - ${config.numberOfImages || 1} sortie${(config.numberOfImages || 1) > 1 ? 's' : ''}`}
        icon={ImageIcon}
      />

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(7rem,1fr)_auto_auto_auto] gap-3 pt-2">
        <MediaField label="Brief" className="min-h-0">
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
          />
        </MediaField>

        {settings}

        <div className="min-h-0 border-t border-white/[0.07] pt-2">
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
            <div className="grid max-h-20 grid-cols-6 gap-2 overflow-hidden">
              {sourceImages.map((attachment) => (
                <div key={attachment.id} className="group relative overflow-hidden">
                  <button type="button" onClick={() => onImageClick(attachment.url)} className="block w-full">
                    <img src={attachment.url} alt={attachment.name || 'Image source'} className="aspect-square w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(attachment.id)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    title="Retirer"
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
              className="flex h-12 w-full items-center justify-center border border-dashed border-white/[0.1] text-xs font-semibold text-[var(--app-text-muted)] hover:border-[rgba(var(--media-accent-rgb),0.42)] hover:text-[var(--app-text)]"
            >
              Deposer
            </button>
          )}
        </div>

        <PrimaryActionButton
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={isLoading}
          loadingLabel="..."
          idleLabel="Generer"
          icon={Sparkles}
        />
      </div>
    </MediaPanel>
  );

  const stage = (
    <MediaPanel>
      <MediaPanelHeader
        label="Canvas"
        title={selectedModelLabel}
        detail={[
          config.aspectRatio || 'Auto',
          isAzureImageModel ? currentImageDimensions : imageSizeOptions.length > 0 ? currentImageSize : '',
          isAzureImageModel ? currentImageQuality : '',
        ].filter(Boolean).join(' - ')}
        icon={ImageIcon}
      />

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto] gap-2 pt-2">
        {isLoading ? (
          <div className="grid min-h-0 gap-2 sm:grid-cols-2">
            {Array.from({ length: Math.max(1, Math.min(config.numberOfImages || 1, maxOutputImages)) }).map((_, index) => (
              <div
                key={index}
                className="flex min-h-0 animate-pulse items-center justify-center border border-white/[0.08]"
              >
                <Loader2 size={24} className="animate-spin text-[var(--media-accent)]" />
              </div>
            ))}
          </div>
        ) : featuredImage ? (
          <>
            <div className="group relative min-h-0 overflow-hidden">
              <button type="button" onClick={() => onImageClick(featuredImage.url)} className="block h-full w-full">
                <img
                  src={featuredImage.url}
                  alt={featuredImage.name || 'Image generee'}
                  className="h-full w-full object-contain"
                />
              </button>
              <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <IconAction icon={Maximize2} label="Agrandir" onClick={() => onImageClick(featuredImage.url)} />
                <a
                  href={featuredImage.url}
                  download={featuredImage.name || 'image-generee.png'}
                  className="inline-flex h-8 w-8 items-center justify-center text-white/80 hover:text-white"
                  title="Telecharger"
                  aria-label="Telecharger"
                >
                  <Download size={15} />
                </a>
              </div>
            </div>

            <PromptSource prompt={featuredImage.prompt} />

            {galleryImages.length > 0 && (
              <div className="grid max-h-16 grid-cols-5 gap-2 overflow-hidden">
                {galleryImages.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedImageId(image.id)}
                    className={cn(
                      'overflow-hidden border-b hover:border-[rgba(var(--media-accent-rgb),0.55)]',
                      selectedImageId === image.id ? 'border-[var(--media-accent)]' : 'border-white/10',
                    )}
                  >
                    <img src={image.url} alt={image.name || 'Image generee'} className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <EmptyOutput
            icon={Images}
            title="Aucun rendu image"
          />
        )}
      </div>
    </MediaPanel>
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

      <MediaStudioShell
        tone={imageTone}
        eyebrow="Image"
        title="Composer une image precise"
        subtitle="Prompt, references et rendu final dans une surface unique, sans etape fictive."
        metrics={[
          { label: 'Modele', value: selectedModelLabel },
          { label: 'Ratio', value: config.aspectRatio || 'Auto' },
          { label: isAzureImageModel ? 'Qualite' : 'Taille', value: isAzureImageModel ? currentImageQuality : currentImageSize || 'Auto' },
          { label: 'Sources', value: sourceImages.length },
          { label: 'Rendus', value: allImages.length },
        ]}
        composer={composer}
        stage={stage}
        rootProps={{ 'data-image-studio-scroll': 'true' }}
      />
    </>
  );
};
