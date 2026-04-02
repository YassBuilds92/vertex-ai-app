import React from 'react';
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
    eyebrow: 'Cowork apps',
    title: 'Un atelier pour lancer une mission, puis ouvrir de vraies apps construites par Cowork.',
    body: "Recherche, PDF premium, nasheed studio, media et apps reutilisables: tout demarre depuis une scene simple, lisible et directement actionnable.",
    bullets: [
      'App Store Cowork visible sans transformer le shell en dashboard generique',
      'Chaque app garde sa propre scene, pas juste un prompt renomme',
      'Recherche, artefacts et apps dans un seul flux',
    ],
    suggestions: [
      'Creer une app PDF premium',
      'Transformer une veille en mini-site',
      'Preparer un Nasheed Studio avec Lyria 3',
    ],
    ambientWords: ['atelier', 'apps', 'mission', 'catalogue', 'studio', 'livraison'],
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
  lyria: {
    eyebrow: 'Lyria studio',
    title: 'Une entree dediee a la generation musicale pour composer une texture, un clip ou un bed sans detour.',
    body: 'Le mode Lyria pose enfin une vraie scene musique: prompt, contre-indications, variantes et direction sonore restent visibles des la premiere seconde.',
    bullets: [
      'Studio musique distinct du TTS et du podcast',
      'Variantes, seed et negative prompt plus lisibles',
      'Base claire pour bed, nasheed, clip ou texture sonore',
    ],
    suggestions: [
      'Bed editorial ample et discret',
      'Theme nasheed solennel moderne',
      'Texture ambient cinematographique',
    ],
    ambientWords: ['tempo', 'texture', 'motif', 'energie', 'lyria', 'arrangement'],
    primaryLabel: 'Lancer un premier morceau',
    icon: Music,
  },
};

function renderModeShowcase(mode: AppMode, content: EmptyStateContent, onQuickPrompt: (prompt: string) => void, surfaceLabel: string) {
  const launchers = content.suggestions.map((suggestion, index) => (
    <button
      key={`${suggestion}-panel`}
      onClick={() => onQuickPrompt(suggestion)}
      className="group flex items-start gap-3 rounded-[1.3rem] border border-[var(--app-border)] bg-black/10 px-3.5 py-3.5 text-left transition-all hover:-translate-y-[1px] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-hover)]"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
        {index + 1}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--app-text)]">{suggestion}</div>
        <div className="mt-1 text-[12px] leading-5 text-[var(--app-text-muted)]">
          Lance directement cette direction dans le studio.
        </div>
      </div>
    </button>
  ));

  if (mode === 'image') {
    return (
      <div className="grid gap-4 lg:grid-rows-[auto_1fr]">
        <div className="rounded-[1.9rem] border border-[var(--app-border)] bg-[var(--app-surface-hover)] p-4 sm:p-5">
          <div className="studio-section-label">Scene active</div>
          <div className="mt-3 text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--app-text)]">{surfaceLabel}</div>
          <p className="mt-3 text-sm leading-6 text-[var(--app-text)]/66">
            Une composition plus editoriale pour cadrer vite le ratio, la matiere et le nombre de variantes avant la premiere image.
          </p>
        </div>
        <div className="rounded-[1.9rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 sm:p-5">
          <div className="studio-section-label">Composition</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1.08fr_0.92fr]">
            <div className="flex min-h-[12rem] flex-col justify-between rounded-[1.55rem] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(82,219,255,0.12),rgba(4,16,24,0.12))] p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">Hero 4:5</div>
              <div className="text-lg font-semibold tracking-[-0.04em] text-white">Affiche editoriale, lumiere laterale, direction precise.</div>
            </div>
            <div className="grid gap-3">
              {['16:9 storyboard', '3:4 portrait detaille', '2 variantes premium'].map((item) => (
                <div key={item} className="rounded-[1.3rem] border border-[var(--app-border)] bg-black/10 px-3.5 py-3 text-sm text-[var(--app-text)]/78">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {launchers}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'video') {
    return (
      <div className="grid gap-4 lg:grid-rows-[auto_1fr]">
        <div className="rounded-[1.9rem] border border-[var(--app-border)] bg-[var(--app-surface-hover)] p-4 sm:p-5">
          <div className="studio-section-label">Scene active</div>
          <div className="mt-3 text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--app-text)]">{surfaceLabel}</div>
          <p className="mt-3 text-sm leading-6 text-[var(--app-text)]/66">
            Resolution, format et duree deviennent des choix de storyboard au lieu d un bloc de reglages compact.
          </p>
        </div>
        <div className="rounded-[1.9rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 sm:p-5">
          <div className="studio-section-label">Storyboard</div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {['Plan large', 'Mouvement', 'Beat final'].map((label, index) => (
              <div key={label} className="rounded-[1.25rem] border border-[var(--app-border)] bg-black/10 p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-text-muted)]/78">0{index + 1}</div>
                <div className="mt-6 aspect-[4/5] rounded-[1rem] bg-[linear-gradient(180deg,rgba(255,191,134,0.18),rgba(10,15,19,0.12))]" />
                <div className="mt-3 text-sm text-[var(--app-text)]/78">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['16:9', '9:16', '6s', '1080p'].map((chip) => (
              <span key={chip} className="studio-chip">{chip}</span>
            ))}
          </div>
          <div className="mt-4 grid gap-3">
            {launchers}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'audio') {
    return (
      <div className="grid gap-4 lg:grid-rows-[auto_1fr]">
        <div className="rounded-[1.9rem] border border-[var(--app-border)] bg-[var(--app-surface-hover)] p-4 sm:p-5">
          <div className="studio-section-label">Scene active</div>
          <div className="mt-3 text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--app-text)]">{surfaceLabel}</div>
          <p className="mt-3 text-sm leading-6 text-[var(--app-text)]/66">
            Une entree plus claire pour choisir une voix, une langue et un jeu avant de lancer la narration.
          </p>
        </div>
        <div className="rounded-[1.9rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 sm:p-5">
          <div className="studio-section-label">Console voix</div>
          <div className="mt-4 rounded-[1.45rem] border border-rose-300/14 bg-[linear-gradient(180deg,rgba(255,120,166,0.12),rgba(8,9,12,0.14))] p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">Voix active</div>
            <div className="mt-2 text-lg font-semibold tracking-[-0.04em] text-white">Kore · narration claire · fr-FR</div>
            <div className="mt-4 flex items-end gap-1.5">
              {[20, 42, 28, 54, 34, 46, 24, 38, 18, 33, 27, 49].map((height, index) => (
                <span key={`${height}-${index}`} className="w-2 rounded-full bg-white/70" style={{ height }} />
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {['Style instructions', 'Mode duo selon le modele'].map((item) => (
              <div key={item} className="rounded-[1.25rem] border border-[var(--app-border)] bg-black/10 px-3.5 py-3 text-sm text-[var(--app-text)]/78">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3">
            {launchers}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'lyria') {
    return (
      <div className="grid gap-4 lg:grid-rows-[auto_1fr]">
        <div className="rounded-[1.9rem] border border-[var(--app-border)] bg-[var(--app-surface-hover)] p-4 sm:p-5">
          <div className="studio-section-label">Scene active</div>
          <div className="mt-3 text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--app-text)]">{surfaceLabel}</div>
          <p className="mt-3 text-sm leading-6 text-[var(--app-text)]/66">
            Un rail musique dedie pour bed, clip, nasheed ou texture sonore, sans melanger cette logique avec la voix.
          </p>
        </div>
        <div className="rounded-[1.9rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 sm:p-5">
          <div className="studio-section-label">Deck musical</div>
          <div className="mt-4 rounded-[1.45rem] border border-emerald-300/14 bg-[linear-gradient(180deg,rgba(46,204,113,0.13),rgba(4,16,24,0.12))] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">Modele</div>
                <div className="mt-2 text-lg font-semibold tracking-[-0.04em] text-white">Lyria 2 · stable mix bed</div>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/72">x4 max</div>
            </div>
            <div className="mt-4 flex items-end gap-1.5">
              {[24, 31, 22, 47, 33, 58, 36, 44, 29, 51, 38, 62, 42, 35].map((height, index) => (
                <span key={`${height}-${index}`} className="w-2 rounded-full bg-white/70" style={{ height }} />
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {['Tempo, energie, textures', 'Negative prompt et seed'].map((item) => (
              <div key={item} className="rounded-[1.25rem] border border-[var(--app-border)] bg-black/10 px-3.5 py-3 text-sm text-[var(--app-text)]/78">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3">
            {launchers}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-rows-[auto_auto_1fr]">
      <div className="rounded-[1.9rem] border border-[var(--app-border)] bg-[var(--app-surface-hover)] p-4 sm:p-5">
        <div className="studio-section-label">Scene active</div>
        <div className="mt-3 text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--app-text)]">
          {surfaceLabel}
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--app-text)]/66">
          Une entree claire, un geste principal, puis une montee en puissance sans panneau generique ni wizard impose.
        </p>
      </div>

      <div className="rounded-[1.9rem] border border-[var(--app-border)] bg-[var(--app-surface-hover)] p-4 sm:p-5">
        <div className="studio-section-label">Cadence</div>
        <div className="mt-3 space-y-3">
          <div className="rounded-[1.25rem] border border-[var(--app-border)] bg-black/10 px-3.5 py-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-text-muted)]/78">Signal</div>
            <div className="mt-2 text-sm text-[var(--app-text)]/78">{content.ambientWords[0]} et {content.ambientWords[1]}</div>
          </div>
          <div className="rounded-[1.25rem] border border-[var(--app-border)] bg-black/10 px-3.5 py-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-text-muted)]/78">Execution</div>
            <div className="mt-2 text-sm text-[var(--app-text)]/78">{content.ambientWords[2]} puis {content.ambientWords[3]}</div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.9rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 sm:p-5">
        <div className="studio-section-label">Ce que vous pouvez lancer ici</div>
        <div className="mt-4 grid gap-3">
          {launchers}
        </div>
      </div>
    </div>
  );
}

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
    ? 'app store cowork'
    : mode === 'chat'
      ? 'chat & raisonnement'
      : mode === 'image'
        ? 'generation image'
      : mode === 'video'
        ? 'generation video'
          : mode === 'audio'
            ? 'text-to-speech'
            : 'lyria / musique';
  const atmosphereLine = content.ambientWords.slice(0, 4).join(' · ');
  const orchestrationLine = content.ambientWords.slice(-3).join(' · ');

  return (
    <section className="mx-auto flex min-h-full w-full max-w-6xl items-stretch px-3 py-3 sm:px-5 sm:py-4 lg:px-8 lg:py-5">
      <div className="studio-empty-state studio-panel-strong relative flex min-h-[34rem] w-full overflow-hidden rounded-[2.45rem] p-4 sm:p-5 lg:min-h-[38rem] lg:p-6">
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

        <div className="relative z-10 grid h-full min-h-[inherit] gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(18rem,0.82fr)] lg:gap-8">
          <div className="flex min-h-[26rem] flex-col justify-between">
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

              <h2 className="mt-6 max-w-[11ch] text-balance text-[clamp(2.15rem,7.4cqw,4.35rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-[var(--app-text)]">
                {content.title}
              </h2>

              <p className="mt-4 max-w-[38rem] text-[14px] leading-7 text-[var(--app-text)]/64 sm:text-[15px]">
                {content.body}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <span className="studio-chip">{atmosphereLine}</span>
                <span className="studio-chip">{orchestrationLine}</span>
              </div>

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
                        Ouvrir Cowork Apps
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

          {renderModeShowcase(mode, content, onQuickPrompt, surfaceLabel)}
        </div>
      </div>
    </section>
  );
};
