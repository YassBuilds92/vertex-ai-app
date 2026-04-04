import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Bot, RotateCcw, Copy, Check, ImageIcon, Video, Music, FileText, Youtube, Send, Pencil, BrainCircuit, ChevronDown, AlertCircle, Sparkles, Download,
  Loader2, Globe, Search, CheckCircle2, AlertTriangle, Wrench, Clock3
} from 'lucide-react';
import { Message, ActivityItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AttachmentGallery } from './AttachmentGallery';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Boîte de réflexion avec auto-scroll pendant le streaming
const ThinkingBox = ({ thoughts, live = false }: { thoughts: string; live?: boolean }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  
  // Split thoughts into "nodes" or steps if possible
  const nodes = thoughts
    .split(/\n\n+/)
    .filter(n => n.trim().length > 0)
    .map(n => n.trim());

  useEffect(() => {
    if (live && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [thoughts, live]);

  return (
    <div
      ref={boxRef}
      className={cn(
        "relative min-w-0 w-full p-5 md:p-6 rounded-xl border border-indigo-500/15 overflow-hidden thought-gradient",
        "bg-[var(--app-surface)]/55",
        live ? "animate-in fade-in duration-500" : ""
      )}
      style={{ maxHeight: live ? '400px' : '70vh', minHeight: '80px' }}
    >
      <div className="relative flex flex-col gap-5">
        {nodes.length === 0 && live ? (
          <div className="flex items-center gap-3 text-indigo-400/60 font-medium italic text-sm py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            <span>Initialisation des parametres...</span>
          </div>
        ) : (
          nodes.map((node, i) => (
            <div
              key={`${i}-${node.slice(0, 10)}`}
              className="relative pl-7"
            >
              <div className="absolute left-1 top-0 bottom-[-20px] w-0.5 bg-gradient-to-b from-indigo-500/30 to-transparent" />
              <div className="absolute left-[-2px] top-1.5 w-2 h-2 rounded-full bg-indigo-500/40 ring-2 ring-indigo-500/10" />

              <div className="message-copy text-[14px] text-[var(--app-text)]/85 font-sans leading-relaxed tracking-wide whitespace-pre-wrap">
                {node}
                {live && i === nodes.length - 1 && (
                  <span className="inline-block w-1.5 h-4 bg-indigo-500/50 ml-1.5 align-middle rounded-sm animate-pulse" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const runStateMeta = {
  running: { label: 'En cours', className: 'text-indigo-300 bg-indigo-500/12 border-indigo-500/25', icon: Loader2 },
  completed: { label: 'Termine', className: 'text-emerald-300 bg-emerald-500/12 border-emerald-500/25', icon: CheckCircle2 },
  failed: { label: 'Echec', className: 'text-rose-300 bg-rose-500/12 border-rose-500/25', icon: AlertTriangle },
  aborted: { label: 'Arrete', className: 'text-amber-300 bg-amber-500/12 border-amber-500/25', icon: AlertCircle },
} as const;

function getActivityIcon(item: ActivityItem) {
  if (item.kind === 'tool_call' || item.kind === 'tool_result') {
    if (item.toolName === 'music_catalog_lookup') return Music;
    if (item.toolName === 'web_search') return Search;
    if (item.toolName === 'web_fetch') return Globe;
    return Wrench;
  }
  if (item.kind === 'warning') return AlertTriangle;
  if (item.kind === 'reasoning') return BrainCircuit;
  if (item.kind === 'narration') return Bot;
  return Clock3;
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(value));
}

function formatEuroEstimate(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '~0 €';
  if (value < 0.01) return `~${value.toFixed(4)} €`;
  if (value < 1) return `~${value.toFixed(3)} €`;
  return `~${value.toFixed(2)} €`;
}

function formatDurationMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0s';
  if (value >= 60_000) return `${(value / 60_000).toFixed(1)} min`;
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}s`;
}

const ThinkingIndicator = () => (
  <div className="flex items-center gap-3 px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20">
    <div className="flex gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse [animation-delay:200ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse [animation-delay:400ms]" />
    </div>
    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.15em]">Analyse</span>
  </div>
);

const ActivityTimeline = ({ msg, live = false }: { msg: Message; live?: boolean }) => {
  const items = msg.activity || [];
  const runState = msg.runState || 'running';
  const stateMeta = runStateMeta[runState] || runStateMeta.running;
  const StateIcon = stateMeta.icon;
  const runMeta = msg.runMeta || {
    iterations: 0,
    modelCalls: 0,
    toolCalls: 0,
    searchCount: 0,
    fetchCount: 0,
    sourcesOpened: 0,
    domainsOpened: 0,
    artifactState: 'none' as const,
    stalledTurns: 0,
    retryCount: 0,
    queueWaitMs: 0,
    mode: 'autonomous' as const,
    phase: 'analysis',
    taskComplete: false,
    inputTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
    toolUseTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    estimatedCostEur: 0,
  };
  const isCompactCowork = Boolean(runMeta.mode);
  const artifactLabel =
    runMeta.artifactState === 'released'
      ? 'Publie'
      : runMeta.artifactState === 'created'
        ? 'Cree'
        : runMeta.artifactState === 'drafting'
          ? 'Brouillon'
          : 'Sans artefact';
  const artifactTone =
    runMeta.artifactState === 'released'
      ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200'
      : runMeta.artifactState === 'created'
        ? 'border-sky-500/20 bg-sky-500/[0.06] text-sky-200'
        : runMeta.artifactState === 'drafting'
          ? 'border-indigo-500/20 bg-indigo-500/[0.06] text-indigo-100'
          : 'border-white/8 bg-white/[0.03] text-[var(--app-text-muted)]';
  const costLabel =
    runMeta.estimatedCostEur > 0
      ? `~€${runMeta.estimatedCostEur < 0.1 ? runMeta.estimatedCostEur.toFixed(3) : runMeta.estimatedCostEur.toFixed(2)}`
      : runMeta.estimatedCostUsd > 0
        ? `~$${runMeta.estimatedCostUsd < 0.1 ? runMeta.estimatedCostUsd.toFixed(3) : runMeta.estimatedCostUsd.toFixed(2)}`
        : null;
  const visibleItems = items.filter((item) => item.kind !== 'tool_call' && (!isCompactCowork || item.kind !== 'reasoning'));

  if (items.length === 0 && !live && !msg.runState) return null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="rounded-xl border border-indigo-500/15 bg-[var(--app-surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/6 flex flex-wrap items-center gap-2.5">
          <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold', stateMeta.className)}>
            <StateIcon size={13} className={cn(runState === 'running' && 'animate-spin')} />
            {stateMeta.label}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-500/18 bg-sky-500/[0.05] text-[11px] text-sky-200">
            <BrainCircuit size={12} />
            {runMeta.phase || 'analysis'}
          </div>
          <div className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px]',
            runMeta.taskComplete
              ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200'
              : 'border-white/8 bg-white/[0.03] text-[var(--app-text-muted)]'
          )}>
            <CheckCircle2 size={12} />
            {runMeta.taskComplete ? 'Pret a livrer' : 'En cours'}
          </div>
          <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px]', artifactTone)}>
            <Sparkles size={12} />
            {artifactLabel}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-[11px] text-[var(--app-text-muted)]">
            <Search size={12} />
            {runMeta.searchCount} recherche{runMeta.searchCount > 1 ? 's' : ''}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-[11px] text-[var(--app-text-muted)]">
            <Globe size={12} />
            {runMeta.sourcesOpened} source{runMeta.sourcesOpened > 1 ? 's' : ''} ouverte{runMeta.sourcesOpened > 1 ? 's' : ''}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-[11px] text-[var(--app-text-muted)]">
            <Globe size={12} />
            {runMeta.domainsOpened} domaine{runMeta.domainsOpened > 1 ? 's' : ''}
          </div>
          {runMeta.retryCount > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.06] text-amber-200 text-[11px]">
              <AlertTriangle size={12} />
              retry {runMeta.retryCount}
            </div>
          )}
          {runMeta.stalledTurns > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.06] text-amber-200 text-[11px]">
              <AlertCircle size={12} />
              stagnation {runMeta.stalledTurns}
            </div>
          )}
          {(runMeta.totalTokens > 0 || costLabel) && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-[11px] text-[var(--app-text-muted)]">
              <Sparkles size={12} />
              {runMeta.totalTokens > 0 ? `${formatCompactNumber(runMeta.totalTokens)} tokens` : 'cout'}
              {costLabel ? ` | ${costLabel}` : ''}
            </div>
          )}
        </div>

        <div className="p-4 md:p-5 flex flex-col gap-3">
          {!isCompactCowork && (runMeta.totalTokens > 0 || runMeta.queueWaitMs > 0 || runMeta.toolCalls > 0) && (
            <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-3 text-[12px] text-[var(--app-text-muted)]">
              <span className="text-[var(--app-text)]/88">
                Input {formatCompactNumber(runMeta.inputTokens)} • Output {formatCompactNumber(runMeta.outputTokens)}
                {runMeta.thoughtTokens > 0 ? ` • Reasoning ${formatCompactNumber(runMeta.thoughtTokens)}` : ''}
                {runMeta.toolUseTokens > 0 ? ` • Outils->modele ${formatCompactNumber(runMeta.toolUseTokens)}` : ''}
                {runMeta.modelCalls > 0 ? ` • ${runMeta.modelCalls} appel${runMeta.modelCalls > 1 ? 's' : ''} modele` : ''}
              </span>
              {runMeta.queueWaitMs > 0 && (
                <span className="block mt-1">
                  File d'attente: {formatDurationMs(runMeta.queueWaitMs)}
                </span>
              )}
            </div>
          )}
          {visibleItems.length === 0 ? (
            <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 text-sm text-[var(--app-text-muted)] italic">
              Initialisation de l'activite Cowork...
            </div>
          ) : (
            visibleItems.map((item, index) => {
              const Icon = getActivityIcon(item);
              const tone =
                item.kind === 'warning'
                  ? 'border-amber-500/25 bg-amber-500/[0.08]'
                  : item.kind === 'reasoning'
                    ? 'border-sky-500/22 bg-sky-500/[0.06]'
                  : item.kind === 'tool_result' && item.status === 'warning'
                    ? 'border-amber-500/22 bg-amber-500/[0.07]'
                  : item.kind === 'tool_result' && item.status === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                  : item.kind === 'tool_result' && item.status === 'error'
                    ? 'border-rose-500/20 bg-rose-500/[0.08]'
                    : item.kind === 'narration'
                          ? 'border-indigo-500/20 bg-indigo-500/[0.05]'
                          : 'border-white/8 bg-white/[0.03]';

              return (
                <div key={item.id} className="relative pl-10">
                  {index < visibleItems.length - 1 && (
                    <div className="absolute left-[15px] top-6 bottom-[-18px] w-px bg-gradient-to-b from-indigo-500/30 to-transparent" />
                  )}
                  <div className="absolute left-0 top-2 w-8 h-8 rounded-2xl border border-white/8 bg-black/30 flex items-center justify-center text-[var(--app-text-muted)]">
                    <Icon size={14} className={cn(item.kind === 'reasoning' && 'text-sky-300', item.kind === 'warning' && 'text-amber-300', item.kind === 'tool_result' && item.status === 'warning' && 'text-amber-300')} />
                  </div>
                  <div className={cn('rounded-2xl border px-4 py-3.5 shadow-sm', tone)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--app-text-muted)] font-semibold">
                          {item.title || item.toolName || 'Activite'}
                        </div>
                        {item.message && (
                          <p className="message-copy mt-1.5 text-[14px] leading-relaxed text-[var(--app-text)]/88 whitespace-pre-wrap">
                            {item.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {item.argsPreview && (
                      <div className="message-copy mt-3 rounded-xl border border-white/6 bg-black/25 px-3 py-2 text-[12px] font-mono text-sky-200/85 break-words">
                        {item.argsPreview}
                      </div>
                    )}
                    {item.resultPreview && (
                      <div className="message-copy mt-3 rounded-xl border border-white/6 bg-black/25 px-3 py-2 text-[12px] leading-relaxed text-[var(--app-text)]/78 whitespace-pre-wrap">
                        {item.resultPreview}
                      </div>
                    )}
                    {item.meta && Object.keys(item.meta).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(item.meta).map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-[var(--app-text-muted)]"
                          >
                            <span className="uppercase tracking-[0.14em]">{key}</span>
                            <span className="text-[var(--app-text)]/85 normal-case tracking-normal">{String(value)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
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
  msg, idx, isLast, isLoading, isExpanded, disableEntranceAnimation = false, onToggleThoughts, setSelectedImage, onEdit, onRetry
}: {
  msg: Message, idx: number, isLast: boolean, isLoading: boolean, isExpanded: boolean,
  disableEntranceAnimation?: boolean,
  onToggleThoughts: (idx: number) => void,
  setSelectedImage: (url: string) => void,
  onEdit: (idx: number, newText: string) => void,
  onRetry: (idx: number) => void,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showRefined, setShowRefined] = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const [isCollapsed, setIsCollapsed] = useState(msg.role === 'user' && msg.content && msg.content.length > 800);
  const isCoworkMessage = Boolean(msg.runMeta?.mode || (msg.activity?.length ?? 0) > 0 || msg.runState);

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
    <div
      className={cn(
        "group/msg relative flex w-full min-w-0 items-start gap-3 md:gap-4",
        msg.role === 'user' ? "flex-row-reverse" : "",
        !disableEntranceAnimation && "animate-in fade-in slide-in-from-bottom-2 duration-300"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-1 border",
        msg.role === 'user'
          ? "bg-white/[0.05] border-[var(--app-border)] text-[var(--app-text)]"
          : "bg-[rgba(129,236,255,0.1)] border-[var(--app-border-strong)] text-[var(--app-accent)]"
      )}>
        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className={cn(
        "flex min-w-0 flex-1 flex-col gap-2 transition-all",
        msg.role === 'user' ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "relative min-w-0 max-w-full px-5 py-4 md:px-7 md:py-5 rounded-xl overflow-hidden",
          msg.role === 'user'
            ? "w-fit max-w-full md:max-w-[42rem] bg-white/[0.04] text-[var(--app-text)] rounded-tr-md border border-[var(--app-border)]"
            : "w-full md:max-w-[48rem] bg-white/[0.035] text-[var(--app-text)]/90 rounded-bl-md border border-[var(--app-border)]"
        )}>
          {msg.role === 'model' && !isLoading && (
            <button
              onClick={() => onRetry(idx)}
              disabled={isLoading}
              className="absolute -right-12 top-10 flex h-9 w-9 items-center justify-center text-zinc-500 hover:text-[var(--app-text)] bg-[var(--app-text)]/5 hover:bg-[var(--app-text)]/10 rounded-xl opacity-0 group-hover/msg:opacity-100 transition-all border border-[var(--app-border)] shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
              title="Régénérer la réponse"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {msg.role === 'model' && msg.content && (
            <button 
              onClick={handleCopyMsg}
              className="absolute -right-12 top-2 flex h-9 w-9 items-center justify-center text-zinc-500 hover:text-[var(--app-text)] bg-[var(--app-text)]/5 hover:bg-[var(--app-text)]/10 rounded-xl opacity-0 group-hover/msg:opacity-100 transition-all border border-[var(--app-border)] shadow-lg"
              title="Copier le message"
            >
              {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          )}
          
          {msg.role === 'user' ? (
            <div className="flex min-w-0 flex-col gap-2.5">
              {msg.attachments && (msg.attachments?.length ?? 0) > 0 && (
                <AttachmentGallery
                  attachments={msg.attachments}
                  setSelectedImage={setSelectedImage}
                  variant="compact"
                />
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
                    className="message-copy w-full bg-black/30 border border-[var(--app-border-strong)] rounded-lg px-3.5 py-3 text-[15px] text-zinc-100 leading-[1.8] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)]/30"
                    rows={Math.max(2, editText.split('\n').length)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={handleEditCancel} className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white rounded-full border border-[var(--app-border)] bg-white/5 hover:bg-white/10 transition-all">Annuler</button>
                    <button onClick={handleEditSave} className="px-3 py-1.5 text-xs text-[#041018] border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,rgba(129,236,255,0.95),rgba(68,196,255,0.78))] rounded-full transition-all flex items-center gap-1.5"><Send size={11} />Envoyer</button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <p className={cn(
                    "message-copy whitespace-pre-wrap leading-[1.8] text-[15.5px] text-[var(--app-text)] transition-all duration-300",
                    isCollapsed ? "line-clamp-6 overflow-hidden" : ""
                  )}>
                    {msg.content}
                  </p>
                  {msg.role === 'user' && msg.content && msg.content.length > 800 && (
                    <button
                      onClick={() => setIsCollapsed(!isCollapsed)}
                      className="mt-2 text-[12px] font-medium text-[var(--app-accent)] hover:text-white bg-[rgba(129,236,255,0.08)] hover:bg-[rgba(129,236,255,0.14)] px-3 py-1 rounded-full transition-colors border border-[var(--app-border-strong)]"
                    >
                      {isCollapsed ? "Afficher la suite (" + msg.content.length + " caractères)" : "Réduire le message"}
                    </button>
                  )}
                </div>
              )}

              <AnimatePresence>
                {showRefined && msg.refinedInstruction && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl relative overflow-hidden group/refined">
                      <div className="absolute top-0 right-0 p-2 opacity-20">
                        <Sparkles size={40} className="text-indigo-500" />
                      </div>
                      <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-400/80">
                        <Sparkles size={10} />
                        Prompt optimise par l'IA
                      </div>
                      <p className="message-copy text-[13px] text-[var(--app-text)]/80 leading-relaxed italic font-serif">
                        "{msg.refinedInstruction}"
                      </p>
                      <p className="mt-2 text-[11px] text-[var(--app-text-muted)]/60">
                        Original : {msg.content}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-5">
              {((msg.activity?.length ?? 0) > 0 || !!msg.runState) && (
                <ActivityTimeline msg={msg} live={isLoading && isLast} />
              )}

              {/* Section Thoughts : visible immédiatement dès le streaming, ou si la réponse finale a des thoughts */}
              {!isCoworkMessage && (((isLoading && isLast) || msg.thoughts || (msg.thoughtImages?.length ?? 0) > 0)) && (
                <div className="flex flex-col gap-2">
                  {isLoading && isLast ? (
                    /* Pendant le streaming : toggle fonctionnel + auto-ouvert dès l'envoi */
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => onToggleThoughts(idx)}
                        className="flex items-center gap-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors w-fit bg-indigo-500/[0.07] hover:bg-indigo-500/[0.12] px-3 py-1.5 rounded-lg border border-indigo-500/20"
                      >
                        <BrainCircuit size={13} className="animate-pulse" />
                        <span>Raisonnement brut en cours…</span>
                        <ChevronDown size={13} className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")} />
                      </button>
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                            className="overflow-hidden"
                            layout
                          >
                            {msg.thoughts ? (
                              <ThinkingBox thoughts={msg.thoughts} live />
                            ) : (
                              /* Pas encore de tokens de réflexion : loader d'attente */
                              <div className="p-8 bg-indigo-500/[0.04] border border-indigo-500/20 rounded-xl flex flex-col items-center justify-center gap-4 min-h-[160px] shadow-inner shadow-indigo-500/5 animate-in fade-in zoom-in-95 duration-500">
                                <ThinkingIndicator />
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-xs font-semibold text-indigo-400 animate-pulse">Intelligence en éveil...</span>
                                  <span className="text-[10px] text-indigo-400/50 font-medium text-center max-w-[200px]">Initialisation des neurones et préparation du raisonnement cognitif</span>
                                </div>
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
                        Raisonnement brut
                        <ChevronDown size={13} className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")} />
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mt-2"
                            layout
                          >
                            <ThinkingBox thoughts={msg.thoughts || ''} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              )}
              
              {/* Section Médias (Images et Vidéos) */}
              {msg.role === 'model' && msg.attachments && msg.attachments.length > 0 && (
                <AttachmentGallery
                  attachments={msg.attachments}
                  setSelectedImage={setSelectedImage}
                  variant="full"
                />
              )}
              {false && msg.role === 'model' && msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-4 mt-2">
                  {msg.attachments.map((att, i) => (
                    <motion.div 
                      key={att.id || i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group/media relative max-w-full md:max-w-xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/20"
                    >
                      {att.type === 'image' ? (
                        <div className="relative">
                          <img 
                            src={att.url} 
                            alt={att.name || "Image générée"} 
                            className="w-full h-auto cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => setSelectedImage(att.url)}
                          />
                          <a 
                            href={att.url} 
                            download={att.name || "image.png"}
                            className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl opacity-0 group-hover/media:opacity-100 transition-all bg-black/70 border border-white/10"
                            title="Télécharger l'image"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={16} />
                          </a>
                        </div>
                      ) : att.type === 'video' ? (
                        <div className="relative aspect-video bg-black flex items-center justify-center">
                          <video 
                            src={att.url} 
                            controls 
                            className="w-full h-full max-h-[500px]"
                            poster={att.thumbnail}
                          />
                          <a 
                            href={att.url} 
                            download={att.name || "video.mp4"}
                            className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl opacity-0 group-hover/media:opacity-100 transition-all bg-black/70 border border-white/10 z-10"
                            title="Télécharger la vidéo"
                          >
                            <Download size={16} />
                          </a>
                        </div>
                      ) : null}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Rétrocompatibilité msg.images */}
              {msg.images && (msg.images?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-3">
                  {msg.images.map((img, i) => (
                    <motion.div 
                      key={`legacy-${i}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative group/media"
                    >
                      <img 
                        src={img} 
                        alt={`Legacy Generated ${i}`} 
                        onClick={() => setSelectedImage(img)}
                        className="w-full md:max-w-md rounded-2xl border border-white/[0.08] shadow-2xl cursor-pointer hover:opacity-90 transition-opacity" 
                      />
                      <a 
                        href={img} 
                        download={`image-${i}.png`}
                        className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl opacity-0 group-hover/media:opacity-100 transition-all bg-black/70 border border-white/10"
                      >
                        <Download size={16} />
                      </a>
                    </motion.div>
                  ))}
                </div>
              )}
              
              {msg.content && (
                <div className="markdown-body message-copy w-full min-w-0 max-w-full text-[var(--app-text)]/90">
                  <Markdown
                    components={{
                      a({ href, children, ...props }: any) {
                        const safeHref = typeof href === 'string' ? href : '';
                        const openInNewTab = safeHref.length > 0 && !safeHref.startsWith('#');

                        return (
                          <a
                            href={safeHref}
                            target={openInNewTab ? '_blank' : undefined}
                            rel={openInNewTab ? 'noopener noreferrer' : undefined}
                            className="font-medium text-indigo-300 underline underline-offset-4 decoration-indigo-400/40 hover:text-indigo-200 hover:decoration-indigo-300 transition-colors break-all"
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      },
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
              {!msg.content && msg.runState === 'running' && (
                <div className="text-sm text-[var(--app-text-muted)] italic">
                  La synthese finale est en preparation...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Boutons d'action pour l'utilisateur, déplacés hors de la box */}
        {msg.role === 'user' && !isEditing && !isLoading && (
          <div className="flex gap-2.5 justify-end mt-1 px-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
            {msg.refinedInstruction && (
              <button
                onClick={() => setShowRefined(!showRefined)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all rounded-lg border",
                  showRefined 
                    ? "text-[var(--app-accent)] bg-[rgba(129,236,255,0.12)] border-[var(--app-border-strong)]" 
                    : "text-zinc-500 hover:text-[var(--app-accent)] bg-[var(--app-text)]/[0.04] hover:bg-[rgba(129,236,255,0.08)] border-[var(--app-border)] hover:border-[var(--app-border-strong)]"
                )}
                title="Voir le prompt optimisé"
              >
                <Sparkles size={11} className={cn(showRefined && "animate-pulse")} />
                Prompt Optimisé
              </button>
            )}
            <button
              onClick={() => { setEditText(msg.content); setIsEditing(true); }}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-[var(--app-text)] bg-[var(--app-text)]/[0.04] hover:bg-[var(--app-text)]/[0.08] rounded-full border border-[var(--app-border)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pencil size={11} />
              Modifier
            </button>
            <button
              onClick={() => onRetry(idx)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-[var(--app-text)] bg-[var(--app-text)]/[0.04] hover:bg-[var(--app-text)]/[0.08] rounded-full border border-[var(--app-border)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={11} />
              Renvoyer
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
