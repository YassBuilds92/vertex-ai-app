import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
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

import { buildAdaptiveListingPack, getStyleLabel } from '../../shared/listing-pack.js';
import { getImageModelLabel, IMAGE_MODEL_OPTIONS } from '../../shared/image-models.js';
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
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '5:4', label: '5:4' },
  { value: '4:5', label: '4:5' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '21:9', label: '21:9' },
] as const;

function RatioShape({ ratio }: { ratio: string }) {
  if (!ratio) return <span className="text-[9px] font-black opacity-60">A</span>;
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

function summarizeShotPrompt(prompt?: string) {
  const clean = String(prompt || '')
    .replace(/\s+/g, ' ')
    .replace(/^Use the attached source photos.*?Art direction:\s*/i, '')
    .replace(/Keep the image believable.*$/i, '')
    .trim();
  if (!clean) return 'Angle adapte a partir des references.';
  return clean.length > 132 ? `${clean.slice(0, 129)}...` : clean;
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

  const [prompt, setPrompt] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [hiddenImageIds, setHiddenImageIds] = useState<string[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allImages = useMemo(() => buildImageHistory(messages), [messages]);
  const visibleImages = useMemo(
    () => allImages.filter((image) => !hiddenImageIds.includes(image.id)),
    [allImages, hiddenImageIds],
  );
  const featuredImage = useMemo(
    () => visibleImages.find((image) => image.id === selectedImageId) || visibleImages[0] || null,
    [visibleImages, selectedImageId],
  );
  const galleryRail = useMemo(
    () => visibleImages.filter((image) => image.id !== featuredImage?.id),
    [visibleImages, featuredImage?.id],
  );
  const optimizedPromptGallery = useMemo(() => {
    const seen = new Set<string>();

    return visibleImages
      .filter((image) => image.refinedPrompt)
      .filter((image) => {
        const key = String(image.refinedPrompt).trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }, [visibleImages]);
  const featuredRefinerProfile = useMemo(
    () => getPromptRefinerProfile('image', featuredImage?.refinerProfileId || config.refinerProfileId),
    [config.refinerProfileId, featuredImage?.refinerProfileId],
  );
  const hiddenLegacyCount = Math.max(0, allImages.length - visibleImages.length);
  const sourceImages = useMemo(
    () => pendingAttachments.filter((attachment) => attachment.type === 'image'),
    [pendingAttachments],
  );
  const hasSourceImages = sourceImages.length > 0;
  const adaptiveListingPack = useMemo(
    () => buildAdaptiveListingPack({
      notes: prompt,
      imageCount: sourceImages.length,
      fileNames: sourceImages.map((attachment) => attachment.name || ''),
    }),
    [prompt, sourceImages],
  );
  const loadingPreviewCount = hasSourceImages
    ? adaptiveListingPack.shotCount
    : (config.numberOfImages || 1);
  const canSubmit = hasSourceImages
    ? !isLoading
    : Boolean(prompt.trim()) && !isLoading && !isRefining;

  useEffect(() => {
    if (!visibleImages.length) {
      setSelectedImageId(null);
      return;
    }

    if (!selectedImageId || !visibleImages.some((image) => image.id === selectedImageId)) {
      setSelectedImageId(visibleImages[0].id);
    }
  }, [selectedImageId, visibleImages]);

  useEffect(() => {
    setHiddenImageIds((current) => current.filter((id) => allImages.some((image) => image.id === id)));
  }, [allImages]);

  const copyPrompt = async (value: string | undefined, promptId: string) => {
    if (!value?.trim()) return;
    const copied = await copyTextToClipboard(value);
    if (!copied) return;
    setCopiedPromptId(promptId);
    window.setTimeout(() => setCopiedPromptId((current) => (current === promptId ? null : current)), 1400);
  };

  const hideImage = (imageId: string) => {
    setHiddenImageIds((current) => (current.includes(imageId) ? current : [...current, imageId]));
  };

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

    if (hasSourceImages) {
      onGenerate(prompt.trim() || adaptiveListingPack.summary, {
        originalPrompt: prompt.trim() || adaptiveListingPack.summary,
        listingPack: {
          workflow: 'vinted_pack',
          productType: adaptiveListingPack.productType,
          styleId: adaptiveListingPack.styleId,
          shotCount: adaptiveListingPack.shotCount,
          shots: adaptiveListingPack.shots,
        },
      });
      return;
    }

    if (!prompt.trim()) return;

    if (isRefinerEnabled) {
      setIsRefining(true);
      setOriginalPrompt(prompt.trim());
      try {
        const res = await fetch('/api/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            mode: 'image',
            profileId: config.refinerProfileId,
            customInstructions: config.refinerCustomInstructions,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setRefinedPrompt(data.refinedInstruction || prompt.trim());
        } else {
          onGenerate(prompt.trim(), { originalPrompt: prompt.trim() });
          setPrompt('');
        }
      } catch {
        onGenerate(prompt.trim(), { originalPrompt: prompt.trim() });
        setPrompt('');
      } finally {
        setIsRefining(false);
      }
      return;
    }

    onGenerate(prompt.trim(), { originalPrompt: prompt.trim() });
    setPrompt('');
  };

  const handleApplyRefined = () => {
    if (!refinedPrompt) return;
    onGenerate(refinedPrompt, { originalPrompt, refinedPrompt });
    setPrompt('');
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  const handleRevertOriginal = () => {
    if (!originalPrompt.trim()) return;
    onGenerate(originalPrompt, { originalPrompt });
    setPrompt('');
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  const handleEditRefined = () => {
    if (!refinedPrompt) return;
    setPrompt(refinedPrompt);
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  const handleDismissPreview = () => {
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

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <div className="space-y-6 pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelPicker((current) => !current)}
                className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:border-[var(--app-border-strong)]"
              >
                <ImageIcon size={13} className="text-[var(--app-accent)]" />
                {getImageModelLabel(config.model)}
                <ChevronDown size={12} className={cn('text-[var(--app-text-muted)] transition-transform', showModelPicker && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {showModelPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute left-0 top-full z-20 mt-1.5 w-64 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-strong)] p-2 shadow-xl backdrop-blur-xl"
                  >
                    {IMAGE_MODEL_OPTIONS.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setConfig({ model: model.id });
                          setShowModelPicker(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[12px] transition-colors',
                          config.model === model.id
                            ? 'bg-[var(--app-accent-soft)] font-bold text-[var(--app-accent)]'
                            : 'text-[var(--app-text)] hover:bg-white/[0.05]',
                        )}
                      >
                        <div>
                          <div className="font-semibold">{model.label}</div>
                          <div className="text-[10px] text-[var(--app-text-muted)]">{model.info}</div>
                        </div>
                        {config.model === model.id && <Check size={13} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-[1.2rem] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-2">
              {aspectRatios.map((ratio) => (
                <button
                  key={ratio.value}
                  type="button"
                  onClick={() => setConfig({ aspectRatio: ratio.value as any })}
                  title={ratio.label || 'Auto'}
                  className={cn(
                    'flex min-w-[42px] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-all',
                    (config.aspectRatio || '') === ratio.value
                      ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-sm'
                      : 'bg-white/[0.06] text-[var(--app-text-muted)] hover:bg-white/10',
                  )}
                >
                  <RatioShape ratio={ratio.value} />
                  <span className="text-[9px] font-bold leading-none">{ratio.label}</span>
                </button>
              ))}
            </div>

            {!hasSourceImages ? (
              <>
                <button
                  type="button"
                  onClick={onToggleRefiner}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all',
                    isRefinerEnabled
                      ? 'border-[var(--app-accent)]/30 bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                      : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)]',
                  )}
                >
                  <Sparkles size={12} fill={isRefinerEnabled ? 'currentColor' : 'none'} />
                  Raffineur IA
                </button>

                {activeRefinerProfile && (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-white/[0.03] px-3 py-2 text-[11px] text-[var(--app-text-muted)]">
                    <span className="font-bold text-[var(--app-text)]">{activeRefinerProfile.title}</span>
                    <span className="hidden sm:inline">{activeRefinerProfile.summary}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-white/[0.03] px-3 py-2 text-[11px] text-[var(--app-text-muted)]">
                <Sparkles size={12} className="text-[var(--app-accent)]" />
                Plan auto actif
              </div>
            )}
          </div>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <div className="overflow-hidden rounded-[2.2rem] border border-[var(--app-border)] bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(8,8,12,0.88))] shadow-[0_40px_120px_-60px_rgba(0,0,0,0.92)]">
              <div className="grid gap-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--app-accent)]">
                      Image studio
                    </div>
                    <h2 className="mt-2 text-[clamp(1.7rem,2.8vw,3rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--app-text)]">
                      Prompt + photos.
                      <br />
                      Le plan se cale tout seul.
                    </h2>
                    <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-[var(--app-text-muted)]">
                      {hasSourceImages
                        ? 'Balance les refs, ajoute juste une note si tu veux, puis lance. Le studio sort un plan adapte au produit sans passer par des presets.'
                        : 'Tu peux partir d un prompt libre, ou glisser des photos pour basculer sur un plan produit adapte.'}
                    </p>
                  </div>

                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">
                      Session
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">
                      {hasSourceImages
                        ? `${sourceImages.length} ref${sourceImages.length > 1 ? 's' : ''}`
                        : 'prompt libre'}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(280px,0.98fr)]">
                  <div className="space-y-4">
                    <div className="rounded-[1.8rem] border border-[var(--app-border)] bg-black/20 p-4 sm:p-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                          Invite
                        </div>
                        {hasSourceImages && (
                          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold text-[var(--app-text-muted)]">
                            {adaptiveListingPack.summary}
                          </div>
                        )}
                      </div>

                      <textarea
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        onKeyDown={(event) => {
                          if (!hasSourceImages && event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void handleSubmit();
                          }
                        }}
                        placeholder={
                          hasSourceImages
                            ? 'Notes libres: matiere, fond, crop, angle, niveau premium, defaut a eviter...'
                            : 'Decris ton image: sujet, cadre, lumiere, matiere, energie, style...'
                        }
                        rows={hasSourceImages ? 5 : 6}
                        className="w-full resize-none rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-[14px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/50 outline-none transition-colors focus:border-[var(--app-border-strong)]"
                      />

                      {config.refinerCustomInstructions?.trim() && !hasSourceImages && (
                        <div className="mt-3 rounded-[1rem] border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                          <span className="font-bold text-[var(--app-text)]">Consigne perso:</span>{' '}
                          {config.refinerCustomInstructions}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-[11px] text-[var(--app-text-muted)]">
                          {hasSourceImages
                            ? `Sortie conseillee: ${config.aspectRatio || 'Auto'}`
                            : `Sortie: ${config.aspectRatio || 'Auto'}${config.numberOfImages ? ` - ${config.numberOfImages} image(s)` : ''}`}
                        </div>
                        {!hasSourceImages && (
                          <div className="flex flex-wrap items-center gap-2">
                            {[1, 2, 3, 4].map((count) => (
                              <button
                                key={count}
                                type="button"
                                onClick={() => setConfig({ numberOfImages: count })}
                                className={cn(
                                  'flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold transition-all',
                                  (config.numberOfImages || 1) === count
                                    ? 'bg-[var(--app-accent)] text-[#0a0a14]'
                                    : 'bg-white/[0.06] text-[var(--app-text-muted)] hover:bg-white/10',
                                )}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[1.8rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(8,8,12,0.7))] p-4 sm:p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                            Photos source
                          </div>
                          <div className="mt-1 text-[13px] text-[var(--app-text)]">
                            {hasSourceImages ? 'Ajoute autant de refs que tu veux.' : 'Glisse tes refs produit ici.'}
                          </div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold text-[var(--app-text-muted)]">
                          {sourceImages.length} ref{sourceImages.length > 1 ? 's' : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenFilePicker}
                        className="group flex min-h-[11rem] w-full flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-[var(--app-border-strong)] bg-white/[0.03] px-4 py-6 text-center transition-all hover:border-[var(--app-accent)]/35 hover:bg-[var(--app-accent-soft)]"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[var(--app-accent)] transition-transform group-hover:scale-[1.03]">
                          <Upload size={18} />
                        </div>
                        <div className="mt-4 text-[13px] font-semibold text-[var(--app-text)]">
                          {hasSourceImages ? 'Ajouter d autres photos' : 'Importer tes photos'}
                        </div>
                        <p className="mt-2 max-w-[18rem] text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                          Le studio s en sert pour verrouiller le produit, puis il reconstruit les angles utiles.
                        </p>
                      </button>

                      {sourceImages.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          {sourceImages.map((attachment) => (
                            <div
                              key={attachment.id}
                              className="group relative overflow-hidden rounded-[1.15rem] border border-white/8 bg-black/30"
                            >
                              <button
                                type="button"
                                onClick={() => onImageClick(attachment.url)}
                                className="block w-full"
                              >
                                <img
                                  src={attachment.url}
                                  alt={attachment.name || 'Source produit'}
                                  className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemoveAttachment(attachment.id)}
                                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-black/55 text-white/88 backdrop-blur-sm transition-colors hover:bg-black/75"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      className={cn(
                        'flex w-full items-center justify-center gap-2 rounded-[1.4rem] px-5 py-3 text-[13px] font-bold transition-all',
                        canSubmit
                          ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-lg shadow-[var(--app-accent)]/20 hover:brightness-110'
                          : 'cursor-not-allowed bg-white/[0.06] text-[var(--app-text-muted)]',
                      )}
                    >
                      {(isLoading || isRefining) ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={14} />}
                      {hasSourceImages
                        ? isLoading
                          ? 'Generation du plan...'
                          : `Generer ${adaptiveListingPack.shotCount} vues adaptees`
                        : isRefining
                          ? 'Optimisation...'
                          : isLoading
                            ? 'Generation...'
                            : 'Generer'}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {hasSourceImages ? (
                      <>
                        <div className="rounded-[1.8rem] border border-[var(--app-border)] bg-white/[0.03] p-4 sm:p-5">
                          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                            Plan adapte
                          </div>
                          <div className="mt-3 text-lg font-semibold tracking-tight text-[var(--app-text)]">
                            {adaptiveListingPack.summary}
                          </div>
                          <p className="mt-2 text-[12px] leading-relaxed text-[var(--app-text-muted)]">
                            {adaptiveListingPack.rationale}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold text-[var(--app-text)]">
                              {adaptiveListingPack.productLabel}
                            </span>
                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold text-[var(--app-text-muted)]">
                              {getStyleLabel(adaptiveListingPack.styleId)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold text-[var(--app-text-muted)]">
                              {adaptiveListingPack.shotCount} vues
                            </span>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          {adaptiveListingPack.shots.map((shot, index) => (
                            <div
                              key={shot.id}
                              className="rounded-[1.45rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(8,8,12,0.72))] p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-accent)]">
                                    Vue {index + 1}
                                  </div>
                                  <div className="mt-2 text-[14px] font-semibold text-[var(--app-text)]">
                                    {shot.label}
                                  </div>
                                </div>
                                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold text-[var(--app-text-muted)]">
                                  {shot.shortLabel}
                                </div>
                              </div>
                              <p className="mt-3 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                                {summarizeShotPrompt(shot.prompt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-[1.8rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(8,8,12,0.78))] p-4 sm:p-5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                          Prompt libre
                        </div>
                        <div className="mt-3 text-lg font-semibold tracking-tight text-[var(--app-text)]">
                          Une invite, puis des rendus directs.
                        </div>
                        <p className="mt-2 text-[12px] leading-relaxed text-[var(--app-text-muted)]">
                          Sans photo, le studio reste en mode libre. Des que tu ajoutes des refs, il passe en plan produit adapte sans te demander de categorie ni de preset.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          {['Sujet', 'Lumiere', 'Cadre'].map((item) => (
                            <div key={item} className="rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-[var(--app-text)]">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {!hasSourceImages && refinedPrompt && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="rounded-[2rem] border border-[var(--app-accent)]/20 bg-[var(--app-accent-soft)] p-5"
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
                    Generer avec ce prompt
                  </button>
                  <button
                    type="button"
                    onClick={handleRevertOriginal}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <Undo2 size={11} />
                    Garder l original
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
                    onClick={handleDismissPreview}
                    className="ml-auto text-[11px] text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    Annuler
                  </button>
                </div>
              </motion.div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
