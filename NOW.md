# NOW

## Objectif actuel
- Phase 2 Cowork v2 est codee localement et le worker Cloud Run est valide reellement.
- Le prochain gros chantier fonctionnel est la Phase 3 V1 (GitOps / GitHub / Vercel), sauf si on choisit d'abord de push/deployer la Phase 2 backend.

## Blocage actuel
- Aucun blocage technique majeur sur la Phase 2 elle-meme.
- Point ouvert non ferme dans cette session:
  - les changements Phase 2 du repo ne sont pas encore commit/push/deployes cote backend Vercel dans ce tour
  - le retest produit authentifie sur la disparition de `session-touch-failed` n'a pas encore ete rejoue par l'utilisateur dans cette session

## Prochaine action exacte
- Soit:
  - commit/push les changements Phase 2
  - deployer le backend associe
  - rejouer un vrai run `/api/cowork` avec `COWORK_ENABLE_SANDBOX=1`
- Soit:
  - attaquer directement la Phase 3 V1

## Fichiers chauds
- `api/index.ts`
- `server/lib/cowork-workers.ts`
- `server/lib/cowork-sandbox.ts`
- `cloud-run/cowork-workers/cloudbuild.yaml`
- `cloud-run/cowork-workers/src/sandbox/python.js`
- `cloud-run/cowork-workers/src/sandbox/shell.js`
- `cloud-run/cowork-workers/src/sandbox/persistence.js`

## Validations restantes
- si on veut fermer la Phase 2 "deployee cote produit":
  - push/deploy du repo courant
  - retest reel d'un run `/api/cowork` qui appelle `run_python` / `run_shell`
- validations deja faites:
  - `npm run lint`
  - `npm run build`
  - `node node_modules/tsx/dist/cli.mjs test-cowork-workers.ts`
  - `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts`
  - `node node_modules/tsx/dist/cli.mjs test-cowork-sandbox.ts`
  - `GET /health` sur `cowork-workers`
  - `POST /sandbox/python` reel
  - `POST /sandbox/shell` reel
  - installation de package + reimport sur 2 requetes reelles
  - persistance de fichier de session shell sur 2 requetes reelles
  - `DELETE /sandbox/:sessionId` reel

## Risques immediats
- ne jamais supposer que `/tmp` ou un venv local Cloud Run survit d'une requete a l'autre ou entre instances
- ne jamais rebasculer le pipeline image worker sur Container Registry classique; garder Artifact Registry
- ne jamais deployer une image Cloud Run avant `docker push` effectif dans le pipeline
- ne jamais exposer les routes sandbox sans timeout, cleanup, bearer auth et allowlist shell
- la Phase 2 manipule du code arbitraire: toute persistence doit rester isolee par `sessionId` et nettoyable explicitement
