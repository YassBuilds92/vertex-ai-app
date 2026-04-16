import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Film, Mic, Paperclip, X, FileText, Youtube, Square, SlidersHorizontal, ArrowUp
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
      if (index >= 0 && segments[index + 1]) return segments[index + 1];
    }
  } catch { return null; }
  return null;
}

function buildYouTubeThumbnailUrl(url?: string) {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;
}

function parseTimeOffsetInput(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (/^\d{1,2}:\d{1,2}(?::\d{1,2}(?:\.\d+)?)?$/.test(trimmed)) {
    const parts = trimmed.split(':').map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
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
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '';
  const rounded = Math.round(seconds * 1000) / 1000;
  if (!Number.isInteger(rounded)) return `${rounded.toFixed(3).replace(/\.?0+$/, '')}s`;
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainderSeconds = rounded % 60;
  if (hours > 0) return `${hours}h${minutes > 0 ? `${minutes}m` : ''}${remainderSeconds > 0 ? `${remainderSeconds}s` : ''}`;
  if (minutes > 0) return `${minutes}m${remainderSeconds > 0 ? `${remainderSeconds}s` : ''}`;
  return `${remainderSeconds}s`;
}

function buildVideoMetadataSummary(videoMetadata?: AttachmentVideoMetadata) {
  if (!videoMetadata) return null;
  const segments = [
    typeof videoMetadata.startOffsetSeconds === 'number' ? `Debut ${formatTimeOffsetInput(videoMetadata.startOffsetSeconds)}` : null,
    typeof videoMetadata.endOffsetSeconds === 'number' ? `Fin ${formatTimeOffsetInput(videoMetadata.endOffsetSeconds)}` : null,
    typeof videoMetadata.fps === 'number' ? `${videoMetadata.fps} FPS` : null,
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
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend, onStop, isLoading, isRecording, recordingTime, onToggleRecording, processFiles, pendingAttachments, setPendingAttachments, setSelectedImage, placeholder
}) => {
  const [text, setText] = useState('');
  const [youtubeSettingsDraft, setYoutubeSettingsDraft] = useState<YouTubeSettingsDraft | null>(null);
  const { configs, activeMode } = useStore();
  const placeholderByMode = {
    chat: 'Ecris ton message…',
    cowork: 'Decris ta mission…',
    image: 'Decris ton image…',
    video: 'Decris ta scene…',
    audio: 'Colle ton texte…',
    lyria: 'Decris ton morceau…',
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
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  useEffect(() => {
    if (!youtubeSettingsDraft) return;
    const attachmentStillExists = pendingAttachments.some(
      (attachment) => attachment.id === youtubeSettingsDraft.attachmentId
    );
    if (!attachmentStillExists) setYoutubeSettingsDraft(null);
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
      setYoutubeSettingsDraft((prev) => prev ? { ...prev, error: 'Le debut doit etre un temps valide (ex: 1m10s, 01:10).' } : prev);
      return;
    }
    const endOffsetSeconds = endText ? parseTimeOffsetInput(endText) : null;
    if (endText && endOffsetSeconds === null) {
      setYoutubeSettingsDraft((prev) => prev ? { ...prev, error: 'La fin doit etre un temps valide (ex: 2m30s, 02:30).' } : prev);
      return;
    }
    const fps = fpsText ? Number(fpsText) : undefined;
    if (fpsText && (!Number.isFinite(fps) || fps! <= 0 || fps! > 24)) {
      setYoutubeSettingsDraft((prev) => prev ? { ...prev, error: 'Le FPS doit etre entre 0 et 24.' } : prev);
      return;
    }
    if (typeof startOffsetSeconds === 'number' && typeof endOffsetSeconds === 'number' && endOffsetSeconds <= startOffsetSeconds) {
      setYoutubeSettingsDraft((prev) => prev ? { ...prev, error: 'La fin doit etre apres le debut.' } : prev);
      return;
    }

    const nextVideoMetadata: AttachmentVideoMetadata | undefined =
      typeof startOffsetSeconds === 'number' || typeof endOffsetSeconds === 'number' || typeof fps === 'number'
        ? {
            ...(typeof startOffsetSeconds === 'number' ? { startOffsetSeconds } : {}),
            ...(typeof endOffsetSeconds === 'number' ? { endOffsetSeconds } : {}),
            ...(typeof fps === 'number' ? { fps } : {}),
          }
        : undefined;

    setPendingAttachments((prev) => prev.map((attachment) => (
      attachment.id === youtubeSettingsDraft.attachmentId
        ? { ...attachment, mimeType: attachment.mimeType || 'video/mp4', videoMetadata: nextVideoMetadata }
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
              id, type: 'youtube', url, name: `Chargement…`, mimeType: 'video/mp4',
              thumbnail: buildYouTubeThumbnailUrl(url),
            }]);
            fetch(`/api/metadata?url=${encodeURIComponent(url)}`)
              .then(res => res.json())
              .then(data => {
                if (data.title || data.thumbnail) {
                  setPendingAttachments(prev => prev.map(a =>
                    a.id === id ? { ...a, name: data.title || a.name, thumbnail: data.thumbnail || a.thumbnail } : a
                  ));
                }
              })
              .catch(() => {
                setPendingAttachments(prev => prev.map(a =>
                  a.id === id ? { ...a, name: 'Video YouTube' } : a
                ));
              });
          }
          remainingText = remainingText.replace(match[0], '').trim();
        });
        if (remainingText || text) {
          setText(prev => (prev + ' ' + remainingText).trim());
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
            }
          }, 0);
        }
      }
    }
  };

  const canSend = text.trim() || pendingAttachments.length > 0;

  return (
    <div className="relative">
      <div className={cn(
        "relative rounded-2xl border bg-[var(--app-surface-strong)] transition-all duration-200",
        "border-[var(--app-border)] focus-within:border-[var(--app-accent)]/40 focus-within:shadow-[0_0_0_3px_var(--app-accent-soft)]"
      )}>
        {/* Recording indicator */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-center gap-3 px-4 py-2.5 border-b border-[var(--app-border)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <span className="text-xs font-medium text-red-400">Enregistrement</span>
                <span className="text-xs text-red-400/60 font-mono tabular-nums">{formatTime(recordingTime)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attachments */}
        <AnimatePresence>
          {pendingAttachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-b border-[var(--app-border)]"
            >
              <div className="flex flex-wrap gap-2 p-2.5">
                {pendingAttachments.map((att, idx) => (
                  <motion.div
                    key={att.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: idx * 0.03 }}
                    className="group/att relative w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)] transition-colors"
                  >
                    <div className="aspect-square overflow-hidden bg-black/10">
                      {att.type === 'image' ? (
                        <img src={att.url} alt="" className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" onClick={() => setSelectedImage(att.url)} />
                      ) : att.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center text-indigo-400 bg-indigo-500/5"><Film size={20} /></div>
                      ) : att.type === 'audio' ? (
                        <div className="w-full h-full flex items-center justify-center text-rose-400 bg-rose-500/5"><Mic size={20} /></div>
                      ) : att.type === 'document' ? (
                        <div className="w-full h-full flex items-center justify-center text-emerald-400 bg-emerald-500/5"><FileText size={20} /></div>
                      ) : att.type === 'youtube' ? (
                        att.thumbnail ? (
                          <>
                            <img src={att.thumbnail} alt={att.name || ''} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/90"><Youtube size={14} className="text-white" /></div>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-red-400 bg-red-500/5"><Youtube size={20} /></div>
                        )
                      ) : null}

                      {att.type === 'youtube' && (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); openYouTubeSettings(att); }}
                          className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg bg-black/50 text-white/80 opacity-0 group-hover/att:opacity-100 transition-opacity"
                        >
                          <SlidersHorizontal size={11} />
                        </button>
                      )}
                    </div>

                    <div className="px-2 py-1.5">
                      <span className="block truncate text-[10px] font-medium text-[var(--app-text)]/80">{att.name}</span>
                      {buildVideoMetadataSummary(att.videoMetadata) && (
                        <span className="mt-0.5 block text-[9px] text-[var(--app-text-muted)]">
                          {buildVideoMetadataSummary(att.videoMetadata)}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => setPendingAttachments(prev => prev.filter(a => a.id !== att.id))}
                      className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 text-white hover:bg-red-500 rounded-md flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-all z-20"
                    >
                      <X size={10} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area */}
        <div className="flex items-end gap-1 p-2">
          <input
            type="file" ref={fileInputRef} className="hidden" multiple
            onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] transition-colors"
            title="Joindre"
          >
            <Paperclip size={16} />
          </button>

          <button
            onClick={onToggleRecording}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
              isRecording
                ? "text-red-400 bg-red-500/10"
                : "text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]"
            )}
            title={isRecording ? "Stop" : "Micro"}
          >
            {isRecording ? <div className="w-2.5 h-2.5 bg-red-500 rounded-sm" /> : <Mic size={16} />}
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
            placeholder={isRecording ? "Enregistrement…" : (placeholder || placeholderByMode[activeMode])}
            disabled={isRecording}
            className="w-full max-h-[200px] min-h-[36px] bg-transparent border-none focus:ring-0 resize-none py-2 px-2 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/50 text-sm leading-6 outline-none disabled:opacity-40"
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
          />

          <button
            onClick={isLoading ? onStop : handleSendClick}
            disabled={!isLoading && !canSend}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
              isLoading
                ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                : canSend
                  ? "bg-[var(--app-accent)] text-white shadow-sm hover:opacity-90"
                  : "text-[var(--app-text-muted)]/30 cursor-default"
            )}
          >
            {isLoading ? <Square size={14} fill="currentColor" /> : <ArrowUp size={16} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {/* YouTube Settings Modal */}
      <AnimatePresence>
        {youtubeSettingsDraft && youtubeSettingsAttachment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setYoutubeSettingsDraft(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(event) => event.stopPropagation()}
              className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] px-5 py-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-red-400">Video</div>
                  <h3 className="mt-1.5 text-lg font-semibold text-[var(--app-text)] line-clamp-1">
                    {youtubeSettingsAttachment.name || 'YouTube'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setYoutubeSettingsDraft(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid gap-5 p-5 md:grid-cols-[1fr_1fr]">
                  <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-black/20">
                    {youtubeSettingsAttachment.thumbnail ? (
                      <div className="relative aspect-video">
                        <img src={youtubeSettingsAttachment.thumbnail} alt="" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/90 shadow-lg">
                            <Youtube size={24} className="text-white" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex aspect-video items-center justify-center text-red-400"><Youtube size={28} /></div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-[var(--app-text)]">Debut</span>
                      <input type="text" value={youtubeSettingsDraft.startInput}
                        onChange={(event) => setYoutubeSettingsDraft((prev) => prev ? { ...prev, startInput: event.target.value, error: null } : prev)}
                        placeholder="ex: 1m10s" className="studio-input" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-[var(--app-text)]">Fin</span>
                      <input type="text" value={youtubeSettingsDraft.endInput}
                        onChange={(event) => setYoutubeSettingsDraft((prev) => prev ? { ...prev, endInput: event.target.value, error: null } : prev)}
                        placeholder="ex: 2m30s" className="studio-input" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-[var(--app-text)]">FPS</span>
                      <input type="text" inputMode="decimal" value={youtubeSettingsDraft.fpsInput}
                        onChange={(event) => setYoutubeSettingsDraft((prev) => prev ? { ...prev, fpsInput: event.target.value, error: null } : prev)}
                        placeholder="1 par defaut" className="studio-input" />
                    </label>
                    {youtubeSettingsDraft.error && (
                      <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-300">{youtubeSettingsDraft.error}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[var(--app-border)] px-5 py-3">
                <button type="button" onClick={() => setYoutubeSettingsDraft(null)}
                  className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors">
                  Annuler
                </button>
                <button type="button" onClick={saveYouTubeSettings}
                  className="rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity">
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
