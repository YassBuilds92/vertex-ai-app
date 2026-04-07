# NOW

## Objectif actuel
- Verifier en reel que le hotfix Cowork/Firestore du 2026-04-07 a bien stabilise les sessions et les runs utilisateur, puis reprendre la Phase 2 Cowork v2 (sandbox Python sur Cloud Run).

## Blocage actuel
- Le vrai bug utilisateur n'etait pas l'embedding: Cowork pouvait etre detourne par une instruction systeme custom persistante (`GEO-PALANTIR`) et Firestore refusait encore des champs reels (`selectedCustomPrompt`, nouveaux compteurs `runMeta`), ce qui degradait la persistance.
- La Phase 2 reste fonctionnellement non commencee: `/sandbox/python` et `/sandbox/shell` n'existent toujours pas dans `cowork-workers`.

## Prochaine action exacte
- Faire rejouer a l'utilisateur un vrai run Cowork avec PDF joint et ouvrir F12 pour confirmer les nouveaux logs.
- Si plus aucune degradation Firestore n'apparait, reprendre la Phase 2 avec `/sandbox/python`.
- Si un nouveau blocage apparait, partir des logs `[StudioDebug]` plutot que du ressenti UI seul.

## Fichiers chauds
- `src/App.tsx`
- `src/firebase.ts`
- `src/utils/client-debug.ts`
- `firestore.rules`
- `api/index.ts`
- `src/components/SidebarRight.tsx`

## Validations restantes
- retest utilisateur reel d'un run Cowork avec session authentifiee + piece jointe PDF
- verifier dans F12 la disparition des warnings `Cowork Firestore rules are outdated` et `Missing or insufficient permissions`
- non-regression deja faite: `npm run lint`
- non-regression deja faite: `npm run build`
- non-regression deja faite: `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts`
- infra deja faite: `npm run deploy-rules`
- infra deja faite: `vercel deploy --prod --yes`

## Risques immediats
- ne jamais reintroduire un import top-level PDF qui peut faire tomber tout le boot Vercel (`/api/status`, `/api/chat`, `/api/cowork`)
- ne jamais laisser une instruction systeme custom ecraser Cowork pur; toute personnalisation forte doit rester cote chat/agent/app, pas prendre la main sur le runtime autonome
- le projet Vertex actuel peut renvoyer des `429 RESOURCE_EXHAUSTED` intermittents; les smokes RAG sont maintenant honnetes sur ce point
- `qdrant-dev` tourne actuellement en self-host sur Cloud Run pour la validation reelle; ce n'est pas encore la cible finale SaaS/Qdrant Cloud
- la Phase 2 ajoute du code arbitraire: ne jamais exposer les routes sandbox sans timeout, cleanup et bearer auth
