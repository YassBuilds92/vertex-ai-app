# NOW

## Objectif actuel
- Verrouiller la resynchronisation multi-appareils des historiques quand une session ou des messages sont restes seulement dans le cache local apres un echec Firestore/reseau.
- Le fix local ajoute:
  - le replay automatique des `session shells` restes `pendingRemote`
  - le replay des snapshots de messages standards vers Firestore
  - le replay des snapshots Cowork au retour reseau / retour de focus
  - la recreation d'une coquille de session avant replay si seul l'historique local subsiste

## Blocage actuel
- Aucun blocage code majeur.
- La preuve critique restante est un retest reel en session connectee:
  - creer un fil hors ligne ou avec Firestore degrade sur appareil A
  - laisser l'app replay au retour reseau / retour de focus
  - verifier l'apparition du fil sur appareil B avec le meme compte

## Prochaine action exacte
- rejouer la recette `Historique - synchro multi-appareils apres echec local puis reprise reseau`
- si le retest est bon:
  - redeployer si l'environnement public n'a pas encore ce fix
  - reprendre ensuite les retests media/Cowork deja notes

## Fichiers chauds
- `api/index.ts`
- `src/App.tsx`
- `src/utils/sessionShells.ts`
- `src/utils/sessionSnapshots.ts`
- `src/utils/cowork.ts`
- `src/components/ImageStudio.tsx`
- `src/components/AudioStudio.tsx`
- `src/components/LyriaStudio.tsx`
- `src/components/VideoStudio.tsx`
- `src/components/StudioAudioPlayer.tsx`
- `src/components/SidebarRight.tsx`
- `QA_RECIPES.md`
- `src/utils/chat-parts.ts`
- `src/utils/media-gallery-history.ts`
- `src/utils/instruction-gallery.ts`
- `shared/prompt-refiners.ts`
- `tmp/media-modes-preview.html`
- `tmp/media-modes-preview.tsx`

## Validations restantes
- a faire:
  - retest utilisateur reel multi-appareils sur compte connecte
  - redeploiement si souhaite / si prod n'a pas encore ce fix
- deja faits sur ce lot:
  - `npm run lint`
  - `npm run build`
  - `node node_modules/tsx/dist/cli.mjs verify-chat-parts.ts`
  - `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts`
  - check cible `buildApiHistoryFromMessages(..., { coworkCompact: true, maxMessages: 8 })`
  - QA visuelle locale via Vite source + Playwright CLI / Edge sur les studios image/audio/lyria et le panneau Cowork

## Risques immediats
- surveiller un replay inutilement trop frequent des snapshots Cowork locaux
- ne pas perdre une session sans shell distant quand seuls des snapshots locaux restent encore a rejouer
- ne pas reintroduire un historique Cowork trop massif sur les runs multi-tour
- ne pas perdre `generationMeta` lors de sanitization/persistence des attachments
- ne pas refaire du lecteur audio natif brut sur les surfaces premium
- ne pas casser la compaction d'historique Cowork en voulant rajouter trop de contexte
