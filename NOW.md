# NOW

## Objectif actuel
- Terminer la vraie Phase 0 de Cowork v2: deployer `cowork-workers` sur Cloud Run, brancher `COWORK_WORKERS_URL` / `COWORK_WORKERS_TOKEN`, puis lancer la Phase 1A RAG text-first.

## Blocage actuel
- La fondation est verte localement, mais aucun service Cloud Run reel n'est encore deploye ni pointe par les env vars de l'app.

## Prochaine action exacte
- Depuis `cloud-run/cowork-workers/`, faire un premier deploy Cloud Run reel (`gcloud builds submit --config cloudbuild.yaml .` ou `gcloud run deploy --source .`), configurer `COWORK_WORKERS_TOKEN`, puis verifier:
  1. `curl https://<service>.run.app/health`
  2. `npx tsx test-cowork-workers.ts` avec `COWORK_WORKERS_URL` sur l'URL reelle
  3. debut de `server/lib/embeddings.ts` + `server/lib/qdrant.ts` pour Phase 1A

## Fichiers chauds
- `server/lib/cowork-workers.ts`
- `server/lib/config.ts`
- `api/index.ts`
- `cloud-run/cowork-workers/src/index.js`
- `cloud-run/cowork-workers/cloudbuild.yaml`
- `test-cowork-workers.ts`

## Validations restantes
- smoke Cloud Run reel sur `/health`
- wiring env vars cote app/Vercel
- Phase 1A RAG text-only avec un premier vrai index/retrieval

## Risques immediats
- `cloudbuild.yaml` deploie bien le service, mais la vraie auth bearer et les env vars Cloud Run restent a poser hors repo.
- `gemini-embedding-2-preview` n'accepte pas les PDFs longs en direct comme un flux illimite: pour les docs > 6 pages, il faudra extraire/chunker le texte au lieu de compter sur l'embed PDF natif.
