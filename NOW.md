# NOW

## Objectif actuel
- Revalider a chaud le produit apres remise en ligne de l'API prod:
  - confirmer dans l'UI reelle qu'un refresh retire bien le faux etat "Vertex deconnecte"
  - confirmer qu'un envoi utilisateur normal en chat et Cowork passe sans popup 500
  - reprendre ensuite la revalidation generated app authentifiee

## Blocage actuel
- Plus de blocage prod immediat:
  - `https://vertex-ai-app-pearl.vercel.app/api/status` renvoie a nouveau `200`
  - `POST /api/chat` renvoie `200`
  - `POST /api/cowork` renvoie `200`
- Fix retenu:
  - le bundle generated app ne depend plus d'un import runtime vers `generated-app-sdk`
  - `server/lib/generated-apps.ts` genere maintenant un composant React autonome pour le bundle diagnostique
  - le host produit continue d'utiliser le rendu natif canonique via `GeneratedAppCanvas`

## Prochaine action exacte
- Recharger l'app en production et verifier a la main:
  - badge Vertex AI reconnecte
  - un message simple en chat
  - un message simple en Cowork
- Puis reprendre la verification generated app connectee:
  - `create -> open -> run -> publish -> update draft`

## Fichiers chauds
- `server/lib/generated-apps.ts`
- `shared/generated-app-sdk.tsx`
- `shared/generated-app-bundle.ts`
- `src/generated-app-sdk.tsx`
- `test-generated-app-bundle-state.ts`
- `COWORK.md`
- `SESSION_STATE.md`
- `BUGS_GRAVEYARD.md`

## Validations restantes
- Verifier le rendu UI reel apres refresh navigateur.
- Rejouer le flux authentifie complet generated app dans la vraie app.

## Risques immediats
- Si une ancienne page garde une reponse `/api/status` en cache ou un state frontend stale, l'utilisateur peut devoir faire un hard refresh pour voir le badge se recaler.
- Le flux generated app complet en session authentifiee reste la prochaine zone a revalider en conditions reelles.
