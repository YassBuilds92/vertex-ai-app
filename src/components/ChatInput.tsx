import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, Send, ImageIcon, Film, Mic, Paperclip, X, Music, FileText, Youtube, ChevronRight, Square 
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Attachment, AttachmentType } from '../types';
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
  const { configs, activeMode, theme } = useStore();
  const config = configs[activeMode];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSendClick = () => {
    if ((!text.trim() && pendingAttachments.length === 0) || isLoading) return;
    onSend(text);
    setText('');
    setPendingAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      processFiles(e.clipboardData.files);
    } else {
      const clipboardText = e.clipboardData.getData('text');
      const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/;
      const match = clipboardText.match(ytRegex);
      if (match) {
        e.preventDefault();
        const url = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
        if (!pendingAttachments.some(a => a.url === url)) {
          setPendingAttachments(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            type: 'youtube',
            url: url,
            name: `YouTube Video`
          }]);
        }
        const newText = clipboardText.replace(match[0], '').trim();
        if (newText) {
          setText(prev => prev + newText);
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
      <div className="absolute -inset-px rounded-[1.4rem] bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-purple-500/0 group-focus-within/input:from-indigo-500/20 group-focus-within/input:via-purple-500/15 group-focus-within/input:to-pink-500/20 transition-all duration-700 blur-sm" />
      
      <div className="relative bg-[var(--app-surface)]/80 backdrop-blur-3xl border border-[var(--app-border)] rounded-[2rem] p-2.5 shadow-2xl group-focus-within/input:border-indigo-500/30 transition-all duration-500 ring-1 ring-[var(--app-border)]">
        
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
        {pendingAttachments.length > 0 && (
          <div className="flex flex-col gap-2 p-2 pb-1 mx-1 mb-1 border-b border-[var(--app-border)]">
            {pendingAttachments.map(att => (
              <div key={att.id} className="relative group/att bg-[var(--app-text)]/[0.04] hover:bg-[var(--app-text)]/[0.06] rounded-xl border border-[var(--app-border)] transition-colors overflow-hidden">
                {att.type === 'image' && (
                  <div className="flex items-center gap-3 p-2">
                    <img src={att.url} alt="preview" className="w-16 h-16 object-cover rounded-lg ring-1 ring-[var(--app-border)] cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setSelectedImage(att.url)} />
                    <span className="text-xs text-[var(--app-text-muted)] truncate">{att.name}</span>
                  </div>
                )}
                {/* ... other types ... */}
                <button 
                  onClick={() => setPendingAttachments(prev => prev.filter(a => a.id !== att.id))}
                  className="absolute top-1.5 right-1.5 w-5 h-5 bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] rounded-full flex items-center justify-center border border-[var(--app-border)] opacity-0 group-hover/att:opacity-100 transition-all hover:bg-[var(--app-surface-hover)] shadow-md"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Controls Row */}
        <div className="flex items-end gap-1.5">
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
            className="p-2.5 text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-text)]/[0.06] rounded-xl transition-all duration-200 shrink-0"
            title="Joindre un fichier"
          >
            <Paperclip size={19} />
          </button>
          <button 
            onClick={onToggleRecording}
            className={cn(
              "p-2.5 rounded-xl transition-all duration-200 shrink-0",
              isRecording 
                ? "text-red-400 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20" 
                : "text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-text)]/[0.06]"
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
            placeholder={isRecording ? "Enregistrement en cours…" : "Envoyer un message…"}
            disabled={isRecording}
            className="w-full max-h-60 min-h-[48px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/50 text-[15px] outline-none disabled:opacity-50"
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
              "w-11 h-11 shrink-0 rounded-xl flex items-center justify-center transition-all duration-300 m-0.5",
              isLoading
                ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                : (!text.trim() && pendingAttachments.length === 0)
                  ? "bg-[var(--app-text)]/[0.04] text-[var(--app-text-muted)]"
                  : "bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/20"
            )}
          >
            {isLoading ? <Square size={16} fill="currentColor" /> : <ChevronRight size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};
