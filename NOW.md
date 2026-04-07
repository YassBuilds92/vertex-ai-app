# NOW

## Objectif actuel
- Verifier en reel que le hotfix streaming/chat du 2026-04-07 supprime le `504` sur `/api/chat` avec PDF et que le recanonisation des `sessions` fait disparaitre `session-touch-failed`, puis reprendre la Phase 2 Cowork v2 (sandbox Python sur Cloud Run).

## Blocage actuel
- Le vrai bug critique restant n'etait pas l'embedding: `/api/chat` ouvrait un SSE sans `flushHeaders()` ni premier chunk immediat. Avec un PDF, le premier token Gemini pouvait arriver trop tard, Vercel gardait la requete muette puis finissait en `504 Gateway Timeout`.
- En parallele, `touchSession()` faisait un `updateDoc({ updatedAt })` sur des shells de session potentiellement legacy. Si le document remote portait encore des champs hors schema courant, la revalidation Firestore de tout le document echouait en `Missing or insufficient permissions`.
- La Phase 2 reste fonctionnellement non commencee: `/sandbox/python` et `/sandbox/shell` n'existent toujours pas dans `cowork-workers`.

## Prochaine action exacte
- Redepployer Vercel pour pousser le nouveau streaming `chat/cowork` et le fallback PDF text-first.
- Rejouer en prod un vrai run `chat` avec PDF joint et verifier dans F12:
  - `POST /api/chat -> 200` immediat
  - `x-studio-trace-id` present
  - events `chat:debug` avec `request_accepted -> contents_built -> model_stream_start`
- Rejouer ensuite un vrai run Cowork et verifier que les events SSE arrivent des l'initialisation.
- Si le `session-touch-failed` persiste encore, inspecter le detail Firestore du document `sessions/{id}` concerne pour identifier le ou les champs legacy restants.

## Fichiers chauds
- `src/App.tsx`
- `src/utils/client-debug.ts`
- `server/routes/standard.ts`
- `server/lib/chat-parts.ts`
- `src/utils/client-debug.ts`
- `firestore.rules`
- `api/index.ts`

## Validations restantes
- retest utilisateur reel d'un run `chat` avec session authentifiee + piece jointe PDF
- retest utilisateur reel d'un run `cowork` avec session authentifiee + piece jointe PDF
- verifier dans F12 la presence des nouveaux logs `chat:debug` et d'un `traceId`
- verifier dans F12 la disparition de `504` sur `/api/chat`
- verifier dans F12 la disparition de `session-touch-failed` pour le run courant
- non-regression deja faite: `npm run lint`
- non-regression deja faite: `npm run build`
- non-regression deja faite: `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts`
- verification locale faite: smoke `/api/chat` texte -> premier chunk SSE immediat
- verification locale faite: smoke `/api/chat` PDF -> `request_accepted -> contents_built -> model_stream_start`

## Risques immediats
- ne jamais reintroduire un endpoint SSE qui attend le premier token modele avant d'ouvrir vraiment la reponse HTTP
- ne jamais repasser les PDFs de `chat` uniquement en `fileData` si un texte extractible et court suffit: sinon la latence redevient opaque et fragile
- ne jamais faire un simple `updateDoc({ updatedAt })` sur un shell potentiellement legacy si le but est aussi de le recanoniser
- ne jamais reintroduire un import top-level PDF qui peut faire tomber tout le boot Vercel (`/api/status`, `/api/chat`, `/api/cowork`)
- ne jamais laisser une instruction systeme custom ecraser Cowork pur; toute personnalisation forte doit rester cote chat/agent/app, pas prendre la main sur le runtime autonome
- le projet Vertex actuel peut renvoyer des `429 RESOURCE_EXHAUSTED` intermittents; les smokes RAG sont maintenant honnetes sur ce point
- `qdrant-dev` tourne actuellement en self-host sur Cloud Run pour la validation reelle; ce n'est pas encore la cible finale SaaS/Qdrant Cloud
- la Phase 2 ajoute du code arbitraire: ne jamais exposer les routes sandbox sans timeout, cleanup et bearer auth
