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
  Wand2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AppMode } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const modeCopy: Record<AppMode, {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  suggestions: string[];
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = {
  chat: {
    eyebrow: 'Conversation augmentee',
    title: 'Une scene de travail claire, profonde et immediate pour raisonner sans friction.',
    body: "Pose une question, colle un brief, joins des fichiers, puis laisse la conversation devenir un vrai espace de travail au lieu d'une simple boite noire.",
    bullets: ['Conversations longues et lisibles', 'Copie pensée pour le fond', 'Rendu markdown et médias plus élégants'],
    suggestions: [
      "Explique-moi clairement la différence entre Plus et Business.",
      "Aide-moi à structurer un projet de A à Z.",
      "Résume-moi un sujet complexe avec exemples concrets.",
    ],
    icon: MessageSquare,
  },
  cowork: {
    eyebrow: 'Agent studio',
    title: "Cowork devient un vrai atelier d'exécution, de création d'agents et de livraison haut de gamme.",
    body: "Recherche, PDF premium, podcast, génération média, spécialistes réutilisables: tout part d'un même centre de commande, visible et itérable.",
    bullets: ['Hub Agents natif', 'PDF, podcast et outils média', 'Boucles agentiques lisibles'],
    suggestions: [
      "Crée un agent qui fait un PDF premium sur l'actu du soir.",
      "Fais une veille puis transforme-la en mini-site HTML.",
      "Prépare un podcast avec voix Gemini et fond Lyria.",
    ],
    icon: BrainCircuit,
  },
  image: {
    eyebrow: 'Image direction',
    title: "Un atelier visuel plus net, pour générer, comparer et diriger l'image sans interface molle.",
    body: "Le mode image doit donner envie de composer: ratios, variantes, prompts, et sorties premium, sans noyer l'utilisateur dans un panneau générique.",
    bullets: ['Ratios rapides', 'Choix de modèle plus lisible', 'Mise en valeur des rendus'],
    suggestions: [
      "Imagine une affiche éditoriale futuriste pour Studio Pro.",
      "Crée un concept art de forêt ancienne hyper détaillé.",
      "Génère une couverture magazine sport au style premium.",
    ],
    icon: ImageIcon,
  },
  video: {
    eyebrow: 'Video lab',
    title: 'Un cockpit vidéo plus éditorial pour diriger les formats, la durée et la scène en un coup d’œil.',
    body: "Au lieu d'un écran vide, le mode vidéo devient une surface de préproduction: promesse, format, cadence et rendu attendu sont visibles dès l'entrée.",
    bullets: ['Portrait et paysage visibles', 'Choix rapides de durée', 'Surface pensée pour le storyboard'],
    suggestions: [
      "Crée une vidéo portrait de lancement produit en 6 secondes.",
      "Prépare un plan cinématique de stade avant match.",
      "Imagine une scène nature contemplative en 16:9.",
    ],
    icon: Film,
  },
  audio: {
    eyebrow: 'Voice & sound',
    title: 'Un mode audio qui ressemble à un vrai studio de narration, pas à un simple champ TTS.',
    body: "Voix Gemini, langue, style et intentions doivent être lisibles instantanément pour donner l'impression d'un poste de narration professionnel.",
    bullets: ['Voix et locale visibles', 'Préparation de narration plus claire', 'Base idéale pour les futurs podcasts'],
    suggestions: [
      "Lis un intro podcast calme en français.",
      "Fais une voix off premium pour une vidéo produit.",
      "Prépare un texte parlé avec rythme radio du soir.",
    ],
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

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:px-10 lg:pt-12">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="studio-panel-strong relative overflow-hidden rounded-[2.4rem]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(129,236,255,0.11),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,191,134,0.1),transparent_22%)]" />

        <div className="grid gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-10">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-white/72">
              <Sparkles size={12} className="text-[var(--app-accent)]" />
              {content.eyebrow}
            </div>

            <div className="mt-5 max-w-3xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] text-[var(--app-accent)] shadow-[0_20px_40px_-24px_rgba(68,196,255,0.5)]">
                  <Icon size={20} />
                </div>
                <div className="studio-section-label">Studio Pro · {mode === 'cowork' ? 'mode agent' : mode}</div>
              </div>

              <h2 className="max-w-3xl text-3xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-4xl lg:text-[3.6rem]">
                {content.title}
              </h2>
              <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/66 sm:text-[16px]">
                {content.body}
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {content.bullets.map((bullet) => (
                <span key={bullet} className="studio-chip text-[12px]">
                  <Wand2 size={12} className="text-[var(--app-accent)]" />
                  {bullet}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
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
                    <Sparkles size={16} />
                    Lancer une première mission
                    <ArrowRight size={16} />
                  </button>
                  {mode === 'cowork' && onOpenAgentsHub && (
                    <button onClick={onOpenAgentsHub} className="studio-button-secondary">
                      <BrainCircuit size={16} />
                      Ouvrir le Hub Agents
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="mt-8 space-y-3">
              <div className="studio-section-label">Impulsions rapides</div>
              <div className="flex flex-wrap gap-2.5">
                {content.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => onQuickPrompt(suggestion)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-left text-[13px] text-white/78 transition-all hover:-translate-y-[1px] hover:border-[var(--app-border-strong)] hover:bg-white/[0.07]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <div className="grid gap-4">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                className="studio-panel rounded-[2rem] p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="studio-section-label">Vue directrice</div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-white">AWWARDS-grade shell</div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-[var(--app-accent)]">
                    <Icon size={18} />
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Centre</div>
                    <div className="mt-2 text-sm font-medium text-white/82">Poster state riche, lisible et actionnable</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Cadre</div>
                    <div className="mt-2 text-sm font-medium text-white/82">Rail, scène, inspector dans une seule DA</div>
                  </div>
                </div>
              </motion.div>

              <div className="grid gap-4 sm:grid-cols-[0.95fr_1.05fr]">
                <motion.div
                  animate={{ y: [0, 5, 0] }}
                  transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="studio-panel rounded-[1.8rem] p-5"
                >
                  <div className="studio-section-label">Energie produit</div>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.04] p-3 text-sm text-white/72">
                      Commandes visibles
                    </div>
                    <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.04] p-3 text-sm text-white/72">
                      Empty states utiles
                    </div>
                    <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.04] p-3 text-sm text-white/72">
                      Responsive maîtrisé
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}
                  className="studio-panel rounded-[1.8rem] p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="studio-section-label">Signal visuel</div>
                    <div className="h-2.5 w-2.5 rounded-full bg-[var(--app-accent)] shadow-[0_0_18px_rgba(129,236,255,0.8)]" />
                  </div>
                  <div className="mt-4 rounded-[1.5rem] border border-white/8 bg-[linear-gradient(135deg,rgba(129,236,255,0.1),rgba(255,255,255,0.02)_45%,rgba(255,191,134,0.08))] p-4">
                    <div className="text-xl font-semibold tracking-tight text-white">Scène prête pour la production</div>
                    <p className="mt-3 text-sm leading-6 text-white/66">
                      Une base propre pour le chat, Cowork, le hub agents, les médias et les futurs flux premium.
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
