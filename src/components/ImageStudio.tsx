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
  imageModelSupportsAutoAspectRatio,
  isAzureOpenAIImageModel,
} from '../../shared/image-models.js';
import { useStore } from '../store/useStore';
import { Attachment, MediaGenerationRequest, Message } from '../types';
import { buildImageHistory } from '../utils/media-gallery-history';
import {
  EmptyOutput,
  IconAction,
  MediaField,
  MediaPanel,
  MediaPanelHeader,
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

const azureAspectRatios = new Set(['', '1:1', '3:2', '2:3']);

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

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto] gap-3 pt-2">
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
        detail={`${config.aspectRatio || 'Auto'} - ${config.imageSize || 'auto'}`}
        icon={ImageIcon}
      />

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto] gap-2 pt-2">
        {isLoading ? (
          <div className="grid min-h-0 gap-2 sm:grid-cols-2">
            {Array.from({ length: Math.max(1, Math.min(config.numberOfImages || 1, 4)) }).map((_, index) => (
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
