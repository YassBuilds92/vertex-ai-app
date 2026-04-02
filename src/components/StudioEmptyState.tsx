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
  tags: string[];
  primaryLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const modeCopy: Record<AppMode, EmptyStateContent> = {
  chat: {
    eyebrow: 'Thinking surface',
    title: 'Penser dans un cadre plus calme.',
    body: 'Une seule scene pour ecrire, joindre, explorer et laisser la reponse prendre la place.',
    suggestions: [
      'Structurer un projet de A a Z',
      'Comparer Plus et Business',
      'Resumer un sujet complexe',
    ],
    tags: ['Lecture nette', 'Fichiers en flux', 'Long-form ready'],
    primaryLabel: 'Lancer une idee',
    icon: MessageSquare,
  },
  cowork: {
    eyebrow: 'Cowork apps',
    title: 'Construire des apps sans noyer le shell.',
    body: 'Mission, recherche, rendu, puis ouverture d une vraie surface. Le reste doit disparaitre.',
    suggestions: [
      'Creer une app PDF premium',
      'Transformer une veille en mini-site',
      'Lancer une mission de recherche profonde',
    ],
    tags: ['Mission first', 'Apps a ouvrir', 'Resultats devant'],
    primaryLabel: 'Lancer une mission',
    icon: BrainCircuit,
  },
  image: {
    eyebrow: 'Image direction',
    title: 'Cadrer l image avant qu elle existe.',
    body: 'Le prompt, la lumiere et le ratio restent proches. Le bruit visuel sort du chemin.',
    suggestions: [
      'Concevoir une affiche editoriale',
      'Creer une couverture sport premium',
      'Generer une foret ancienne detaillee',
    ],
    tags: ['Ratio visible', 'Direction first', 'Rendu au centre'],
    primaryLabel: 'Lancer une direction',
    icon: ImageIcon,
  },
  video: {
    eyebrow: 'Video lab',
    title: 'Bloquer la scene, pas un mur de reglages.',
    body: 'Format, duree et mouvement restent lisibles en un regard, avec une entree beaucoup plus cine.',
    suggestions: [
      'Storyboard produit portrait 6s',
      'Plan de stade cinematographique',
      'Scene nature 16:9',
    ],
    tags: ['Storyboard rapide', 'Formats clairs', 'Tempo present'],
    primaryLabel: 'Lancer une scene',
    icon: Film,
  },
  audio: {
    eyebrow: 'Voice studio',
    title: 'Poser la voix, puis la laisser respirer.',
    body: 'Voix, langue et intention restent accessibles, sans transformer l accueil en panneau technique.',
    suggestions: [
      'Intro podcast calme',
      'Voix off produit premium',
      'Texte parle style radio',
    ],
    tags: ['Voix en avant', 'Ton lisible', 'Studio sobre'],
    primaryLabel: 'Lancer une voix',
    icon: FileAudio,
  },
  lyria: {
    eyebrow: 'Lyria studio',
    title: 'Modeler le morceau dans un studio plus vide.',
    body: 'Texture, energie et variantes restent la. Tout le reste se tait pour laisser entendre la direction.',
    suggestions: [
      'Bed editorial ample et discret',
      'Theme nasheed solennel moderne',
      'Texture ambient cinematographique',
    ],
    tags: ['Texture first', 'Moins de chrome', 'Musique au centre'],
    primaryLabel: 'Lancer un morceau',
    icon: Music,
  },
};

interface StudioEmptyStateProps {
  mode: AppMode;
  isAuthenticated: boolean;
  onPrimaryAction: () => void;
  onQuickPrompt: (prompt: string) => void;
  onOpenAgentsHub?: () => void;
}

export const StudioEmptyState: React.FC<StudioEmptyStateProps> = ({
  mode,
  isAuthenticated,
  onPrimaryAction,
  onQuickPrompt,
  onOpenAgentsHub,
}) => {
  const content = modeCopy[mode];
  const Icon = content.icon;
  const surfaceLabel = mode === 'cowork'
    ? 'cowork apps'
    : mode === 'chat'
      ? 'chat & raisonnement'
      : mode === 'image'
        ? 'generation image'
        : mode === 'video'
          ? 'generation video'
          : mode === 'audio'
            ? 'text-to-speech'
            : 'lyria / musique';

  return (
    <section className="mx-auto flex min-h-full w-full max-w-[1440px] items-stretch px-3 py-3 sm:px-5 sm:py-4 lg:px-8 lg:py-6">
      <div className="studio-empty-hero studio-panel-strong relative isolate flex min-h-[38rem] w-full overflow-hidden rounded-[2.65rem] px-5 py-5 sm:px-7 sm:py-7 lg:min-h-[44rem] lg:px-10 lg:py-10">
        <div className="studio-empty-hero__noise" aria-hidden="true" />
        <div className="studio-empty-hero__scene-wrap" aria-hidden="true">
          <div className="studio-empty-hero__scene-glow" />
          <Suspense fallback={<div className="studio-empty-hero__scene-fallback" />}>
            <StudioHeroScene mode={mode} />
          </Suspense>
        </div>

        <div className="studio-empty-hero__content relative z-10 flex min-h-[inherit] w-full flex-col justify-between lg:max-w-[36rem]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-black/16 px-3.5 py-2 text-[11px] uppercase tracking-[0.22em] text-[var(--app-text)]/74 backdrop-blur-md">
              <Sparkles size={12} className="text-[var(--app-accent)]" />
              {content.eyebrow}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-[var(--app-border)] bg-white/[0.04] text-[var(--app-accent)] shadow-[0_22px_52px_-30px_rgba(68,196,255,0.55)]">
                <Icon size={18} />
              </div>
              <div>
                <div className="studio-section-label">Studio Pro</div>
                <div className="mt-1 text-sm font-medium text-[var(--app-text)]/68">{surfaceLabel}</div>
              </div>
            </div>

            <h2 className="mt-8 max-w-[8ch] text-balance text-[clamp(2.85rem,9vw,6.4rem)] font-semibold leading-[0.9] tracking-[-0.075em] text-[var(--app-text)]">
              {content.title}
            </h2>

            <p className="mt-5 max-w-[30rem] text-[15px] leading-7 text-[var(--app-text)]/68 sm:text-[16px]">
              {content.body}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {!isAuthenticated ? (
                <button onClick={onPrimaryAction} className="studio-button-primary studio-glow">
                  <Bot size={16} />
                  Se connecter avec Google
                  <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onQuickPrompt(content.suggestions[0])}
                    className="studio-button-primary studio-glow"
                  >
                    <Sparkles size={16} />
                    {content.primaryLabel}
                    <ArrowRight size={16} />
                  </button>
                  {mode === 'cowork' && onOpenAgentsHub && (
                    <button onClick={onOpenAgentsHub} className="studio-button-secondary studio-glow">
                      <BrainCircuit size={16} />
                      Ouvrir Cowork Apps
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-5 lg:mt-16">
            <div className="flex flex-wrap gap-2.5">
              {content.suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  onClick={() => onQuickPrompt(suggestion)}
                  className={cn(
                    'studio-empty-hero__suggestion',
                    index === 0 && 'is-strong'
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="studio-empty-hero__meta">
              <div className="studio-section-label">Current frame</div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.22em] text-[var(--app-text-muted)]/74">
                {surfaceLabel}
              </div>
              <div className="mt-4 grid gap-2.5">
                {content.tags.map((tag, index) => (
                  <div
                    key={tag}
                    className="flex items-center gap-3 rounded-full border border-[var(--app-border)] bg-white/[0.03] px-3.5 py-2.5"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text-muted)]/72">
                      0{index + 1}
                    </span>
                    <span className="text-[12px] text-[var(--app-text)]/78">{tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
