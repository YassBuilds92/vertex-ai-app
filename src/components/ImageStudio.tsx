import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Pencil,
  Sparkles,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  getImageModelLabel,
  getImageModelOption,
  getImageModelSizeControlLabel,
  imageModelSupportsAutoAspectRatio,
  imageModelSupportsImageSize,
  IMAGE_MODEL_OPTIONS,
  isAzureOpenAIImageModel,
} from '../../shared/image-models.js';
import { getPromptRefinerProfile } from '../../shared/prompt-refiners.js';
import { useStore } from '../store/useStore';
import { Attachment, MediaGenerationRequest, Message } from '../types';
import { copyTextToClipboard } from '../utils/clipboard';
import { buildImageHistory } from '../utils/media-gallery-history';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  if (!ratio) return <span className="text-[9px] font-black opacity-70">A</span>;
  const [w, h] = ratio.split(':').map(Number);
  const maxDim = 12;
  const scale = Math.min(maxDim / w, maxDim / h);
  return (
    <span
      className="inline-block rounded-[1.5px] border-[1.5px] border-current"
      style={{ width: Math.max(4, w * scale), height: Math.max(4, h * scale) }}
    />
  );
}

function clipPrompt(prompt?: string) {
  const clean = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
}

interface ImageStudioProps {
  onGenerate: (prompt: string, request?: MediaGenerationRequest) => void;
  isLoading: boolean;
  messages: Message[];
  onImageClick: (url: string) => void;
  isRefinerEnabled: boolean;
  onToggleRefiner: () => void;
  pendingAttachments: Attachment[];
  onAddAttachments: (files: FileList | File[]) => Promise<void>;
  onRemoveAttachment: (attachmentId: string) => void;
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
  onImageClick,
  isRefinerEnabled,
  onToggleRefiner,
  pendingAttachments,
  onAddAttachments,
  onRemoveAttachment,
}) => {
  const { configs, setConfig } = useStore();
  const config = configs.image;
  const activeRefinerProfile = getPromptRefinerProfile('image', config.refinerProfileId);
  const selectedModel = getImageModelOption(config.model);
  const isAzureImageModel = isAzureOpenAIImageModel(config.model);
  const supportsAutoRatio = imageModelSupportsAutoAspectRatio(config.model);
  const supportsImageSize = imageModelSupportsImageSize(config.model);

  const [prompt, setPrompt] = useState('');
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState('');
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
  const featuredPrompt = featuredImage?.refinedPrompt || featuredImage?.prompt || '';
  const canSubmit = Boolean(prompt.trim()) && !isLoading && !isRefining;

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

  const copyPrompt = async (value: string | undefined, promptId: string) => {
    if (!value?.trim()) return;
    const copied = await copyTextToClipboard(value);
    if (!copied) return;
    setCopiedPromptId(promptId);
    window.setTimeout(() => setCopiedPromptId((current) => (current === promptId ? null : current)), 1400);
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleSourceFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    await onAddAttachments(imageFiles);
  };

  const submitRawPrompt = (value: string, request?: MediaGenerationRequest) => {
    onGenerate(value, request);
    setPrompt('');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const cleanPrompt = prompt.trim();

    if (isRefinerEnabled) {
      setIsRefining(true);
      setOriginalPrompt(cleanPrompt);
      try {
        const res = await fetch('/api/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: cleanPrompt,
            mode: 'image',
            profileId: config.refinerProfileId,
            customInstructions: config.refinerCustomInstructions,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setRefinedPrompt(data.refinedInstruction || cleanPrompt);
        } else {
          submitRawPrompt(cleanPrompt, { originalPrompt: cleanPrompt });
        }
      } catch {
        submitRawPrompt(cleanPrompt, { originalPrompt: cleanPrompt });
      } finally {
        setIsRefining(false);
      }
      return;
    }

    submitRawPrompt(cleanPrompt, { originalPrompt: cleanPrompt });
  };

  const handleApplyRefined = () => {
    if (!refinedPrompt) return;
    submitRawPrompt(refinedPrompt, { originalPrompt, refinedPrompt });
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  const handleRevertOriginal = () => {
    if (!originalPrompt.trim()) return;
    submitRawPrompt(originalPrompt, { originalPrompt });
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  const handleEditRefined = () => {
    if (!refinedPrompt) return;
    setPrompt(refinedPrompt);
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  return (
    <div data-image-studio-scroll="true" className="h-full touch-pan-y overflow-y-auto overscroll-y-contain">
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

      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(340px,1.08fr)]">
        <section className="space-y-4">
          <div className="rounded-[1.5rem] border border-[var(--app-border)] bg-[var(--app-surface)]/80 p-4 shadow-[0_24px_90px_-62px_rgba(0,0,0,0.8)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">
                  Generation image
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--app-text)]">
                  Prompt
                </h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--app-accent)]">
                <ImageIcon size={18} />
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Decris l'image: sujet, cadrage, lumiere, style, details importants..."
              rows={8}
              className="min-h-[15rem] w-full resize-none rounded-[1.1rem] border border-white/8 bg-black/20 px-4 py-4 text-[15px] leading-relaxed text-[var(--app-text)] outline-none transition-colors placeholder:text-[var(--app-text-muted)]/50 focus:border-[var(--app-border-strong)]"
            />

            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Modele</span>
                  <select
                    value={config.model}
                    onChange={(event) => setConfig({ model: event.target.value })}
                    className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-3 text-[12px] font-semibold text-[var(--app-text)] outline-none focus:border-[var(--app-border-strong)]"
                  >
                    {IMAGE_MODEL_OPTIONS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-1.5">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Images</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setConfig({ numberOfImages: count })}
                        className={cn(
                          'h-10 rounded-xl text-[12px] font-bold transition-all',
                          (config.numberOfImages || 1) === count
                            ? 'bg-[var(--app-accent)] text-[#0a0a14]'
                            : 'border border-[var(--app-border)] bg-white/[0.04] text-[var(--app-text-muted)] hover:bg-white/[0.07]',
                        )}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Ratio</span>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                  {visibleRatios.map((ratio) => (
                    <button
                      key={ratio.value}
                      type="button"
                      onClick={() => setConfig({ aspectRatio: ratio.value })}
                      title={ratio.label}
                      className={cn(
                        'flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition-all',
                        (config.aspectRatio || '') === ratio.value
                          ? 'bg-[var(--app-accent)] text-[#0a0a14]'
                          : 'border border-[var(--app-border)] bg-white/[0.04] text-[var(--app-text-muted)] hover:bg-white/[0.07]',
                      )}
                    >
                      <RatioShape ratio={ratio.value} />
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                {supportsImageSize ? (
                  <div className="space-y-1.5">
                    <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">
                      {getImageModelSizeControlLabel(config.model)}
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {imageSizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setConfig({ imageSize: size })}
                          className={cn(
                            'h-10 rounded-xl text-[12px] font-bold transition-all',
                            (config.imageSize || '1K') === size
                              ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] ring-1 ring-[var(--app-accent)]/30'
                              : 'border border-[var(--app-border)] bg-white/[0.04] text-[var(--app-text-muted)] hover:bg-white/[0.07]',
                          )}
                        >
                          {isAzureImageModel ? azureQualityLabels[size] : size}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                    {getImageModelLabel(config.model)} gere la taille automatiquement.
                  </div>
                )}

                <button
                  type="button"
                  onClick={onToggleRefiner}
                  className={cn(
                    'flex h-10 items-center justify-center gap-2 self-end rounded-xl border px-3 text-[12px] font-semibold transition-all',
                    isRefinerEnabled
                      ? 'border-[var(--app-accent)]/30 bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                      : 'border-[var(--app-border)] bg-white/[0.04] text-[var(--app-text-muted)] hover:bg-white/[0.07]',
                  )}
                >
                  <Sparkles size={13} fill={isRefinerEnabled ? 'currentColor' : 'none'} />
                  Raffineur
                </button>
              </div>

              {activeRefinerProfile && isRefinerEnabled && (
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                  <span className="font-bold text-[var(--app-text)]">{activeRefinerProfile.title}</span>
                  {' - '}
                  {activeRefinerProfile.summary}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-[1.1rem] border border-white/8 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold text-[var(--app-text-muted)]">Images source</span>
                <button
                  type="button"
                  onClick={handleOpenFilePicker}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-text)] transition-colors hover:bg-white/[0.07]"
                >
                  <Upload size={12} />
                  Ajouter
                </button>
              </div>

              {sourceImages.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {sourceImages.map((attachment) => (
                    <div key={attachment.id} className="group relative overflow-hidden rounded-xl border border-white/8 bg-black/30">
                      <button type="button" onClick={() => onImageClick(attachment.url)} className="block w-full">
                        <img src={attachment.url} alt={attachment.name || 'Image source'} className="aspect-square w-full object-cover" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveAttachment(attachment.id)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenFilePicker}
                  className="flex min-h-[5.5rem] w-full items-center justify-center rounded-xl border border-dashed border-[var(--app-border)] text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]"
                >
                  Ajouter des references optionnelles
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13px] font-bold transition-all',
                canSubmit
                  ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-lg shadow-[var(--app-accent)]/20 hover:brightness-110'
                  : 'cursor-not-allowed bg-white/[0.06] text-[var(--app-text-muted)]',
              )}
            >
              {(isLoading || isRefining) ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={14} />}
              {isLoading ? 'Generation...' : isRefining ? 'Optimisation...' : 'Generer'}
            </button>
          </div>

          <AnimatePresence>
            {refinedPrompt && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="rounded-[1.3rem] border border-[var(--app-accent)]/20 bg-[var(--app-accent-soft)] p-4"
              >
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--app-accent)]">
                  <Sparkles size={11} />
                  Prompt optimise
                </div>
                <p className="mb-2 text-[13px] leading-relaxed text-[var(--app-text)]">{refinedPrompt}</p>
                <p className="mb-4 text-[11px] text-[var(--app-text-muted)]">Original: {originalPrompt}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleApplyRefined}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-[12px] font-bold text-[#0a0a14] transition-all hover:brightness-110"
                  >
                    <ArrowRight size={12} />
                    Generer
                  </button>
                  <button
                    type="button"
                    onClick={handleRevertOriginal}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <Undo2 size={11} />
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={handleEditRefined}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <Pencil size={11} />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefinedPrompt(null)}
                    className="ml-auto text-[11px] text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    Annuler
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="min-h-[32rem] rounded-[1.5rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(8,8,12,0.72))] p-4 shadow-[0_24px_90px_-62px_rgba(0,0,0,0.86)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">
                Sortie image
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--app-text)]">
                {selectedModel?.label || getImageModelLabel(config.model)} - {config.aspectRatio || 'Auto'}
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-text-muted)]">
              {allImages.length} rendu{allImages.length > 1 ? 's' : ''}
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: Math.max(1, Math.min(config.numberOfImages || 1, 4)) }).map((_, index) => (
                <div key={index} className="aspect-square animate-pulse rounded-[1.25rem] border border-white/8 bg-white/[0.05]" />
              ))}
            </div>
          ) : featuredImage ? (
            <div className="space-y-4">
              <div className="group relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/30">
                <button type="button" onClick={() => onImageClick(featuredImage.url)} className="block w-full">
                  <img src={featuredImage.url} alt={featuredImage.name || 'Image generee'} className="max-h-[68vh] w-full object-contain" />
                </button>
                <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onImageClick(featuredImage.url)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                    title="Agrandir"
                  >
                    <Maximize2 size={15} />
                  </button>
                  <a
                    href={featuredImage.url}
                    download={featuredImage.name || 'image-generee.png'}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                    title="Telecharger"
                  >
                    <Download size={15} />
                  </a>
                </div>
              </div>

              <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold text-[var(--app-text-muted)]">Prompt source</span>
                  <button
                    type="button"
                    onClick={() => copyPrompt(featuredPrompt, featuredImage.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-text)] transition-colors hover:bg-white/[0.07]"
                  >
                    <Copy size={12} />
                    {copiedPromptId === featuredImage.id ? 'Copie' : 'Copier'}
                  </button>
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--app-text-muted)]">
                  {clipPrompt(featuredPrompt) || 'Prompt non renseigne.'}
                </p>
              </div>

              {galleryImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {galleryImages.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSelectedImageId(image.id)}
                      className="overflow-hidden rounded-xl border border-white/8 bg-black/30 transition-colors hover:border-[var(--app-border-strong)]"
                    >
                      <img src={image.url} alt={image.name || 'Image generee'} className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-[var(--app-border)] bg-black/15 px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.04] text-[var(--app-accent)]">
                <ImageIcon size={22} />
              </div>
              <p className="text-sm font-semibold text-[var(--app-text)]">La sortie apparait ici.</p>
              <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[var(--app-text-muted)]">
                Ecris un prompt, choisis les quelques parametres utiles, puis genere.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
