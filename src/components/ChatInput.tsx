import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, Send, ImageIcon, Film, Mic, Paperclip, X, Music, FileText, Youtube, ChevronRight, Square, SlidersHorizontal
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Attachment, AttachmentVideoMetadata } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

function extractYouTubeVideoId(url?: string) {
  if (!url) return null;

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, '');

    if (hostname.includes('youtu.be')) {
      return pathname.split('/').filter(Boolean)[0] || null;
    }

    if (hostname.includes('youtube.com')) {
      const watchId = parsed.searchParams.get('v');
      if (watchId) return watchId;

      const segments = pathname.split('/').filter(Boolean);
      const index = segments.findIndex((segment) => ['shorts', 'live', 'embed'].includes(segment));
      if (index >= 0 && segments[index + 1]) {
        return segments[index + 1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

function buildYouTubeThumbnailUrl(url?: string) {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;
}

function parseTimeOffsetInput(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (/^\d{1,2}:\d{1,2}(?::\d{1,2}(?:\.\d+)?)?$/.test(trimmed)) {
    const parts = trimmed.split(':').map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 2) {
      return (parts[0] * 60) + parts[1];
    }
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }

  const unitRegex = /(\d+(?:\.\d+)?)(h|m|s)/g;
  let consumed = '';
  let total = 0;
  let match: RegExpExecArray | null;

  while ((match = unitRegex.exec(trimmed)) !== null) {
    consumed += match[0];
    const numericValue = Number(match[1]);
    if (!Number.isFinite(numericValue)) return null;
    const unit = match[2];
    total += unit === 'h' ? numericValue * 3600 : unit === 'm' ? numericValue * 60 : numericValue;
  }

  return consumed === trimmed ? total : null;
}

function formatTimeOffsetInput(seconds?: number) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return '';
  }

  const rounded = Math.round(seconds * 1000) / 1000;
  if (!Number.isInteger(rounded)) {
    return `${rounded.toFixed(3).replace(/\.?0+$/, '')}s`;
  }

  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainderSeconds = rounded % 60;

  if (hours > 0) {
    return `${hours}h${minutes > 0 ? `${minutes}m` : ''}${remainderSeconds > 0 ? `${remainderSeconds}s` : ''}`;
  }
  if (minutes > 0) {
    return `${minutes}m${remainderSeconds > 0 ? `${remainderSeconds}s` : ''}`;
  }
  return `${remainderSeconds}s`;
}

function buildVideoMetadataSummary(videoMetadata?: AttachmentVideoMetadata) {
  if (!videoMetadata) return null;

  const segments = [
    typeof videoMetadata.startOffsetSeconds === 'number'
      ? `Debut ${formatTimeOffsetInput(videoMetadata.startOffsetSeconds)}`
      : null,
    typeof videoMetadata.endOffsetSeconds === 'number'
      ? `Fin ${formatTimeOffsetInput(videoMetadata.endOffsetSeconds)}`
      : null,
    typeof videoMetadata.fps === 'number'
      ? `${videoMetadata.fps} FPS`
      : null,
  ].filter(Boolean);

  return segments.length > 0 ? segments.join(' · ') : null;
}

type YouTubeSettingsDraft = {
  attachmentId: string;
  startInput: string;
  endInput: string;
  fpsInput: string;
  error: string | null;
};

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isLoading: boolean;
  isRecording: boolean;
  recordingTime: number;
  onToggleRecording: () => void;
  processFiles: (files: FileList | File[]) => Promise<void>;
  pendingAttachments: Attachment[];
  setPendingAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  setSelectedImage: (url: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSend, onStop, isLoading, isRecording, recordingTime, onToggleRecording, processFiles, pendingAttachments, setPendingAttachments, setSelectedImage 
}) => {
  const [text, setText] = useState('');
  const [youtubeSettingsDraft, setYoutubeSettingsDraft] = useState<YouTubeSettingsDraft | null>(null);
  const { configs, activeMode, theme } = useStore();
  const config = configs[activeMode];
  const placeholderByMode = {
    chat: 'Envoyer un message…',
    cowork: "Decris la mission, le livrable ou l'app a construire…",
    image: 'Decris le cadre, la lumiere, la matiere et le ratio…',
    video: 'Decris la scene, le mouvement, le format et la duree…',
    audio: 'Colle le texte a lire et le ton souhaite…',
    lyria: 'Decris le morceau, le tempo, l energie et les textures…',
  } as const;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const youtubeSettingsAttachment = youtubeSettingsDraft
    ? pendingAttachments.find((attachment) => attachment.id === youtubeSettingsDraft.attachmentId)
    : null;

  const handleSendClick = () => {
    if ((!text.trim() && pendingAttachments.length === 0) || isLoading) return;
    onSend(text);
    setText('');
    setPendingAttachments([]);
    setYoutubeSettingsDraft(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  useEffect(() => {
    if (!youtubeSettingsDraft) return;
    const attachmentStillExists = pendingAttachments.some(
      (attachment) => attachment.id === youtubeSettingsDraft.attachmentId
    );
    if (!attachmentStillExists) {
      setYoutubeSettingsDraft(null);
    }
  }, [pendingAttachments, youtubeSettingsDraft]);

  const openYouTubeSettings = (attachment: Attachment) => {
    setYoutubeSettingsDraft({
      attachmentId: attachment.id,
      startInput: formatTimeOffsetInput(attachment.videoMetadata?.startOffsetSeconds),
      endInput: formatTimeOffsetInput(attachment.videoMetadata?.endOffsetSeconds),
      fpsInput: typeof attachment.videoMetadata?.fps === 'number' ? String(attachment.videoMetadata.fps) : '',
      error: null,
    });
  };

  const saveYouTubeSettings = () => {
    if (!youtubeSettingsDraft) return;

    const startText = youtubeSettingsDraft.startInput.trim();
    const endText = youtubeSettingsDraft.endInput.trim();
    const fpsText = youtubeSettingsDraft.fpsInput.trim();

    const startOffsetSeconds = startText ? parseTimeOffsetInput(startText) : null;
    if (startText && startOffsetSeconds === null) {
      setYoutubeSettingsDraft((prev) => prev ? {
        ...prev,
        error: 'Le debut doit etre un temps valide, par exemple 1m10s ou 01:10.',
      } : prev);
      return;
    }

    const endOffsetSeconds = endText ? parseTimeOffsetInput(endText) : null;
    if (endText && endOffsetSeconds === null) {
      setYoutubeSettingsDraft((prev) => prev ? {
        ...prev,
        error: 'La fin doit etre un temps valide, par exemple 2m30s ou 02:30.',
      } : prev);
      return;
    }

    const fps = fpsText ? Number(fpsText) : undefined;
    if (fpsText && (!Number.isFinite(fps) || fps <= 0 || fps > 24)) {
      setYoutubeSettingsDraft((prev) => prev ? {
        ...prev,
        error: 'Le FPS doit etre un nombre entre 0 et 24.',
      } : prev);
      return;
    }

    if (
      typeof startOffsetSeconds === 'number'
      && typeof endOffsetSeconds === 'number'
      && endOffsetSeconds <= startOffsetSeconds
    ) {
      setYoutubeSettingsDraft((prev) => prev ? {
        ...prev,
        error: 'La fin doit etre apres le debut.',
      } : prev);
      return;
    }

    const nextVideoMetadata: AttachmentVideoMetadata | undefined =
      typeof startOffsetSeconds === 'number'
      || typeof endOffsetSeconds === 'number'
      || typeof fps === 'number'
        ? {
            ...(typeof startOffsetSeconds === 'number' ? { startOffsetSeconds } : {}),
            ...(typeof endOffsetSeconds === 'number' ? { endOffsetSeconds } : {}),
            ...(typeof fps === 'number' ? { fps } : {}),
          }
        : undefined;

    setPendingAttachments((prev) => prev.map((attachment) => (
      attachment.id === youtubeSettingsDraft.attachmentId
        ? {
            ...attachment,
            mimeType: attachment.mimeType || 'video/mp4',
            videoMetadata: nextVideoMetadata,
          }
        : attachment
    )));
    setYoutubeSettingsDraft(null);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      processFiles(e.clipboardData.files);
    } else {
      const clipboardText = e.clipboardData.getData('text');
      // Regex for standard, shorts, live, and mobile YouTube URLs
      const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/|m\.youtube\.com\/watch\?v=)([^&\s\?]+)/g;
      const matches = Array.from(clipboardText.matchAll(ytRegex));
      
      if (matches.length > 0) {
        e.preventDefault();
        let remainingText = clipboardText;

        matches.forEach(match => {
          const url = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
          if (!pendingAttachments.some(a => a.url === url)) {
            const id = Math.random().toString(36).substring(7);
            setPendingAttachments(prev => [...prev, {
              id,
              type: 'youtube',
              url: url,
              name: `Chargement du titre...`,
              mimeType: 'video/mp4',
              thumbnail: buildYouTubeThumbnailUrl(url),
            }]);

            // Fetch real title from backend
            fetch(`/api/metadata?url=${encodeURIComponent(url)}`)
              .then(res => res.json())
              .then(data => {
                if (data.title || data.thumbnail) {
                  setPendingAttachments(prev => prev.map(a => 
                    a.id === id ? {
                      ...a,
                      name: data.title || a.name,
                      thumbnail: data.thumbnail || a.thumbnail,
                    } : a
                  ));
                }
              })
              .catch(() => {
                setPendingAttachments(prev => prev.map(a => 
                  a.id === id ? { ...a, name: 'Vidéo YouTube' } : a
                ));
              });
          }
          // Remove the link from the remaining text
          remainingText = remainingText.replace(match[0], '').trim();
        });

        if (remainingText || text) {
          setText(prev => (prev + ' ' + remainingText).trim());
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`;
            }
          }, 0);
        }
      }
    }
  };
  return (
    <div className="relative group/input">
      <div className="absolute -inset-px rounded-[1.7rem] bg-[linear-gradient(135deg,rgba(129,236,255,0),rgba(129,236,255,0),rgba(255,191,134,0))] blur-sm transition-all duration-700 group-focus-within/input:bg-[linear-gradient(135deg,rgba(129,236,255,0.24),rgba(68,196,255,0.1),rgba(255,191,134,0.18))]" />
      
      <div className="studio-panel-strong relative rounded-[2rem] p-2.5 ring-1 ring-white/5 transition-all duration-500">
        
        
        {/* Recording Indicator */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-center gap-3 py-2.5 px-4 mx-1 bg-red-500/[0.08] border border-red-500/15 rounded-2xl">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-4 h-4 bg-red-500/30 rounded-full animate-ping" />
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                </div>
                <span className="text-sm text-red-400 font-medium">Enregistrement en cours</span>
                <span className="text-sm text-red-400/60 font-mono tabular-nums">{formatTime(recordingTime)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending Attachments */}
        <AnimatePresence>
          {pendingAttachments.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-1 mb-1 flex flex-wrap gap-2.5 overflow-hidden border-b border-[var(--app-border)]/60 p-2 pb-1"
            >
              {pendingAttachments.map((att, idx) => (
                <motion.div 
                  key={att.id} 
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 25,
                    delay: idx * 0.05 
                  }}
                  className="group/att relative w-[140px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm transition-all hover:border-[var(--app-border-strong)] hover:shadow-[0_16px_30px_-24px_rgba(68,196,255,0.32)]"
                >
                  <div className="flex flex-col gap-2 p-2">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-black/20 ring-1 ring-white/5">
                      {att.type === 'image' ? (
                        <img src={att.url} alt="preview" className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-500" onClick={() => setSelectedImage(att.url)} />
                      ) : att.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center text-indigo-400 bg-indigo-500/10">
                          <Film size={24} />
                        </div>
                      ) : att.type === 'audio' ? (
                        <div className="w-full h-full flex items-center justify-center text-pink-400 bg-pink-500/10">
                          <Mic size={24} />
                        </div>
                      ) : att.type === 'document' ? (
                        <div className="w-full h-full flex items-center justify-center text-emerald-400 bg-emerald-500/10">
                          <FileText size={24} />
                        </div>
                      ) : att.type === 'youtube' ? (
                        att.thumbnail ? (
                          <>
                            <img
                              src={att.thumbnail}
                              alt={att.name || 'Video YouTube'}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                            <div className="absolute inset-0 flex items-center justify-center text-white/95">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/90 shadow-[0_18px_36px_-22px_rgba(239,68,68,0.95)]">
                                <Youtube size={22} />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-red-500 bg-red-500/10">
                            <Youtube size={24} />
                          </div>
                        )
                      ) : null}
                      
                      {/* Badge Type */}
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-bold uppercase tracking-wider text-white/90">
                        {att.type}
                      </div>
                      {att.type === 'youtube' && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openYouTubeSettings(att);
                          }}
                          className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/90 backdrop-blur-md opacity-0 transition-opacity group-hover/att:opacity-100"
                          title="Regler la plage video"
                        >
                          <SlidersHorizontal size={13} />
                        </button>
                      )}
                    </div>
                    
                    <div className="px-1 pb-1">
                      <span className="block truncate text-[10px] font-medium text-[var(--app-text)]/90">{att.name}</span>
                      {buildVideoMetadataSummary(att.videoMetadata) && (
                        <span className="mt-1 block line-clamp-2 text-[9px] leading-relaxed text-[var(--app-text-muted)]/80">
                          {buildVideoMetadataSummary(att.videoMetadata)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => setPendingAttachments(prev => prev.filter(a => a.id !== att.id))}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white hover:bg-red-500 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 opacity-0 group-hover/att:opacity-100 transition-all shadow-xl z-20"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls Row */}
        <div className="rounded-[1.55rem] border border-[var(--app-border)] bg-black/15 px-2 py-2 sm:px-2.5 flex items-end gap-1.5">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files);
              e.target.value = '';
            }} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-transparent bg-white/[0.03] text-[var(--app-text-muted)] transition-all duration-200 hover:border-[var(--app-border)] hover:bg-white/[0.06] hover:text-[var(--app-text)]"
            title="Joindre un fichier"
          >
            <Paperclip size={19} />
          </button>
          <button 
            onClick={onToggleRecording}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 border",
              isRecording 
                ? "text-red-400 bg-red-500/10 hover:bg-red-500/15 border-red-500/20" 
                : "text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-white/[0.06] border-transparent hover:border-[var(--app-border)]"
            )}
            title={isRecording ? "Arrêter l'enregistrement" : "Enregistrer un message vocal"}
          >
            {isRecording ? <div className="w-3.5 h-3.5 bg-red-500 rounded-[3px]" /> : <Mic size={19} />}
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendClick();
              }
            }}
            onPaste={handlePaste}
            placeholder={isRecording ? "Enregistrement en cours…" : placeholderByMode[activeMode]}
            disabled={isRecording}
            className="w-full max-h-60 min-h-[48px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2.5 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/55 text-[15px] leading-7 outline-none disabled:opacity-50"
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 240)}px`;
            }}
          />
          <button
            onClick={isLoading ? onStop : handleSendClick}
            disabled={!isLoading && (!text.trim() && pendingAttachments.length === 0)}
            className={cn(
              "w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-300 m-0.5 border",
              isLoading
                ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 border-red-500/20"
                : (!text.trim() && pendingAttachments.length === 0)
                  ? "bg-[var(--app-text)]/[0.04] text-[var(--app-text-muted)] border-transparent"
                  : "border-[var(--app-border-strong)] bg-[linear-gradient(135deg,rgba(129,236,255,0.95),rgba(68,196,255,0.78))] text-[#041018] shadow-[0_20px_48px_-24px_rgba(68,196,255,0.7)]"
            )}
          >
            {isLoading ? <Square size={16} fill="currentColor" /> : <ChevronRight size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {youtubeSettingsDraft && youtubeSettingsAttachment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-black/72 p-4 backdrop-blur-md md:items-center"
            onClick={() => setYoutubeSettingsDraft(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
              className="studio-panel-strong my-auto flex max-h-[calc(100vh-4.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-[var(--app-border)] bg-[var(--app-surface-strong)]/95 shadow-[0_36px_90px_-36px_rgba(0,0,0,0.85)] md:max-h-[calc(100vh-2rem)]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] px-4 py-4 md:px-6 md:py-5">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-300/90">
                    Video settings
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-xl font-semibold text-[var(--app-text)]">
                    {youtubeSettingsAttachment.name || 'Lien YouTube'}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">
                    Regle la portion analysee par Gemini exactement comme une entree video native.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setYoutubeSettingsDraft(null)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-white/[0.04] text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  title="Fermer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] md:gap-6 md:px-6 md:py-6">
                  <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/30">
                    {youtubeSettingsAttachment.thumbnail ? (
                      <div className="relative aspect-video">
                        <img
                          src={youtubeSettingsAttachment.thumbnail}
                          alt={youtubeSettingsAttachment.name || 'Video YouTube'}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/92 shadow-[0_28px_48px_-28px_rgba(239,68,68,0.95)]">
                            <Youtube size={34} className="text-white" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-red-500/10 text-red-300">
                        <Youtube size={34} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[var(--app-text)]">
                        Start Time
                      </span>
                      <input
                        type="text"
                        value={youtubeSettingsDraft.startInput}
                        onChange={(event) => setYoutubeSettingsDraft((prev) => prev ? {
                          ...prev,
                          startInput: event.target.value,
                          error: null,
                        } : prev)}
                        placeholder="e.g., 1m10s"
                        className="studio-input h-12"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[var(--app-text)]">
                        End Time
                      </span>
                      <input
                        type="text"
                        value={youtubeSettingsDraft.endInput}
                        onChange={(event) => setYoutubeSettingsDraft((prev) => prev ? {
                          ...prev,
                          endInput: event.target.value,
                          error: null,
                        } : prev)}
                        placeholder="e.g., 2m30s"
                        className="studio-input h-12"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[var(--app-text)]">
                        FPS (frames per second)
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={youtubeSettingsDraft.fpsInput}
                        onChange={(event) => setYoutubeSettingsDraft((prev) => prev ? {
                          ...prev,
                          fpsInput: event.target.value,
                          error: null,
                        } : prev)}
                        placeholder="Defaults to 1 FPS"
                        className="studio-input h-12"
                      />
                    </label>

                    <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-[var(--app-text-muted)]">
                      Formats acceptes: <span className="text-[var(--app-text)]">1m10s</span>, <span className="text-[var(--app-text)]">70s</span>, <span className="text-[var(--app-text)]">01:10</span>.
                      Laisse vide pour analyser toute la video.
                    </div>

                    {youtubeSettingsDraft.error && (
                      <div className="rounded-[1.15rem] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {youtubeSettingsDraft.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[var(--app-border)] px-4 py-4 md:px-6 md:py-5">
                <button
                  type="button"
                  onClick={() => setYoutubeSettingsDraft(null)}
                  className="inline-flex items-center justify-center rounded-2xl border border-[var(--app-border)] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveYouTubeSettings}
                  className="inline-flex items-center justify-center rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,rgba(129,236,255,0.95),rgba(68,196,255,0.78))] px-4 py-2.5 text-sm font-semibold text-[#041018] shadow-[0_20px_48px_-24px_rgba(68,196,255,0.7)]"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
