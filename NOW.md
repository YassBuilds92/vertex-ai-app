# NOW

## Objectif actuel
- Fermer la vraie validation externe de la Phase 1A Cowork v2: brancher Qdrant + Vertex, rejouer l'indexation/retrieval reelle, puis lancer la Phase 1B multimodale.

## Blocage actuel
- La Phase 1A est implementee et verte localement, mais aucune preuve reelle n'a encore ete jouee contre un cluster Qdrant et des embeddings Vertex actifs dans cet environnement.

## Prochaine action exacte
- Configurer les env vars reelles puis lancer:
  1. `COWORK_ENABLE_RAG=1`
  2. `COWORK_RAG_AUTOINJECT=1`
  3. `QDRANT_URL` (+ `QDRANT_API_KEY` si besoin)
  4. `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS_JSON`
  5. `COWORK_TEST_RAG=1`
- Ensuite:
  - `npx tsx test-cowork-rag.ts`
  - upload d'un PDF texte via Cowork
  - demande de rappel semantique reelle pour verifier `memory_search` + auto-injection

## Fichiers chauds
- `api/index.ts`
- `server/lib/cowork-memory.ts`
- `server/lib/embeddings.ts`
- `server/lib/qdrant.ts`
- `src/App.tsx`
- `src/utils/cowork.ts`
- `src/components/MessageItem.tsx`
- `test-cowork-rag.ts`

## Validations restantes
- smoke reel `test-cowork-rag.ts`
- run Cowork authentifie avec upload texte/PDF puis question de rappel
- verification UI du pill `Memoire (n)` sur un vrai run avec auto-injection

## Risques immediats
- sans `userIdHint`, la memoire backend ne peut pas isoler proprement les donnees utilisateur
- si Qdrant est indisponible, l'upload doit rester reussi mais l'indexation memoire sera seulement best-effort et visible comme warning
- `gemini-embedding-001` reste text-only: l'image/audio/video attendront la Phase 1B
