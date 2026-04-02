# NOW

## Objectif actuel
- Valider en vrai run connecte/deploye la nouvelle ingestion YouTube native dans chat/Cowork:
  - lien YouTube = contenu video reel, pas seulement titre/URL
  - reglages `debut / fin / FPS` = bien appliques et conserves
  - uploads video/PDF/image/audio/texte deja corriges = toujours OK

## Blocage actuel
- Le correctif YouTube natif est valide localement en TypeScript/tests + captures UI, mais pas encore rejoue dans l'app authentifiee/deployee.

## Prochaine action exacte
- Redeployer puis rejouer une matrice manuelle:
  - chat + URL YouTube simple
  - chat + URL YouTube avec `40s -> 80s`, `5 FPS`
  - Cowork + URL YouTube avec les memes reglages
  - follow-up sur un message YouTube deja persiste
  - revalidation rapide des uploads MP4/PDF/TXT

## Fichiers chauds
- `server/lib/chat-parts.ts`
- `src/components/ChatInput.tsx`
- `src/components/AttachmentGallery.tsx`
- `server/routes/standard.ts`
- `verify-chat-parts.ts`
- `tmp/youtube-preview.tsx`

## Validations restantes
- Rejouer YouTube natif dans l'UI connectee/deployee.
- Verifier qu'un message YouTube deja persiste garde bien sa plage `debut / fin / FPS`.
- Confirmer en vrai run si plusieurs URLs YouTube dans un meme contexte restent acceptables par l'endpoint cible.
- Confirmer qu'aucun type supporte ne retombe sur le simple fallback `Nom + URL`.

## Risques immediats
- Les fichiers texte tres volumineux restent tronques volontairement dans le contexte modele.
- Les formats binaires non supportes par Gemini (ex: Office natif non parse localement) tombent encore sur un fallback descriptif.
- La doc Vertex sur les URLs YouTube est plus restrictive que l'UI Google AI Studio sur certains cas; le multi-YouTube par requete reste a verifier en pratique.
