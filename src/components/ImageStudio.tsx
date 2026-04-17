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

import {
  getImageModelLabel,
  IMAGE_MODEL_OPTIONS,
} from '../../shared/image-models.js';
import {
  buildListingPackPlan,
  buildListingPackSummary,
  LISTING_PACK_PRODUCT_OPTIONS,
  LISTING_PACK_STYLE_OPTIONS,
  type ListingPackProductType,
  type ListingPackStyleId,
} from '../../shared/listing-pack.js';
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

type WorkflowMode = 'listing_pack' | 'freeform';

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

  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('listing_pack');
  const [productType, setProductType] = useState<ListingPackProductType>('clothing');
  const [styleId, setStyleId] = useState<ListingPackStyleId>('soft_daylight');
  const [shotCount, setShotCount] = useState(4);
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
  const listingPlan = useMemo(
    () => buildListingPackPlan({
      productType,
      styleId,
      notes: prompt,
      shotCount,
    }),
    [productType, prompt, shotCount, styleId],
  );
  const listingSummary = useMemo(
    () => buildListingPackSummary({
      productType,
      styleId,
      notes: prompt,
      shotCount,
    }),
    [productType, prompt, shotCount, styleId],
  );
  const canSubmit = workflowMode === 'listing_pack'
    ? sourceImages.length > 0 && !isLoading
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

  const copyPrompt = async (value: string, promptId: string) => {
    if (!value.trim()) return;
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
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/')).slice(0, 3);
    if (imageFiles.length === 0) return;
    await onAddAttachments(imageFiles);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (workflowMode === 'listing_pack') {
      onGenerate(listingSummary, {
        originalPrompt: listingSummary,
        listingPack: {
          workflow: 'vinted_pack',
          productType,
          styleId,
          shotCount,
          shots: listingPlan,
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
    } else {
      onGenerate(prompt.trim(), { originalPrompt: prompt.trim() });
      setPrompt('');
    }
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
    <div className="flex h-full flex-col">
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

      <div className="mx-auto w-full max-w-7xl flex-shrink-0 px-4 pt-6 pb-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[1.2rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-1">
            <button
              onClick={() => setWorkflowMode('listing_pack')}
              className={cn(
                'rounded-[0.9rem] px-3 py-2 text-[12px] font-semibold transition-all',
                workflowMode === 'listing_pack'
                  ? 'bg-[var(--app-accent)] text-[#0a0a14]'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]',
              )}
            >
              Pack Vinted
            </button>
            <button
              onClick={() => setWorkflowMode('freeform')}
              className={cn(
                'rounded-[0.9rem] px-3 py-2 text-[12px] font-semibold transition-all',
                workflowMode === 'freeform'
                  ? 'bg-[var(--app-accent)] text-[#0a0a14]'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]',
              )}
            >
              Libre
            </button>
          </div>

          <div className="relative">
            <button
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

          {workflowMode === 'freeform' ? (
            <>
              <button
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
              Prompts angles auto, reel de sortie plus propre que les photos marketplace brutes.
            </div>
          )}
        </div>

        <AnimatePresence>
          {workflowMode === 'freeform' && refinedPrompt && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="rounded-[1.8rem] border border-[var(--app-accent)]/20 bg-[var(--app-accent-soft)] p-5">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--app-accent)]">
                  <Sparkles size={11} />
                  Prompt optimise
                </div>
                <p className="mb-2 text-[13px] leading-relaxed text-[var(--app-text)]">{refinedPrompt}</p>
                <p className="mb-4 text-[11px] text-[var(--app-text-muted)]">Original : {originalPrompt}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleApplyRefined}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-[12px] font-bold text-[#0a0a14] transition-all hover:brightness-110"
                  >
                    <ArrowRight size={12} />
                    Generer avec ce prompt
                  </button>
                  <button
                    onClick={handleRevertOriginal}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <Undo2 size={11} />
                    Garder l'original
                  </button>
                  <button
                    onClick={handleEditRefined}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <Pencil size={11} />
                    Modifier
                  </button>
                  <button
                    onClick={handleDismissPreview}
                    className="ml-auto text-[11px] text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {workflowMode === 'listing_pack' ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_360px]">
            <div className="overflow-hidden rounded-[2rem] border border-[var(--app-border)] bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(8,8,12,0.86))] p-5 shadow-[0_32px_100px_-60px_rgba(0,0,0,0.92)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--app-accent)]">
                    Workflow resale
                  </div>
                  <h2 className="mt-2 text-[clamp(1.6rem,2vw,2.35rem)] font-semibold leading-[1.02] text-[var(--app-text)]">
                    Tu poses tes photos produit, le studio reconstruit un pack d'annonces plus clean et plus vendeur.
                  </h2>
                  <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-[var(--app-text-muted)]">
                    Base-toi sur 1 a 3 photos source. Le moteur garde la silhouette, les matieres et la couleur,
                    puis genere plusieurs angles resale-first: hero, detail, angle secondaire et contexte simple.
                  </p>
                </div>

                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">
                    Pack courant
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">{listingSummary}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-4">
                  <div className="rounded-[1.7rem] border border-[var(--app-border)] bg-white/[0.03] p-4">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                      Type de produit
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {LISTING_PACK_PRODUCT_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setProductType(option.id)}
                          className={cn(
                            'rounded-[1.15rem] border px-3 py-3 text-left transition-all',
                            productType === option.id
                              ? 'border-[var(--app-accent)]/35 bg-[var(--app-accent-soft)]'
                              : 'border-white/8 bg-white/[0.02] hover:border-[var(--app-border-strong)]',
                          )}
                        >
                          <div className="text-[12px] font-semibold text-[var(--app-text)]">{option.label}</div>
                          <div className="mt-1 text-[11px] leading-relaxed text-[var(--app-text-muted)]">{option.summary}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.7rem] border border-[var(--app-border)] bg-white/[0.03] p-4">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                      Direction visuelle
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {LISTING_PACK_STYLE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setStyleId(option.id)}
                          className={cn(
                            'rounded-[1.15rem] border px-3 py-3 text-left transition-all',
                            styleId === option.id
                              ? 'border-[var(--app-accent)]/35 bg-[var(--app-accent-soft)]'
                              : 'border-white/8 bg-white/[0.02] hover:border-[var(--app-border-strong)]',
                          )}
                        >
                          <div className="text-[12px] font-semibold text-[var(--app-text)]">{option.label}</div>
                          <div className="mt-1 text-[11px] leading-relaxed text-[var(--app-text-muted)]">{option.summary}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.7rem] border border-[var(--app-border)] bg-white/[0.03] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                        Plan d'angles
                      </div>
                      <div className="inline-flex rounded-full border border-white/8 bg-black/20 p-1">
                        {[3, 4].map((count) => (
                          <button
                            key={count}
                            onClick={() => setShotCount(count)}
                            className={cn(
                              'rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all',
                              shotCount === count
                                ? 'bg-[var(--app-accent)] text-[#0a0a14]'
                                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]',
                            )}
                          >
                            {count} vues
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {listingPlan.map((shot, index) => (
                        <div
                          key={shot.id}
                          className="rounded-[1.25rem] border border-white/8 bg-white/[0.02] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-accent)]">
                                Vue {index + 1}
                              </div>
                              <div className="mt-2 text-[13px] font-semibold text-[var(--app-text)]">
                                {shot.label}
                              </div>
                            </div>
                            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold text-[var(--app-text-muted)]">
                              {shot.shortLabel}
                            </div>
                          </div>
                          <p className="mt-3 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                            {shot.prompt}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.7rem] border border-[var(--app-border)] bg-white/[0.03] p-4">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                      Note produit optionnelle
                    </div>
                    <textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="Couleur a preserver, vibe, matiere, usage, detail important..."
                      rows={5}
                      className="w-full resize-none rounded-[1.3rem] border border-white/8 bg-black/20 px-4 py-3 text-[13px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/50 outline-none transition-colors focus:border-[var(--app-border-strong)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-[2rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(8,8,12,0.74))] p-4 shadow-[0_24px_90px_-60px_rgba(0,0,0,0.92)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                      Photos source
                    </div>
                    <div className="mt-1 text-[13px] text-[var(--app-text)]">1 a 3 photos produit propres suffisent.</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold text-[var(--app-text-muted)]">
                    {sourceImages.length}/3
                  </div>
                </div>

                <button
                  onClick={handleOpenFilePicker}
                  className="group flex min-h-[11rem] w-full flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-[var(--app-border-strong)] bg-white/[0.03] px-4 py-6 text-center transition-all hover:border-[var(--app-accent)]/35 hover:bg-[var(--app-accent-soft)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[var(--app-accent)] transition-transform group-hover:scale-[1.03]">
                    <Upload size={18} />
                  </div>
                  <div className="mt-4 text-[13px] font-semibold text-[var(--app-text)]">
                    Importer les visuels AliExpress
                  </div>
                  <p className="mt-2 max-w-[16rem] text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                    Le pack garde le vrai produit, mais nettoie l'ambiance, les angles et la lisibilite.
                  </p>
                </button>

                {sourceImages.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {sourceImages.slice(0, 3).map((attachment) => (
                      <div
                        key={attachment.id}
                        className="group relative overflow-hidden rounded-[1.15rem] border border-white/8 bg-black/30"
                      >
                        <button
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
                          onClick={() => onRemoveAttachment(attachment.id)}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-black/55 text-white/88 backdrop-blur-sm transition-colors hover:bg-black/75"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 rounded-[1.3rem] border border-white/8 bg-black/20 p-4 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                  Le moteur vise un rendu resale credible: un seul produit, pas de texte ajoute, pas de collage, pas de faux accessoires.
                </div>
              </div>

              <div className="rounded-[2rem] border border-[var(--app-border)] bg-white/[0.03] p-4">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                  Format & sortie
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {aspectRatios.map((ratio) => (
                    <button
                      key={ratio.value}
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
                <p className="mt-3 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                  Conseille pour ce workflow: <span className="font-semibold text-[var(--app-text)]">4:5</span> ou <span className="font-semibold text-[var(--app-text)]">3:4</span>.
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-[1.4rem] px-5 py-3 text-[13px] font-bold transition-all',
                  canSubmit
                    ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-lg shadow-[var(--app-accent)]/20 hover:brightness-110'
                    : 'cursor-not-allowed bg-white/[0.06] text-[var(--app-text-muted)]',
                )}
              >
                {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={14} />}
                {isLoading ? 'Generation du pack...' : sourceImages.length > 0 ? 'Generer le pack Vinted' : 'Ajoute tes photos source'}
              </button>
            </div>
          </section>
        ) : (
          <div className="rounded-[2rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(8,8,12,0.6))] p-4 shadow-[0_30px_90px_-56px_rgba(0,0,0,0.85)] transition-colors focus-within:border-[var(--app-border-strong)]">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Decris ton image: sujet, cadre, lumiere, matiere, energie, style..."
              rows={4}
              className="w-full resize-none bg-transparent px-2 pt-2 pb-16 text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/50 outline-none"
            />
            <div className="flex flex-col gap-3 border-t border-white/6 pt-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {aspectRatios.map((ratio) => (
                  <button
                    key={ratio.value}
                    onClick={() => setConfig({ aspectRatio: ratio.value as any })}
                    title={ratio.label || 'Auto'}
                    className={cn(
                      'flex min-w-[38px] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-all',
                      (config.aspectRatio || '') === ratio.value
                        ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-sm'
                        : 'bg-white/[0.06] text-[var(--app-text-muted)] hover:bg-white/10',
                    )}
                  >
                    <RatioShape ratio={ratio.value} />
                    <span className="text-[9px] font-bold leading-none">{ratio.label}</span>
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-[var(--app-border)]" />
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
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

              <div className="flex flex-wrap items-center gap-3">
                {config.refinerCustomInstructions?.trim() && (
                  <div className="max-w-[24rem] rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                    <span className="font-bold text-[var(--app-text)]">Consigne perso:</span>{' '}
                    {config.refinerCustomInstructions}
                  </div>
                )}
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all',
                    canSubmit
                      ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-lg shadow-[var(--app-accent)]/20 hover:brightness-110'
                      : 'cursor-not-allowed bg-white/[0.06] text-[var(--app-text-muted)]',
                  )}
                >
                  {(isRefining || isLoading) ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {isRefining ? 'Optimisation...' : isLoading ? 'Generation...' : 'Generer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {!featuredImage && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.6rem] border border-[var(--app-border)] bg-[var(--app-accent-soft)]">
                <ImageIcon size={24} className="text-[var(--app-accent)]" />
              </div>
              <p className="text-sm text-[var(--app-text-muted)]">Tes images apparaitront ici.</p>
            </div>
          ) : (
            <>
              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
                <div className="overflow-hidden rounded-[2rem] border border-[var(--app-border)] bg-black/30 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)]">
                  {isLoading && !featuredImage ? (
                    <div className="flex min-h-[420px] items-center justify-center">
                      <Loader2 size={28} className="animate-spin text-[var(--app-accent)]" />
                    </div>
                  ) : featuredImage ? (
                    <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_340px]">
                      <button
                        onClick={() => onImageClick(featuredImage.url)}
                        className="group relative min-h-[420px] overflow-hidden bg-black"
                      >
                        <img
                          src={featuredImage.url}
                          alt={featuredImage.prompt || 'Image generee'}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
                          loading="lazy"
                          onError={() => hideImage(featuredImage.id)}
                        />
                        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-5 pt-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/72 backdrop-blur-sm">
                              Image phare
                            </div>
                            {featuredImage.shotLabel && (
                              <div className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-semibold text-white/72 backdrop-blur-sm">
                                {featuredImage.shotLabel}
                              </div>
                            )}
                          </div>
                          <div className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-semibold text-white/72 backdrop-blur-sm">
                            {getImageModelLabel(featuredImage.model)}
                          </div>
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/40 to-transparent px-6 pb-6 pt-24 text-left">
                          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/60">
                            {featuredImage.shotLabel ? `Direction retenue · ${featuredImage.shotLabel}` : 'Direction retenue'}
                          </div>
                          <div className="mt-2 max-w-xl text-lg font-semibold text-white">
                            {featuredImage.refinedPrompt || featuredImage.prompt || 'Derniere generation mise en avant'}
                          </div>
                        </div>
                      </button>

                      <div className="flex flex-col gap-4 border-t border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(8,8,12,0.82))] p-5 lg:border-t-0 lg:border-l">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                            Prompt directeur
                          </div>
                          <p className="mt-3 text-[13px] leading-relaxed text-[var(--app-text)]">
                            {featuredImage.refinedPrompt || featuredImage.prompt || 'Prompt indisponible pour cette image historique.'}
                          </p>
                          {featuredImage.refinedPrompt && featuredImage.prompt && featuredImage.refinedPrompt !== featuredImage.prompt && (
                            <p className="mt-3 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                              Original: {featuredImage.prompt}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => copyPrompt(featuredImage.refinedPrompt || featuredImage.prompt, featuredImage.id)}
                            disabled={!featuredImage.prompt && !featuredImage.refinedPrompt}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:text-[var(--app-text-muted)]"
                          >
                            {copiedPromptId === featuredImage.id ? <Check size={13} /> : <Copy size={13} />}
                            {copiedPromptId === featuredImage.id ? 'Copie' : 'Copier le prompt'}
                          </button>
                          <button
                            onClick={() => {
                              setWorkflowMode('freeform');
                              setPrompt(featuredImage.refinedPrompt || featuredImage.prompt);
                            }}
                            disabled={!featuredImage.prompt && !featuredImage.refinedPrompt}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:text-[var(--app-text-muted)]"
                          >
                            <Pencil size={13} />
                            Reutiliser
                          </button>
                          <a
                            href={featuredImage.url}
                            download={featuredImage.name || 'image.png'}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:bg-white/[0.08]"
                          >
                            <Download size={13} />
                            Telecharger
                          </a>
                          <button
                            onClick={() => onImageClick(featuredImage.url)}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:bg-white/[0.08]"
                          >
                            <Maximize2 size={13} />
                            Plein ecran
                          </button>
                        </div>

                        <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
                          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                            Signature de rendu
                          </div>
                          <div className="mt-3 text-[12px] font-semibold text-[var(--app-text)]">
                            {featuredImage.shotLabel ? `${featuredImage.shotLabel} · ` : ''}
                            {getImageModelLabel(featuredImage.model)}
                          </div>
                          <p className="mt-2 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                            Raffineur: {featuredRefinerProfile?.title || 'Profil par defaut'}
                          </p>
                          {featuredImage?.refinerCustomInstructions && (
                            <p className="mt-3 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                              Consigne perso: {featuredImage.refinerCustomInstructions}
                            </p>
                          )}
                          <p className="mt-3 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                            {featuredRefinerProfile?.summary || 'Refinage image standard.'}
                          </p>
                          {hiddenLegacyCount > 0 && (
                            <p className="mt-3 rounded-[1rem] border border-amber-400/20 bg-amber-500/8 px-3 py-2 text-[11px] leading-relaxed text-amber-100/88">
                              {hiddenLegacyCount} rendu(x) introuvable(s) masque(s) car l'ancien bucket ne repond plus.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-[2rem] border border-[var(--app-border)] bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                        Planche contact
                      </div>
                      <div className="text-[11px] text-[var(--app-text-muted)]">
                        {visibleImages.length} rendu(x)
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {isLoading && !visibleImages.length && Array.from({ length: config.numberOfImages || 1 }).map((_, index) => (
                        <div key={`loading-${index}`} className="aspect-square animate-pulse rounded-[1.2rem] border border-[var(--app-border)] bg-[var(--app-surface)]" />
                      ))}
                      {[featuredImage, ...galleryRail].filter(Boolean).slice(0, 8).map((image) => {
                        if (!image) return null;
                        const isSelected = image.id === featuredImage?.id;
                        return (
                          <button
                            key={image.id}
                            onClick={() => setSelectedImageId(image.id)}
                            className={cn(
                              'group relative aspect-square overflow-hidden rounded-[1.3rem] border bg-black transition-all',
                              isSelected
                                ? 'border-[var(--app-border-strong)] ring-2 ring-[var(--app-accent-soft)]'
                                : 'border-[var(--app-border)] hover:border-[var(--app-border-strong)]',
                            )}
                          >
                            <img
                              src={image.url}
                              alt={image.prompt || 'Image generee'}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                              loading="lazy"
                              onError={() => hideImage(image.id)}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 text-left">
                              {image.shotLabel && (
                                <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/70">
                                  {image.shotLabel}
                                </div>
                              )}
                              <div className="line-clamp-2 text-[10px] leading-relaxed text-white/88">
                                {image.refinedPrompt || image.prompt || 'Image'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {optimizedPromptGallery.length > 0 && (
                    <div className="rounded-[2rem] border border-[var(--app-border)] bg-white/[0.03] p-4">
                      <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                        <Sparkles size={12} className="text-[var(--app-accent)]" />
                        Carnet de prompts
                      </div>
                      <div className="space-y-3">
                        {optimizedPromptGallery.map((image) => (
                          <div key={`optimized-${image.id}`} className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text-muted)]">
                                {getImageModelLabel(image.model)}
                              </div>
                              {image.shotLabel && (
                                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold text-[var(--app-text-muted)]">
                                  {image.shotLabel}
                                </div>
                              )}
                            </div>
                            <p className="text-[12px] leading-relaxed text-[var(--app-text)]">{image.refinedPrompt}</p>
                            {image.prompt && image.prompt !== image.refinedPrompt && (
                              <p className="mt-2 text-[11px] leading-relaxed text-[var(--app-text-muted)]">Original: {image.prompt}</p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => copyPrompt(image.refinedPrompt || image.prompt, `optimized-${image.id}`)}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-[var(--app-text)] transition-colors hover:bg-white/[0.08]"
                              >
                                {copiedPromptId === `optimized-${image.id}` ? <Check size={12} /> : <Copy size={12} />}
                                Copier
                              </button>
                              <button
                                onClick={() => {
                                  setWorkflowMode('freeform');
                                  setPrompt(image.refinedPrompt || image.prompt);
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-[var(--app-text)] transition-colors hover:bg-white/[0.08]"
                              >
                                <Pencil size={12} />
                                Reutiliser
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {visibleImages.length > 0 && (
                <section className="rounded-[2rem] border border-[var(--app-border)] bg-white/[0.02] p-4">
                  <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                    Archive visuelle
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleImages.map((image) => (
                      <div key={`card-${image.id}`} className="overflow-hidden rounded-[1.5rem] border border-[var(--app-border)] bg-[var(--app-surface)]/60">
                        <button onClick={() => setSelectedImageId(image.id)} className="block w-full bg-black">
                          <img
                            src={image.url}
                            alt={image.prompt || 'Image generee'}
                            className="aspect-[4/3] w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                            loading="lazy"
                            onError={() => hideImage(image.id)}
                          />
                        </button>
                        <div className="space-y-3 p-4">
                          {image.shotLabel && (
                            <div className="inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold text-[var(--app-text-muted)]">
                              {image.shotLabel}
                            </div>
                          )}
                          <p className="line-clamp-3 text-[12px] leading-relaxed text-[var(--app-text)]">
                            {image.refinedPrompt || image.prompt || 'Prompt indisponible'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => copyPrompt(image.refinedPrompt || image.prompt, image.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-[var(--app-text)] transition-colors hover:bg-white/[0.08]"
                            >
                              {copiedPromptId === image.id ? <Check size={12} /> : <Copy size={12} />}
                              Copier
                            </button>
                            <button
                              onClick={() => onImageClick(image.url)}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-[var(--app-text)] transition-colors hover:bg-white/[0.08]"
                            >
                              <Maximize2 size={12} />
                              Voir
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
