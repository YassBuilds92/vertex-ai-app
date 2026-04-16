# NOW

## Objectif actuel
- Finaliser la v1 de la boucle consciente de `Cowork` pur:
  - clarification ciblee
  - pause/reprise propre
  - verification d'artefact avant publication
  - memoire degradee lisible

## Blocage actuel
- Aucun blocage code local.
- La fonctionnalite est implementee mais reste gatee par `COWORK_ENABLE_CONSCIOUS_LOOP`, OFF par defaut.
- Les smokes bout-en-bout avec vrai RAG/Vertex sur environnement cible restent a rejouer avec les envs adequats.

## Prochaine action exacte
- Activer `COWORK_ENABLE_CONSCIOUS_LOOP=1` sur un environnement de test.
- Jouer 3 smokes manuels:
  - clarification puis reprise
  - creation podcast/PDF puis verification puis `release_file`
  - memoire degradee avec message propre

## Fichiers chauds
- `api/index.ts`
- `server/lib/qdrant.ts`
- `src/utils/cowork.ts`
- `src/components/MessageItem.tsx`
- `src/App.tsx`
- `COWORK.md`

## Validations restantes
- smoke UI/produit reel avec `COWORK_ENABLE_CONSCIOUS_LOOP=1`
- smoke RAG e2e avec `COWORK_TEST_RAG=1`, `QDRANT_URL` et credentials Google disponibles

## Risques immediats
- le mode conscient peut augmenter legerement le nombre de tours sur des demandes ambiguës ou factualisees
- la v1 ne couvre pas encore `Hub Agents` ni `generated apps`
- la verification audio reste best-effort pour certains formats non-WAV quand la duree n'est pas directement inferable
