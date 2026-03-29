import React from 'react';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  FileAudio,
  Film,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AppMode } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type EmptyStateContent = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  suggestions: string[];
  ambientWords: string[];
  primaryLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const modeCopy: Record<AppMode, EmptyStateContent> = {
  chat: {
    eyebrow: 'Conversation augmentee',
    title: 'Une entree claire pour penser, ecrire et envoyer sans friction.',
    body: "Pose une question, glisse un fichier ou colle un brief. Le fond garde juste un souffle lumineux, puis laisse la conversation prendre toute la place.",
    bullets: [
      'Texte, fichiers et markdown dans une meme scene',
      'Fond lumineux discret adapte au theme',
      'Lecture rapide du mobile au grand ecran',
    ],
    suggestions: [
      'Comparer Plus et Business',
      'Structurer un projet de A a Z',
      'Resumer un sujet complexe',
    ],
    ambientWords: ['clarte', 'signal', 'focus', 'memoire', 'raisonnement', 'studio'],
    primaryLabel: 'Essayer une premiere idee',
    icon: MessageSquare,
  },
  cowork: {
    eyebrow: 'Agent studio',
    title: 'Un atelier plus net pour lancer une mission, deleguer, puis livrer sans bruit parasite.',
    body: 'Recherche, PDF premium, podcast, media et specialistes reutilisables: tout demarre depuis une scene simple, lisible et directement actionnable.',
    bullets: [
      'Hub Agents visible sans surcharger la home',
      'Recherche, artefacts et outils dans un seul flux',
      'Premiere action claire des l ouverture',
    ],
    suggestions: [
      'Creer un agent PDF premium',
      'Transformer une veille en mini-site',
      'Preparer un podcast Gemini et Lyria',
    ],
    ambientWords: ['atelier', 'agent', 'mission', 'cadence', 'delegation', 'livraison'],
    primaryLabel: 'Lancer une premiere mission',
    icon: BrainCircuit,
  },
  image: {
    eyebrow: 'Image direction',
    title: 'Une entree plus calme pour composer une image avant meme la premiere generation.',
    body: "Ratios, variantes et direction visuelle restent accessibles, mais la scene respire davantage pour laisser l intention et les rendus dominer.",
    bullets: [
      'Ratios et variantes plus lisibles',
      'Surface plus nette pour diriger l image',
      'Moins de bruit avant la premiere sortie',
    ],
    suggestions: [
      'Concevoir une affiche editoriale',
      'Generer une foret ancienne detaillee',
      'Creer une couverture sport premium',
    ],
    ambientWords: ['vision', 'cadre', 'matiere', 'lumiere', 'image', 'direction'],
    primaryLabel: 'Lancer une premiere direction',
    icon: ImageIcon,
  },
  video: {
    eyebrow: 'Video lab',
    title: 'Une pre-scene plus legere pour cadrer format, duree et intention en un regard.',
    body: "Le mode video pose un vrai point de depart editorial, avec juste assez d information pour choisir vite sans transformer l accueil en panneau technique.",
    bullets: [
      'Portrait et paysage lisibles tout de suite',
      'Formats et durees choisis plus vite',
      'Surface plus propre pour le storyboard',
    ],
    suggestions: [
      'Storyboard produit portrait 6s',
      'Plan de stade cinematographique',
      'Scene nature 16:9',
    ],
    ambientWords: ['cadre', 'mouvement', 'tempo', 'scene', 'storyboard', 'lumiere'],
    primaryLabel: 'Lancer une premiere scene',
    icon: Film,
  },
  audio: {
    eyebrow: 'Voice & sound',
    title: 'Un point de depart audio plus pose pour choisir une voix, un ton et un rythme sans lourdeur.',
    body: 'Voix Gemini, langue et intentions restent visibles des l entree, avec une scene plus calme qui ressemble a un vrai studio de narration.',
    bullets: [
      'Voix et langue lisibles immediatement',
      'Preparation de narration plus claire',
      'Base propre pour les futurs podcasts',
    ],
    suggestions: [
      'Intro podcast calme',
      'Voix off produit premium',
      'Texte parle style radio',
    ],
    ambientWords: ['voix', 'grain', 'cadence', 'narration', 'studio', 'souffle'],
    primaryLabel: 'Lancer une premiere voix',
    icon: FileAudio,
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
  const ambientTracks = [
    content.ambientWords,
    [...content.ambientWords.slice(2), ...content.ambientWords.slice(0, 2)],
    [...content.ambientWords].reverse(),
  ];

  const surfaceLabel = mode === 'cowork'
    ? 'mode agent'
    : mode === 'chat'
      ? 'chat & raisonnement'
      : mode === 'image'
        ? 'generation image'
        : mode === 'video'
          ? 'generation video'
          : 'text-to-speech';

  return (
    <section className="mx-auto flex h-full min-h-0 w-full max-w-6xl items-stretch px-3 py-3 sm:px-5 sm:py-4 lg:px-8 lg:py-5">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="studio-empty-state studio-panel-strong relative flex h-full min-h-0 w-full overflow-hidden rounded-[2.45rem] p-4 sm:p-5 lg:p-6"
      >
        <div className="studio-empty-state__mesh" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(129,236,255,0.2),transparent_68%)] blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-0 right-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,191,134,0.15),transparent_72%)] blur-3xl"
          aria-hidden="true"
        />

        <div className="studio-empty-state__words" aria-hidden="true">
          {ambientTracks.map((track, trackIndex) => (
            <div
              key={`${mode}-ambient-${trackIndex}`}
              className={cn(
                'studio-empty-state__word-track',
                trackIndex === 1 && 'is-mid',
                trackIndex === 2 && 'is-bottom'
              )}
            >
              {[...track, ...track].map((word, wordIndex) => (
                <span
                  key={`${word}-${trackIndex}-${wordIndex}`}
                  className={cn(
                    'studio-empty-state__word',
                    wordIndex % 3 === 1 && 'is-strong'
                  )}
                  style={{ ['--word-opacity' as any]: 0.16 + ((wordIndex + trackIndex) % 4) * 0.07 }}
                >
                  {word}
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className="relative z-10 flex h-full min-h-0 flex-col justify-between">
          <div className="max-w-[42rem]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-hover)] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--app-text)]/72">
              <Sparkles size={12} className="text-[var(--app-accent)]" />
              {content.eyebrow}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.15rem] border border-[var(--app-border)] bg-[var(--app-surface-hover)] text-[var(--app-accent)] shadow-[0_24px_44px_-26px_rgba(68,196,255,0.45)]">
                <Icon size={19} />
              </div>
              <div className="min-w-0">
                <div className="studio-section-label">Studio Pro</div>
                <div className="mt-1 text-sm font-medium text-[var(--app-text)]/72">{surfaceLabel}</div>
              </div>
            </div>

            <h2 className="mt-6 max-w-[11ch] text-balance text-[clamp(2rem,7.4cqw,4.25rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-[var(--app-text)]">
              {content.title}
            </h2>

            <p className="mt-4 max-w-[38rem] text-[14px] leading-7 text-[var(--app-text)]/64 sm:text-[15px]">
              {content.body}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
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
                      Ouvrir le Hub Agents
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="mt-7 space-y-3">
              <div className="studio-section-label">Impulsions rapides</div>
              <div className="flex flex-wrap gap-2.5">
                {content.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => onQuickPrompt(suggestion)}
                    className="studio-glow rounded-full border border-[var(--app-border)] bg-[var(--app-surface-hover)] px-4 py-2.5 text-left text-[13px] text-[var(--app-text)]/76 transition-all hover:-translate-y-[1px] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-7 border-t border-[var(--app-border)] pt-4">
            <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
              {content.bullets.map((bullet, index) => (
                <div key={bullet} className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--app-text-muted)]/78">
                    0{index + 1}
                  </div>
                  <p className="mt-2 max-w-[16rem] text-sm leading-6 text-[var(--app-text)]/74">
                    {bullet}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--app-text-muted)]/76">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--app-accent)] shadow-[0_0_16px_color-mix(in_srgb,var(--app-accent)_55%,transparent_45%)]" />
              Fond adapte au theme clair, sombre et oled
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
