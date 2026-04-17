# NOW

## Objectif actuel
- Valider en conditions reelles le nouveau flow `Image Studio`:
  - une seule invite
  - refs image illimitees
  - plan auto adapte par produit
  - scroll corrige desktop + mobile

## Blocage actuel
- Aucun blocage code local.
- Le refactor est pose et valide en build/preview, mais pas encore rejoue dans une session authentifiee avec de vraies refs produit et une vraie generation backend.

## Prochaine action exacte
- Ouvrir le mode `image` dans l'app reelle.
- Uploader plus de 3 photos produit.
- Verifier:
  - plus aucun preset visible
  - toutes les refs restent visibles
  - la molette et le scroll mobile descendent sur toute la page
  - le lancement cree bien un pack auto adapte au produit

## Fichiers chauds
- `src/components/ImageStudio.tsx`
- `shared/listing-pack.ts`
- `server/lib/schemas.ts`
- `server/lib/media-generation.ts`
- `src/App.tsx`
- `tmp/media-modes-preview.tsx`

## Validations restantes
- smoke manuel authentifie du mode `image`
- smoke backend reel avec plus de 3 refs image
- controle UX final sur un vrai produit mal classe ou peu explicite

## Risques immediats
- l'inference produit/style repose encore sur `prompt + noms de fichiers`; certains cas ambigus peuvent tomber sur une famille trop generique
- le preview local prouve la composition et le scroll, mais pas encore le rendu final d'une vraie generation remote
