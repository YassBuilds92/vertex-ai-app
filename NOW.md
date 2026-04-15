# NOW

## Objectif actuel
- Valider en conditions reelles le correctif `prompt system -> nouveau contexte` et le nouveau flux `video -> Veo`.

## Blocage actuel
- Pas de blocage code local sur le correctif livre:
  - `npm run build` -> OK
  - import serveur `server/routes/standard.ts` -> OK
- Limites restantes:
  - `npm run lint` est encore rouge a cause de 2 erreurs preexistantes hors scope sur la normalisation des modeles image (`server/lib/generated-apps.ts`, `shared/image-models.ts`)
  - aucun smoke Veo reel n'a ete lance pour eviter un cout/billing inutile sans validation utilisateur

## Prochaine action exacte
- Ouvrir une session standard, modifier l'instruction systeme, envoyer un message et verifier que:
  - le premier envoi part sans historique precedent
  - le nouveau prompt system est applique des le premier tour
- Puis lancer un vrai prompt video court pour confirmer le flux Veo + GCS.

## Fichiers chauds
- `src/App.tsx`
- `server/routes/standard.ts`
- `server/lib/storage.ts`
- `src/components/VideoStudio.tsx`
- `TECH_RADAR.md`

## Validations restantes
- smoke UX reelle du reset de contexte apres changement de prompt system
- smoke Veo reel avec bucket de sortie configure
- optionnel: nettoyer les 2 erreurs TypeScript preexistantes hors scope image-models

## Risques immediats
- la route video attend potentiellement plusieurs minutes; sur un runtime serverless strict le polling peut encore etre trop long
- si une session a ete editee sans envoi ensuite, Firestore peut encore afficher l'ancien `systemInstruction` jusqu'au prochain `touchSession`
