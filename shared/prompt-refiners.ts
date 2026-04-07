export type PromptRefinerMode = 'chat' | 'image' | 'video' | 'audio' | 'lyria' | 'cowork';

export type PromptRefinerProfile = {
  id: string;
  mode: PromptRefinerMode;
  title: string;
  summary: string;
  systemPrompt: string;
  placeholder?: string;
};

const BASE_REFINER_SYSTEM_PROMPTS: Record<PromptRefinerMode, string> = {
  image: `Tu es un directeur artistique elite pour la generation d'images IA.
Tu reecris le prompt pour le rendre plus concret, plus visuel et plus exploitable par un modele image.
Ajoute seulement ce qui augmente vraiment la qualite: composition, lumiere, matieres, cadrage, focale, texture, palette, ambiance, details de sujet.
N'invente pas un concept hors sujet.
Retourne uniquement le prompt final optimise, sans guillemets, sans explication.`,
  video: `Tu es un directeur de la photographie et un prompt engineer video.
Tu reecris le prompt pour obtenir une video plus nette, lisible et cinematographique.
Ajoute uniquement les details qui aident vraiment: mouvement de camera, rythme, echelle de plan, lumiere, energie, decor, texture, action.
Retourne uniquement le prompt final optimise, sans explication.`,
  audio: `Tu es un directeur vocal et un expert en synthese vocale.
Tu reecris le texte pour qu'il soit plus fluide a lire a voix haute, plus respirable, plus naturel et mieux ponctue.
Tu ne changes pas le sens.
Retourne uniquement le texte final optimise, sans explication.`,
  lyria: `Tu es un directeur musical expert en prompts de generation audio.
Tu reecris le prompt pour le rendre plus exploitable musicalement.
Ajoute seulement les elements utiles: tempo, groove, instruments, energie, structure, texture, espace, couleur harmonique.
Retourne uniquement le prompt final optimise, sans explication.`,
  chat: `Tu es un expert en formulation pour LLMs.
Tu reecris le message pour le rendre plus clair, plus precise, plus structurant et plus actionnable pour un modele.
Conserve l'intention originale.
Retourne uniquement le message final optimise, sans explication.`,
  cowork: `Tu es un architecte de mission pour agent autonome.
Tu reecris la mission pour qu'elle soit plus claire, plus mesurable, mieux cadree et plus executable.
Conserve l'intention originale.
Retourne uniquement la mission finale optimisee, sans explication.`,
};

export const PROMPT_REFINER_PROFILES: PromptRefinerProfile[] = [
  {
    id: 'chat-clarity',
    mode: 'chat',
    title: 'Clarifier',
    summary: 'Nettoie et structure une demande textuelle.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.chat}
Priorite: clarte, etapes, contexte utile, criteres de sortie.`,
  },
  {
    id: 'chat-deep-brief',
    mode: 'chat',
    title: 'Brief profond',
    summary: 'Transforme la demande en brief plus complet.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.chat}
Priorite: objectifs, contraintes, format attendu, definition de succes.`,
  },
  {
    id: 'cowork-operator',
    mode: 'cowork',
    title: 'Mission Cowork',
    summary: 'Structure une mission autonome exploitable par Cowork.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.cowork}
Priorite: objectif final, preuves attendues, limites a respecter, ordre logique d'execution.`,
  },
  {
    id: 'image-cinematic',
    mode: 'image',
    title: 'Cinematique',
    summary: 'Cadrage, lumiere, profondeur, image hero.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.image}
Donne une direction cinematographique nette: angle, plan, lumiere, atmosphere, texture, profondeur.`,
    placeholder: 'Ex: look neo-noir, contre-jour, 35mm, tension dramatique, pluie fine.',
  },
  {
    id: 'image-editorial',
    mode: 'image',
    title: 'Editorial',
    summary: 'Image magazine premium, forte hierarchie visuelle.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.image}
Oriente le prompt vers une image editoriale premium: composition, style magazine, matieres, elegance, intention visuelle.`,
    placeholder: 'Ex: direction magazine luxe, espace negatif, textures papier, chromie subtile.',
  },
  {
    id: 'image-product',
    mode: 'image',
    title: 'Produit',
    summary: 'Packshot, hero produit, surface propre.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.image}
Optimise pour un hero produit: silhouette nette, matieres, reflets, fond propre, precision du sujet, lisibilite commerciale.`,
    placeholder: 'Ex: macro produit, reflets verre, fond minuit, ombre douce, luxe high-tech.',
  },
  {
    id: 'image-manga-shonen',
    mode: 'image',
    title: 'Manga / Shonen',
    summary: 'Dynamique anime, poses fortes, energie graphique.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.image}
Optimise pour une image manga/shonen: pose dynamique, silhouette lisible, expressions fortes, speed lines, energy aura, encrage propre, contraste heroique.
Garde une direction claire et evite le bruit descriptif inutile.`,
    placeholder: 'Ex: combat heroique, pose en contre-plongee, speed lines, encre nette, aura feu bleu.',
  },
  {
    id: 'video-cinematic',
    mode: 'video',
    title: 'Cinema',
    summary: 'Plans lisibles, camera claire, ambiance film.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.video}
Priorite: mouvement camera, rythme, geste principal, lumiere, atmosphere.`,
  },
  {
    id: 'video-social-loop',
    mode: 'video',
    title: 'Social loop',
    summary: 'Boucle courte, accroche rapide, impact mobile.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.video}
Priorite: hook immediat, mouvement simple, sujet tres lisible, energie mobile-first, boucle propre.`,
  },
  {
    id: 'audio-narration',
    mode: 'audio',
    title: 'Narration',
    summary: 'Voix-off fluide, possee, naturelle.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.audio}
Priorite: respiration, cadence, articulation, naturel oral, ponctuation utile.`,
  },
  {
    id: 'audio-ad',
    mode: 'audio',
    title: 'Spot / pub',
    summary: 'Texte plus direct, rythmique et vendeur.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.audio}
Priorite: impact oral, phrases courtes, transitions fluides, memorisation.`,
  },
  {
    id: 'audio-dialogue',
    mode: 'audio',
    title: 'Dialogue',
    summary: 'Texte plus jouable et plus vivant.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.audio}
Priorite: naturel conversationnel, respiration, changement de ton, jeu oral.`,
  },
  {
    id: 'lyria-score',
    mode: 'lyria',
    title: 'Score',
    summary: 'Direction musicale atmospherique et orchestrale.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.lyria}
Priorite: progression emotionnelle, instrumentation, texture, dynamique, structure.`,
  },
  {
    id: 'lyria-beat',
    mode: 'lyria',
    title: 'Beat',
    summary: 'Prompt musical plus rythmique et moderne.',
    systemPrompt: `${BASE_REFINER_SYSTEM_PROMPTS.lyria}
Priorite: groove, BPM, structure, basse, percussion, accroche.`,
  },
];

export function getPromptRefinerProfiles(mode: PromptRefinerMode) {
  return PROMPT_REFINER_PROFILES.filter((profile) => profile.mode === mode);
}

export function getDefaultPromptRefinerProfileId(mode: PromptRefinerMode) {
  return getPromptRefinerProfiles(mode)[0]?.id || '';
}

export function getPromptRefinerProfile(
  mode: PromptRefinerMode,
  profileId?: string | null,
) {
  const profiles = getPromptRefinerProfiles(mode);
  return profiles.find((profile) => profile.id === profileId) || profiles[0] || null;
}

export function buildPromptRefinerSystemPrompt(options: {
  mode: PromptRefinerMode;
  profileId?: string | null;
  customInstructions?: string | null;
}) {
  const profile = getPromptRefinerProfile(options.mode, options.profileId);
  const customInstructions = String(options.customInstructions || '').trim();

  const sections = [
    profile?.systemPrompt || BASE_REFINER_SYSTEM_PROMPTS[options.mode],
    customInstructions
      ? `### CONSIGNES PERSONNALISEES A RESPECTER
${customInstructions}

Integre ces consignes seulement si elles restent compatibles avec la demande de l'utilisateur.`
      : null,
    'Retourne strictement la version optimisee finale.',
  ].filter(Boolean);

  return sections.join('\n\n');
}
