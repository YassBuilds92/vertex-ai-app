import React, { Suspense } from 'react';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  FileAudio,
  Film,
  Image as ImageIcon,
  MessageSquare,
  Music,
  Sparkles,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { AppMode } from '../types';

const StudioHeroScene = React.lazy(async () => {
  const module = await import('./StudioHeroScene');
  return { default: module.StudioHeroScene };
});

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type EmptyStateContent = {
  eyebrow: string;
  title: string;
  body: string;
  suggestions: string[];
  primaryLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const modeCopy: Record<AppMode, EmptyStateContent> = {
  chat: {
    eyebrow: 'Chat',
    title: 'Que veux-tu explorer ?',
    body: 'Ecris, joins des fichiers, et laisse la reponse prendre forme.',
    suggestions: ['Structurer un projet de A a Z', 'Comparer deux approches', 'Resumer un sujet complexe'],
    primaryLabel: 'Commencer',
    icon: MessageSquare,
  },
  cowork: {
    eyebrow: 'Cowork',
    title: 'Lance une mission experte.',
    body: 'Decris le resultat vise et laisse Cowork prendre la mission en charge.',
    suggestions: ['Creer une app PDF premium', 'Transformer une veille en mini-site', 'Lancer une recherche profonde'],
    primaryLabel: 'Lancer une mission',
    icon: BrainCircuit,
  },
  image: {
    eyebrow: 'Image',
    title: 'Cadre ton image.',
    body: 'Describe le cadre, la lumiere et le style. Le reste suit.',
    suggestions: ['Affiche editoriale moderne', 'Couverture sport premium', 'Foret ancienne detaillee'],
    primaryLabel: 'Generer',
    icon: ImageIcon,
  },
  video: {
    eyebrow: 'Video',
    title: 'Bloque ta scene.',
    body: 'Format, duree, mouvement — decrits et genere.',
    suggestions: ['Plan produit portrait 6s', 'Scene stade cinematographique', 'Nature panoramique 16:9'],
    primaryLabel: 'Creer',
    icon: Film,
  },
  audio: {
    eyebrow: 'Voix',
    title: 'Pose la voix.',
    body: 'Colle ton texte, choisis le ton. La voix prend vie.',
    suggestions: ['Intro podcast calme', 'Voix off produit', 'Narration radio'],
    primaryLabel: 'Synthetiser',
    icon: FileAudio,
  },
  lyria: {
    eyebrow: 'Lyria',
    title: 'Compose ton morceau.',
    body: 'Texture, energie, ambiance — decris et ecoute.',
    suggestions: ['Bed editorial ample', 'Theme nasheed solennel', 'Ambient cinematographique'],
    primaryLabel: 'Composer',
    icon: Music,
  },
};

interface StudioEmptyStateProps {
  mode: AppMode;
  isAuthenticated: boolean;
  onPrimaryAction: () => void;
  onQuickPrompt: (prompt: string) => void;
}

export const StudioEmptyState: React.FC<StudioEmptyStateProps> = ({
  mode,
  isAuthenticated,
  onPrimaryAction,
  onQuickPrompt,
}) => {
  const content = modeCopy[mode];
  const Icon = content.icon;

  return (
    <section className="flex min-h-full w-full items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        {/* Icon */}
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-accent-soft)]">
          <Icon size={22} className="text-[var(--app-accent)]" />
        </div>

        {/* Eyebrow */}
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
          {content.eyebrow}
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold tracking-tight text-[var(--app-text)] sm:text-4xl lg:text-5xl">
          {content.title}
        </h2>

        {/* Body */}
        <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--app-text-muted)]">
          {content.body}
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {!isAuthenticated ? (
            <button onClick={onPrimaryAction} className="studio-button-primary">
              <Bot size={16} />
              Se connecter avec Google
              <ArrowRight size={16} />
            </button>
          ) : (
            <>
              <button
                onClick={() => onQuickPrompt(content.suggestions[0])}
                className="studio-button-primary"
              >
                <Sparkles size={14} />
                {content.primaryLabel}
              </button>
            </>
          )}
        </div>

        {/* Suggestions */}
        {isAuthenticated && (
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {content.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onQuickPrompt(suggestion)}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-sm text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] transition-all duration-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
