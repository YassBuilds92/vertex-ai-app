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
          const id = Math.random().toString(36).substring(7);
          setPendingAttachments(prev => [...prev, {
            id,
            type: 'youtube',
            url: url,
            name: `Chargement du titre...`
          }]);

          // Fetch real title from backend
          fetch(`/api/metadata?url=${encodeURIComponent(url)}`)
            .then(res => res.json())
            .then(data => {
              if (data.title) {
                setPendingAttachments(prev => prev.map(a => 
                  a.id === id ? { ...a, name: data.title } : a
                ));
              }
            })
            .catch(() => {
              setPendingAttachments(prev => prev.map(a => 
                a.id === id ? { ...a, name: 'Vidéo YouTube' } : a
              ));
            });
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
      
      <div className="relative bg-[var(--app-surface)]/80 backdrop-blur-3xl border border-[var(--app-border)] rounded-[2rem] p-2.5 shadow-2xl transition-all duration-500 ring-1 ring-[var(--app-border)]">
        
        
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
              className="flex flex-wrap gap-2.5 p-2 pb-1 mx-1 mb-1 border-b border-[var(--app-border)]/50 overflow-hidden"
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
                  className="relative group/att bg-[var(--app-surface-hover)]/40 backdrop-blur-xl rounded-2xl border border-white/[0.08] transition-all hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 overflow-hidden shrink-0 w-[140px]"
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
                        <div className="w-full h-full flex items-center justify-center text-red-500 bg-red-500/10">
                          <Youtube size={24} />
                        </div>
                      ) : null}
                      
                      {/* Badge Type */}
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-bold uppercase tracking-wider text-white/90">
                        {att.type}
                      </div>
                    </div>
                    
                    <div className="px-1 pb-1">
                      <span className="text-[10px] font-medium text-[var(--app-text)]/90 truncate block">{att.name}</span>
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
