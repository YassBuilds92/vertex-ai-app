# Cowork Workers

Service Cloud Run pour les capacites longues ou isolees de Cowork v2.

## Endpoints disponibles

- `GET /health`
- `POST /sandbox/python`
  - cree/reutilise une session sandbox
  - cree un venv `uv`
  - installe des packages optionnels
  - telecharge des fichiers workspace depuis GCS
  - execute du Python et stream `progress`, `stdout`, `stderr`, `done`
- `POST /sandbox/shell`
  - execute une commande shell allowlistee dans le workspace de session
  - stream `progress`, `stdout`, `stderr`, `done`
- `DELETE /sandbox/:sessionId`
  - cleanup explicite d'une session
- routes encore reservees et non implementees (`501`) :
  - `POST /browser/session`
  - `POST /browser/:sessionId/...`
  - `POST /healing/run`
  - `DELETE /browser/:sessionId`

## Variables d'environnement

- `COWORK_WORKERS_TOKEN`
- `COWORK_WORKSPACE_BUCKET`
  - bucket GCS de destination pour les fichiers generes
  - si absent, le worker retombe sur le bucket derive de `VERTEX_GCS_OUTPUT_URI`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
  - utile surtout en local
  - sur Cloud Run, ADC/service account suffit si le service a acces au bucket
- `PORT`
  - defaut `8080`

## Stack runtime

- Node.js 22
- Python 3.12
- `uv`
- `ffmpeg`
- packages Python pre-installes :
  - `numpy`
  - `pandas`
  - `matplotlib`
  - `pillow`
  - `requests`
  - `scipy`
  - `scikit-learn`
  - `pypdf`
  - `openpyxl`

## Lancement local

```bash
cd cloud-run/cowork-workers
npm install
node src/index.js
```

## Build et deploy

Depuis `cloud-run/cowork-workers/` :

```bash
gcloud builds submit --config cloudbuild.yaml .
```

Le deploy Cloud Build provisionne maintenant :

- `1 vCPU`
- `1 GiB RAM`
- `timeout 300s`

Si tu preferes un deploy direct depuis les sources :

```bash
gcloud run deploy cowork-workers --source . --region europe-west1 --allow-unauthenticated --cpu 1 --memory 1Gi --timeout 300
```

Puis configure le bearer token sur le service :

```bash
gcloud run services update cowork-workers --region europe-west1 --set-env-vars COWORK_WORKERS_TOKEN=ton_token,COWORK_WORKSPACE_BUCKET=project-82b8c612-ea3d-49f5-864-studio-output
```

## Smoke tests

### Health

```bash
curl https://<service>.run.app/health
```

Reponse attendue :

```json
{ "ok": true, "service": "cowork-workers", "sandbox": { "python": true, "shell": true } }
```

### Python

```bash
curl -N \
  -H "Authorization: Bearer $COWORK_WORKERS_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST https://<service>.run.app/sandbox/python \
  -d '{"sessionId":"smoke-python","code":"print(\"hello\")"}'
```

### Shell

```bash
curl -N \
  -H "Authorization: Bearer $COWORK_WORKERS_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST https://<service>.run.app/sandbox/shell \
  -d '{"sessionId":"smoke-shell","command":"python --version"}'
```
