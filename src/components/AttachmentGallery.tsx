import React from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Mic,
  Youtube,
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Attachment } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AttachmentGalleryProps = {
  attachments: Attachment[];
  setSelectedImage: (url: string) => void;
  variant?: 'compact' | 'full';
};

function getAttachmentMeta(attachment: Attachment) {
  if (attachment.type === 'youtube') return 'youtube.com';
  if (attachment.mimeType) return attachment.mimeType;
  return attachment.type;
}

export const AttachmentGallery: React.FC<AttachmentGalleryProps> = ({
  attachments,
  setSelectedImage,
  variant = 'full',
}) => {
  if (!attachments.length) return null;

  const cardWidthClass = variant === 'compact'
    ? 'w-[180px] sm:w-[200px]'
    : 'w-full sm:w-[260px] md:w-[320px]';

  return (
    <div className={cn('flex flex-wrap gap-3', variant === 'compact' && 'gap-2.5')}>
      {attachments.map((attachment, index) => {
        const key = `${attachment.id || attachment.url}-${index}`;

        if (attachment.type === 'image') {
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'group/media overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20 shadow-2xl',
                cardWidthClass,
              )}
            >
              <div className="relative">
                <img
                  src={attachment.url}
                  alt={attachment.name || 'Image jointe'}
                  className="aspect-[4/3] w-full object-cover cursor-pointer transition-transform duration-500 group-hover/media:scale-[1.02]"
                  onClick={() => setSelectedImage(attachment.url)}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-3 pb-3 pt-12">
                  <div className="text-sm font-medium text-white truncate">{attachment.name || 'Image jointe'}</div>
                  <div className="text-[11px] text-white/65">{getAttachmentMeta(attachment)}</div>
                </div>
                <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover/media:opacity-100">
                  <button
                    onClick={() => setSelectedImage(attachment.url)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/60 text-white backdrop-blur-md"
                    title="Agrandir l'image"
                  >
                    <ImageIcon size={16} />
                  </button>
                  <a
                    href={attachment.url}
                    download={attachment.name || 'image'}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/60 text-white backdrop-blur-md"
                    title="Telecharger"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Download size={16} />
                  </a>
                </div>
              </div>
            </motion.div>
          );
        }

        if (attachment.type === 'video') {
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'group/media overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/25 shadow-2xl',
                cardWidthClass,
              )}
            >
              <video
                src={attachment.url}
                controls
                poster={attachment.thumbnail}
                className="aspect-video w-full bg-black"
              />
              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--app-text)]">{attachment.name || 'Video jointe'}</div>
                  <div className="text-[11px] text-[var(--app-text-muted)]">{getAttachmentMeta(attachment)}</div>
                </div>
                <a
                  href={attachment.url}
                  download={attachment.name || 'video'}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[var(--app-text)]"
                  title="Telecharger"
                >
                  <Download size={16} />
                </a>
              </div>
            </motion.div>
          );
        }

        if (attachment.type === 'audio') {
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'rounded-[1.35rem] border border-white/10 bg-[var(--app-surface)]/50 p-4 shadow-xl',
                cardWidthClass,
              )}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-300">
                  <Mic size={18} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--app-text)]">{attachment.name || 'Audio joint'}</div>
                  <div className="text-[11px] text-[var(--app-text-muted)]">{getAttachmentMeta(attachment)}</div>
                </div>
              </div>
              <audio controls src={attachment.url} className="w-full" />
            </motion.div>
          );
        }

        if (attachment.type === 'youtube') {
          return (
            <motion.a
              key={key}
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'group/link rounded-[1.35rem] border border-red-500/20 bg-[linear-gradient(180deg,rgba(239,68,68,0.14),rgba(10,10,10,0.12))] p-4 shadow-xl transition-colors hover:border-red-400/35',
                cardWidthClass,
              )}
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
                  <Youtube size={18} />
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-medium text-[var(--app-text)]">{attachment.name || 'Lien YouTube'}</div>
                  <div className="mt-1 text-[11px] text-[var(--app-text-muted)]">{getAttachmentMeta(attachment)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-red-200/90">
                <ExternalLink size={14} />
                Ouvrir la video
              </div>
            </motion.a>
          );
        }

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              'rounded-[1.35rem] border border-emerald-500/18 bg-[var(--app-surface)]/50 p-4 shadow-xl',
              cardWidthClass,
            )}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <div className="line-clamp-2 text-sm font-medium text-[var(--app-text)]">{attachment.name || 'Document joint'}</div>
                <div className="mt-1 text-[11px] text-[var(--app-text-muted)]">{getAttachmentMeta(attachment)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-[var(--app-text)] transition-colors hover:bg-white/[0.08]"
              >
                <ExternalLink size={14} />
                Ouvrir
              </a>
              <a
                href={attachment.url}
                download={attachment.name || 'document'}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-[var(--app-text)] transition-colors hover:bg-white/[0.08]"
              >
                <Download size={14} />
                Telecharger
              </a>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
