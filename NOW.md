# NOW

## Objectif actuel
- Reprendre la Phase 2 Cowork v2 (sandbox Python sur Cloud Run) apres fermeture du hotfix prod `chat/cowork` du 2026-04-07.

## Blocage actuel
- Le hotfix critique `chat/cowork` est maintenant pousse sur `main`, deploye sur Vercel prod et valide en vrai sur l'alias public:
  - `/api/chat` avec PDF joint repond en `200` immediat
  - `traceId` est present
  - les events `request_accepted -> contents_built -> model_stream_start -> first_chunk_received` sortent bien
  - `/api/cowork` emet aussi des events des l'initialisation
- Le seul point produit encore non prouve bout-en-bout est la disparition totale de `session-touch-failed` dans une vraie session navigateur authentifiee utilisateur; le code a ete recanonise pour l'eviter, mais aucun retest prod authentifie n'a encore ete capture dans cette session.
- La Phase 2 reste fonctionnellement non commencee: `/sandbox/python` et `/sandbox/shell` n'existent toujours pas dans `cowork-workers`.

## Prochaine action exacte
- Demarrer la Phase 2:
  - creer `/sandbox/python` et `/sandbox/shell` dans `cloud-run/cowork-workers`
  - exposer `run_python`, `run_shell`, `install_python_package` dans `api/index.ts`
  - garder feature flags OFF par defaut
- Au prochain retest utilisateur authentifie sur prod:
  - verifier dans F12 que `session-touch-failed` n'apparait plus
  - si le warning reapparait, inspecter le document `sessions/{id}` legacy concerne avant toute nouvelle modif fonctionnelle

## Fichiers chauds
- `cloud-run/cowork-workers/src/index.js`
- `cloud-run/cowork-workers/README.md`
- `server/lib/cowork-workers.ts`
- `server/lib/config.ts`
- `api/index.ts`
- `src/App.tsx`

## Validations restantes
- retest utilisateur reel d'un run `chat` avec session authentifiee + piece jointe PDF
- retest utilisateur reel d'un run `cowork` avec session authentifiee + piece jointe PDF
- verifier dans F12 la disparition de `session-touch-failed` pour le run courant
- non-regression deja faite: `npm run lint`
- non-regression deja faite: `npm run build`
- non-regression deja faite: `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts`
- verification locale faite: smoke `/api/chat` texte -> premier chunk SSE immediat
- verification locale faite: smoke `/api/chat` PDF -> `request_accepted -> contents_built -> model_stream_start`
- verification prod faite: `GET /api/status` -> `200`
- verification prod faite: `POST /api/chat` avec PDF joint -> `200` + `traceId` + events debug immediats
- verification prod faite: `POST /api/cowork` minimal -> `200` + `status` immediat + `text_delta`

## Risques immediats
- ne jamais reintroduire un endpoint SSE qui attend le premier token modele avant d'ouvrir vraiment la reponse HTTP
- ne jamais repasser les PDFs de `chat` uniquement en `fileData` si un texte extractible et court suffit: sinon la latence redevient opaque et fragile
- ne jamais refaire un `updateDoc(...)` sur `sessions/{id}` si le but est aussi de purifier un document potentiellement legacy
- ne jamais reintroduire un import top-level PDF qui peut faire tomber tout le boot Vercel (`/api/status`, `/api/chat`, `/api/cowork`)
- ne jamais laisser une instruction systeme custom ecraser Cowork pur; toute personnalisation forte doit rester cote chat/agent/app, pas prendre la main sur le runtime autonome
- le projet Vertex actuel peut renvoyer des `429 RESOURCE_EXHAUSTED` intermittents; les smokes RAG sont maintenant honnetes sur ce point
- `qdrant-dev` tourne actuellement en self-host sur Cloud Run pour la validation reelle; ce n'est pas encore la cible finale SaaS/Qdrant Cloud
- la Phase 2 ajoute du code arbitraire: ne jamais exposer les routes sandbox sans timeout, cleanup et bearer auth
