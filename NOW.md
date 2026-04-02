# NOW

## Objectif actuel
- Valider en vrai run connecte la nouvelle ingestion fichiers chat/Cowork:
  - video = contenu lisible, pas seulement titre/URL
  - PDF/image/audio = toujours OK
  - documents texte (`txt`, `md`, `csv`, `json`, etc.) = contenu relu par le modele

## Blocage actuel
- Le correctif est valide localement en TypeScript/tests, mais pas encore rejoue dans l'app authentifiee/deployee.

## Prochaine action exacte
- Redeployer puis rejouer une matrice manuelle:
  - chat + video MP4
  - Cowork + video MP4
  - chat + PDF
  - chat + TXT/JSON/CSV

## Fichiers chauds
- `src/App.tsx`
- `server/lib/chat-parts.ts`
- `server/lib/storage.ts`
- `server/routes/standard.ts`
- `api/index.ts`
- `verify-chat-parts.ts`

## Validations restantes
- Rejouer les uploads reels dans l'UI connectee.
- Verifier qu'un ancien message video deja persiste est bien rehydrate via `gs://`.
- Confirmer qu'aucun type supporte ne retombe sur le simple fallback `Nom + URL`.

## Risques immediats
- Les fichiers texte tres volumineux restent tronques volontairement dans le contexte modele.
- Les formats binaires non supportes par Gemini (ex: Office natif non parse localement) tombent encore sur un fallback descriptif.
