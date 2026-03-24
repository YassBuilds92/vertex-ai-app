import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Bot, RotateCcw, Copy, Check, ImageIcon, Video, Music, FileText, Youtube, Send, Pencil, BrainCircuit, ChevronDown, AlertCircle 
} from 'lucide-react';
import { Message } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Boîte de réflexion avec auto-scroll pendant le streaming
const ThinkingBox = ({ thoughts, live = false }: { thoughts: string; live?: boolean }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (live && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [thoughts, live]);
  return (
    <div
      ref={boxRef}
      className={cn(
        "p-4 pl-5 border-l-2 border-indigo-500/40 bg-indigo-500/5 rounded-r-2xl",
        "text-[13.5px] text-[var(--app-text)]/85 font-sans leading-[1.8] whitespace-pre-wrap overflow-y-auto transition-all",
        live ? "animate-in fade-in duration-500" : ""
      )}
      style={{ maxHeight: live ? '250px' : '60vh', minHeight: '40px' }}
    >
      {thoughts}
      {live && (
        <span className="inline-block w-1.5 h-4 bg-indigo-400/80 ml-1 align-middle animate-pulse rounded-sm" />
      )}
    </div>
  );
};

const CopyCodeButton = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-md">
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      {copied ? 'Copié' : 'Copier'}
    </button>
  );
};

export const MessageItem = React.memo(({ 
  msg, idx, isLast, isLoading, isExpanded, onToggleThoughts, setSelectedImage, onEdit, onRetry
}: {
  msg: Message, idx: number, isLast: boolean, isLoading: boolean, isExpanded: boolean,
  onToggleThoughts: (idx: number) => void,
  setSelectedImage: (url: string) => void,
  onEdit: (idx: number, newText: string) => void,
  onRetry: (idx: number) => void,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const [isCollapsed, setIsCollapsed] = useState(msg.role === 'user' && msg.content && msg.content.length > 800);

  const handleCopyMsg = () => {
    navigator.clipboard.writeText(msg.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleEditSave = () => {
    if (editText.trim()) onEdit(idx, editText);
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditText(msg.content);
    setIsEditing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "flex items-start gap-3 md:gap-4 group/msg relative",
        msg.role === 'user' ? "flex-row-reverse" : ""
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-1 transition-all duration-300",
        msg.role === 'user' 
          ? "bg-[var(--app-text)]/[0.05] border border-[var(--app-border)] shadow-md text-[var(--app-text)]" 
          : "bg-gradient-to-br from-indigo-500/20 to-purple-500/15 border border-indigo-500/15 text-indigo-500 shadow-md shadow-indigo-500/5"
      )}>
        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className={cn(
        "px-5 py-4 md:px-7 md:py-5 rounded-[2rem] max-w-[92%] md:max-w-[85%] shadow-2xl transition-all duration-500 relative",
        msg.role === 'user'
          ? "w-fit bg-[var(--app-text)]/[0.03] backdrop-blur-md text-[var(--app-text)] rounded-tr-md border border-[var(--app-border)] ring-1 ring-[var(--app-border)]"
          : "bg-transparent text-[var(--app-text)]/90"
      )}>
        {msg.role === 'model' && !isLoading && (
          <button
            onClick={() => onRetry(idx)}
            className="absolute -right-12 top-10 p-2 text-zinc-500 hover:text-[var(--app-text)] bg-[var(--app-text)]/5 hover:bg-[var(--app-text)]/10 rounded-lg opacity-0 group-hover/msg:opacity-100 transition-all border border-[var(--app-border)] shadow-lg"
            title="Régénérer la réponse"
          >
            <RotateCcw size={14} />
          </button>
        )}
        {msg.role === 'model' && msg.content && (
          <button 
            onClick={handleCopyMsg}
            className="absolute -right-12 top-2 p-2 text-zinc-500 hover:text-[var(--app-text)] bg-[var(--app-text)]/5 hover:bg-[var(--app-text)]/10 rounded-lg opacity-0 group-hover/msg:opacity-100 transition-all border border-[var(--app-border)] shadow-lg"
            title="Copier le message"
          >
            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        )}
        
        {msg.role === 'user' ? (
          <div className="flex flex-col gap-2.5">
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {msg.attachments.map(att => (
                  <div key={att.id} className="inline-flex items-center gap-1.5 bg-white/[0.06] px-2.5 py-1.5 rounded-lg border border-white/[0.06] text-[11px] text-zinc-400">
                    {att.type === 'image' && <ImageIcon size={12} />}
                    {att.type === 'video' && <Video size={12} />}
                    {att.type === 'audio' && <Music size={12} />}
                    {att.type === 'document' && <FileText size={12} />}
                    {att.type === 'youtube' && <Youtube size={12} className="text-red-400" />}
                    <span className="max-w-[120px] truncate">{att.name}</span>
                  </div>
                ))}
              </div>
            )}

            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
                    if (e.key === 'Escape') handleEditCancel();
                  }}
                  autoFocus
                  className="w-full bg-black/30 border border-indigo-500/40 rounded-xl px-3.5 py-3 text-[15px] text-zinc-100 leading-[1.8] resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                  rows={Math.max(2, editText.split('\n').length)}
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={handleEditCancel} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-all">Annuler</button>
                  <button onClick={handleEditSave} className="px-3 py-1.5 text-xs text-white bg-indigo-500/80 hover:bg-indigo-500 rounded-lg transition-all flex items-center gap-1.5"><Send size={11} />Envoyer</button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <p className={cn(
                  "whitespace-pre-wrap leading-[1.8] text-[15.5px] text-[var(--app-text)] transition-all duration-300",
                  isCollapsed ? "line-clamp-6 overflow-hidden" : ""
                )}>
                  {msg.content}
                </p>
                {msg.role === 'user' && msg.content && msg.content.length > 800 && (
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="mt-2 text-[12px] font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1 rounded-lg transition-colors border border-indigo-500/20"
                  >
                    {isCollapsed ? "Afficher la suite (" + msg.content.length + " caractères)" : "Réduire le message"}
                  </button>
                )}
              </div>
            )}

            {!isEditing && !isLoading && (
              <div className="flex gap-2.5 justify-end mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditText(msg.content); setIsEditing(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-[var(--app-text)] bg-[var(--app-text)]/[0.04] hover:bg-[var(--app-text)]/[0.08] rounded-lg border border-[var(--app-border)] transition-all"
                >
                  <Pencil size={11} />
                  Modifier
                </button>
                <button
                  onClick={() => onRetry(idx)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-[var(--app-text)] bg-[var(--app-text)]/[0.04] hover:bg-[var(--app-text)]/[0.08] rounded-lg border border-[var(--app-border)] transition-all"
                >
                  <RotateCcw size={11} />
                  Renvoyer
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Section Thoughts : visible immédiatement dès le streaming, ou si la réponse finale a des thoughts */}
            {((isLoading && isLast) || msg.thoughts || (msg.thoughtImages && msg.thoughtImages.length > 0)) && (
              <div className="flex flex-col gap-2">
                {isLoading && isLast ? (
                  /* Pendant le streaming : toggle fonctionnel + auto-ouvert dès l'envoi */
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => onToggleThoughts(idx)}
                      className="flex items-center gap-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors w-fit bg-indigo-500/[0.07] hover:bg-indigo-500/[0.12] px-3 py-1.5 rounded-lg border border-indigo-500/20"
                    >
                      <BrainCircuit size={13} className="animate-pulse" />
                      <span>Réflexion en cours…</span>
                      <ChevronDown size={13} className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                          className="overflow-hidden"
                          layout
                        >
                          {msg.thoughts ? (
                            <ThinkingBox thoughts={msg.thoughts} live />
                          ) : (
                            /* Pas encore de tokens de réflexion : dots d'attente */
                            <div className="p-5 bg-[var(--app-text)]/[0.02] border border-indigo-500/10 rounded-2xl flex items-center gap-3">
                              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} className="w-2 h-2 rounded-full bg-indigo-400/60" />
                              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-2 h-2 rounded-full bg-indigo-400/60" />
                              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-2 h-2 rounded-full bg-indigo-400/60" />
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onToggleThoughts(idx)}
                      className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-[var(--app-text)] transition-colors w-fit bg-[var(--app-text)]/[0.04] hover:bg-[var(--app-text)]/[0.07] px-3 py-1.5 rounded-lg border border-[var(--app-border)]"
                    >
                      <BrainCircuit size={13} className={cn("transition-colors", isExpanded ? "text-indigo-500" : "")} />
                      Processus de réflexion
                      <ChevronDown size={13} className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")} />
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mt-2"
                        >
                          <ThinkingBox thoughts={msg.thoughts || ''} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            )}
            
            {msg.images && msg.images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {msg.images.map((img, i) => (
                  <motion.img 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={i} src={img} alt={`Generated ${i}`} 
                    onClick={() => setSelectedImage(img)}
                    className="w-full md:max-w-md rounded-2xl border border-white/[0.08] shadow-2xl cursor-pointer hover:opacity-90 transition-opacity" 
                  />
                ))}
              </div>
            )}
            
            {msg.content && (
              <div className="markdown-body text-[var(--app-text)]/90">
                <Markdown
                  components={{
                    code({node, inline, className, children, ...props}: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');
                      if (!inline && match) {
                        return (
                          <div className="relative group/code my-4 rounded-xl border border-white/[0.1] bg-[#000000]">
                            <div className="sticky top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-b border-white/[0.05] z-10 rounded-t-[11px]">
                              <span className="text-xs font-mono text-zinc-400 capitalize">{match[1]}</span>
                              <CopyCodeButton code={codeString} />
                            </div>
                            <div className="p-4 overflow-x-auto rounded-b-[11px]">
                              <code className={className} {...props}>{children}</code>
                            </div>
                          </div>
                        );
                      }
                      return <code className={cn("bg-white/[0.08] px-1.5 py-0.5 rounded-md text-sm text-pink-400", className)} {...props}>{children}</code>;
                    }
                  }}
                >{msg.content}</Markdown>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});
