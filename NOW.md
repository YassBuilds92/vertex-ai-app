# NOW

## Objectif actuel
- Rejouer en conditions reelles la nouvelle passe media + Cowork:
  - interface dediee `generation image`
  - interface dediee `generation video`
  - interface dediee `text-to-speech`
  - nouveau mode `Lyria / musique`
  - toggle Cowork `Utiliser les agents du Hub` desactive par defaut

## Blocage actuel
- La passe est validee localement en TypeScript/build + captures desktop/mobile via harness, mais pas encore rejouee dans l'app authentifiee avec de vrais runs Gemini/Cowork.

## Prochaine action exacte
- Rejouer la passe en session reelle:
  - ouvrir chaque mode media dans l'app connectee
  - lancer au moins un run image, video, TTS et Lyria
  - verifier que Cowork ne voit plus les outils/consignes hub quand le toggle agents est coupe
  - reverifier desktop + mobile sur le domaine/auth reels

## Fichiers chauds
- `src/components/SidebarRight.tsx`
- `src/components/StudioEmptyState.tsx`
- `src/App.tsx`
- `api/index.ts`
- `tmp/media-modes-preview.tsx`
- `QA_RECIPES.md`
- `COWORK.md`
- `DECISIONS.md`

## Validations restantes
- Verifier le rendu reel des generations sur les 4 modes media.
- Verifier que le toggle Cowork change bien le comportement runtime sur un vrai run.
- Verifier que le panneau droit reste lisible sur mobile une fois les vrais champs/erreurs rendus.

## Risques immediats
- Le harness local valide la composition, pas encore le comportement complet des endpoints reels.
- Le mode video garde une dette de validation runtime tant qu'un vrai run Veo n'a pas ete rejoue dans l'app.
- Sans run reelle, on ne peut pas encore prouver visuellement qu'aucun outil hub n'est propose a Cowork quand le toggle reste coupe.
