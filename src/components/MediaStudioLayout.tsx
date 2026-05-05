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
  metrics = [],
  composer,
  stage,
  className,
  rootProps,
}: MediaStudioShellProps) {
  const Icon = tone.icon;
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
        'relative h-full w-full max-w-full overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[linear-gradient(180deg,rgba(var(--media-wash-rgb),0.08),rgba(var(--app-bg-rgb),0)_18rem),var(--app-bg)]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:44px_44px] opacity-55" />
      <div className="relative mx-auto grid w-full min-w-0 max-w-[98rem] gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid min-w-0 gap-4 border-b border-[var(--app-border)] pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[rgba(var(--media-accent-rgb),0.32)] bg-[rgba(var(--media-accent-rgb),0.12)] text-[var(--media-accent)]">
              <Icon size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase text-[var(--app-text-muted)]">
                {eyebrow}
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--app-text)] sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--app-text-muted)]">
                {subtitle}
              </p>
            </div>
          </div>

          {metrics.length > 0 && (
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="min-w-0 rounded-lg border border-[var(--app-border)] bg-white/[0.035] px-3 py-2"
                >
                  <div className="truncate text-[11px] font-semibold text-[var(--app-text-muted)]">
                    {metric.label}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-[var(--app-text)]">
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </header>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(22rem,0.88fr)_minmax(28rem,1.12fr)] xl:gap-6">
          <div className="min-w-0 lg:sticky lg:top-5 lg:self-start">{composer}</div>
          <div className="min-w-0">{stage}</div>
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
        'min-w-0 overflow-hidden rounded-lg border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.022))] shadow-[0_24px_80px_-58px_rgba(0,0,0,0.95)]',
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
    <div className="flex items-start justify-between gap-3 border-b border-[var(--app-border)] px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase text-[var(--app-text-muted)]">{label}</div>
        <div className="mt-1 truncate text-lg font-semibold text-[var(--app-text)]">{title}</div>
        {detail && (
          <div className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">{detail}</div>
        )}
      </div>
      {action || (Icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(var(--media-accent-rgb),0.28)] bg-[rgba(var(--media-accent-rgb),0.1)] text-[var(--media-accent)]">
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
    <label className={cn('block min-w-0 space-y-2', className)}>
      <span className="block text-sm font-semibold text-[var(--app-text)]">{label}</span>
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
        'min-h-[15rem] w-full min-w-0 resize-none rounded-lg border border-[var(--app-border)] bg-black/22 px-4 py-4 text-[15px] leading-7 text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-muted)]/52 focus:border-[rgba(var(--media-accent-rgb),0.58)] focus:bg-black/28',
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
        'h-11 w-full min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-3 text-sm font-semibold text-[var(--app-text)] outline-none focus:border-[rgba(var(--media-accent-rgb),0.58)]',
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
        'h-11 w-full min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-3 text-sm font-semibold text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-muted)]/48 focus:border-[rgba(var(--media-accent-rgb),0.58)]',
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
        'inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold outline-none',
        active
          ? 'border-transparent bg-[var(--media-accent)] text-[var(--media-accent-ink)] shadow-[0_10px_28px_-18px_rgba(var(--media-accent-rgb),0.9)]'
          : 'border-[var(--app-border)] bg-white/[0.045] text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)] hover:bg-white/[0.075] hover:text-[var(--app-text)]',
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
        'inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold outline-none',
        props.disabled
          ? 'cursor-not-allowed bg-white/[0.06] text-[var(--app-text-muted)]'
          : 'bg-[var(--media-accent)] text-[var(--media-accent-ink)] shadow-[0_16px_42px_-24px_rgba(var(--media-accent-rgb),0.95)] hover:brightness-110',
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
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/45 text-white shadow-[0_12px_32px_-18px_rgba(0,0,0,0.95)] hover:bg-black/70',
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
    <div
      className={cn(
        'flex min-h-[28rem] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--app-border)] bg-black/18 px-6 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-[rgba(var(--media-accent-rgb),0.26)] bg-[rgba(var(--media-accent-rgb),0.1)] text-[var(--media-accent)]">
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

export function PromptSource({ prompt, title = 'Prompt source', className }: PromptSourceProps) {
  const [copied, setCopied] = React.useState(false);
  const cleanPrompt = String(prompt || '').replace(/\s+/g, ' ').trim();
  const clippedPrompt = cleanPrompt.length > 220 ? `${cleanPrompt.slice(0, 217)}...` : cleanPrompt;

  const handleCopy = async () => {
    if (!cleanPrompt) return;
    const ok = await copyTextToClipboard(cleanPrompt);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className={cn('rounded-lg border border-[var(--app-border)] bg-white/[0.035] px-4 py-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase text-[var(--app-text-muted)]">{title}</div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!cleanPrompt}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold',
            cleanPrompt
              ? 'border-[var(--app-border)] bg-white/[0.045] text-[var(--app-text)] hover:bg-white/[0.08]'
              : 'cursor-not-allowed border-[var(--app-border)] bg-white/[0.025] text-[var(--app-text-muted)]',
          )}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copie' : 'Copier'}
        </button>
      </div>
      <p className="text-sm leading-6 text-[var(--app-text-muted)]">
        {clippedPrompt || 'Prompt non disponible.'}
      </p>
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
        'rounded-lg border border-[rgba(var(--media-accent-rgb),0.18)] bg-[rgba(var(--media-accent-rgb),0.07)] px-3 py-2 text-sm leading-6 text-[var(--app-text-muted)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
