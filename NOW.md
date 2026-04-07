# NOW

## Objectif actuel
- Attaquer la Phase 2 Cowork v2: sandbox Python reelle sur le worker Cloud Run deja deploye, maintenant que la regression Vercel qui cassait tous les modes est corrigee en production.

## Blocage actuel
- La Phase 0 reelle est fermee, la Phase 1A reelle est fermee, la Phase 1B multimodale est validee en vrai, et le crash Vercel `DOMMatrix` a ete corrige; le prochain gap produit est l'absence des endpoints `/sandbox/python` et `/sandbox/shell` dans `cowork-workers`.
- `vercel env add ... preview` exige un `git-branch` explicite; dans cette session seuls `development` et `production` ont ete branches automatiquement.

## Prochaine action exacte
- 1. Ajouter `/sandbox/python` au worker Cloud Run avec timeout, venv `uv` et streaming SSE.
- 2. Ajouter `/sandbox/shell` avec whitelist stricte et cleanup.
- 3. Brancher `run_python` / `run_shell` dans `api/index.ts` via `callCoworkWorker()`.
- 4. Rejouer un smoke reel `print('hello')`, puis un run Cowork qui genere un fichier et le republie.

## Fichiers chauds
- `api/index.ts`
- `server/lib/cowork-workers.ts`
- `cloud-run/cowork-workers/src/index.js`
- `cloud-run/cowork-workers/Dockerfile`
- `server/lib/storage.ts`
- `verify-cowork-rag-e2e.ts`

## Validations restantes
- smoke reel `run_python("print('hello')")`
- execution Python avec generation de fichier + upload GCS de retour
- non-regression `npm run lint`, `npm run build`, `npx tsx test-cowork-workers.ts`, `npx tsx test-cowork-loop.ts`

## Risques immediats
- ne jamais reintroduire un import top-level PDF qui peut faire tomber tout le boot Vercel (`/api/status`, `/api/chat`, `/api/cowork`)
- le projet Vertex actuel peut renvoyer des `429 RESOURCE_EXHAUSTED` intermittents; les smokes RAG sont maintenant honnetes sur ce point
- `qdrant-dev` tourne actuellement en self-host sur Cloud Run pour la validation reelle; ce n'est pas encore la cible finale SaaS/Qdrant Cloud
- la Phase 2 ajoute du code arbitraire: ne jamais exposer les routes sandbox sans timeout, cleanup et bearer auth
