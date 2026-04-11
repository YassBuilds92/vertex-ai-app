# NOW

## Objectif actuel
- Garder la prod Vercel alignee sur `project-82b8c612-ea3d-49f5-864` pour Vertex + GCS.

## Blocage actuel
- Aucun blocage infra immediat cote Vercel:
  - `GET https://vertex-ai-app-pearl.vercel.app/api/status` -> `googleAuthMode: "authorized-user-json"`
  - `POST /api/chat` -> repond `ok`
  - `POST /api/upload` + `GET /api/storage/object` -> OK sur `gs://project-82b8c612-ea3d-49f5-864-studio-output/...`
- Reste seulement une validation UX manuelle si l'utilisateur veut rejouer le flow complet dans l'interface.

## Prochaine action exacte
- Rejouer un envoi reel dans l'UI de production et verifier qu'aucune erreur de billing n'apparait.

## Fichiers chauds
- `server/lib/storage.ts`
- `server/lib/google-genai.ts`
- `QA_RECIPES.md`

## Validations restantes
- smoke UX manuel dans l'app de prod
- si besoin, aligner aussi les autres environnements/deploiements annexes sur le meme projet bucket

## Risques immediats
- l'auth Vercel repose maintenant sur un JSON `authorized_user` ADC; si on veut un mode plus strict/serveur a long terme, migrer plus tard vers Workload Identity Federation
