import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Image as ImageIcon,
  Images,
  Loader2,
  Maximize2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

import {
  getImageModelLabel,
  getImageModelOption,
  getImageModelSizeControlLabel,
  imageModelSupportsAutoAspectRatio,
  imageModelSupportsImageSize,
  IMAGE_MODEL_OPTIONS,
  isAzureOpenAIImageModel,
} from '../../shared/image-models.js';
import { useStore } from '../store/useStore';
import { Attachment, MediaGenerationRequest, Message } from '../types';
import { getGoogleRecommendedGenerationDefaults } from '../utils/generation-defaults';
import { buildImageHistory } from '../utils/media-gallery-history';
import {
  ChoiceButton,
  EmptyOutput,
  IconAction,
  InlineNotice,
  MediaField,
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

const aspectRatios = [
  { value: '', label: 'Auto' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '5:4', label: '5:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
] as const;

const imageSizes = ['1K', '2K', '4K'] as const;
const azureQualityLabels: Record<typeof imageSizes[number], string> = {
  '1K': 'Basse',
  '2K': 'Moyenne',
  '4K': 'Haute',
};
const azureAspectRatios = new Set(['', '1:1', '3:2', '2:3']);

function RatioShape({ ratio }: { ratio: string }) {
  if (!ratio) return <span className="text-[10px] font-black opacity-75">A</span>;
  const [w, h] = ratio.split(':').map(Number);
  const maxDim = 14;
  const scale = Math.min(maxDim / w, maxDim / h);
  return (
    <span
      className="inline-block rounded-[2px] border-[1.5px] border-current"
      style={{ width: Math.max(5, w * scale), height: Math.max(5, h * scale) }}
    />
  );
}

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
  const supportsImageSize = imageModelSupportsImageSize(config.model);

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
  const visibleRatios = useMemo(
    () => aspectRatios.filter((ratio) => {
      if (isAzureImageModel) return azureAspectRatios.has(ratio.value);
      return supportsAutoRatio || ratio.value;
    }),
    [isAzureImageModel, supportsAutoRatio],
  );
  const canSubmit = Boolean(prompt.trim()) && !isLoading;
  const selectedModelLabel = selectedModel?.label || getImageModelLabel(config.model);

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
      setConfig({ aspectRatio: '1:1' });
    }
  }, [config.aspectRatio, setConfig, supportsAutoRatio]);

  useEffect(() => {
    if (isAzureImageModel && !azureAspectRatios.has(config.aspectRatio || '')) {
      setConfig({ aspectRatio: '' });
    }
  }, [config.aspectRatio, isAzureImageModel, setConfig]);

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

  const composer = (
    <MediaPanel>
      <MediaPanelHeader
        label="Direction"
        title="Prompt image"
        detail={`${selectedModelLabel} - ${config.numberOfImages || 1} sortie${(config.numberOfImages || 1) > 1 ? 's' : ''}`}
        icon={ImageIcon}
      />

      <div className="space-y-5 p-4 sm:p-5">
        <MediaField label="Brief visuel">
          <MediaTextarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Sujet, cadrage, lumiere, style, matiere, details a conserver..."
            rows={8}
          />
        </MediaField>

        <div className="grid gap-4 sm:grid-cols-2">
          <MediaField label="Modele">
            <MediaSelect
              value={config.model}
              onChange={(event) => setConfig({
                model: event.target.value,
                ...getGoogleRecommendedGenerationDefaults('image'),
              })}
            >
              {IMAGE_MODEL_OPTIONS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </MediaSelect>
          </MediaField>

          <MediaField label="Images">
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((count) => (
                <ChoiceButton
                  key={count}
                  active={(config.numberOfImages || 1) === count}
                  onClick={() => setConfig({ numberOfImages: count })}
                >
                  {count}
                </ChoiceButton>
              ))}
            </div>
          </MediaField>
        </div>

        <MediaField label="Ratio">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 xl:grid-cols-10">
            {visibleRatios.map((ratio) => (
              <ChoiceButton
                key={ratio.value}
                active={(config.aspectRatio || '') === ratio.value}
                onClick={() => setConfig({ aspectRatio: ratio.value })}
                title={ratio.label}
                className="min-h-12 flex-col gap-1 px-2 text-xs"
              >
                <RatioShape ratio={ratio.value} />
                {ratio.label}
              </ChoiceButton>
            ))}
          </div>
        </MediaField>

        {supportsImageSize ? (
          <MediaField label={getImageModelSizeControlLabel(config.model)}>
            <div className="grid grid-cols-3 gap-2">
              {imageSizes.map((size) => (
                <ChoiceButton
                  key={size}
                  active={(config.imageSize || '1K') === size}
                  onClick={() => setConfig({ imageSize: size })}
                >
                  {isAzureImageModel ? azureQualityLabels[size] : size}
                </ChoiceButton>
              ))}
            </div>
          </MediaField>
        ) : (
          <InlineNotice>{selectedModelLabel} gere la taille automatiquement.</InlineNotice>
        )}

        <div className="rounded-lg border border-[var(--app-border)] bg-white/[0.025] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--app-text)]">References</div>
            <button
              type="button"
              onClick={handleOpenFilePicker}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-white/[0.045] px-3 py-2 text-sm font-semibold text-[var(--app-text)] hover:bg-white/[0.075]"
            >
              <Upload size={15} />
              Ajouter
            </button>
          </div>

          {sourceImages.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {sourceImages.map((attachment) => (
                <div key={attachment.id} className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/35">
                  <button type="button" onClick={() => onImageClick(attachment.url)} className="block w-full">
                    <img src={attachment.url} alt={attachment.name || 'Image source'} className="aspect-square w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(attachment.id)}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
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
              className="flex min-h-[5.5rem] w-full items-center justify-center rounded-lg border border-dashed border-[var(--app-border)] text-sm font-semibold text-[var(--app-text-muted)] hover:border-[rgba(var(--media-accent-rgb),0.42)] hover:text-[var(--app-text)]"
            >
              Deposer des images source
            </button>
          )}
        </div>

        <PrimaryActionButton
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={isLoading}
          loadingLabel="Generation..."
          idleLabel="Generer l'image"
          icon={Sparkles}
        />
      </div>
    </MediaPanel>
  );

  const stage = (
    <MediaPanel className="min-h-[34rem]">
      <MediaPanelHeader
        label="Canvas"
        title={selectedModelLabel}
        detail={`${config.aspectRatio || 'Auto'} - ${config.imageSize || 'auto'}`}
        action={(
          <div className="rounded-lg border border-[var(--app-border)] bg-white/[0.045] px-3 py-2 text-sm font-semibold text-[var(--app-text-muted)]">
            {allImages.length} rendu{allImages.length > 1 ? 's' : ''}
          </div>
        )}
      />

      <div className="space-y-4 p-4 sm:p-5">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: Math.max(1, Math.min(config.numberOfImages || 1, 4)) }).map((_, index) => (
              <div
                key={index}
                className="flex aspect-square animate-pulse items-center justify-center rounded-lg border border-[var(--app-border)] bg-white/[0.045]"
              >
                <Loader2 size={24} className="animate-spin text-[var(--media-accent)]" />
              </div>
            ))}
          </div>
        ) : featuredImage ? (
          <>
            <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/35">
              <button type="button" onClick={() => onImageClick(featuredImage.url)} className="block w-full">
                <img
                  src={featuredImage.url}
                  alt={featuredImage.name || 'Image generee'}
                  className="max-h-[70vh] w-full object-contain"
                />
              </button>
              <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <IconAction icon={Maximize2} label="Agrandir" onClick={() => onImageClick(featuredImage.url)} />
                <a
                  href={featuredImage.url}
                  download={featuredImage.name || 'image-generee.png'}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/45 text-white shadow-[0_12px_32px_-18px_rgba(0,0,0,0.95)] hover:bg-black/70"
                  title="Telecharger"
                  aria-label="Telecharger"
                >
                  <Download size={15} />
                </a>
              </div>
            </div>

            <PromptSource prompt={featuredImage.prompt} />

            {galleryImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {galleryImages.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedImageId(image.id)}
                    className={cn(
                      'overflow-hidden rounded-lg border bg-black/35 hover:border-[rgba(var(--media-accent-rgb),0.55)]',
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
            detail="Le prochain rendu prendra toute la scene."
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
