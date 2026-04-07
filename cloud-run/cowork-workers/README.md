# Cowork Workers

Service Cloud Run minimal pour les capacites longues ou isolees de Cowork v2.

## Endpoints disponibles

- `GET /health`
- routes futures deja reservees et honnetement non implementees (`501`) :
  - `POST /sandbox/python`
  - `POST /sandbox/shell`
  - `POST /browser/session`
  - `POST /browser/:sessionId/...`
  - `POST /healing/run`
  - `DELETE /sandbox/:sessionId`
  - `DELETE /browser/:sessionId`

## Variables d'environnement

- `COWORK_WORKERS_TOKEN`
- `PORT` (par defaut `8080`)

## Lancement local

```bash
cd cloud-run/cowork-workers
node src/index.js
```

## Build et deploy

Depuis `cloud-run/cowork-workers/` :

```bash
gcloud builds submit --config cloudbuild.yaml .
```

Si tu preferes un deploy direct depuis les sources :

```bash
gcloud run deploy cowork-workers --source . --region europe-west1 --allow-unauthenticated
```

Puis configure le bearer token sur le service :

```bash
gcloud run services update cowork-workers --region europe-west1 --set-env-vars COWORK_WORKERS_TOKEN=ton_token
```

## Smoke test

```bash
curl https://<service>.run.app/health
```

Reponse attendue :

```json
{ "ok": true, "service": "cowork-workers" }
```
