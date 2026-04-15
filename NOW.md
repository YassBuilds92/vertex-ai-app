# NOW

## Objectif actuel
- Finaliser la bascule `gemini-3.1-flash-tts-preview` dans le mode voix et Cowork, puis verifier le comportement utilisateur final.

## Blocage actuel
- Aucun blocage code local:
  - `npm run lint` -> OK
  - `npm run build` -> OK
  - smoke Vertex reel single-speaker `gemini-3.1-flash-tts-preview` -> OK
  - smoke Vertex reel duo `gemini-3.1-flash-tts-preview` -> OK

## Prochaine action exacte
- Ouvrir le mode `audio`, verifier visuellement que `Gemini 3.1 Flash TTS` apparait et lancer une generation courte en `fr-FR`.
- Puis lancer un test Cowork avec `generate_tts_audio` et, si besoin, un duo 2-speakers pour confirmer l'UX de bout en bout avant redeploiement.

## Fichiers chauds
- `shared/gemini-tts.ts`
- `src/components/AudioStudio.tsx`
- `src/components/SidebarRight.tsx`
- `server/lib/media-generation.ts`
- `api/index.ts`
- `TECH_RADAR.md`

## Validations restantes
- smoke UI manuel du mode voix
- smoke Cowork manuel sur `generate_tts_audio` / `create_podcast_episode`
- redeploiement si l'utilisateur veut cette bascule sur son environnement public

## Risques immediats
- `gemini-3.1-flash-tts-preview` reste un modele preview: quotas, latence et comportement peuvent encore bouger
- la doc Cloud TTS montre encore beaucoup d'exemples avec `location=global`; garder ce routing tant que Google ne stabilise pas un autre endpoint recommande
