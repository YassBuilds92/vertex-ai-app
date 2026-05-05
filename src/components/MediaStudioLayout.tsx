import React from 'react';
import { Check, Copy, Loader2, Sparkles, type LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { copyTextToClipboard } from '../utils/clipboard';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CssVars = React.CSSProperties & Record<`--${string}`, string>;

export type MediaStudioTone = {
  accent: string;
  accentRgb: string;
  accentInk?: string;
  washRgb?: string;
  icon: LucideIcon;
};

type MediaMetric = {
  label: string;
  value: React.ReactNode;
};

type MediaStudioShellProps = {
  tone: MediaStudioTone;
  eyebrow: string;
  title: string;
  subtitle: string;
  metrics?: MediaMetric[];
  composer: React.ReactNode;
  stage: React.ReactNode;
  className?: string;
  rootProps?: Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'style'> & Record<`data-${string}`, string | undefined>;
};

export function MediaStudioShell({
  tone,
  eyebrow,
  title,
  subtitle,
  composer,
  stage,
  className,
  rootProps,
}: MediaStudioShellProps) {
  const style: CssVars = {
    '--media-accent': tone.accent,
    '--media-accent-rgb': tone.accentRgb,
    '--media-accent-ink': tone.accentInk || '#071014',
    '--media-wash-rgb': tone.washRgb || tone.accentRgb,
  };

  return (
    <div
      {...rootProps}
      style={style}
      className={cn(
        'relative h-full w-full max-w-full overflow-hidden bg-[linear-gradient(135deg,rgba(var(--media-wash-rgb),0.055),rgba(var(--app-bg-rgb),0)_34%),var(--app-bg)]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.014)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:56px_56px] opacity-35" />
      <div className="relative mx-auto grid h-full w-full min-w-0 max-w-[104rem] px-4 py-3 sm:px-5 lg:px-6">
        <h1 className="sr-only">
          {eyebrow} - {title}. {subtitle}
        </h1>
        <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,0.88fr)_minmax(0,1.12fr)] gap-3 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] md:grid-rows-none lg:grid-cols-[minmax(22rem,0.74fr)_minmax(28rem,1.26fr)] lg:gap-5">
          <div className="min-h-0 min-w-0">{composer}</div>
          <div className="min-h-0 min-w-0">{stage}</div>
        </div>
      </div>
    </div>
  );
}

type PanelProps = {
  children: React.ReactNode;
  className?: string;
};

export function MediaPanel({ children, className }: PanelProps) {
  return (
    <section
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-col overflow-hidden',
        className,
      )}
    >
      {children}
    </section>
  );
}

type PanelHeaderProps = {
  label: string;
  title: React.ReactNode;
  detail?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
};

export function MediaPanelHeader({ label, title, detail, icon: Icon, action }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2">
      <div className="min-w-0">
        <div className="truncate text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">{label}</div>
        <div className="sr-only">{title}</div>
        {detail && <div className="sr-only">{detail}</div>}
      </div>
      {action || (Icon && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--media-accent)]">
          <Icon size={18} />
        </div>
      ))}
    </div>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
};

export function MediaField({ label, children, className }: FieldProps) {
  return (
    <label className={cn('flex min-w-0 flex-col space-y-1.5', className)}>
      <span className="block text-xs font-semibold text-[var(--app-text)]">{label}</span>
      {children}
    </label>
  );
}

type MediaTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function MediaTextarea({ className, ...props }: MediaTextareaProps) {
  return (
    <textarea
      {...props}
      className={cn(
        'h-full min-h-0 w-full min-w-0 resize-none rounded-none border-0 border-l border-white/[0.08] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-muted)]/52 focus:border-[rgba(var(--media-accent-rgb),0.58)]',
        className,
      )}
    />
  );
}

type MediaSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function MediaSelect({ className, ...props }: MediaSelectProps) {
  return (
    <select
      {...props}
      className={cn(
        'h-9 w-full min-w-0 rounded-none border-0 border-b border-white/[0.12] bg-transparent px-0 text-xs font-semibold text-[var(--app-text)] outline-none focus:border-[rgba(var(--media-accent-rgb),0.58)]',
        className,
      )}
    />
  );
}

type MediaInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function MediaInput({ className, ...props }: MediaInputProps) {
  return (
    <input
      {...props}
      className={cn(
        'h-9 w-full min-w-0 rounded-none border-0 border-b border-white/[0.12] bg-transparent px-0 text-xs font-semibold text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-muted)]/48 focus:border-[rgba(var(--media-accent-rgb),0.58)]',
        className,
      )}
    />
  );
}

type ChoiceButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function ChoiceButton({ active, className, children, ...props }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex min-h-8 min-w-0 items-center justify-center gap-1.5 rounded-none border-b px-2 text-xs font-semibold outline-none',
        active
          ? 'border-[var(--media-accent)] text-[var(--media-accent)]'
          : 'border-white/[0.1] text-[var(--app-text-muted)] hover:border-white/[0.2] hover:text-[var(--app-text)]',
        className,
      )}
    >
      {children}
    </button>
  );
}

type PrimaryActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel: string;
  idleLabel: string;
  icon?: LucideIcon;
};

export function PrimaryActionButton({
  loading,
  loadingLabel,
  idleLabel,
  icon: Icon = Sparkles,
  className,
  ...props
}: PrimaryActionButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex h-10 w-full items-center justify-center gap-2 rounded-none border border-[rgba(var(--media-accent-rgb),0.42)] px-4 text-sm font-bold outline-none',
        props.disabled
          ? 'cursor-not-allowed text-[var(--app-text-muted)] opacity-55'
          : 'bg-[rgba(var(--media-accent-rgb),0.1)] text-[var(--media-accent)] hover:bg-[rgba(var(--media-accent-rgb),0.17)]',
        className,
      )}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
      {loading ? loadingLabel : idleLabel}
    </button>
  );
}

type IconActionProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
};

export function IconAction({ icon: Icon, label, className, ...props }: IconActionProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...props}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center text-white/80 hover:text-white',
        className,
      )}
    >
      <Icon size={15} />
    </button>
  );
}

type EmptyOutputProps = {
  icon: LucideIcon;
  title: string;
  detail?: string;
  className?: string;
};

export function EmptyOutput({ icon: Icon, title, detail, className }: EmptyOutputProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col items-center justify-center px-6 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center text-[var(--media-accent)]">
        <Icon size={22} />
      </div>
      <p className="text-sm font-semibold text-[var(--app-text)]">{title}</p>
      {detail && (
        <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--app-text-muted)]">{detail}</p>
      )}
    </div>
  );
}

type PromptSourceProps = {
  prompt?: string;
  title?: string;
  className?: string;
};

export function PromptSource({ prompt, title = 'Prompt', className }: PromptSourceProps) {
  const [copied, setCopied] = React.useState(false);
  const cleanPrompt = String(prompt || '').replace(/\s+/g, ' ').trim();

  const handleCopy = async () => {
    if (!cleanPrompt) return;
    const ok = await copyTextToClipboard(cleanPrompt);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className={cn('border-t border-white/[0.08] pt-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">{title}</div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!cleanPrompt}
          className={cn(
            'inline-flex items-center gap-1.5 border-b px-1 py-1 text-xs font-semibold',
            cleanPrompt
              ? 'border-white/[0.18] text-[var(--app-text)] hover:border-[var(--media-accent)]'
              : 'cursor-not-allowed border-white/[0.08] text-[var(--app-text-muted)]',
          )}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copie' : 'Copier'}
        </button>
      </div>
    </div>
  );
}

type InlineNoticeProps = {
  children: React.ReactNode;
  className?: string;
};

export function InlineNotice({ children, className }: InlineNoticeProps) {
  return (
    <div
      className={cn(
        'border-l border-[rgba(var(--media-accent-rgb),0.34)] px-3 py-1.5 text-xs leading-5 text-[var(--app-text-muted)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
