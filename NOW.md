# NOW

## Objectif actuel
- Lot "fluidite + media studios + Cowork multi-tour" ferme localement et pret pour retest reel / redeploiement.
- Ce lot couvre maintenant:
  - Cowork qui traite en priorite le dernier follow-up au lieu de repartir sur la requete precedente
  - la persistance exacte `prompt` / `refinedPrompt` / modele / profil de raffineur sur image/audio/video/lyria
  - la galerie image hero + copie fiable des prompts
  - le player audio custom avec preview plus premium
  - les raffineurs IA par mode avec profils et consignes perso
  - plusieurs sources de jank frontend (transitions globales, updates streaming trop frequentes, gros shell trop lourd)

## Blocage actuel
- Aucun blocage technique majeur.
- La prochaine preuve critique n'est plus le code local mais le retest utilisateur reel:
  - conversation Cowork longue puis follow-up court
  - generation image/audio sur session normale
  - redeploiement si on veut projeter ce lot sur l'environnement public

## Prochaine action exacte
- rejouer les flows critiques en contexte reel apres push:
  - Cowork multi-tour
  - image studio avec copie de prompt
  - audio/Lyria studio avec player custom
- si le retest est bon, reprendre le prochain chantier prioritaire (Phase 3 V1 ou lot produit suivant)

## Fichiers chauds
- `api/index.ts`
- `src/App.tsx`
- `src/components/ImageStudio.tsx`
- `src/components/AudioStudio.tsx`
- `src/components/LyriaStudio.tsx`
- `src/components/VideoStudio.tsx`
- `src/components/StudioAudioPlayer.tsx`
- `src/components/SidebarRight.tsx`
- `src/utils/chat-parts.ts`
- `src/utils/media-gallery-history.ts`
- `src/utils/instruction-gallery.ts`
- `shared/prompt-refiners.ts`
- `tmp/media-modes-preview.html`
- `tmp/media-modes-preview.tsx`

## Validations restantes
- a faire:
  - retest utilisateur reel / redeploiement si souhaite
- deja faits sur ce lot:
  - `npm run lint`
  - `npm run build`
  - `node node_modules/tsx/dist/cli.mjs verify-chat-parts.ts`
  - `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts`
  - check cible `buildApiHistoryFromMessages(..., { coworkCompact: true, maxMessages: 8 })`
  - QA visuelle locale via Vite source + Playwright CLI / Edge sur les studios image/audio/lyria et le panneau Cowork

## Risques immediats
- ne pas reintroduire un historique Cowork trop massif sur les runs multi-tour
- ne pas perdre `generationMeta` lors de sanitization/persistence des attachments
- ne pas refaire du lecteur audio natif brut sur les surfaces premium
- ne pas casser la compaction d'historique Cowork en voulant rajouter trop de contexte
