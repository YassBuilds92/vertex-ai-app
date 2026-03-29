# TECH RADAR

## Format
- Date de verification
- Technologie
- Statut
- Choix
- Alternatives evaluees
- Cout
- Sources officielles

## 2026-03-29 - @google/genai pour Vertex AI
- Statut: retenu pour le projet
- Choix: conserver `@google/genai` comme SDK principal pour Gemini sur Vertex AI.
- Pourquoi: la documentation officielle Google recommande les nouvelles Google Gen AI libraries et montre la syntaxe actuelle `GoogleGenAI({ vertexai: true, project, location })` puis `ai.models.generateContent(...)`.
- Alternatives evaluees:
  - `@google-cloud/vertexai`
    - Ecartee pour les nouveaux travaux: la doc de migration met l'accent sur le nouvel SDK et le precedent chemin est en phase de depreciation.
  - appels REST artisanaux
    - Ecartes: plus fragiles, plus verbeux, moins maintenables.
- Cout: SDK gratuit, mais Vertex AI est un service payant a l'usage.
- Sources officielles:
  - [Google Gen AI SDK overview](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview)
  - [Google Gen AI libraries](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/libraries)
  - [Vertex AI SDK migration guide](https://cloud.google.com/vertex-ai/generative-ai/docs/deprecations/genai-vertexai-sdk)

## 2026-03-29 - Gemini 3.1 Pro Preview pour Cowork
- Statut: retenu pour les taches complexes Cowork
- Choix: garder `gemini-3.1-pro-preview` comme modele principal Cowork.
- Pourquoi: la documentation Vertex liste toujours `gemini-3.1-pro-preview` comme version supportee et la doc Gemini 3 montre des exemples explicites avec ce model ID pour les cas a fort raisonnement.
- Alternatives evaluees:
  - `gemini-3-flash-preview`
    - Conserve comme alternative plus rapide, mais pas choisi comme modele principal du mode autonome.
  - `gemini-2.5-pro`
    - Plus stable, mais moins aligne avec la direction produit actuelle basee sur Gemini 3.x.
- Cout: payant a l'usage via Vertex AI.
- Sources officielles:
  - [Supported models](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/provisioned-throughput/supported-models)
  - [Deployments and endpoints](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations)
  - [Get started with Gemini 3](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/get-started-with-gemini-3)

## 2026-03-29 - Gemini 3.1 Flash-Lite Preview pour taches de fond
- Statut: retenu pour la generation de blueprints et taches rapides
- Choix: utiliser `gemini-3.1-flash-lite-preview` pour les taches structurelles legeres comme la generation de blueprints d'agents.
- Pourquoi: model ID encore supporte officiellement, plus adapte aux taches rapides et moins couteuses que le mode autonome complet.
- Alternatives evaluees:
  - `gemini-3-flash-preview`
    - Plus puissant, mais pas necessaire pour un blueprint borne et structure.
  - `gemini-2.5-flash-lite`
    - Ecarte pour ce cas car la logique produit actuelle privilegie 3.1 quand disponible.
- Cout: payant a l'usage via Vertex AI.
- Sources officielles:
  - [Supported models](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/provisioned-throughput/supported-models)
  - [Deployments and endpoints](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations)

## 2026-03-29 - Endpoint global par defaut pour Gemini 3.x
- Statut: retenu
- Choix: continuer a utiliser `global` comme endpoint par defaut pour les appels Gemini 3.x/3.1.
- Pourquoi: les docs Gemini 3 quickstart utilisent explicitement `GOOGLE_CLOUD_LOCATION=global`, et la page locations liste les model IDs Gemini 3.x sur l'endpoint global.
- Alternatives evaluees:
  - region fixe `us-central1`
    - Ecartee comme valeur par defaut pour Gemini 3.x: moins robuste pour la disponibilite generale du projet.
- Cout: sans surcout de bibliotheque, cout Vertex AI normal.
- Sources officielles:
  - [Get started with Gemini 3](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/get-started-with-gemini-3)
  - [Deployments and endpoints](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations)

## 2026-03-29 - Gemini 2.5 Flash Image pour la generation image actuelle
- Statut: retenu
- Choix: conserver `gemini-2.5-flash-image` pour la generation image du projet.
- Pourquoi: la doc officielle indique que `gemini-2.5-flash-image` est le model ID courant et precise que les variantes preview precedentes sont retirees.
- Alternatives evaluees:
  - anciens previews image Gemini
    - Ecartes: retraites.
  - Imagen
    - Non retenu par defaut dans ce projet car la logique en place a deja migre vers le chemin Gemini image.
- Cout: payant a l'usage via Vertex AI.
- Sources officielles:
  - [Gemini 2.5 Flash Image model page](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-image)
  - [Generate and edit images with Gemini](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-generation)

## 2026-03-29 - Gemini TTS pour la future brique podcast
- Statut: en veille active, non encore branche dans le code
- Choix pressenti: utiliser les modeles Gemini TTS verifies officiellement (`gemini-2.5-pro-tts`, `gemini-2.5-flash-tts`) quand on branchera le pipeline podcast.
- Pourquoi: la doc officielle Cloud TTS liste ces modeles et montre une integration compatible SDK GenAI.
- Alternatives evaluees:
  - `gemini-2.5-flash-lite-preview-tts`
    - Existant dans la doc, mais moins evident comme choix par defaut pour une voix premium.
  - solutions TTS tierces
    - Non etudiees pour l'instant car la contrainte produit privilegie l'ecosysteme Google.
- Cout: payant a l'usage via Cloud TTS / Vertex Media Studio selon le chemin final.
- Sources officielles:
  - [Gemini-TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)
  - [Convert text to speech in Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/speech/text-to-speech)

## 2026-03-29 - Lyria pour la musique du futur mode podcast
- Statut: en veille active, non encore branche dans le code
- Choix pressenti: utiliser Lyria via Vertex AI pour la generation musicale du podcast.
- Pourquoi: la doc officielle confirme Lyria sur Vertex AI avec endpoint `global` et model IDs explicites pour Lyria 3.
- Alternatives evaluees:
  - banques musicales ou services tiers
    - Non etudies pour l'instant, car hors cible tant que le flux Google n'est pas branche.
- Cout: payant a l'usage via Vertex AI.
- Sources officielles:
  - [Generate music with Lyria](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music)

## 2026-03-29 - Veo pour la video
- Statut: retenu en principe, implementation backend encore partielle
- Choix: rester aligne sur Veo cote produit pour la video.
- Pourquoi: les docs officielles listent les modeles Veo 3.1 et leur usage text-to-video dans Vertex AI.
- Alternatives evaluees:
  - services video tiers
    - Non etudies ici car l'ecosysteme produit reste Google.
- Cout: payant a l'usage via Vertex AI.
- Sources officielles:
  - [Generate videos with Veo from text prompts](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-text)
  - [Deployments and endpoints](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations)

## 2026-03-29 - Gemini TTS pour audio direct et Cowork
- Statut: retenu et branche dans le code
- Choix: utiliser `gemini-2.5-flash-tts` par defaut, avec support explicite de `gemini-2.5-pro-tts` et `gemini-2.5-flash-lite-preview-tts`.
- Pourquoi: la doc officielle Cloud TTS liste ces modeles, le SDK `@google/genai` supporte `responseModalities: ['AUDIO']` + `speechConfig`, et ce chemin marche deja en test reel local.
- Alternatives evaluees:
  - `gemini-2.5-flash-lite-preview-tts`
    - Garde comme option eco, mais pas choisi par defaut.
  - solutions TTS tierces
    - Non etudiees pour l'instant car la contrainte produit privilegie l'ecosysteme Google.
- Cout: payant a l'usage via Cloud TTS / Vertex AI.
- Sources officielles:
  - [Gemini-TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)
  - [Convert text to speech in Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/speech/text-to-speech)

## 2026-03-29 - Lyria pour la musique directe et Cowork
- Statut: retenu et branche dans le code
- Choix: utiliser `lyria-002` par defaut pour la generation musicale, avec support prepare pour les modeles `lyria-3-*` via l'endpoint interactions.
- Pourquoi: la doc officielle Lyria 2 confirme l'endpoint `predict`, la doc Lyria 3 confirme l'endpoint interactions, et `lyria-002` a repondu en test reel local.
- Alternatives evaluees:
  - banques musicales ou services tiers
    - Non etudies pour l'instant, car hors cible tant que le flux Google repond correctement.
- Cout: payant a l'usage via Vertex AI.
- Sources officielles:
  - [Generate music with Lyria](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music)
  - [Lyria music generation reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/lyria-music-generation)

## 2026-03-29 - `google-auth-library` transitive pour Lyria REST
- Statut: retenu sans ajout de dependance directe
- Choix: reutiliser `google-auth-library` deja present transitivement dans `node_modules` pour obtenir un token OAuth Cloud Platform sur les appels REST Lyria.
- Pourquoi: evite d'ajouter une nouvelle dependance au `package.json`, reste officiel Google, et simplifie l'auth des endpoints Vertex AI non couverts par le chemin SDK deja utilise.
- Alternatives evaluees:
  - signer un JWT manuellement
    - Ecarte: plus fragile et plus verbeux sans gain produit.
  - ajouter `google-auth-library` comme dependance directe
    - Non retenu pour l'instant car la librairie est deja installee transitivement et suffit au besoin actuel.
- Cout: gratuit cote librairie, Vertex AI reste payant a l'usage.
- Sources officielles:
  - [google-auth-library-nodejs](https://github.com/googleapis/google-auth-library-nodejs)
  - [Generate music with Lyria](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music)

## 2026-03-29 - Pipeline podcast autonome Cowork
- Statut: retenu et branche dans le code
- Date de verification: 2026-03-29
- Choix:
  - narration podcast par defaut via `gemini-2.5-pro-tts`
  - bed musical par defaut via `lyria-002`
  - mix final local via `ffmpeg` deja disponible sur la machine, sans nouvelle dependance npm
- Pourquoi:
  - `gemini-2.5-pro-tts` est le meilleur choix premium pour une narration podcast "texte + voix" dans l'ecosysteme Google
  - `lyria-002` est deja stable dans le code et repond en test reel
  - `ffmpeg` evite d'ajouter une grosse dependance JS juste pour le mix et gere proprement loop, fade et resampling
- Alternatives evaluees:
  - `gemini-2.5-flash-tts`
    - Plus rapide, mais non retenu comme defaut podcast car moins premium que `pro-tts`
  - sortir deux stems separes sans mix
    - Ecarte: ne livre pas un vrai podcast pret a publier
  - mix PCM/WAV en pur JavaScript
    - Ecarte: plus fragile sur les differences de sample rate/canaux et moins fiable que `ffmpeg`
- Cout:
  - payant a l'usage pour Gemini TTS et Lyria via Vertex AI
  - `ffmpeg` local gratuit
- Sources officielles:
  - [Gemini-TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)
  - [Convert text to speech in Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/speech/text-to-speech)
  - [Generate music with Lyria](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music)

## 2026-03-29 - Podcast Cowork robuste sans dependance binaire dure
- Statut: retenu et branche dans le code
- Date de verification: 2026-03-29
- Choix:
  - garder `gemini-2.5-pro-tts` pour la narration premium
  - garder `lyria-002` comme bed podcast par defaut
  - supporter officiellement `lyria-3-clip-preview` et `lyria-3-pro-preview` comme options explicites, sans en faire le defaut
  - fiabiliser le mix via un fallback WAV pur TypeScript quand `ffmpeg`/`ffprobe` manquent
- Pourquoi:
  - la page Vertex AI locations liste toujours `gemini-2.5-pro-tts`, `gemini-2.5-flash-tts` et `gemini-2.5-flash-lite-preview-tts`
  - la doc Lyria confirme `lyria-002` sur `predict` et montre aussi `lyria-3-pro-preview` via `interactions`
  - `lyria-002` reste le choix le plus robuste pour un mix fallback maison car la sortie de travail est en WAV
- Alternatives evaluees:
  - `lyria-3-pro-preview` par defaut
    - Ecarte comme defaut: preview, sortie audio MP3 plus dependante d'un decodeur externe si `ffmpeg` n'est pas present
  - dependance npm de transcodage audio
    - Ecartee: dette technique et poids supplementaire alors qu'un fallback WAV interne suffit au chemin principal
  - stems separes voix/musique
    - Ecartes: ne satisfont pas le contrat produit "podcast pret a publier"
- Cout:
  - payant a l'usage pour Gemini TTS et Lyria via Vertex AI
  - pas de nouvelle dependance npm ajoutee
- Sources officielles:
  - [Deployments and endpoints](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations)
  - [Generate music with Lyria](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music)
  - [Gemini-TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)

## 2026-03-29 - Gemini thinking summaries via `thinkingConfig.includeThoughts`
- Statut: reverifie et applique
- Date de verification: 2026-03-29
- Technologie: Gemini API / Google GenAI SDK
- Choix: pour afficher le thinking resumee en streaming avec Gemini 3.x/3.1, utiliser `thinkingConfig.includeThoughts: true` et `thinkingConfig.thinkingLevel`, au lieu de compter sur des champs racine historiques.
- Alternatives evaluees:
  - garder uniquement `thinkingLevel` / `maxThoughtTokens` au niveau racine
    - Ecartee: insuffisant pour obtenir les events `thoughts` en chat standard.
  - reconstruire artificiellement un "thinking UI" cote frontend sans flux modele
    - Ecartee: contraire a l'objectif de transparence reelle.
- Cout: aucun cout de dependance supplementaire; cout modele normal Vertex AI.
- Sources officielles:
  - [Gemini API Thinking](https://ai.google.dev/gemini-api/docs/thinking)
  - [Thought signatures](https://ai.google.dev/gemini-api/docs/thought-signatures)
  - [Gemini 3.1 Pro Preview model page](https://ai.google.dev/gemini-api/docs/models/gemini#gemini-3.1-pro-preview)
  - [Gemini 3.1 Flash Lite Preview model page](https://ai.google.dev/gemini-api/docs/models/gemini#gemini-3.1-flash-lite-preview)
  - [Gemini 3 Flash Preview model page](https://ai.google.dev/gemini-api/docs/models/gemini#gemini-3-flash-preview)
