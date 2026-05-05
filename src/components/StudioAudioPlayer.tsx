import React from 'react';
import { Check, Copy, Download, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { copyTextToClipboard } from '../utils/clipboard';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

type StudioAudioPlayerProps = {
  src: string;
  title: string;
  subtitle?: string;
  prompt?: string;
  downloadName?: string;
  className?: string;
  compact?: boolean;
  accentRgb?: string;
  accentEndRgb?: string;
  accentInk?: string;
};

type PlayerStyle = React.CSSProperties & Record<`--${string}`, string>;

export const StudioAudioPlayer: React.FC<StudioAudioPlayerProps> = ({
  src,
  title,
  subtitle,
  prompt,
  downloadName,
  className,
  compact = false,
  accentRgb = '244,114,182',
  accentEndRgb = '248,113,113',
  accentInk = '#13060e',
}) => {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, [src]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch (error) {
        console.error('Audio playback failed:', error);
      }
      return;
    }

    audio.pause();
  };

  const seekTo = (nextValue: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(nextValue)) return;
    audio.currentTime = Math.max(0, Math.min(duration || 0, nextValue));
    setCurrentTime(audio.currentTime);
  };

  const jumpBy = (delta: number) => {
    seekTo((audioRef.current?.currentTime || 0) + delta);
  };

  const handleCopyPrompt = async () => {
    if (!prompt) return;
    const copied = await copyTextToClipboard(prompt);
    if (!copied) return;
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 1400);
  };

  const playerStyle: PlayerStyle = {
    '--player-accent-rgb': accentRgb,
    '--player-accent-end-rgb': accentEndRgb,
    '--player-accent-ink': accentInk,
  };

  return (
    <div
      style={playerStyle}
      className={cn(
        'overflow-hidden border-t border-white/[0.08]',
        className,
      )}
    >
      <audio ref={audioRef} preload="metadata" src={src} />
      <div className={cn('space-y-2 py-2', compact && 'space-y-2 py-2')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--app-text)]">{title}</div>
            {subtitle && (
              <div className="mt-1 truncate text-[11px] text-[var(--app-text-muted)]">{subtitle}</div>
            )}
          </div>
          <a
            href={src}
            download={downloadName || title}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
            title="Telecharger"
          >
            <Download size={15} />
          </a>
        </div>

        <div className="relative overflow-hidden border-l border-white/[0.08] px-3 py-2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--player-accent-rgb),0.18),transparent_52%)] opacity-80" />
          <div className="relative flex items-center gap-3">
            {!compact && (
              <button
                type="button"
                onClick={() => jumpBy(-10)}
                className="hidden h-8 w-8 shrink-0 items-center justify-center text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)] sm:inline-flex"
                title="Reculer de 10 secondes"
              >
                <SkipBack size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={togglePlayback}
              className="flex h-11 w-11 shrink-0 items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(var(--player-accent-end-rgb),0.86))] text-[var(--player-accent-ink)] transition-transform hover:scale-[1.02]"
              title={isPlaying ? 'Pause' : 'Lecture'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-[1px]" />}
            </button>

            {!compact && (
              <button
                type="button"
                onClick={() => jumpBy(10)}
                className="hidden h-8 w-8 shrink-0 items-center justify-center text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)] sm:inline-flex"
                title="Avancer de 10 secondes"
              >
                <SkipForward size={15} />
              </button>
            )}

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex h-8 items-end gap-1.5 overflow-hidden">
                {Array.from({ length: compact ? 18 : 24 }).map((_, index) => (
                  <span
                    key={`${src}-wave-${index}`}
                    className={cn(
                      'flex-1 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(var(--player-accent-rgb),0.42),rgba(var(--player-accent-rgb),0.18))] transition-all duration-300',
                      isPlaying ? 'opacity-100' : 'opacity-60',
                    )}
                    style={{
                      height: `${26 + ((index * 11) % 42)}%`,
                      transform: isPlaying ? `translateY(${(index % 3) * -1}px)` : 'translateY(0px)',
                    }}
                  />
                ))}
              </div>

              <div className="space-y-2">
                <div className="h-1 bg-white/8">
                  <div
                    className="h-full bg-[linear-gradient(90deg,rgba(255,255,255,0.95),rgba(var(--player-accent-end-rgb),0.85))]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(duration, 0)}
                  step={0.1}
                  value={Math.min(currentTime, duration || currentTime)}
                  onChange={(event) => seekTo(Number(event.target.value))}
                  className="w-full cursor-pointer"
                  style={{ accentColor: `rgb(${accentRgb})` }}
                />
                <div className="flex items-center justify-between text-[11px] text-[var(--app-text-muted)]">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {prompt && (
          <div className="border-t border-white/[0.08] pt-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-bold uppercase text-[var(--app-text-muted)]">Prompt</div>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="inline-flex items-center gap-1.5 border-b border-white/[0.16] px-1 py-1 text-xs font-semibold text-[var(--app-text)] hover:border-[var(--media-accent)]"
              >
                {copiedPrompt ? <Check size={11} /> : <Copy size={11} />}
                {copiedPrompt ? 'Copie' : 'Copier'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
