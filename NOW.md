# NOW

## Objectif actuel
- UI/UX redesign complet termine et pousse. Tester en conditions reelles (session authentifiee).

## Blocage actuel
- Le bug "je peux ecrire que dans chat et raisonnement" n'a pas ete reproduit cote frontend. Le code `handleSend` et `ChatInput` ne sont pas mode-gates. Cause probable: backend/API ou session Firebase. A tester connecte.

## Prochaine action exacte
- Ouvrir l'app deployee connecte et tester l'ecriture dans les modes Images, Video, Voix, Lyria, Cowork.
- Si le bug persiste: investiguer les endpoints backend (`/api/chat`, `/api/cowork`) et les configs par mode dans `useStore.ts`.

## Fichiers chauds
- `src/App.tsx` (handleSend, configs par mode)
- `server/routes/` (endpoints par mode)
- `src/utils/chat-parts.ts` (construction des parts API)

## Validations restantes
- Test ecriture dans tous les modes (connecte)
- Test Cowork Apps (ouverture, creation, lancement)
- Verification visuelle mobile du nouveau design indigo
- Verification theme light (pas de regression)

## Risques immediats
- Le chunk `StudioHeroScene` reste a ~501 kB minifie (lazy-load, desktop only).
- Le `StudioEmptyState` a perdu la scene Three.js (simplification voulue). A re-evaluer si l'utilisateur la redemande.
