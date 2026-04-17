# NOW

## Objectif actuel
- Stabiliser le demarrage de `Cowork` quand l'auto-memoire RAG tombe.
- Garder la memoire en best-effort sans warning technique inline pour un incident Qdrant transitoire.

## Blocage actuel
- Aucun blocage code local.
- Le correctif local est pose, mais le smoke reel avec un vrai `503` Qdrant sur l'environnement cible reste a rejouer.

## Prochaine action exacte
- Rejouer un run Cowork avec auto-memoire active et un Qdrant qui renvoie du HTML `503`.
- Verifier:
  - absence de warning technique inline au debut du run
  - logs serveur toujours explicites
  - message court seulement si le probleme est non transitoire/configuration

## Fichiers chauds
- `api/index.ts`
- `server/lib/qdrant.ts`
- `test-cowork-loop.ts`
- `QA_RECIPES.md`
- `COWORK.md`

## Validations restantes
- smoke Cowork reel avec Qdrant transitoirement indisponible
- smoke RAG e2e avec `COWORK_TEST_RAG=1`, `QDRANT_URL` et credentials Google disponibles

## Risques immediats
- un incident Qdrant durable mais non transitoire remontera encore un message court cote UI, ce qui est voulu
- le correctif ne reduit pas a lui seul la latence si l'instance doit quand meme tenter un auto-retrieval avant echec
