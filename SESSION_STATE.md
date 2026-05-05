# SESSION STATE

## 2026-05-05 - Nettoyage UI Hub/Raffineur, defaults Google et studios media aeres

### Ce qui a ete accompli
- Cowork:
  - suppression de la section `Options Cowork` et du toggle `Utiliser les agents du Hub`
  - `/api/cowork` n'est plus alimente par `hubAgents` depuis le frontend
- Raffineur IA:
  - suppression des controles Raffineur dans `SidebarRight`
  - suppression des props/flows de raffinement dans `ImageStudio`, `AudioStudio`, `LyriaStudio` et `VideoStudio`
  - nettoyage du store, des types et des metas d'historique media
- Defaults modele:
  - ajout de `src/utils/generation-defaults.ts`
  - defaults visibles: `temperature=1`, `topP=0.95`, `topK=40`
  - reset discret des parametres avances via icone
  - changement de modele media/chat remet les defaults recommandes
- Icone IA:
  - `SystemInstructionGallery` construit maintenant un prompt image depuis titre + instruction
  - fallback local si `/api/refine` renvoie une instruction vide
  - le bouton n'est bloque que si titre et prompt sont tous deux vides
- UI media:
  - Image, Voix et Lyria ont plus de largeur, de gap, de hauteur utile et moins de panneaux compresses

### Validation locale
- `npm run lint` -> OK
- `npm run build` -> OK
- serveur local Express verifie sur `http://127.0.0.1:3000/api/status`
- QA visuelle Edge headless via Vite source:
  - image studio
  - audio studio
  - Lyria studio
  - panneau Cowork sans Hub Agents

### Fichiers principaux modifies
- `src/utils/generation-defaults.ts`
- `src/store/useStore.ts`
- `src/components/SidebarRight.tsx`
- `src/components/ImageStudio.tsx`
- `src/components/AudioStudio.tsx`
- `src/components/LyriaStudio.tsx`
- `src/components/VideoStudio.tsx`
- `src/components/SystemInstructionGallery.tsx`
- `src/App.tsx`
- `api/index.ts`
- `src/types.ts`
- `src/utils/media-gallery-history.ts`
- `src/utils/instruction-gallery.ts`

### Points d'attention
- `src/components/ChatInput.tsx` et `src/components/MessageItem.tsx` etaient deja modifies dans le worktree; ils n'ont pas ete revertis.
- Les anciens chemins Hub/generated apps restent historiques dans le repo, mais la surface demandee par l'utilisateur n'est plus exposee dans l'UI principale.

## 2026-05-01 - Cowork repare pour les anciens reglages `thinkingLevel=minimal`

### Ce qui a ete accompli
- Reproduction directe sur Vercel:
  - `/api/cowork` echouait avec `thinking_level MINIMAL is not supported by this model`
  - le meme smoke avec `low`, `medium` ou `high` passait
- `server/lib/google-genai.ts`:
  - `buildThinkingConfig()` mappe maintenant `minimal` vers `low` pour les modeles Gemini 3.x
- `src/components/SidebarRight.tsx`:
  - si un ancien etat persistant garde `minimal` avec un modele `pro-preview`, la sidebar le corrige automatiquement en `low`
- `test-cowork-loop.ts`:
  - ajout d'une assertion de regression sur cette normalisation
- `BUGS_GRAVEYARD.md`:
  - ajout du diagnostic et de la resolution

### Validation locale
- `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts` -> OK
- `npm run lint` -> OK
- `npm run build` -> OK

### Validation production
- commit `1f44b07` pousse sur `main`
- deploy Vercel prod -> alias `https://vertex-ai-app-pearl.vercel.app`
- smoke reel Vercel `/api/cowork` avec `thinkingLevel=minimal` -> OK:
  - SSE `text_delta`: `OK, c'est note.`
  - SSE `done`
  - aucune erreur `thinking_level MINIMAL`

### Fichiers modifies
- `server/lib/google-genai.ts`
- `src/components/SidebarRight.tsx`
- `test-cowork-loop.ts`
- `BUGS_GRAVEYARD.md`
- `SESSION_STATE.md`

## 2026-04-17 - Image Studio refondu en flow unique `prompt + photos + plan auto`

### Ce qui a ete accompli
- `src/components/ImageStudio.tsx`:
  - suppression du flow a presets `workflowMode`
  - nouvelle surface unique centree sur:
    - une invite libre
    - l'ajout de photos source
    - un plan auto adapte au produit detecte
  - correction du scroll:
    - le studio est maintenant un seul conteneur scrollable (`overflow-y-auto`) au niveau page
    - ajout de `touch-pan-y` pour mieux expliciter l'intention tactile
  - upload image sans limite visible cote UI
  - affichage d'un plan auto compact:
    - resume
    - chips produit/style/vues
    - cartes de vues a generer
- `shared/listing-pack.ts`:
  - ajout de `buildAdaptiveListingPack(...)`
  - inference produit/style a partir du prompt + noms de fichiers
  - extension des packs auto a 5 vues quand utile
  - export de `getStyleLabel(...)` / `getProductLabel(...)`
- `server/lib/schemas.ts`:
  - suppression de la limite `max(3)` sur `referenceImages`
- `server/lib/media-generation.ts`:
  - suppression du `slice(0, 3)` sur les refs inline
- `src/App.tsx`:
  - suppression du `slice(0, 3)` lors de la construction des refs inline envoyees au backend
- `tmp/media-modes-preview.tsx`:
  - harness de preview image enrichi avec vraies refs factices
  - ajout d'un scroll de QA pilotable par query string

### Validation locale
- `npm run lint` -> OK
- `npm run build` -> OK
- preview local source via Vite:
  - `http://127.0.0.1:4173/tmp/media-modes-preview.html?mode=image&surface=studio`
  - captures locales:
    - `tmp/image-studio-preview-desktop.png`
    - `tmp/image-studio-preview-mobile.png`
    - `tmp/image-studio-preview-desktop-bottom.png`
    - `tmp/image-studio-preview-mobile-bottom.png`

### Ce qu'il reste a faire
- rejouer le mode `image` dans l'app authentifiee avec de vraies photos produit
- lancer une vraie generation pack avec plus de 3 refs
- verifier au moins un cas ambigu de produit pour juger la qualite de l'inference auto

### Fichiers modifies
- `src/components/ImageStudio.tsx`
- `shared/listing-pack.ts`
- `server/lib/schemas.ts`
- `server/lib/media-generation.ts`
- `src/App.tsx`
- `tmp/media-modes-preview.tsx`
- `NOW.md`
- `SESSION_STATE.md`
- `DECISIONS.md`
- `QA_RECIPES.md`

### Decisions prises pendant la session
- le mode image ne doit plus exposer de presets ou de categories visibles avant l'action utilisateur
- si des refs sont presentes, le studio bascule automatiquement en logique pack produit
- la limite de 3 refs image est retiree du frontend et du backend
- le scroll doit se faire sur toute la scene studio, pas sur un sous-panneau secondaire

### Pieges / points d'attention
- l'inference auto est volontairement heuristique et peut rester trop generique pour certains produits mal decrits
- le preview local valide la scene, pas la qualite creative du modele image sur un vrai prompt
- les screenshots de QA dans `tmp/` ne sont pas des assets produit, seulement des preuves locales

### Intention exacte du dernier changement
- coller au besoin utilisateur reel:
  - moins de blabla
  - zero preset a choisir
  - une invite, des photos, puis des plans utiles
- remettre le mode `image` au service d'un usage produit rapide et beau, avec une navigation fluide sur desktop comme sur mobile

## 2026-04-17 - Auto-memoire Qdrant rendue silencieuse pour les pannes transitoires

### Ce qui a ete accompli
- `server/lib/qdrant.ts`:
  - ajout de `isTransientQdrantError(...)`
  - ajout de `summarizeQdrantErrorForUser(...)`
  - les reponses HTML/non-JSON restent detectees, mais peuvent maintenant etre reformulees proprement pour l'UI
- `api/index.ts`:
  - ajout de `resolveAutoMemoryWarning(...)`
  - l'auto-retrieval memoire n'emet plus de warning inline au debut du run pour un incident transitoire (`503`, timeout, indisponibilite, quota)
  - les cas non transitoires gardent un message court et non technique
  - les logs serveur conservent le detail brut pour debug
- tests:
  - `test-cowork-loop.ts` couvre maintenant:
    - classification transitoire d'une reponse HTML `503`
    - resume utilisateur court pour Qdrant
    - politique auto-memoire: pas de warning inline sur incident transitoire, warning court sur misconfiguration
- documentation:
  - `QA_RECIPES.md` mis a jour pour le nouveau contrat UX
  - `COWORK.md`, `DECISIONS.md`, `NOW.md` mis a jour

### Validation locale
- `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts` -> OK
- `npm run lint` -> OK
- `npm run build` -> OK

### Ce qu'il reste a faire
- rejouer un smoke reel Cowork avec un Qdrant qui renvoie un HTML `503`
- verifier que la conversation reste propre au demarrage et que les logs serveur gardent bien la cause brute

### Fichiers modifies
- `api/index.ts`
- `server/lib/qdrant.ts`
- `test-cowork-loop.ts`
- `QA_RECIPES.md`
- `COWORK.md`
- `DECISIONS.md`
- `NOW.md`

### Decisions prises pendant la session
- un enrichissement automatique best-effort ne doit pas polluer la timeline utilisateur avec une erreur infra brute
- les details techniques Qdrant restent cote logs/tests; l'UI ne garde qu'un message court si le probleme n'est pas transitoire

### Intention exacte du dernier changement
- faire disparaitre le message qui "claque" au debut de conversation sans masquer les vrais signaux utiles pour le debug
- garder Cowork premium cote UX tout en preservant l'honnetete serveur

## 2026-04-16 - Cowork conscient v1 implemente localement, avec pause clarification et gate verification

### Ce qui a ete accompli
- Backend `api/index.ts`:
  - ajout du flag `COWORK_ENABLE_CONSCIOUS_LOOP`
  - ajout du tool `ask_user_clarification`
  - ajout de la phase `clarification`
  - un run Cowork peut maintenant finir en `paused`
  - reprise multi-tour: si le dernier message Cowork precedent etait en pause, le prompt du tour suivant injecte une note interne courte pour signaler que l'utilisateur repond a une clarification en attente
  - `publish_status` et `report_progress` sont exposes dans le mode conscient
  - `computeCompletionState()` bloque maintenant:
    - une cloture factualisee/current sans lecture validante
    - un artefact cree mais non verifie
    - une clarification encore en attente
  - verification d'artefact branchee avant toute publication:
    - PDF: header `%PDF` + pages detectees
    - image: coherence mime/signature
    - audio/podcast: mime/taille + duree quand disponible/inferable
  - `release_file` refuse maintenant un fichier non verifie quand le mode conscient est actif
- Frontend:
  - `src/types.ts`: `RunState` supporte `paused`
  - `src/utils/cowork.ts`: nouvel event `clarification_requested`, qui ajoute la question dans la conversation et laisse le run en pause
  - `src/App.tsx`: ne force plus `completed` a la fin du flux si le run est deja `paused`; placeholder adapte quand Cowork attend une precision
  - `src/components/ChatInput.tsx`: placeholder overridable
  - `src/components/MessageItem.tsx`: statut `paused` + details outils replieables, avec micro-messages inline gardes visibles
- Memoire / Qdrant:
  - `server/lib/qdrant.ts` parse maintenant defensivement les reponses HTML/non-JSON
  - un helper interne de test expose le parseur pour les unitaires
- Tests:
  - `test-cowork-loop.ts` couvre maintenant:
    - clarification non comptee comme livraison
    - blocage `missing_validating_reads`
    - blocage `awaiting_user_clarification`
    - blocage `artifact_not_verified`
    - message Qdrant HTML/non-JSON lisible
  - `verify-cowork-rag-e2e.ts` verifie qu'un event `memory_index_failed` n'expose plus le parse error brut `Unexpected token '<'`

### Validation locale
- `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts` -> OK
- `npm run lint` -> OK
- `npm run build` -> OK
- `node node_modules/tsx/dist/cli.mjs verify-cowork-rag-e2e.ts` -> skip honnete (`COWORK_TEST_RAG=1`, `QDRANT_URL`, `GOOGLE_APPLICATION_CREDENTIALS_JSON` manquants)

### Ce qu'il reste a faire
- activer `COWORK_ENABLE_CONSCIOUS_LOOP=1` sur un environnement de test complet
- jouer un smoke UI manuel:
  - clarification puis reprise
  - podcast/PDF verifie puis publie
  - memoire degradee propre
- etendre plus tard ce contrat conscient aux `Hub Agents` et `generated apps` si le retour utilisateur est bon

### Fichiers modifies
- `api/index.ts`
- `server/lib/config.ts`
- `server/lib/media-generation.ts`
- `server/lib/qdrant.ts`
- `src/App.tsx`
- `src/components/ChatInput.tsx`
- `src/components/MessageItem.tsx`
- `src/types.ts`
- `src/utils/cowork.ts`
- `test-cowork-loop.ts`
- `verify-cowork-rag-e2e.ts`
- `COWORK.md`
- `DECISIONS.md`
- `TECH_RADAR.md`
- `QA_RECIPES.md`
- `NOW.md`

### Decisions prises pendant la session
- la boucle consciente reste OFF par defaut tant que les smokes bout-en-bout ne sont pas confirmes
- aucune nouvelle dependance n'a ete ajoutee
- `report_progress` reste un outil de structure interne; la conversation n'expose pas le chain-of-thought brut

### Pieges / points d'attention
- la verification audio est plus forte sur WAV que sur certains formats compresses quand la duree n'est pas disponible
- la reprise clarification depend de la memoire d'historique Cowork envoyee cote frontend; ne pas enlever la part `[Memoire Cowork persistante]` pour les messages modeles Cowork

### Intention exacte du dernier changement
- transformer la pause, la clarification et la verification en etats runtime natifs plutot qu'en effets de bord
- rapprocher Cowork d'un comportement "conscient" type Codex / Claude Code tout en gardant le runtime simple, local et sans nouvelle dette dependance

## 2026-04-15 - Gemini 3.1 Flash TTS branche dans le mode voix et Cowork, avec smoke reel single + duo

### Ce qui a ete accompli
- Catalogue TTS partage:
  - `shared/gemini-tts.ts`
    - ajout du modele officiel `gemini-3.1-flash-tts-preview`
    - ajout d'un alias `gemini-3.1-flash-tts`
    - marquage multi-speaker pour `3.1 Flash TTS`
    - centralisation des labels/options TTS
- Mode voix:
  - `src/store/useStore.ts`
    - defaut `audio.model` -> `gemini-3.1-flash-tts-preview`
  - `src/components/AudioStudio.tsx`
  - `src/components/SidebarRight.tsx`
    - pickers modeles recables sur le catalogue partage
    - labels audio et message multi-speaker mis a jour
- Cowork / backend:
  - `server/lib/media-generation.ts`
    - `DEFAULT_TTS_MODEL` -> `gemini-3.1-flash-tts-preview`
    - messages d'erreur multi-speaker mis a jour
  - `server/lib/generated-apps.ts`
  - `server/lib/agents.ts`
  - `api/index.ts`
    - liste de modeles, prompts et descriptions outils TTS/podcast mis a jour
- Hygiene TypeScript:
  - `shared/image-models.ts`
    - correction du type du fallback pour `normalizeImageModelId(...)`
  - `tmp/media-modes-preview.tsx`
    - ajout du callback manquant `onSessionInstructionChange`

### Validation locale
- `npm run lint` -> OK
- `npm run build` -> OK

### Validation reelle
- smoke single-speaker via `generateGeminiTtsBinary(...)` charge avec `dotenv/config`:
  - `model: "gemini-3.1-flash-tts-preview"`
  - `mimeType: "audio/wav"`
  - `voice: "Kore"`
  - `languageCode: "fr-FR"`
  - `sampleRateHz: 24000`
- smoke duo via `generateGeminiTtsBinary(...)`:
  - `model: "gemini-3.1-flash-tts-preview"`
  - `speakerMode: "duo"`
  - `speakerNames: "Yassine | Nora"`
  - `speakerVoices: "Kore | Puck"`

### Ce qu'il reste a faire
- smoke manuel depuis l'interface `audio` pour verifier le rendu utilisateur final
- smoke Cowork en conditions reelles via les outils `generate_tts_audio` et `create_podcast_episode`
- redeployer si l'utilisateur veut pousser cette integration sur son environnement public

### Decisions prises pendant la session
- `Gemini 3.1 Flash TTS` devient le defaut pour la voix generique
- `Gemini 2.5 Pro TTS` reste le defaut podcast pour ne pas changer brutalement la signature du chemin long-form
- la source de verite TTS doit vivre dans `shared/` pour eviter les listes divergentes entre UI et backend

### Intention exacte
- integrer le nouveau modele TTS Google pour de vrai, pas seulement l'afficher
- garantir qu'il soit utilisable autant depuis le mode voix que depuis le runtime Cowork
- verrouiller la realite de l'API avec une verification doc officielle + un smoke Vertex reel

## 2026-04-15 - Prompt system immediat + contexte reset au bon moment, mode video recable sur Veo

### Ce qui a ete accompli
- Correction du bug `prompt system stale`:
  - `src/App.tsx`
    - ajout d'helpers pour resoudre l'instruction systeme active et le prompt selectionne
    - `handleSend()` utilise maintenant la config visible comme source d'autorite immediate pour les sessions `standard`
    - ajout d'un commit `systemPromptHistory` au moment du send
    - le premier envoi apres changement de prompt part sans reutiliser l'historique precedent
    - `touchSession()` remet aussi a jour l'etat local immediatement au lieu d'attendre seulement Firestore
- Correction du mode video:
  - `server/routes/standard.ts`
    - remplacement du `501` par une vraie route Veo
    - appel `client.models.generateVideos(...)`
    - polling `client.operations.getVideosOperation(...)`
    - retour frontend avec `url`, `storageUri`, `model`
  - `server/lib/storage.ts`
    - ajout de `resolveStorageObjectUrl(storageUri)` pour signer ou proxyfier un objet GCS deja genere
  - `server/lib/schemas.ts`
    - `VideoGenSchema` accepte maintenant `model`
  - `src/App.tsx`
    - le frontend envoie aussi le modele video courant
  - `src/components/VideoStudio.tsx` / `src/types.ts`
    - `4k` n'est expose que pour un modele `preview`

### Validation locale
- `npm run build` -> OK
- import module runtime:
  - `server/lib/storage.ts` -> OK
  - `server/lib/schemas.ts` -> OK
  - `server/routes/standard.ts` -> OK
- `npm run lint` -> toujours KO, mais pour 2 erreurs preexistantes hors scope:
  - `server/lib/generated-apps.ts`
  - `shared/image-models.ts`

### Ce qu'il reste a faire
- smoke utilisateur reel:
  - changer le prompt system d'une session standard
  - envoyer tout de suite un message
  - verifier que le premier tour n'utilise plus l'ancien contexte
  - refaire le meme test via le bouton `Renvoyer`
  - refaire aussi le test via `Modifier`
- smoke Veo reel:
  - lancer une video courte
  - confirmer que l'artefact revient avec une URL lisible
- si la cible principale reste Vercel/serverless:
  - reevaluer plus tard un flux async persiste si le polling Veo depasse les limites runtime

### Decisions prises pendant la session
- le changement de prompt system doit etre committe au moment du send, pas a chaque frappe
- le contexte visible en UI peut rester affiche, mais le contexte envoye au modele doit etre borne au prompt system courant
- pour la video, priorite a un vrai flux Veo minimal sans nouvelle dependance plutot qu'a un placeholder UX
- la logique de borne de contexte doit couvrir aussi les chemins `overrideMessages` (`Renvoyer`, `Modifier`), pas seulement l'envoi simple
- la session locale doit etre mise a jour immediatement quand la sidebar change le prompt system, sinon certaines actions repartent d'un shell stale

### Intention exacte
- supprimer la sensation produit la plus irritante: "je change le prompt system mais le premier message repart encore comme avant"
- transformer le mode `video` de facade UI en chemin backend reel, tout en restant compatible avec l'auth Vertex/GCS deja en place

## 2026-04-11 - `Cowork Apps` retire du shell principal, fallback `Cowork` restaure

### Ce qui a ete accompli
- Suppression frontend de la surface `Cowork Apps`:
  - retrait du bouton header dans `src/App.tsx`
  - retrait de l'overlay plein ecran et des retours vers le hub
  - retrait du CTA secondaire `Cowork Apps` dans `src/components/StudioEmptyState.tsx`
  - retrait de la section `Apps` dans `src/components/SidebarLeft.tsx`
- Nettoyage code:
  - suppression de `src/components/AgentsHub.tsx`
  - suppression de `src/components/CoworkCreationChat.tsx`
  - suppression du harness `tmp/cowork-apps-preview.tsx` et `tmp/cowork-apps-preview.html`
  - mise a jour de `tmp/media-modes-preview.tsx` pour le nouveau contrat `StudioEmptyState`
- Comportement de repli:
  - une session `generated_app` existante ne doit plus rouvrir une surface app dediee
  - `src/App.tsx` redirige maintenant ces sessions historiques vers `Cowork`

### Validation reelle
- `npm run lint` -> OK
- `npm run build` -> OK
- verification visuelle locale via Edge headless:
  - capture: `tmp/cowork-empty-after-removal.png`
  - attendu confirme:
    - plus de bouton `Cowork Apps`
    - plus de wording `Construis des apps expertes`
    - empty state `Cowork` recentre sur une mission simple

### Ce qu'il reste a faire
- verifier une session Firebase connectee si l'utilisateur veut confirmer le comportement avec son historique reel
- decider plus tard si le backend `generated-apps` doit aussi etre retire ou seulement laisse en legacy non expose

### Intention exacte
- retirer la surface produit visible `Cowork Apps` sans casser le shell principal ni forcer une purge backend plus large dans la meme passe

## 2026-04-11 - Production Vercel recablee vers `project-82b8c612-ea3d-49f5-864`, ancien projet `gen-lang-client-0405707007` elimine

### Ce qui a ete accompli
- Verification prod reelle:
  - `GET https://vertex-ai-app-pearl.vercel.app/api/status` montrait encore:
    - `googleAuthMode: "service-account-json"`
    - `serviceAccount: google-ai-studio@gen-lang-client-0405707007.iam.gserviceaccount.com`
    - donc la prod etait bien deployee avec le nouveau code, mais toujours branchee sur l'ancien projet GCP
- Cause racine precise:
  - les variables Vercel `VERTEX_PROJECT_ID`, `VERTEX_GCS_OUTPUT_URI` et `GOOGLE_APPLICATION_CREDENTIALS_JSON` pointaient encore vers `gen-lang-client-0405707007`
  - le push git ne pouvait pas corriger ca tout seul, car c'etait un probleme d'env/secrets runtime Vercel
- Contrainte infra decouverte:
  - tentative de creation d'une nouvelle cle de service account sur `project-82b8c612-ea3d-49f5-864`
  - resultat: KO
  - erreur: `constraints/iam.disableServiceAccountKeyCreation`
- Alternative validee reellement:
  - le JSON ADC local `application_default_credentials.json` (type `authorized_user`) fonctionne dans ce codebase pour:
    - Vertex texte
    - upload GCS
    - fallback proxy quand la signed URL n'est pas signable
- Bascule Vercel effectuee:
  - `GOOGLE_APPLICATION_CREDENTIALS_JSON` remplace par le JSON ADC `authorized_user` du compte `yassinebenks5@gmail.com`
  - `VERTEX_PROJECT_ID=project-82b8c612-ea3d-49f5-864`
  - `VERTEX_GCS_OUTPUT_URI=gs://project-82b8c612-ea3d-49f5-864-studio-output/output`
  - environnements touches:
    - `production`
    - `preview`
- Correction code annexe:
  - `server/lib/storage.ts`
    - distingue maintenant `authorized-user-json` de `service-account-json`
  - `server/lib/google-genai.ts`
    - trim `VERTEX_PROJECT_ID` et `VERTEX_LOCATION` pour eviter un faux bug si Vercel ajoute un saut de ligne via stdin
- Redeploiement:
  - `vercel deploy --prod --yes`
  - alias prod recable: `https://vertex-ai-app-pearl.vercel.app`

### Verifications reelles
- `/api/status` prod:
  - `googleAuthMode: "authorized-user-json"`
  - plus aucune trace de `gen-lang-client-0405707007`
- `/api/refine` prod:
  - OK avec payload valide (`type: "system"`)
- `/api/chat` prod:
  - SSE OK
  - reponse texte recue: `ok`
- `/api/upload` prod:
  - objet ecrit dans `gs://project-82b8c612-ea3d-49f5-864-studio-output/output/uploaded/vercel-gcs-smoke.txt`
- `/api/storage/object` prod:
  - contenu renvoye: `vercel-gcs-ok`
- local:
  - `npm run lint` -> OK
  - `npm run build` -> OK

### Nettoyage effectue
- fichiers temporaires Vercel/env supprimes
- service account intermediaire `vercel-vertex-runtime@project-82b8c612-ea3d-49f5-864.iam.gserviceaccount.com` supprime car finalement inutile

### Decision appliquee
- En prod Vercel, utiliser pour l'instant un JSON `authorized_user` ADC sur le bon projet plutot qu'un service account key:
  - parce que la policy GCP interdit la creation de nouvelles cles de service account
  - parce que ce mode a ete valide reellement sur Vertex + GCS dans ce codebase

### Ce qu'il reste a faire
- verification UX manuelle dans l'interface pour confirmer que l'erreur utilisateur de billing a bien disparu
- a plus long terme, si on veut une auth serveur plus stricte:
  - etudier une migration vers Workload Identity Federation pour Vercel

### Intention exacte
- corriger la vraie prod, pas seulement la machine locale
- supprimer la confusion "bon code mais mauvais projet runtime"
- laisser une trace claire du contournement retenu tant que la policy GCP bloque les cles de service account

## 2026-04-11 - Projet final corrige vers `project-82b8c612-ea3d-49f5-864`, bucket cree, fallback proxy pour GCS en mode ADC utilisateur

### Ce qui a ete accompli
- Correction utilisateur finale:
  - le vrai projet cible n'etait pas `famous-design-492918-s7`
  - le bon projet est `project-82b8c612-ea3d-49f5-864` (`My First Project`)
  - le bon compte GCP reste `yassinebenks5@gmail.com`
- Reconfiguration locale:
  - `.env`
    - `VERTEX_PROJECT_ID="project-82b8c612-ea3d-49f5-864"`
    - `VERTEX_GCS_OUTPUT_URI="gs://project-82b8c612-ea3d-49f5-864-studio-output/output"`
  - `gcloud config set project project-82b8c612-ea3d-49f5-864` -> OK
  - `gcloud auth application-default set-quota-project project-82b8c612-ea3d-49f5-864` -> OK
- Verification reelle GCP:
  - `gcloud projects describe project-82b8c612-ea3d-49f5-864` -> OK
  - vrai appel Vertex `gemini-3.1-flash-lite-preview` -> OK (`ok`)
  - buckets projet initialement vides
  - creation bucket:
    - `gs://project-82b8c612-ea3d-49f5-864-studio-output` -> OK
- Recablage bucket cote code:
  - `server/lib/storage.ts`
    - derive maintenant bucket + prefix depuis `VERTEX_GCS_OUTPUT_URI`
    - si `getSignedUrl()` echoue en mode ADC utilisateur (`Cannot sign data without client_email`), fallback sur une URL proxy applicative
  - `server/routes/standard.ts`
    - nouvelle route `GET /api/storage/object?uri=...`
    - telecharge l'objet GCS cote backend et le sert au client
  - `cloud-run/cowork-workers/src/lib/gcs.js`
    - retombe aussi sur le bucket derive de `VERTEX_GCS_OUTPUT_URI`
  - `cloud-run/cowork-workers/cloudbuild.yaml`
    - `_WORKSPACE_BUCKET=project-82b8c612-ea3d-49f5-864-studio-output`
- Smoke GCS reel:
  - upload temporaire via `uploadToGCSWithMetadata(...)`
  - objet ecrit avec succes:
    - `gs://project-82b8c612-ea3d-49f5-864-studio-output/output/uploaded/smoke-test-2.txt`
  - URL retournee:
    - `http://localhost:3000/api/storage/object?uri=gs%3A%2F%2F...`
  - smoke HTTP local:
    - `GET /api/status` -> OK
    - `GET /api/storage/object?uri=gs%3A%2F%2F...` -> `smoke-ok-2`
  - `npm run lint` -> OK
  - `npm run build` -> OK

### Cause racine precise du dernier blocage
- Le projet `project-82...` est sain cote Vertex et GCS, mais les ADC utilisateur ne peuvent pas signer une GCS signed URL standard:
  - erreur exacte: `Cannot sign data without client_email`
- Le vrai besoin n'etait donc pas une autre auth GCP, mais un mode de distribution de fichier compatible `gcloud auth only`.

### Decision appliquee
- Conserver `gcloud auth only` / ADC utilisateur.
- Eviter toute exigence de JSON service account.
- Remplacer le besoin de signed URL par un proxy backend quand la signature n'est pas possible.

### Ce qu'il reste a faire
- si on veut la preuve UX finale:
  - lancer le backend
  - ouvrir une URL proxy `/api/storage/object?uri=...`
  - rejouer une generation media complete dans l'app
- si on redeploie le worker Cloud Run:
  - pousser la nouvelle variable bucket `project-82b8c612-ea3d-49f5-864-studio-output`

### Intention exacte
- finir le switch de projet pour de vrai
- garder le cap utilisateur "gcloud auth only"
- eliminer le dernier faux blocage GCS sans revenir a une cle de service JSON

## 2026-04-11 - Compte GCP corrige vers `yassinebenks5@gmail.com`, bucket runtime derive de `VERTEX_GCS_OUTPUT_URI`

### Ce qui a ete accompli
- Clarification utilisateur:
  - `yassinebenks5@gmail.com` est le bon compte pour Google Cloud / Vertex / bucket / projet
  - `yayaben92y@gmail.com` ne sert qu'au volet Firebase et n'a pas a avoir acces au projet GCP
- Auth GCP corrigee:
  - `gcloud auth login yassinebenks5@gmail.com --update-adc`
  - resultat:
    - compte actif `gcloud`: `yassinebenks5@gmail.com`
    - ADC mises a jour
    - projet courant: `famous-design-492918-s7`
  - verification:
    - `gcloud auth list` -> `yassinebenks5@gmail.com` actif
    - `gcloud projects describe famous-design-492918-s7` -> OK
- Recablage bucket cote code:
  - `.env`
    - `VERTEX_GCS_OUTPUT_URI="gs://famous-design-492918-s7-studio-output/output"`
  - `server/lib/storage.ts`
    - suppression du bucket hardcode `videosss92`
    - les uploads backend derivent maintenant bucket + prefix depuis `VERTEX_GCS_OUTPUT_URI`
  - `cloud-run/cowork-workers/src/lib/gcs.js`
    - fallback bucket derive de `VERTEX_GCS_OUTPUT_URI` si `COWORK_WORKSPACE_BUCKET` est absent
  - `cloud-run/cowork-workers/cloudbuild.yaml`
    - env vars worker recablees vers `famous-design-492918-s7-studio-output`
- Verification code:
  - `npm run lint` -> OK
  - `npm run build` -> OK

### Blocage infra reel confirme
- Listing des buckets du projet:
  - `gcloud storage buckets list --project famous-design-492918-s7` -> vide
- tentative de creation bucket:
  - `gcloud storage buckets create gs://famous-design-492918-s7-studio-output --project famous-design-492918-s7 --location us-central1 --uniform-bucket-level-access`
  - resultat: KO
  - erreur: `The billing account for the owning project is disabled in state absent`
- smoke Vertex reel:
  - vrai `generateContent("Reply with exactly: ok")` sur `gemini-3.1-flash-lite-preview`
  - resultat: KO
  - erreur: `403 BILLING_DISABLED` sur `aiplatform.googleapis.com`

### Conclusion operative
- L'identite GCP locale est maintenant correcte.
- Le backend est maintenant aligne pour utiliser le bucket declare dans `VERTEX_GCS_OUTPUT_URI`.
- Le blocage restant n'est plus un probleme de compte ni de code:
  - il faut reactiver/attacher une facturation au projet `famous-design-492918-s7`
  - puis creer le bucket `famous-design-492918-s7-studio-output`

### Intention exacte
- separer proprement identite Firebase et identite GCP
- supprimer la confusion du bucket hardcode
- arriver a un etat honnete ou toute la stack est prete, avec un blocage restant purement infra et prouve par des erreurs reelles

## 2026-04-11 - Correction du vrai projet utilisateur + relance `gcloud auth application-default login`

### Ce qui a ete accompli
- Clarification utilisateur:
  - le vrai nouveau projet n'est pas `project-82b8c612-ea3d-49f5-864`
  - le vrai projet cible est `famous-design-492918-s7`
- Verification locale:
  - `.env` pointait encore sur l'ancien project id
  - le SDK `gcloud` etait bien installe localement dans:
    - `C:\Users\Yassine\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`
  - il n'etait simplement pas disponible sur le `PATH` de la session shell Codex
- Correctifs / actions appliques:
  - `.env`
    - `VERTEX_PROJECT_ID` change vers `famous-design-492918-s7`
  - `gcloud config set project famous-design-492918-s7`
    - OK
    - warning important:
      - le compte CLI actif `yayaben92y@gmail.com` n'a pas acces au projet (ou le projet n'existe pas pour ce compte)
  - `gcloud auth application-default login`
    - flow navigateur lance avec succes
    - ADC recreees localement
    - fichier cree/maj:
      - `C:\Users\Yassine\AppData\Roaming\gcloud\application_default_credentials.json`
    - quota project ADC:
      - `famous-design-492918-s7`

### Point technique important constate
- `server/lib/storage.ts` n'utilise pas `VERTEX_GCS_OUTPUT_URI` pour les uploads runtime.
- Le bucket reel utilise par `uploadToGCSWithMetadata(...)` est encore code en dur:
  - `const BUCKET_NAME = 'videosss92';`
- Conclusion:
  - le switch projet + ADC couvre bien l'auth Vertex/Google SDK
  - mais il ne suffit pas, a lui seul, a faire suivre les uploads/media vers un bucket du nouveau projet

### Ce qu'il reste a faire
- verifier un vrai appel Vertex texte avec `famous-design-492918-s7`
- verifier si le compte choisi pendant le login ADC a bien les droits reels sur ce projet
- si l'objectif est aussi de migrer les medias:
  - soit confirmer le bucket cible du nouveau projet
  - soit recabler `server/lib/storage.ts` pour ne plus hardcoder `videosss92`

### Intention exacte
- remettre le repo et la machine sur le vrai projet donne par l'utilisateur
- relancer proprement la connexion `gcloud auth only`
- eviter une fausse conclusion du type "le nouveau bucket est pris en compte" alors que le code upload reste encore branche ailleurs

## 2026-04-11 - Migration backend vers un mode unique `Vertex AI + gcloud auth (ADC)`

### Ce qui a ete accompli
- Relecture du socle auth Google:
  - `server/lib/google-genai.ts` utilisait deja Vertex AI classique (`vertexai: true`, `project`, `location`)
  - `GEMINI_API_KEY` et `VERTEX_EXPRESS` n'etaient en pratique pas utilises pour les appels backend Gemini
  - le vrai trou etait `server/lib/storage.ts`, qui n'initialisait `@google-cloud/storage` que si `GOOGLE_APPLICATION_CREDENTIALS_JSON` etait rempli
- Correctifs appliques:
  - `server/lib/storage.ts`
    - support ADC `gcloud auth application-default login` via `new Storage()` quand aucun JSON inline n'est fourni
    - fallback ADC aussi si `GOOGLE_APPLICATION_CREDENTIALS_JSON` est invalide
    - exposition du mode d'auth actif via `getGoogleAuthMode()`
  - `server/lib/google-genai.ts`
    - message d'erreur plus explicite quand `VERTEX_PROJECT_ID` / `VERTEX_LOCATION` manquent
    - warning unique si `VERTEX_EXPRESS` ou `GEMINI_API_KEY` trainent encore dans l'env, pour rappeler qu'ils sont ignores cote backend
  - `server/routes/standard.ts`
    - `/api/status` expose maintenant `googleAuthMode`
  - `vite.config.ts`
    - suppression de l'injection inutile de `GEMINI_API_KEY`, `API_KEY`, `VERTEX_PROJECT_ID`, `VERTEX_LOCATION` dans le bundle frontend
  - `.env.example`
    - reecrit pour documenter un seul flux:
      - `gcloud config set project ...`
      - `gcloud auth application-default login`
      - `GOOGLE_APPLICATION_CREDENTIALS_JSON` laisse vide en usage normal
  - memoire projet:
    - `AI_LEARNINGS.md`
    - `DECISIONS.md`
    - `QA_RECIPES.md`
    - `NOW.md`

### Cause racine precise
- Le backend n'avait pas un probleme "Gemini vs Vertex Express".
- Le probleme structurel etait l'asymetrie suivante:
  - `@google/genai` pouvait tourner via ADC sans JSON inline
  - `@google-cloud/storage` etait coupe tant que `GOOGLE_APPLICATION_CREDENTIALS_JSON` etait vide
- En pratique, un utilisateur pouvait croire que le setup `gcloud auth only` marchait parce que le chat repondait, puis casser plus loin sur les uploads/signatures GCS.

### Decisions prises et pourquoi
- Garder un seul mode backend:
  - `Vertex AI` + `gcloud auth` / ADC
  - JSON service account seulement comme override explicite
- Ne pas ajouter de chemin API key / Express:
  - contraire a la demande utilisateur
  - inutilement ambigu alors que le projet est deja Vertex-first
- Retirer les envs Google du bundle frontend:
  - elles n'etaient pas utilisees cote client
  - elles ajoutaient du bruit et une surface de fuite inutile

### Ce qu'il reste a faire
- Validation locale:
  - `npm run lint`
  - `npm run build`
  - `GET /api/status`
- Validation reelle utile si on veut la preuve finale:
  - lancer un endpoint media qui passe par GCS pour confirmer que `application-default` couvre bien Gemini + Storage avec le nouveau compte

### Validation reelle effectuee apres patch
- `.env` du projet mis a jour vers:
  - `VERTEX_PROJECT_ID="project-82b8c612-ea3d-49f5-864"`
  - `VERTEX_GCS_OUTPUT_URI="gs://project-82b8c612-ea3d-49f5-864.firebasestorage.app/output"`
  - `GEMINI_API_KEY=""`
  - `GOOGLE_APPLICATION_CREDENTIALS_JSON=""`
- `gcloud --version`: OK
- `gcloud config set project project-82b8c612-ea3d-49f5-864`: commande acceptee mais warning permission sur le compte actif
- test Vertex reel minimal:
  - `createGoogleAI('gemini-3.1-flash-lite-preview')`
  - `generateContent("Reply with exactly: ok")`
  - resultat: OK (`"ok"`)
- test GCS reel minimal:
  - upload temporaire via `uploadToGCSWithMetadata(...)`
  - resultat: KO
  - erreur exacte:
    - `403`
    - `The billing account for the owning project is disabled in state closed`

### Blocage actif confirme
- Le setup `gcloud auth only` est valide cote Vertex/Gemini.
- Le projet cible n'est pas totalement exploitable pour les medias/uploads tant que la facturation du projet proprietaire du bucket reste fermee.
- Ce blocage est infra/projet, pas machine locale:
  - les autres PC auront le meme echec sur GCS tant que billing n'est pas reactive ou que `VERTEX_GCS_OUTPUT_URI` ne pointe pas vers un bucket sain.

### Pieges / points d'attention
- `googleAuthMode: "application-default"` dans `/api/status` ne remplace pas un vrai test permissionnel bucket/modeles
- si le nouveau compte Google n'a pas les IAM roles attendus sur le projet ou le bucket, l'auth ADC sera bien detectee mais les appels peuvent encore etre refuses
- un vieux `.env` peut encore contenir `GEMINI_API_KEY` / `VERTEX_EXPRESS`; le backend les ignore maintenant, mais il vaut mieux les supprimer pour eviter la confusion

### Intention exacte
- faire correspondre le code a la consigne utilisateur "plus express, uniquement gcloud auth"
- eviter le faux positif "le chat marche donc toute la stack Google marche"
- laisser la prochaine session reprendre directement sur la validation locale/reelle du nouveau compte

## 2026-04-09 - Fix prod auth Google + disparition des sessions apres ecriture

### Ce qui a ete accompli
- Diagnostic utilisateur reel:
  - sur le fixe, le login Google echouait avec popup bloquee / timeout `auth/network-request-failed` puis `auth/popup-closed-by-user`
  - sur le portable, un message pouvait apparaitre dans l'historique puis disparaitre apres sync/refresh
- Cause racine precise du bug "session disparait":
  - `ChatSession` contenait `id`
  - `src/App.tsx` envoyait cet objet quasi brut vers `users/{uid}/sessions/{sessionId}`
  - `firestore.rules` refusait `id`
  - les sous-documents `messages/*` pouvaient quand meme exister, donc le parent `sessions/{id}` restait absent
- Correctifs appliques:
  - `src/App.tsx`
    - ajout de `toSessionFirestorePayload()`
    - toutes les ecritures de session retirent maintenant `id` et `messages`
    - migration du login Google de `signInWithPopup` vers `signInWithRedirect`
    - `getRedirectResult(auth)` ajoute au boot
    - timeout auth porte a `10000 ms`
    - le bootstrap Firestore attend aussi `isStorageResetReady`
  - `src/firebase.ts`
    - export de `signInWithRedirect` et `getRedirectResult`
  - `firestore.rules`
    - ajout defensif du champ optionnel `id` dans `isValidSession()` pour tolerer les clients deja deploies
- Deploiements reels:
  - `npm run deploy-rules` : OK
  - `npx vercel deploy --prod --yes` : OK
  - alias prod actif:
    - `https://vertex-ai-app-pearl.vercel.app`
- Smokes:
  - `npm run lint` : OK
  - `npm run build` : OK
  - `GET /api/status` prod : OK
  - `GET /storage-reset.json` prod : OK

### Ce qui reste a faire
- Retest utilisateur reel sur le domaine prod:
  - fixe:
    - hard refresh
    - verifier que le login Google passe par redirection pleine page
    - verifier qu'il n'y a plus de popup Google qui boucle
  - portable:
    - creer un fil
    - envoyer un message
    - verifier qu'il reste present apres `F5`

### Decisions prises et pourquoi
- Corriger des deux cotes:
  - frontend pour ne plus ecrire `id` dans les documents de session
  - rules pour tolerer provisoirement `id` tant que tous les clients n'ont pas recharge le nouveau bundle
- Passer a `signInWithRedirect`:
  - evite la dependance Firebase Auth a `window.closed`
  - contourne les problemes COOP observes sur Comet/Chromium

### Pieges / points d'attention
- Un onglet stale peut encore executer l'ancien flux popup tant qu'il n'a pas ete hard refresh
- Les rules prod acceptent maintenant `id`, mais le contrat cible reste un document de session sans ce champ duplique
- Si le fixe echoue encore en auth, verifier d'abord que le bundle charge est bien le nouveau et que le flux lance une redirection, pas une popup

### Intention exacte
- Stabiliser la persistance Firestore reelle des sessions
- Fermer le faux diagnostic "c'est juste les rules" avec une cause racine code + rules precise
- Redonner un login Google robuste sur Comet sans popup fragile

## 2026-04-09 - Reset global total: purge Firestore + bucket + reset navigateur versionne

### Ce qui a ete accompli
- Demande utilisateur explicite:
  - supprimer tous les historiques de toutes les sessions
  - vider tous les stockages
  - repartir de zero
- Correctif produit complete:
  - `src/utils/storageReset.ts`
    - le reset ne vide plus seulement quelques cles `localStorage`
    - il vide maintenant aussi:
      - `localStorage`
      - `sessionStorage`
      - IndexedDB de l'origine
      - Cache Storage
      - cookies accessibles en JS
    - ajout d'un marker de reset `v2` pour eviter qu'un ancien build confirme a tort un reset plus fort qu'il ne sait pas executer
  - `src/App.tsx`
    - le bootstrap attend maintenant la fin du reset navigateur asynchrone complet
    - si un vrai stockage a ete nettoye, la page se recharge
  - `public/storage-reset.json`
    - version prod courante:
      - `2026-04-09T10:25:00Z-hard-reset-browser-storage-v3`
  - `QA_RECIPES.md`
    - ajout d'une recette `Hard reset global - historique et stockages`
- Purge distante executee:
  - Firestore via REST + suppression par `collectionGroup` pour traiter les sous-collections orphelines:
    - `messages`: `2387`
    - `sessions`: `292`
    - `agents`: `2`
    - `custom_prompts`: `10`
    - `generatedApps`: `0`
    - `files`: `0`
    - `users`: `0`
  - verification finale Firestore:
    - `users`, `sessions`, `messages`, `agents`, `generatedApps`, `custom_prompts`, `files` -> `EMPTY`
  - bucket GCS `videosss92` vide:
    - `588` objets supprimes
    - `0` restants
  - verification Qdrant:
    - `/collections` vide
    - `cowork_memory` absente
- Prod redeployee et smoke OK:
  - `npx vercel deploy --prod --yes`
  - alias:
    - `https://vertex-ai-app-pearl.vercel.app`
  - `GET /api/status` -> OK
  - `GET /storage-reset.json` -> OK

### Ce qui reste a faire
- Retest utilisateur reel:
  - ouvrir la prod sur fixe et portable
  - hard refresh si un onglet ancien est deja ouvert
  - laisser le reset s'appliquer
  - se reconnecter si la session auth a ete purgee
  - verifier que la sidebar repart vide sur les deux appareils

### Decisions prises et pourquoi
- Ne pas se contenter d'effacer `users` a la racine Firestore:
  - des sous-collections orphelines peuvent survivre
  - il faut supprimer explicitement les `collectionGroup` critiques
- Versionner la capacite de reset navigateur:
  - un ancien build peut voir un nouveau marker et l'acquitter sans vider IndexedDB/caches
  - le marker `v2` force donc le vrai reset complet

### Pieges / points d'attention
- Si un onglet n'a jamais recharge la nouvelle build, il peut encore afficher un etat stale jusqu'au refresh
- Le reset complet peut deconnecter l'utilisateur, ce qui est attendu
- Si un historique reapparait encore, il faudra identifier si une nouvelle ecriture cloud a ete recreee apres le wipe

### Intention exacte
- Fermer proprement le sujet "historique local / divergence entre appareils" par une remise a zero reelle et prouvee
- Laisser la prochaine session reprendre directement sur la verification utilisateur finale, pas sur une nouvelle phase de purge

## 2026-04-09 - Ajustement critique: un snapshot Firestore autoritaire doit evincer les vieux shells locaux non pending

### Ce qui a ete accompli
- Diagnostic complementaire:
  - le replay local -> Firestore ne suffisait pas a lui seul
  - `mergeSessionsWithLocal(...)` continuait a re-injecter tous les shells locaux absents du cloud, meme ceux deja marques `pendingRemote: false`
  - consequence produit directe:
    - une machine pouvait garder des sessions fantomes uniquement dans son cache local
    - une autre machine affichait seulement le vrai contenu Firestore
    - les compteurs divergeaient durablement
- Correctif applique:
  - `src/utils/sessionShells.ts`
    - `mergeSessionsWithLocal(...)` accepte maintenant `remoteIsAuthoritative`
    - quand ce flag est actif, seuls les shells encore `pendingRemote` survivent en local si absents du cloud
    - les shells locaux synchronises mais absents du snapshot serveur sont purges du store local
  - `src/App.tsx`
    - le listener `users/{uid}/sessions` passe `remoteIsAuthoritative: !snapshot.metadata.fromCache`
    - un snapshot serveur force donc la convergence entre appareils

### Validation locale
- `npm run lint` : OK
- `npm run build` : OK

### Validation prod
- `npx vercel deploy --prod --yes` : OK
- alias prod actif:
  - `https://vertex-ai-app-pearl.vercel.app`
- smoke:
  - `GET /api/status` : OK
  - `GET /` : `200`

### Ce qui reste a faire
- rejouer le cas utilisateur reel:
  - machine A avec vieux cache local
  - machine B avec autre cache local
  - verifier qu'apres snapshot Firestore serveur les deux convergent sur le meme nombre

### Intention exacte
- faire de Firestore la verite finale des listes de sessions une fois le serveur joint
- empecher un merge local trop permissif de recreer des divergences permanentes entre appareils

## 2026-04-09 - Replay automatique du cache local vers Firestore pour reparer la synchro multi-appareils des conversations

### Ce qui a ete accompli
- Diagnostic:
  - les conversations ne sont pas censees etre "local only" quand l'utilisateur est connecte
  - le vrai trou restant etait le suivant:
    - les `session shells` pouvaient rester `pendingRemote` en local apres un echec Firestore/reseau
    - les snapshots locaux de messages pouvaient rester sur l'appareil sans mecanisme de replay automatique
    - resultat produit: impression d'historique "sauvegarde seulement sur cette machine"
- Correctif applique:
  - `src/utils/sessionShells.ts`
    - ajout de `loadPendingLocalSessionShells(userId)`
  - `src/utils/sessionSnapshots.ts`
    - ajout de `loadLocalSessionSnapshotEntries(userId)` pour exposer les messages locaux en attente
  - `src/utils/cowork.ts`
    - ajout de `loadCoworkSessionSnapshotEntries(userId)` pour exposer les snapshots Cowork en attente locale
  - `src/App.tsx`
    - ajout d'un replay automatique des ecritures locales vers Firestore
    - declenchement sur retour reseau (`online`) et retour de focus (`visibilitychange`)
    - recreation d'une session shell via `buildRecoveredSessionShell(...)` si des messages locaux existent sans parent session connu
    - replay sequentiel des shells, messages standard et snapshots Cowork
  - `QA_RECIPES.md`
    - nouvelle recette de regression multi-appareils

### Validation locale
- `npm run lint` : OK
- `npm run build` : OK

### Ce qui reste a faire
- verifier le scenario reel sur deux appareils ou deux navigateurs avec le meme compte:
  - appareil A cree un fil hors ligne / en echec Firestore
  - retour reseau ou retour de focus
  - appareil B voit le fil reapparaitre depuis Firestore
- si la prod ne porte pas encore ce patch:
  - redeployer frontend + rules si necessaire

### Decisions prises et pourquoi
- conserver Firestore comme source de verite de l'historique multi-appareils
- traiter le cache local comme une file de secours rejouable, pas comme une destination finale
- recreer une session shell avant replay des messages pour eviter un historique distant introuvable

### Pieges / points d'attention
- les snapshots Cowork locaux peuvent etre rejoues plusieurs fois tant qu'ils restent utiles a l'hydratation riche locale; verifier que cela ne cree pas de bruit excessif
- le replay n'est pas une migration backend: il depend toujours qu'un appareil ayant le cache local revienne en ligne

### Intention exacte
- enlever l'impression produit "l'historique est local a cette machine"
- faire converger automatiquement le cache local vers Firestore des que l'app retrouve des conditions normales
- laisser une recette QA explicite pour ne plus regresser sur la synchro multi-appareils

## 2026-04-08 - Fluidite globale, studios media premium et fix critique Cowork multi-tour fermes localement

### Ce qui a ete accompli
- Correctif critique Cowork multi-tour:
  - un follow-up court ne doit plus etre ecrase par le dossier precedent
  - `src/utils/chat-parts.ts` compacte maintenant l'historique Cowork
  - `api/index.ts` ajoute un wrapper de tour courant pour rappeler que la derniere demande utilisateur est prioritaire
- Socle media/instructions:
  - `src/types.ts` et `src/App.tsx` preservent `generationMeta` sur les medias generes
  - ces metas gardent le prompt source, le prompt raffine, le modele, le profil de raffineur et les consignes perso
  - `src/utils/instruction-gallery.ts` agrege maintenant une vraie galerie d'instructions/prompts a partir de l'historique
- Studios media:
  - `src/components/ImageStudio.tsx`
    - hero image + galerie secondaire
    - copie fiable des prompts source / optimises
    - meta visibles sur le profil de raffineur
  - `src/components/StudioAudioPlayer.tsx`
    - vrai player custom pour audio/Lyria
    - prompt source visible et copiable
  - `src/components/AudioStudio.tsx`, `src/components/LyriaStudio.tsx`, `src/components/VideoStudio.tsx`
    - historique/media relies aux vraies metas de generation
- Raffineurs IA:
  - `shared/prompt-refiners.ts` introduit des profils par mode
  - `src/store/useStore.ts` persiste maintenant la config raffineur par mode
  - `src/components/SidebarRight.tsx` expose profils et consignes perso selon le mode
- Perf / fluidite:
  - `src/App.tsx`
    - updates streaming plus calmes
    - `startTransition(...)` sur des ecritures plus lourdes
  - `src/index.css`
    - encore moins de transitions globales inutiles
  - `vite.config.ts`
    - chunking plus propre; le chunk principal reste autour de 208 kB

### Validation locale
- `npm run lint` : OK
- `npm run build` : OK
- `node node_modules/tsx/dist/cli.mjs verify-chat-parts.ts` : OK
- `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts` : OK
- QA visuelle reelle:
  - harness Vite source `tmp/media-modes-preview.html`
  - captures desktop/mobile regenerees puis nettoyees du repo avant commit
  - verification manuelle des surfaces:
    - image studio
    - audio studio
    - Lyria studio
    - panneau Cowork

### Bugs importants rencontres et corriges
- Bug produit critique:
  - Cowork repondait a la premiere question au lieu du follow-up
  - resolution: historique compact + prompt de priorite du tour courant
- Bug QA/harness:
  - preview media blanche
  - cause: Vite servait encore un module stale sur `src/utils/media-history.ts`
  - resolution:
    - overlay d'erreur runtime
    - `PreviewErrorBoundary`
    - nouveau module `src/utils/media-gallery-history.ts`

### Ce qui reste a faire
- rejouer ces flows dans le produit reel apres push:
  - Cowork long + follow-up court
  - image avec copie de prompt
  - audio/Lyria avec player custom
- redeployer l'app si on veut projeter ce lot sur le domaine public
- reprendre ensuite le prochain chantier prioritaire

### Decisions prises et pourquoi
- le dernier message utilisateur doit avoir la priorite absolue sur un run Cowork multi-tour
- les metas de generation media sont un contrat produit de premiere classe, pas juste du debug
- le raffineur doit etre configure par mode, pas globalement

### Pieges / points d'attention
- ne pas reintroduire un historique Cowork massif
- ne pas perdre `generationMeta` a la sanitization ou dans les galleries
- si un harness Vite devient blanc, afficher d'abord l'erreur runtime dans la page avant de toucher au CSS

### Intention exacte
- fermer proprement le gros lot demande par l'utilisateur:
  - fluidite
  - no-freeze
  - UX image/audio plus premium
  - Cowork plus intelligent en multi-tour
- laisser la suite sur une base stable, observable et rejouable

## 2026-04-07 - Cowork v2 Phase 2: sandbox Python/Shell completee localement, worker Cloud Run deploye et valide reellement

### Ce qui a ete accompli
- Phase 2 codee de bout en bout dans le repo:
  - nouveaux outils backend `run_python`, `run_shell`, `install_python_package`
  - nouveau client `server/lib/cowork-sandbox.ts`
  - worker Cloud Run avec vraies routes:
    - `GET /health`
    - `POST /sandbox/python`
    - `POST /sandbox/shell`
    - `DELETE /sandbox/:sessionId`
- Worker sandbox:
  - Python 3.12 + `uv`
  - SSE `progress/stdout/stderr/done/error`
  - timeouts
  - upload/download GCS des fichiers de travail
  - detection et publication des fichiers generes
  - allowlist shell
  - packages dynamiques avec blacklist
- Fix architectural majeur:
  - ajout d'une persistence de session sandbox sur GCS
  - manifest packages + workspace de session restaures/persistes entre requetes
  - correction necessaire car Cloud Run ne garantit pas la survie du filesystem local entre requetes/instances

### Infra reelle
- creation d'un repo Artifact Registry:
  - `europe-west1-docker.pkg.dev/gen-lang-client-0405707007/cowork-workers`
- pipeline `cloudbuild.yaml` corrige:
  - build
  - push explicite Docker
  - deploy Cloud Run
- service Cloud Run redeploye avec succes apres plusieurs iterations
- revision validee en fin de session:
  - `cowork-workers-00006-5sw`
- variables worker deployees cote Cloud Run:
  - `COWORK_SANDBOX_PERSIST_SESSIONS=1`
  - `COWORK_SANDBOX_PERSIST_BUCKET=videosss92`
  - `COWORK_WORKSPACE_BUCKET=videosss92`

### Validation locale
- `npm run lint` : OK
- `npm run build` : OK
- `node node_modules/tsx/dist/cli.mjs test-cowork-workers.ts` : OK
- `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts` : OK
- `node node_modules/tsx/dist/cli.mjs test-cowork-sandbox.ts` : OK

### Validation reelle
- `GET /health` : OK
- `POST /sandbox/python` avec `print('phase2-ok')` : OK
- `POST /sandbox/shell` avec `echo phase2-shell-ok` : OK
- install dynamique `colorama` puis nouvel appel Python meme `sessionId` :
  - restore session : OK
  - `import colorama` : OK
- ecriture d'un fichier via shell Python puis lecture sur une 2e requete meme `sessionId` :
  - persistence workspace : OK
- `DELETE /sandbox/:sessionId` : OK

### Bugs importants rencontres et corriges
- pipeline Cloud Build initialement faux:
  - tentative de deploy avant push image
  - puis quota/problemes `gcr.io`
  - resolution: migration Artifact Registry + `docker push` explicite
- hypothese fausse initiale sur les sessions sandbox:
  - un package installe dans une requete n'etait pas retrouve a la suivante
  - cause: Cloud Run stateless / multi-instance, `/tmp` non partage
  - resolution: persistence GCS du manifest et du workspace de session
- `run_shell` avec `python` pouvait casser en `ENOENT`
  - resolution: preparation/restauration du venv pour les commandes Python shell quand une session persistante existe

### Ce qui reste a faire
- optionnel mais logique pour fermer totalement la phase cote produit:
  - commit/push le repo
  - deployer le backend qui expose ces outils
  - rejouer un vrai run `/api/cowork` avec `COWORK_ENABLE_SANDBOX=1`
- sinon, le prochain chantier fonctionnel est la Phase 3 V1

### Decisions prises et pourquoi
- Cloud Run reste le runtime sandbox retenu:
  - 100% Google
  - reellement valide
  - tient les usages Phase 2
- les sessions sandbox doivent persister hors instance:
  - GCS choisi car deja dans la stack, simple et Google-native
- Artifact Registry remplace Container Registry classique pour les images worker:
  - plus coherent avec l'etat actuel GCP
  - meilleur fit regional et Cloud Run

### Pieges / points d'attention
- `/tmp` Cloud Run est utilisable pour une requete, pas comme stockage de session fiable
- une install package "OK" sur un appel ne prouve rien tant qu'on ne refait pas un 2e appel avec le meme `sessionId`
- `run_shell` doit rester borne a une allowlist stricte
- ne jamais exposer de token worker dans les logs ou la memoire projet

### Intention exacte
- faire une vraie Phase 2 executable en conditions reelles
- ne pas livrer une "sandbox" qui n'est qu'une demo mono-requete
- laisser la suite du projet sur une base Cloud Run robuste, rejouable et honnete

## 2026-04-07 - Fix critique chat/PDF: SSE immediat, heartbeat keepalive, fallback PDF text-first, recanonisation de session

### Ce qui a ete accompli
- Diagnostic du blocage utilisateur reel en mode `chat`:
  - les logs F12 montraient `POST /api/chat -> start`, puis aucun event utile pendant ~300 s, puis `504 Gateway Timeout`
  - `attachmentCount: 1` montrait qu'une piece jointe PDF partait bien, mais la console n'avait aucune visibilite sur les etapes backend
  - le probleme n'etait donc pas un crash immediate ni un rejet de schema `/api/chat`
- Correctifs backend `chat`:
  - `server/routes/standard.ts`
    - ajout d'un `traceId` par requete `chat`
    - envoi immediat des headers SSE via `flushHeaders()`
    - emission instantanee d'un premier event debug `request_accepted`
    - heartbeat `: keep-alive` toutes les 15 s
    - nouveaux events debug `contents_built`, `model_stream_start`, `first_chunk_received`, `stream_completed`, `error`
    - header `X-Studio-Trace-Id` pour relier F12 et les logs backend
  - `server/lib/chat-parts.ts`
    - nouveau fallback PDF text-first:
      - si le PDF est recuperable en buffer, extraction texte via `extractTextFromPdfBuffer()`
      - si un vrai texte est extrait, le modele recoit un contexte texte clippe au lieu de dependendre uniquement du PDF natif
      - si l'extraction echoue ou est trop pauvre, fallback honnete sur la reference PDF native existante
- Correctifs frontend / logs:
  - `src/App.tsx`
    - `touchSession()` n'utilise plus un simple `updateDoc({ updatedAt })`
    - le shell de session est reecrit de facon canonique via `setDoc(cleanForFirestore(...))` pour nettoyer les champs legacy qui pouvaient faire echouer la revalidation Firestore
    - le parseur SSE `/api/chat` journalise maintenant explicitement les `data.debug` en `StudioDebug[chat:debug]`
  - `src/utils/client-debug.ts`
    - les fetchs logguent maintenant `traceId` si le backend le renvoie
- Correctifs Cowork:
  - `api/index.ts`
    - ajout d'un `ensureSseReady()` pour `/api/cowork`
    - headers SSE flushes plus tot
    - `traceId` sur tous les events
    - heartbeat keepalive identique au mode `chat`
    - premier event `status` emis des l'initialisation

### Validation locale
- `npm run lint` : OK
- `npm run build` : OK
- `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts` : OK
- smoke local `/api/chat` texte:
  - `STATUS 200`
  - `X-Studio-Trace-Id` present
  - premier chunk immediat:
    - `data: {"debug":{"stage":"request_accepted",...}}`
- smoke local `/api/chat` PDF (`tmp/qa-attachment.pdf`):
  - `STATUS 200`
  - `X-Studio-Trace-Id` present
  - chunk 1 immediat:
    - `request_accepted`
  - chunk 2:
    - `contents_built`
    - `model_stream_start`

### Validation reelle
- `git push origin main` : OK (`021dfdd`)
- `npx vercel deploy --prod --yes` : OK
- alias prod reapplique:
  - `https://vertex-ai-app-pearl.vercel.app`
- `GET /api/status` prod : `200`
- `POST /api/cowork` prod minimal :
  - `200`
  - `traceId` present
  - premier chunk `: connected`
  - premier event metier `Initialisation`
- `POST /api/chat` prod avec PDF joint :
  - `200`
  - `traceId` present
  - `request_accepted`
  - `contents_built`
  - `model_stream_start`
  - `first_chunk_received`
  - plus de silence de 300 s avant la premiere sortie

### Ce qui reste a faire
- refaire le scenario utilisateur reel sur prod dans une session authentifiee navigateur:
  - mode `chat`
  - PDF joint
  - verifier que `session-touch-failed` a disparu
- si ce warning persiste encore, inspecter le document Firestore legacy exact qui resiste
- reprendre ensuite la Phase 2 (`/sandbox/python`, `/sandbox/shell`)

### Decisions prises et pourquoi
- un endpoint SSE doit ouvrir la reponse HTTP avant toute etape potentiellement longue:
  - sinon un modele lent au premier token ressemble a un freeze reseau ou a une panne API
- pour le chat document-centric, un PDF textuel doit d'abord essayer le chemin texte:
  - plus rapide
  - plus debuggable
  - moins dependant d'un parse natif modele opaque
- pour reabiliter des documents `sessions/{id}` legacy, toucher un timestamp ne suffit pas:
  - il faut reecrire un shell canonique qui remplace les anciens champs hors schema

### Pieges / points d'attention
- un `STATUS 200` immediat ne prouve pas encore que la reponse finale modele sera toujours rapide; il prouve seulement que la requete ne reste plus muette jusqu'au timeout gateway
- le fallback PDF text-first aide surtout les PDFs textuels; un PDF scanne peut encore retomber sur le chemin natif
- le fix `touchSession()` ne traite que les shells qu'on reecrit; des collections legacy non ouvertes peuvent encore contenir des champs anciens

### Intention exacte
- supprimer le faux ressenti "l'IA ne fait rien" en rendant toutes les etapes visibles des les premieres centaines de millisecondes
- faire en sorte qu'un PDF ne transforme plus le mode `chat` en boite noire de 5 minutes
- remettre les sessions sur un schema propre sans demander a l'utilisateur de tout recreer a la main

## 2026-04-07 - Hotfix utilisateur Cowork: prompt hijack neutralise, rules Firestore redeployees, logs F12 enrichis

### Ce qui a ete accompli
- Diagnostic du bug utilisateur reel:
  - les erreurs console montraient des refus Firestore sur les sessions/messages
  - l'UI de droite montrait une instruction liee `GEO-PALANTIR`
  - `src/App.tsx` envoyait encore `config.systemInstruction` a `/api/cowork`
  - `api/index.ts` la concatenait dans `buildCoworkSystemInstruction(...)`
- Correctifs code:
  - `src/utils/client-debug.ts`
    - nouveau logger client structure `[StudioDebug][...]`
    - instrumentation globale des fetchs `/api/*` et `firestore.googleapis.com`
    - helper de log des events SSE Cowork
  - `src/App.tsx`
    - instrumentation de `/api/status`, `/api/chat`, `/api/cowork`
    - logs des synchros Firestore, des persistances de sessions/messages, des events SSE Cowork/chat
    - suppression de la transmission de `systemInstruction` custom pour Cowork pur
  - `api/index.ts`
    - ignorance explicite de `config.systemInstruction` pour un run Cowork pur
    - warning serveur si un ancien client essaye encore de la pousser
  - `src/firebase.ts`
    - suppression des `alert(...)` Firestore
    - logs structures + trace console a la place
  - `src/components/SidebarRight.tsx`
    - note UI expliquant que l'instruction visible n'ecrase plus Cowork pur
  - `firestore.rules`
    - support de `selectedCustomPrompt`
    - support des champs `runMeta` v2: `workerCallsCount`, `workerMsTotal`, `embeddingCount`, `embeddingTokens`, `vectorSearches`, `pythonExecutions`, `gitOps`, `browserOps`

### Validation locale
- `npm run lint` : OK
- `npm run build` : OK
- `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts` : OK

### Validation reelle
- `npm run deploy-rules` : OK sur `gen-lang-client-0229561140`
- `vercel deploy --prod --yes` : OK
- alias prod reapplique sur `https://vertex-ai-app-pearl.vercel.app`
- `GET /api/status` prod : 200
- `POST /api/cowork` prod minimal : 200 + SSE normal
- `POST /api/cowork` prod avec `config.systemInstruction = "reponds uniquement GEO-PALANTIR"` : Cowork repond quand meme `Bonjour.`

### Ce qui reste a faire
- faire rejouer a l'utilisateur un vrai run Cowork authentifie avec piece jointe PDF
- verifier dans F12:
  - presence des logs `[StudioDebug]`
  - disparition du warning `Cowork Firestore rules are outdated`
  - disparition des `Missing or insufficient permissions` lies au schema courant
- reprendre ensuite la Phase 2 (`/sandbox/python`, `/sandbox/shell`)

### Decisions prises et pourquoi
- Cowork pur ne doit plus accepter d'override systeme venu du client:
  - sinon une instruction galerie ou une session sale peut prendre la main sur tout le runtime autonome
- les erreurs Firestore cote produit doivent vivre en console, pas en `alert(...)`:
  - l'utilisateur a explicitement demande une console F12 beaucoup plus bavarde

### Pieges / points d'attention
- un retest backend `POST /api/cowork` ne prouve pas a lui seul qu'une session authentifiee Firestore est propre; le vrai retest utilisateur reste indispensable
- la nouvelle instrumentation peut etre tres bavarde; c'est volontaire pour ce lot debug

### Intention exacte
- faire en sorte que le prochain signal utilisateur soit diagnostiqueable en quelques secondes depuis F12
- remettre Cowork sur sa promesse: runtime autonome stable, non detourne par une instruction hors sujet

## 2026-04-07 - Fix critique prod: crash Vercel `DOMMatrix` au boot, redeploye et revalide

### Ce qui a ete accompli
- Diagnostic prod reel:
  - `GET https://vertex-ai-app-pearl.vercel.app/api/status` renvoyait `FUNCTION_INVOCATION_FAILED`
  - `vercel logs vertex-ai-app-pearl.vercel.app --no-follow --status-code 500 --expand` a montre:
    - `ReferenceError: DOMMatrix is not defined`
    - stack dans `pdfjs-dist/legacy/build/pdf.mjs`
    - impact global sur la function `api/index`
- Correctif code:
  - `server/lib/chunking.ts`
    - suppression de l'import top-level direct `pdf-parse`
    - ajout d'un helper memoise `getPdfParseRuntime()`
    - chargement runtime de `pdf-parse/worker` puis `pdf-parse`
    - passage de `CanvasFactory` au constructeur `PDFParse`
- Redeploy prod:
  - `vercel deploy --prod --yes`
  - nouvel alias production reapplique sur `https://vertex-ai-app-pearl.vercel.app`

### Validation reelle
- Locale:
  - `node node_modules/tsx/dist/cli.mjs -e "import('./server/lib/chunking.ts')..."` : OK
  - `npm run lint` : OK
  - `npm run build` : OK
  - `node node_modules/tsx/dist/cli.mjs test-cowork-workers.ts` : OK
  - `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts` : OK
  - `node node_modules/tsx/dist/cli.mjs test-generated-app-stream.ts` : OK
  - `node node_modules/tsx/dist/cli.mjs test-generated-app-manifest.ts` : OK
  - `node node_modules/tsx/dist/cli.mjs test-cowork-rag.ts` : SKIP honnete (`COWORK_TEST_RAG=1`, `QDRANT_URL`)
  - `node node_modules/tsx/dist/cli.mjs verify-cowork-rag-e2e.ts` : SKIP honnete (`COWORK_TEST_RAG=1`, `QDRANT_URL`)
  - `node node_modules/tsx/dist/cli.mjs test-cowork-rag-multimodal.ts` : SKIP honnete (`COWORK_TEST_RAG=1`, `QDRANT_URL`)
- Production:
  - `GET /api/status` : 200 + JSON sain
  - `POST /api/chat` minimal : 200
  - `POST /api/cowork` minimal : 200 + flux SSE demarre

### Ce qui reste a faire
- pousser le meme etat sur GitHub pour resynchroniser le repo avec le deploy prod
- repartir ensuite sur la Phase 2 (`/sandbox/python`, `/sandbox/shell`)

### Decisions prises et pourquoi
- conserver `pdf-parse` pour l'instant:
  - la doc officielle couvre le cas Vercel/serverless
  - le vrai probleme etait le mode de chargement, pas necessairement la librairie elle-meme
- verifier systematiquement la prod avec `/api/status` apres toute modif backend qui introduit un parseur/document loader:
  - `npm run build` ne suffit pas pour attraper un crash de boot serverless

### Pieges / points d'attention
- un import top-level "inoffensif" peut casser toute la function `api/index.ts`
- sur Vercel, il faut lire les logs runtime, pas seulement les logs de build, quand un alias `Ready` renvoie quand meme `FUNCTION_INVOCATION_FAILED`

### Intention exacte
- remettre tous les modes utilisateur sur pied avant de continuer a empiler des phases Cowork v2
- garder une trace precise du symptome et du fix pour ne pas perdre de temps sur ce meme crash plus tard

## 2026-04-07 - Cowork v2: Phase 0 reelle fermee, Phase 1A reelle fermee, Phase 1B multimodale complete

### Ce qui a ete accompli
- Infra reelle:
  - APIs GCP activees sur `gen-lang-client-0405707007`:
    - `run.googleapis.com`
    - `cloudbuild.googleapis.com`
    - `artifactregistry.googleapis.com`
  - deploy Cloud Run reel du worker:
    - service: `cowork-workers`
    - region: `europe-west1`
    - URL: `https://cowork-workers-635320914187.europe-west1.run.app`
    - `GET /health` verifie reellement
    - bearer auth verifiee reellement (`401` sans token, `501` honnete avec token sur une route reservee)
  - deploy Qdrant de validation sur Cloud Run:
    - service: `qdrant-dev`
    - region: `europe-west1`
    - URL: `https://qdrant-dev-635320914187.europe-west1.run.app`
    - `GET /collections` et `GET /readyz` verifies
- Vercel envs reelles:
  - `COWORK_WORKERS_URL`, `COWORK_WORKERS_TOKEN`, `QDRANT_URL`, `COWORK_ENABLE_RAG=1`, `COWORK_RAG_AUTOINJECT=1`
  - branches automatiquement sur `development` et `production`
  - `preview` non branche dans cette session car le CLI demande un `git-branch` explicite
- Code Phase 1B:
  - `server/lib/google-genai.ts`
    - fix critique: `gemini-embedding-2-preview` ne doit pas etre force sur `global`
  - `server/lib/media-understanding.ts`
    - nouveau helper de resume/transcription media pour image/audio/video
  - `server/lib/embeddings.ts`
    - wrappers multimodaux via `gemini-embedding-2-preview`
  - `server/lib/cowork-memory.ts`
    - `indexFileToMemory()` remplace l'ancien chemin text-only
    - image/audio/video indexes avec resume lisible + embed media contextuel
    - fallback texte honnete si l'embed media echoue
    - point IDs Qdrant passes en `randomUUID()`
  - `server/lib/qdrant.ts`
    - payload enrichi (`modality`, `summaryKind`, `embeddingStrategy`)
  - `server/lib/config.ts`
    - defaut RAG passe a `gemini-embedding-2-preview`
    - ajout du `summaryModel`
  - `api/index.ts`
    - `release_file` indexe maintenant tous les medias supportes par la memoire
    - sortie `release_file` enrichie avec les metas memoire
  - `verify-cowork-rag-e2e.ts`
    - nouveau smoke reel `/api/cowork` de bout en bout

### Validation reelle
- `npm run lint` : OK
- `npm run build` : OK
- `node node_modules/tsx/dist/cli.mjs test-cowork-workers.ts` : OK
- `node node_modules/tsx/dist/cli.mjs test-cowork-loop.ts` : OK
- `node node_modules/tsx/dist/cli.mjs test-generated-app-stream.ts` : OK
- `node node_modules/tsx/dist/cli.mjs test-generated-app-manifest.ts` : OK
- `node node_modules/tsx/dist/cli.mjs test-cowork-rag.ts` : OK
- `node node_modules/tsx/dist/cli.mjs verify-cowork-rag-e2e.ts` : OK
- `node node_modules/tsx/dist/cli.mjs test-cowork-rag-multimodal.ts` : OK
- verification directe Vertex:
  - texte: OK
  - image: OK
  - audio: OK
  - PDF: OK
  - video (`gs://cloud-samples-data/generative-ai/video/pixel8.mp4`): OK

### Ce qui reste a faire
- Phase 2:
  - `/sandbox/python`
  - `/sandbox/shell`
  - transfert de fichiers sandbox <-> GCS
  - tools `run_python` / `run_shell` dans `api/index.ts`
- optionnel infra:
  - ajouter une config `preview` Vercel si un vrai branch preview le justifie

### Decisions prises et pourquoi
- `gemini-embedding-2-preview` devient le defaut RAG:
  - c'est le seul choix coherent avec la promesse Phase 1B multimodale
  - il a ete valide reellement sur texte/image/audio/video
- l'indexation multimodale passe par un resume/transcript lisible:
  - meilleur debug
  - meilleurs snippets dans `### MEMOIRE PERTINENTE`
  - fallback texte propre si l'embed media tombe
- un Qdrant self-host sur Cloud Run est accepte comme cluster de validation reelle:
  - conforme a l'alternative prevue par le brief
  - permet de fermer la validation sans attendre un compte Qdrant Cloud

### Pieges / points d'attention
- le projet Vertex renvoie encore des `429 RESOURCE_EXHAUSTED` intermittents
- `verify-cowork-rag-e2e.ts` et `test-cowork-rag-multimodal.ts` sautent honnetement si le quota bloque tout
- le service `qdrant-dev` est pratique pour la validation, pas encore un choix SaaS final fige

### Intention exacte
- clore proprement toute la promesse memoire du brief avant d'ouvrir la sandbox Python
- garder une preuve reelle rejouable, pas seulement des helpers unitaire/integres
- laisser la prochaine session repartir directement sur la Phase 2 sans re-auditer tout le RAG

## 2026-04-07 - Cowork v2 Phase 1A: RAG text-first local complet

### Ce qui a ete accompli
- Backend RAG ajoute:
  - `server/lib/chunking.ts`
    - chunking texte simple en TS pur
    - extraction PDF via `pdf-parse`
  - `server/lib/embeddings.ts`
    - wrapper Vertex embeddings via `@google/genai`
    - defaut Phase 1A: `gemini-embedding-001`
    - tracking usage (`tokenCount`, dimensions, truncation)
  - `server/lib/qdrant.ts`
    - client REST Qdrant
    - creation auto de collection
    - indexes payload `userId`, `fileId`, `mimeType`
    - retries via `retryWithBackoff()`
  - `server/lib/cowork-memory.ts`
    - orchestration index/search/recall/forget
    - auto-section `### MEMOIRE PERTINENTE`
- `api/index.ts`:
  - parse maintenant `userIdHint` et `memorySearchEnabled`
  - auto-retrieval avant la boucle Cowork si:
    - `COWORK_ENABLE_RAG=1`
    - `COWORK_RAG_AUTOINJECT=1`
    - run Cowork pur (pas agent/generated app)
    - `userIdHint` present
  - nouveaux tools:
    - `memory_search`
    - `memory_recall`
    - `memory_forget`
  - `release_file`:
    - genere maintenant un `fileId` stable cote backend
    - emet `workspace_file_created` avec ce `fileId`
    - indexe automatiquement les fichiers texte/PDF quand le RAG est actif
    - emet `memory_indexed` ou `memory_index_failed`
  - `workspace_delete` tente aussi un `memory_forget`
  - `RunMeta` remonte maintenant les compteurs RAG reels (`embeddingCount`, `embeddingTokens`, `vectorSearches`)
- Frontend:
  - `src/App.tsx`
    - envoie `userIdHint: user.uid`
    - envoie `memorySearchEnabled: true`
    - persiste les fichiers workspace avec le `fileId` backend via `setDoc(...)`
  - `src/utils/cowork.ts`
    - nouveaux events SSE:
      - `memory_indexed`
      - `memory_index_failed`
      - `memory_recalled`
  - `src/components/MessageItem.tsx`
    - nouveau pill `Memoire (n)` quand une auto-injection a reellement eu lieu
- Tests:
  - nouveau `test-cowork-rag.ts`
    - smoke reel gate par env vars
    - texte + PDF
    - index -> search -> recall -> forget
    - skip honnete si Vertex/Qdrant/envs absents

### Validation locale
- `npm run lint` : OK
- `npm run build` : OK
- `npx tsx test-cowork-workers.ts` : OK
- `npx tsx test-cowork-loop.ts` : OK
- `npx tsx test-generated-app-stream.ts` : OK
- `npx tsx test-generated-app-manifest.ts` : OK
- `npx tsx test-cowork-rag.ts` : SKIP honnete si envs RAG absentes

### Ce qui reste a faire
- brancher les env vars reelles Qdrant + Vertex
- jouer `npx tsx test-cowork-rag.ts` en vrai
- faire un run Cowork authentifie:
  - upload PDF texte
  - verification de `memory_indexed`
  - nouvelle question qui doit rappeler le bon passage via auto-injection
- attaquer ensuite la Phase 1B multimodale (`gemini-embedding-2-preview`)

### Decisions prises et pourquoi
- Phase 1A garde `gemini-embedding-001` comme defaut:
  - plus stable pour du text-first immediat
  - aligne avec la sequence decidee (`1A` text-first, `1B` multimodal)
- la memoire s'appuie sur `userIdHint` explicite:
  - le backend n'a toujours pas d'identite Firebase user native
  - il faut donc transmettre l'isolement tenant dans le body `/api/cowork`
- `release_file` genere le `fileId` cote backend:
  - indispensable pour que le vector DB et Firestore parlent du meme fichier

### Pieges / points d'attention
- si `userIdHint` manque, les tools memoire doivent echouer honnetement au lieu d'indexer sans isolation
- si Qdrant tombe, `release_file` doit quand meme reussir, mais en emettant `memory_index_failed`
- `memory_recall` peut remonter beaucoup de texte: a utiliser de facon ciblee
- `gemini-embedding-001` reste text-only; ne pas lui promettre image/audio/video

### Intention exacte
- livrer une vraie Phase 1A utilisable, pas juste des wrappers backend
- faire en sorte qu'un fichier publie par Cowork puisse etre retrouve semantiquement au run suivant
- garder une transparence utilisateur explicite sur ce qui a ete memorise, rappele ou rate

## 2026-04-07 - Cowork v2 Phase 0: worker Cloud Run minimal + helper backend + meta V2

### Ce qui a ete accompli
- Nouveau client worker `server/lib/cowork-workers.ts`:
  - URL et bearer token lus depuis `server/lib/config.ts`
  - retries via `retryWithBackoff()`
  - support JSON + SSE pour la suite
- `server/lib/config.ts` etend maintenant la config avec:
  - `COWORK_ENABLE_RAG`
  - `COWORK_ENABLE_SANDBOX`
  - `COWORK_ENABLE_GIT`
  - `COWORK_ENABLE_BROWSER`
  - `COWORK_WORKERS_URL`
  - `COWORK_WORKERS_TOKEN`
  - `QDRANT_URL`
- `api/index.ts`:
  - `CoworkRunMeta` etendu avec les compteurs v2
  - `createEmptyCoworkRunMeta()` alimente deja ces champs a zero
  - `callCoworkWorker` exporte dans `__coworkLoopInternals` et `__coworkWorkerInternals`
  - flags v2 passes a `buildCoworkSystemInstruction()` pour preparer le gating futur sans exposer de faux outils
- Frontend/meta:
  - `src/types.ts`, `src/utils/cowork.ts` et `src/components/MessageItem.tsx` acceptent et affichent deja les nouveaux compteurs si non nuls
- Nouveau sous-projet `cloud-run/cowork-workers/`:
  - `package.json`
  - `src/auth.js`
  - `src/index.js`
  - `Dockerfile`
  - `cloudbuild.yaml`
  - `README.md`
  - service minimal Node 22 avec `GET /health`
  - routes futures reservees en `501` honnete
- Nouveau smoke `test-cowork-workers.ts`:
  - demarre le worker localement
  - pointe `COWORK_WORKERS_URL` vers ce serveur
  - appelle `callCoworkWorker('/health')` via `api/index.ts`

### Validation locale
- `npm run lint` : OK
- `npm run build` : OK
- `npx tsx test-cowork-workers.ts` : OK
- `npx tsx test-cowork-loop.ts` : OK
- `npx tsx test-generated-app-stream.ts` : OK
- `npx tsx test-generated-app-manifest.ts` : OK

### Ce qui reste a faire
- deployer `cloud-run/cowork-workers/` sur un vrai service Cloud Run
- renseigner `COWORK_WORKERS_URL` + `COWORK_WORKERS_TOKEN`
- verifier `/health` en condition reelle
- attaquer Phase 1A:
  - `server/lib/embeddings.ts`
  - `server/lib/qdrant.ts`
  - hook d'ingestion/retrieval text-first

### Decisions prises et pourquoi
- service Cloud Run unique plutot que plusieurs services:
  - moins de friction infra
  - un seul bearer token
  - warm pool partage
- Phase 0 sans dependance root supplementaire:
  - le worker tourne en Node natif pour poser le socle sans debat npm premature
  - les dependances lourdes (Playwright, Octokit ou autres) seront ajoutees plus tard avec verification officielle et comparaison documentee

### Pieges / points d'attention
- `cloudbuild.yaml` deploie le service, mais ne fournit pas encore `COWORK_WORKERS_TOKEN`; cela reste une action d'env infra a faire hors repo
- la doc officielle Gemini Embedding 2 verifiee le 2026-04-07 confirme:
  - PDF natif limite a 6 pages
  - video avec audio limitee a 80s
  - video sans audio limitee a 120s
- consequence pour la suite:
  - les PDFs longs devront passer par extraction texte + chunking
  - les medias longs auront besoin de fallback transcript / keyframes

### Intention exacte
- debloquer toutes les futures phases Cowork v2 sans casser l'app actuelle
- garder une fondation honnete: aucun faux endpoint, aucun faux outil, aucun faux succes
- faire en sorte que la prochaine session puisse commencer directement par le deploy Cloud Run reel puis l'embarquement du RAG

## 2026-04-07 - Galerie d instructions: edit fiable, icones IA retablies, sauvegarde directe

### Ce qui a ete accompli
- Fix du pipeline d'icone IA dans `src/components/SystemInstructionGallery.tsx`:
  - la galerie attendait encore `base64`
  - `/api/generate-image` renvoie maintenant `url` / `images[]`
  - la galerie accepte desormais `url` GCS ou `base64`, en preview immediate comme en generation background
- Refonte des actions de cartes dans `SystemInstructionGallery`:
  - suppression de l'overlay d'actions fragile base sur `group-hover` + `pointer-events`
  - actions `Utiliser`, `Modifier`, `Supprimer` rendues explicitement et de facon fiable sur chaque carte
  - ajout d'un etat visuel `Active` pour l'instruction actuellement selectionnee
- Nouveau flux de mise a jour directe depuis `src/components/SidebarRight.tsx`:
  - lorsqu'une instruction de galerie est selectionnee, la session garde un `selectedCustomPrompt`
  - le panneau droit affiche un bloc `Instruction liee`
  - si le textarea `Instructions systeme` diverge du prompt sauvegarde, un bouton `Mettre a jour` pousse directement la nouvelle version dans `users/{uid}/custom_prompts/{id}`
- Persistance session/local cache:
  - `src/types.ts` ajoute `SelectedCustomPromptRef`
  - `src/App.tsx` transporte la selection dans une session standard nouvellement creee
  - `src/utils/sessionShells.ts` normalise et conserve ce lien dans le cache local-first
- Hygiene TypeScript:
  - `src/utils/cowork.ts` declare maintenant `workspace_file_created` et `workspace_file_deleted`
  - `tmp/media-modes-preview.tsx` accepte les nouveaux props de `SidebarRight` et peut afficher un prompt lie mocke via `?linked=1`

### Validation locale
- `npm run lint` : OK
- `npm run build` : OK
- Harness visuel local via Vite source:
  - `http://127.0.0.1:4174/tmp/media-modes-preview.html?surface=panel&mode=chat&linked=1`
- Captures reelles Edge headless:
  - `tmp/qa-sidebar-linked-desktop.png`
  - `tmp/qa-sidebar-linked-mobile.png`
  - `tmp/qa-sidebar-linked-mobile-tall.png`

### Ce qui reste a faire
- Rejouer le flux authentifie complet sur de vraies instructions Firestore:
  - edit carte existante
  - selection puis mise a jour directe depuis le panneau droit
  - creation sans icone puis verification de la generation auto

### Risques / limites
- Le harness local prouve le rendu du bloc `Instruction liee`, pas la galerie authentifiee complete.
- Si un prompt est modifie hors de la session courante, le snapshot de session reste sur l'ancienne version jusqu'a une nouvelle selection ou une mise a jour directe.

### Intention exacte
- Eviter a l'utilisateur de repasser par le crayon pour chaque iteration sur une instruction deja choisie.
- Restaurer la confiance dans `Mes Instructions` en rendant les actions explicites, robustes et coherentes avec le backend actuel.

## 2026-04-06 - Workspace persistant Cowork + fix history media

### Ce qui a été accompli

**1. Fix bug media history Cowork**
- Problème: à chaque message suivant une photo, l'IA répondait comme si la photo venait d'être envoyée
- Cause: `buildApiMessageParts` renvoyait les données brutes pour tous les messages historiques
- Fix: option `historyMode` → remplace les attachments par `[Pièce jointe: nom — mimeType]`
- Fichier: `src/utils/chat-parts.ts`

**2. Espace de travail persistant Cowork (VM)**
- `release_file` émet SSE `workspace_file_created` → frontend persiste dans `/users/{uid}/workspace/files/`
- Avant chaque run Cowork: fetch 30 derniers fichiers → `workspaceFiles` dans body → `### ESPACE DE TRAVAIL PERSONNEL` dans system prompt
- Nouvel outil `workspace_delete` → SSE `workspace_file_deleted` → suppression Firestore
- 5 fichiers modifiés: `src/types.ts`, `server/lib/schemas.ts`, `api/index.ts`, `src/App.tsx`, `firestore.rules`
- Commit 1f86135, pushé sur main

### État: non testé en run réel — à valider end-to-end

### Pièges
- `limit` importé depuis `firebase/firestore` directement dans App.tsx (légèrement incohérent avec le reste)
- Signed URLs expirent 7j, storageUri permanent → liens morts dans chat après 7j pour l'utilisateur
- Workspace actif seulement pour runs Cowork purs (pas agent/generated_app)

---

## 2026-04-04 - Redesign UI complet: migration design system cyan→indigo, nettoyage border-radius

### Ce qui a ete accompli
- **Design system migre**: accent cyan (#81ecff) → indigo (#818cf8/#6366f1), font Sora → Inter + JetBrains Mono
- **14 fichiers modifies** dans un seul commit `cdbdc0b`, pousse sur main
- **Composants réécrits de zero**: ChatInput, StudioEmptyState, SidebarLeft
- **Composants migres (couleurs + border-radius)**: AgentsHub, AgentWorkspacePanel, GeneratedAppHost, AgentAppPreview, AttachmentGallery, NasheedStudioWorkspace, SidebarRight, MessageItem
- **index.css**: nouveau systeme de variables CSS (--app-accent, --app-bg-rgb, --radius-*)
- **App.tsx**: header compact h-14, ambient bg simplifie, max-w-3xl pour chat area
- **Zero reference cyan restante** dans le codebase
- **Zero border-radius custom** (rounded-[X.Xrem]) restant — tout standardise en rounded-lg/xl/2xl
- **Build clean** (seuls warnings de chunk size habituels)

### Bug "je peux plus ecrire"
- Investigation approfondie de ChatInput.tsx et handleSend dans App.tsx
- Le textarea n'est disabled que pendant isRecording
- handleSend n'est pas mode-gate — fonctionne pareil pour tous les modes
- sendInFlightRef.current se reset dans un finally block
- **Conclusion**: pas un bug frontend. Cause probable: erreur backend/API pour les modes non-chat, ou version deployee obsolete

### Decisions prises
- Retirer la scene Three.js du StudioEmptyState (simplification, gain perf)
- Palette indigo plutot que cyan (plus moderne, meilleur contraste, moins "generique IA")
- Border-radius standardises: lg (0.75rem), xl (1rem), 2xl (1.25rem) — fini les valeurs custom par composant

### Ce qui reste a faire
- Tester l'ecriture dans tous les modes en etant connecte (reproduire le bug)
- Tester Cowork Apps
- Verifier theme light
- Verifier mobile

---

## Mise a jour complementaire - 2026-04-02 (refonte hero `three.js`, shell plus epure, validation desktop/mobile)
- Besoin traite:
  - l'utilisateur veut une vraie refonte plus Awwwards:
    - beaucoup moins de texte
    - beaucoup plus d'air
    - une presence `three.js`
    - un shell moins serre et moins "dashboard"
- Cause racine confirmee:
  - l'ancien accueil vide empilait trop de copy, de cartes et de micro-sections
  - la composition respirait mal, surtout avant meme d'avoir commence a travailler
  - les rails lateraux restaient encore trop verbeuses pour une DA plus editoriale
- Correctifs appliques:
  - dependance / scene:
    - `package.json`
    - `package-lock.json`
    - ajout de `three@0.183.2`
    - nouveau composant `src/components/StudioHeroScene.tsx`
      - scene WebGL brute `three`
      - sculpture animee + halo + particules
      - lazy load pour sortir le poids du chemin critique normal
  - accueil vide:
    - `src/components/StudioEmptyState.tsx`
      - reecrit en hero editorial unique
      - copy radicalement coupee
      - CTA central + suggestions minimales
      - metadata rail tres courte
    - `src/index.css`
      - nouveau fond plus calme et moins quadrille
      - nouvelles classes `studio-empty-hero*`
      - panneaux plus sobres
      - responsive mobile dedie pour garder titre + CTA dans le premier ecran
  - shell:
    - `src/components/SidebarLeft.tsx`
      - labels de modes raccourcis
      - colonne legerement elargie
      - branding plus compact
    - `src/components/SidebarRight.tsx`
      - copy des cartes mode raccourcie pour reduire la densite narrative
  - documentation:
    - `TECH_RADAR.md`
    - `DECISIONS.md`
    - `QA_RECIPES.md`
    - `AI_LEARNINGS.md`
    - `BUGS_GRAVEYARD.md`
- Validation locale:
  - `npm run lint` : OK
  - `npm run build` : OK
  - captures Chrome headless reelles sur `http://127.0.0.1:3000`:
    - `tmp/refonte-home-desktop.png`
    - `tmp/refonte-home-mobile.png`
- Bug rencontre pendant la validation:
  - le hero mobile perdait toute sa copy en capture headless
  - cause racine: reveal `motion` sur la copy critique
  - correctif final: copy statique, animation gardee dans la scene `three.js`
- Fichiers modifies:
  - `package.json`
  - `package-lock.json`
  - `src/components/StudioHeroScene.tsx`
  - `src/components/StudioEmptyState.tsx`
  - `src/components/SidebarLeft.tsx`
  - `src/components/SidebarRight.tsx`
  - `src/index.css`
  - `NOW.md`
  - `SESSION_STATE.md`
  - `AI_LEARNINGS.md`
  - `BUGS_GRAVEYARD.md`
  - `TECH_RADAR.md`
  - `DECISIONS.md`
  - `QA_RECIPES.md`
- Limites restantes:
  - validation visuelle reelle faite surtout sur le shell vide `chat`
  - pas encore de replay visuel equivalent sur `cowork`, `image`, `video`, `audio`, `lyria`
  - pas encore de validation authentifiee avec historique reel et vrais rendus media
  - chunk lazy `StudioHeroScene` toujours lourd (~`505 kB` minifie)
- Intention exacte:
  - passer d'un accueil bavard a un poster vivant
  - faire porter l'identite par une scene 3D et par l'espace negatif, pas par une accumulation de blocs
  - garder la refonte simple a maintenir en restant sur `three` brut plutot que d'ouvrir une pile 3D plus grosse

## Mise a jour complementaire - 2026-04-02 (modes media dedies + mode Lyria + delegation hub opt-in dans Cowork)
- Besoin traite:
  - l'utilisateur veut une interface propre et distincte pour:
    - `generation d'image`
    - `generation video`
    - `text-to-speech`
    - `Lyria / musique`
  - il veut aussi pouvoir couper l'usage des agents du Hub dans Cowork via une case a cocher, desactivee par defaut
- Cause racine confirmee:
  - les modes media partageaient encore trop de copy / surface d'accueil generique
  - `audio` melangeait TTS et musique alors que Lyria merite sa propre entree produit
  - Cowork recevait encore le catalogue Hub + les outils de delegation des qu'il tournait en runtime normal, sans vrai opt-in utilisateur
- Correctifs appliques:
  - contrat / store:
    - `src/types.ts`
      - ajout de `lyria` dans `AppMode`
      - ajout de `sampleCount` et `agentDelegationEnabled` dans `ModelConfig`
    - `src/store/useStore.ts`
      - config dediee `lyria`
      - `cowork.agentDelegationEnabled = false` par defaut
      - `lastSessionIdsByMode.lyria`
  - runtime / transport:
    - `src/App.tsx`
      - branche complete `effectiveMode === 'lyria'` vers `/api/generate-music`
      - placeholders/labels/create labels et cycle clavier mis a jour
      - `hubAgents` n'est envoye a `/api/cowork` que si `config.agentDelegationEnabled === true`
    - `api/index.ts`
      - `buildCoworkSystemInstruction()` accepte `agentDelegationEnabled`
      - si le toggle est coupe:
        - pas de section `HUB AGENTS DISPONIBLES`
        - pas de consignes de delegation
        - les tools `create_agent_blueprint`, `update_agent_blueprint`, `run_hub_agent` sont filtres
    - `server/lib/schemas.ts`
      - `config.agentDelegationEnabled` accepte cote schema
    - `src/utils/sessionRecovery.ts`
      - rehydrate aussi `lyria`
  - UI:
    - `src/components/SidebarLeft.tsx`
      - nouveau mode `Lyria / Musique`
    - `src/components/ChatInput.tsx`
      - placeholders dedies par mode
    - `src/components/SidebarRight.tsx`
      - cartes editoriales propres a `image`, `video`, `audio`, `lyria`
      - section Cowork `Utiliser les agents du Hub`
      - panneau Lyria avec `sampleCount`, `negativePrompt`, `seed`
    - `src/components/StudioEmptyState.tsx`
      - showcases distincts pour image, video, TTS et Lyria
  - harness QA:
    - `tmp/media-modes-preview.html`
    - `tmp/media-modes-preview.tsx`
- Validation locale:
  - `npm run lint` : OK
  - `npm run build` : OK
  - captures Edge headless reelles via serveur Vite source `:4174`:
    - `tmp/qa2-image-mode-desktop.png`
    - `tmp/qa2-video-mode-desktop.png`
    - `tmp/qa2-audio-mode-desktop.png`
    - `tmp/qa2-lyria-mode-desktop.png`
    - `tmp/qa2-lyria-panel-desktop.png`
    - `tmp/qa2-lyria-mode-mobile.png`
    - `tmp/qa2-cowork-panel-desktop.png`
    - `tmp/qa2-cowork-panel-mobile.png`
- Fichiers modifies:
  - `src/types.ts`
  - `src/store/useStore.ts`
  - `src/utils/sessionRecovery.ts`
  - `server/lib/schemas.ts`
  - `src/App.tsx`
  - `api/index.ts`
  - `src/components/SidebarLeft.tsx`
  - `src/components/ChatInput.tsx`
  - `src/components/SidebarRight.tsx`
  - `src/components/StudioEmptyState.tsx`
  - `tmp/media-modes-preview.html`
  - `tmp/media-modes-preview.tsx`
- Limites restantes:
  - pas encore de run authentifie avec de vraies generations `image/video/tts/lyria`
  - pas encore de preuve runtime in-app qu'un Cowork toggle `off` ne delegue jamais sur un run reel complet
  - `vite preview` ne doit pas etre reutilise pour ce harness: il retombe sur la SPA principale
- Intention exacte:
  - donner a chaque surface media une vraie personnalite des la premiere seconde
  - separer clairement `TTS` et `Lyria`
  - rendre la delegation Hub dans Cowork explicite, visible et volontaire

## Mise a jour complementaire - 2026-04-02 (YouTube natif comme Google AI Studio, avec plage video et FPS)
- Besoin traite:
  - l'utilisateur veut que les liens YouTube soient interpretes comme dans Google AI Studio, pas comme un bricolage `titre + lien`
  - il montre aussi l'UI AI Studio de reglages video (`Start Time`, `End Time`, `FPS`) et demande le meme comportement
- Verification officielle faite:
  - doc Google AI / Gemini reverifiee
  - confirmation que Gemini accepte une URL YouTube native en `fileData.fileUri`
  - confirmation que `videoMetadata.startOffset`, `endOffset` et `fps` sont supportes pour cadrer l'analyse
- Cause racine confirmee:
  - apres le correctif `gs://` pour les fichiers uploadees, le chemin YouTube restait encore en fallback texte dans `server/lib/chat-parts.ts`
  - la piece jointe YouTube n'avait aucun champ pour conserver une plage video ou un FPS
  - l'UI ne montrait qu'une carte lien sans modal de parametrage
- Correctifs appliques:
  - contrat partage:
    - `src/types.ts`
    - `shared/chat-parts.ts`
    - `server/lib/schemas.ts`
    - ajout de `videoMetadata` (`startOffsetSeconds`, `endOffsetSeconds`, `fps`) sur les attachments
  - serialisation/persistance:
    - `src/utils/chat-parts.ts`
    - `src/utils/cowork.ts`
    - propagation et sanitation de `videoMetadata`
  - backend:
    - `server/lib/chat-parts.ts`
      - un attachment `youtube` devient maintenant une vraie part native:
        - `fileData.fileUri = https://www.youtube.com/...`
        - `fileData.mimeType = video/mp4`
        - `videoMetadata` derive depuis les reglages UI
      - les videos fichier/GCS peuvent aussi porter `videoMetadata` si on l'ajoute plus tard
    - `server/routes/standard.ts`
      - `/api/metadata` renvoie maintenant `title + thumbnail`
  - frontend:
    - `src/components/ChatInput.tsx`
      - la piece jointe YouTube garde maintenant un vrai `thumbnail`
      - ajout d'un modal `Video settings`
      - champs:
        - `Start Time`
        - `End Time`
        - `FPS`
      - formats acceptes:
        - `1m10s`
        - `70s`
        - `01:10`
      - validation:
        - temps invalides refuses
        - `end > start`
        - `0 < fps <= 24`
      - fix responsive mobile: footer du modal rendu visible au premier ecran
    - `src/components/AttachmentGallery.tsx`
      - la carte YouTube persistente affiche aussi la vignette et le resume `debut / fin / FPS`
  - validation code:
    - `verify-chat-parts.ts`
      - couvre maintenant le cas YouTube natif + `videoMetadata`
      - couvre aussi la persistance de `videoMetadata` dans l'historique
- Validation locale:
  - `npm run lint` : OK
  - `npm run build` : OK
  - `npx tsx verify-chat-parts.ts` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - captures Edge headless locales:
    - `C:\Users\Yassine\AppData\Local\Temp\youtube-preview-card-apr02.png`
    - `C:\Users\Yassine\AppData\Local\Temp\youtube-preview-modal-apr02.png`
    - `C:\Users\Yassine\AppData\Local\Temp\youtube-preview-modal-mobile-apr02-fixed3.png`
- Harness ajoute:
  - `tmp/youtube-preview.html`
  - `tmp/youtube-preview.tsx`
- Limites restantes:
  - pas encore de run authentifie/deploye sur un vrai lien YouTube dans l'app finale
  - pas encore de preuve pratique sur un contexte contenant plusieurs URLs YouTube a la fois
- Intention exacte:
  - aligner enfin la voie YouTube sur une vraie entree multimodale Gemini
  - garder l'UI et la persistance assez riches pour que l'utilisateur voie et reouvre son cadrage video

## Mise a jour complementaire - 2026-04-02 (pieces jointes video/texte enfin lisibles dans chat + Cowork)
- Besoin traite:
  - l'utilisateur remonte qu'une video envoyee n'est lue qu'a travers son titre dans `chat` et dans `cowork`
  - il demande aussi une verification sur les autres types de fichiers
- Cause racine confirmee:
  - le pipeline d'upload gardait l'URL signee GCS pour l'UI, mais perdait le `gs://` utile a Vertex/Gemini
  - `server/lib/chat-parts.ts` essayait ensuite de reconsommer video/audio/image/PDF via fetch HTTP/inline; pour les videos, cela pouvait finir en fallback `Nom + URL`
  - les documents texte (`txt`, `md`, `csv`, `json`, etc.) n'avaient pas de voie de decode explicite
- Correctifs appliques:
  - `src/types.ts` / `shared/chat-parts.ts` / `server/lib/schemas.ts`
    - ajout du champ `storageUri` sur les attachments
  - `server/lib/storage.ts`
    - nouvel upload enrichi `uploadToGCSWithMetadata()`
    - helper `tryExtractGcsUriFromUrl()` pour rehydrater les anciens messages deja persistes
  - `server/routes/standard.ts`
    - `/api/upload`, `/api/generate-image`, `/api/generate-audio`, `/api/generate-music` renvoient maintenant aussi `storageUri`
  - `src/App.tsx`
    - les uploads utilisent `storageUri` et n'envoient plus la base64 au backend quand le fichier est deja en GCS
    - les medias generes persistent eux aussi `storageUri`
  - `server/lib/chat-parts.ts`
    - prefere `fileData` `gs://...` pour image/audio/video/PDF
    - decode le texte des fichiers `text/plain`, `text/markdown`, `csv`, `json`, `xml`, etc.
  - `api/index.ts`
    - `release_file` renvoie maintenant `storageUri`
    - les attachments Cowork derives de `release_file` gardent donc une vraie voie modele
- Validation locale:
  - `npm run lint` : OK
  - `npx tsx verify-chat-parts.ts` : OK
  - `npx tsx test-cowork-loop.ts` : OK
- Fichiers modifies:
  - `src/App.tsx`
  - `src/types.ts`
  - `src/utils/chat-parts.ts`
  - `src/utils/cowork.ts`
  - `shared/chat-parts.ts`
  - `server/lib/chat-parts.ts`
  - `server/lib/schemas.ts`
  - `server/lib/storage.ts`
  - `server/routes/standard.ts`
  - `api/index.ts`
  - `verify-chat-parts.ts`
- Limites restantes:
  - pas encore de preuve UI authentifiee/deployee
  - les formats binaires exotiques non supportes par Gemini restent en fallback descriptif
  - les gros fichiers texte sont volontairement tronques avant injection dans le contexte modele
- Intention exacte:
  - garder l'URL signee pour l'UX, mais redonner au modele une reference GCS stable
  - faire en sorte qu'un upload video/document dans `chat` et `cowork` soit traite comme une vraie entree multimodale, pas comme un simple nom de fichier

## Mise a jour complementaire - 2026-04-02 (audit shell + autonomie backend + allègement critique)
- Besoin traite:
  - l'utilisateur demande un audit complet esthetique / frontend / backend
  - correction prioritaire du shell vide, des rails d'autonomie restants et du poids du bundle critique
- Constats confirmes:
  - la sidebar gauche n'offrait plus de geste clair pour demarrer une nouvelle session
  - le centre du shell pouvait rester vide visuellement sur l'etat d'accueil tant que le rendu des messages etait evalue en parallele
  - il restait encore des rails backend `outputKindHint` / specialisations familiales dans la creation d'agents/apps
  - le bundle principal restait trop lourd pour le premier chargement
- Correctifs appliques:
  - `src/components/SidebarLeft.tsx`
    - retour d'un CTA visible `Nouveau ...` adapte au mode actif
  - `src/components/StudioEmptyState.tsx`
    - refonte en vraie scene d'accueil premium desktop/mobile
    - suppression de l'animation `motion` pour rendre l'etat vide deterministe
  - `src/App.tsx`
    - short-circuit explicite de l'etat vide pour ne plus evaluer la pile messages/virtualizer quand le shell doit juste accueillir
    - detection plus robuste d'une conversation reellement rendable
    - lazy loading des surfaces lourdes:
      - `AgentsHub`
      - `AgentWorkspacePanel`
      - `NasheedStudioWorkspace`
      - `GeneratedAppHost`
  - `src/components/SidebarRight.tsx`
    - lazy loading de `SystemInstructionGallery`
  - `server/lib/generated-apps.ts`
    - sanitation backend rendue plus neutre:
      - plus de derive forte par famille pour `modalities`
      - `outputKind` seulement sanitize legacy
      - `modelProfile` n'invente plus de specialisation implicite depuis les outils/modalites
  - `api/index.ts`
    - suppression de `outputKindHint` sur `create_agent_blueprint`
    - retrait de `outputKind` du prompt de sous-mission d'agent
- Validation locale:
  - `npm run lint` : OK
  - `npx tsx test-generated-app-stream.ts` : OK
  - `npx tsx test-generated-app-manifest.ts` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npm run build` : OK
  - captures Edge headless locales:
    - `tmp/audit-desktop-after4.png`
    - `tmp/audit-mobile-after4.png`
- Impact mesure:
  - le shell vide est redevenu visible et actionnable sur desktop/mobile
  - le chunk principal Vite est descendu d'environ `928 kB` a `816 kB` minifie
  - les surfaces Cowork/generated app sortent davantage du chemin critique initial
- Limites restantes:
  - pas encore de validation authentifiee/deployee de cette passe
  - le chunk principal reste encore au-dessus du warning Vite
- Intention exacte:
  - rendre le shell accueillant et immediat
  - finir de retirer les rails backend qui contredisaient la promesse d'autonomie
  - garder la prochaine passe concentree sur la validation reelle connectee et, si besoin, une seconde passe perf

## Mise a jour complementaire - 2026-04-02 (Cowork Apps auto-definies, clarification libre et runtime generic)
- Besoin traite:
  - l'utilisateur refuse un hub qui dirige Cowork via des options produit (`podcast`, `duel`, etc.)
  - il veut que l'app puisse definir elle-meme:
    - son interface
    - sa logique d'execution
    - son identite / mission
    - ses defaults outils
  - la seule limite voulue cote creation est l'imagination utilisateur, avec clarification libre si Cowork la juge necessaire
- Cause racine confirmee:
  - le flux generated app gardait encore des rails locaux ou backend:
    - choix de type dans `AgentsHub`
    - prompts frontend qui reinjectaient `Type de sortie attendu`
    - heuristiques runtime centrees sur `outputKind`
    - specialisations backend trop familiales
- Correctifs appliques:
  - `src/types.ts`
    - ajout de `GeneratedAppIdentity`
    - ajout de `modalities`
    - ajout de `runtime.toolDefaults`
    - ajout de `generationMode`
    - ajout des tours de transcript de creation et des nouveaux phases `clarification_requested` / `clarification_resolved`
  - `server/lib/schemas.ts`
    - `GeneratedAppCreateSchema` accepte maintenant `brief` libre ou `transcript`
    - schemas ajoutes pour `identity`, JSON runtime defaults, `generationMode`, `renderMode`
  - `server/lib/generated-apps.ts`
    - pipeline remplace par:
      - planner sur transcript libre
      - generation de source TSX autonome
    - sanitation rendue neutre:
      - `outputKind` derive seulement pour compatibilite legacy
      - plus de familles produit autoritaires pour definir l'app
    - `createGeneratedAppFromBriefWithProgress()` peut maintenant:
      - demander une clarification libre
      - reprendre sur transcript
      - produire manifest + source autonome
  - `server/routes/standard.ts`
    - SSE `generated_app_clarification`
    - `done.status` peut valoir `clarification_requested` ou `completed`
    - route create accepte `transcript`
  - `api/index.ts`
    - suppression de `outputKindHint` sur `create_generated_app`
    - suppression des nudges `Type de sortie attendu`
    - `applyRuntimeMediaToolDefaults()` remplace par `applyRuntimeToolDefaults()`
    - merge runtime base sur `manifest.runtime.toolDefaults` + `formValues`
  - `src/App.tsx`
    - prompts de lancement nettoyes des hints locaux `debateHint`, `nasheedRuntimeHint`, `Type de sortie attendu`
    - nouveau flux creation SSE avec transcript + clarification conversationnelle
  - `src/components/AgentsHub.tsx`
    - suppression des cartes/options de type d'app
    - un seul brief libre
    - reponse libre a la question de clarification de Cowork
    - historique conversationnel visible dans le hub
  - `src/components/GeneratedAppHost.tsx`
    - composant genere = chemin principal
    - canvas/host natif = fallback honnete
    - compatibilite legacy preservee via `generationMode`
  - tests:
    - `test-generated-app-stream.ts` couvre le flux clarification
    - `test-generated-app-manifest.ts` couvre `modalities`, `identity`, `runtime.toolDefaults`, `generationMode`
    - `test-cowork-loop.ts` couvre le merge runtime generique
- Tests / validations effectues:
  - `npm run lint` : OK
  - `npx tsx test-generated-app-stream.ts` : OK
  - `npx tsx test-generated-app-manifest.ts` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npm run build` : OK
- Fichiers modifies:
  - `src/types.ts`
  - `server/lib/schemas.ts`
  - `server/lib/generated-apps.ts`
  - `server/routes/standard.ts`
  - `api/index.ts`
  - `src/App.tsx`
  - `src/components/AgentsHub.tsx`
  - `src/components/GeneratedAppHost.tsx`
  - `test-generated-app-stream.ts`
  - `test-generated-app-manifest.ts`
  - `test-cowork-loop.ts`
  - `tmp/cowork-apps-preview.tsx`
- Limites restantes:
  - pas encore de run authentifie bout a bout apres deploy
  - pas encore de preuve visuelle in-app qu'un brief hybride traverse bien le hub sans aucun choix force
  - les anciennes apps persistent en mode legacy/fallback jusqu'a regeneration si elles ont ete creees avant ce contrat
- Intention exacte:
  - faire de Cowork un createur d'apps qui se definissent elles-memes
  - releguer le backend a son vrai role:
    - safety
    - validation
    - fallback
    - compatibilite legacy
  - ne plus injecter localement une vision produit que Cowork devrait decider lui-meme

## Mise a jour complementaire - 2026-04-02 (duel audio generated app + clarification initiale + host audio premium)
- Besoin traite:
  - l'utilisateur confirme que `Produire maintenant` sort bien quelque chose sur `IA Duel Podcast`, mais releve 2 defauts majeurs:
    - la presentation audio est laide / trop plate
    - le fond produit est faux: il veut 2 IA qui debattent, pas une chronique solo
  - il demande aussi une phase de clarification initiale type "choix recommandes + autre direction" avant generation
- Cause racine confirmee:
  - une app `podcast` n'etait pas assez specialisee quand son besoin reel etait `debat`
  - le manifest pouvait garder un schema generique et le runtime pouvait laisser `create_podcast_episode` partir sans speakers ni camps explicites
  - le host generated app affichait encore les artefacts audio comme une liste brute, sans mise en scene de master final
- Correctifs appliques:
  - `server/lib/generated-apps.ts`
    - ajout de helpers semantiques pour reconnaitre l'intention `debat/duel`
    - specialisation du manifest generated app en schema contradictoire:
      - `topic`
      - `stance_a`
      - `stance_b`
      - `debate_frame`
      - `duration`
    - enrichissement des capabilities et du `systemInstruction` pour interdire la chronique solo
  - `api/index.ts`
    - ajout de helpers runtime `isDebateGeneratedApp()` + `buildDebatePodcastRuntimeDefaults()`
    - `applyRuntimeMediaToolDefaults()` accepte maintenant `runtimeApp` + `runtimeAppFormValues`
    - pour `create_podcast_episode`, injection automatique d'un vrai brief de duel, de la duree et de 2 speakers si l'app est un debat
    - meta outil enrichie avec `speakerMode`, `speakerNames`, `speakerVoices`
  - `src/App.tsx`
    - le prompt de lancement generated app renforce explicitement l'interdiction de la chronique solo pour les apps de debat
  - `shared/generated-app-sdk.tsx`
    - ajout d'un featured artifact audio `Master audio`
    - lecteur embarque, waveform decoratif, chips de meta, actions `Ouvrir` / `Telecharger`
  - `src/components/AgentsHub.tsx`
    - ajout d'une premiere couche de clarification avant la creation generated app
    - choix recommandes + voie libre `Autre direction`
- Tests / validations effectues:
  - `npm run lint` : OK
  - `npx tsx test-generated-app-manifest.ts` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npm run build` : OK
  - validation visuelle locale via harness Vite:
    - `generated-app-host-debate-apr02-vite.png` valide la nouvelle carte audio
    - `cowork-apps-creation-apr02-vite.png` valide le harness creation, mais pas encore la vraie clarification utilisateur
- Fichiers modifies:
  - `api/index.ts`
  - `server/lib/generated-apps.ts`
  - `shared/generated-app-sdk.tsx`
  - `src/App.tsx`
  - `src/components/AgentsHub.tsx`
  - `test-cowork-loop.ts`
- Limites restantes:
  - pas de redeploiement dans cette session
  - pas de run authentifie complet rejoue dans la vraie app
  - la capture clarification reste partielle: le code est la, mais l'UI reelle connectee reste a confirmer
- Intention exacte:
  - faire en sorte qu'une app generee "debat audio" soit specialisee jusqu'au bout:
    - creation mieux cadree
    - runtime reellement duo
    - sortie audio lisible comme un vrai master final

## Mise a jour complementaire - 2026-04-02 (generated apps podcast / les modeles configures doivent devenir des defaults reels d'outils)
- Besoin traite:
  - l'utilisateur signale qu'en cliquant sur `Produire maintenant` dans une generated app podcast, le chargement semble tourner dans le vide puis ne rien livrer
  - il demande aussi si Cowork genere vraiment les apps avec les bons outils
- Investigation reelle:
  - smoke prod direct `POST https://vertex-ai-app-pearl.vercel.app/api/generated-apps/create/stream`:
    - phases observees: `brief_validated -> spec_ready -> source_ready -> bundle_skipped -> manifest_ready`
    - le manifest cree pour `IA Duel Podcast` est bien de type `podcast`
  - smoke prod direct `POST /api/cowork` avec cette generated app:
    - `create_podcast_episode` puis `release_file` executes avec succes
    - un evenement `released_file` est bien emis avec URL signee audio
    - conclusion: le backend prod sait reellement creer et publier une app podcast, puis produire un master final
  - en revanche, l'audit du code a revele 2 incoherences locales:
    - `server/lib/generated-apps.ts` acceptait une `toolAllowList` podcast trop large, pouvant laisser passer des outils parasites comme `write_file`
    - `api/index.ts` n'utilisait `modelProfile.ttsModel|musicModel|imageModel` que comme hint prompt; si le modele n'explicitait pas l'argument d'outil, les outils media retombaient silencieusement sur leurs defaults globaux
- Cause racine confirmee:
  - la generated app etait bien specialisee produitement, mais sa configuration runtime n'etait pas pleinement contraignante
  - resultat concret observe en smoke:
    - une app creee avec `ttsModel: gemini-2.5-flash-tts` pouvait quand meme lancer `create_podcast_episode` en `gemini-2.5-pro-tts`
- Correctifs appliques:
  - `server/lib/generated-apps.ts`
    - ajout d'une curation des outils par `outputKind`
    - pour `podcast`, `create_podcast_episode` + `release_file` deviennent des outils obligatoires
    - les outils parasites hors famille (ex: `write_file`) sont filtres a la sanitisation
  - `api/index.ts`
    - ajout du helper `applyRuntimeMediaToolDefaults()`
    - injection des defaults `modelProfile` d'une generated app dans:
      - `generate_image_asset`
      - `generate_tts_audio`
      - `generate_music_audio`
      - `create_podcast_episode`
    - le meta/log des appels d'outils reflète aussi maintenant les modeles effectifs
  - tests:
    - `test-cowork-loop.ts` couvre les defaults runtime des outils media
    - `test-generated-app-manifest.ts` couvre l'ecartement de `write_file` sur une app podcast
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-generated-app-manifest.ts` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - smoke serveur local ephemere sur `:3001`:
    - `create_podcast_episode` finit par reussir
    - le `ttsModel` effectif observe est maintenant bien `gemini-2.5-flash-tts`
    - `release_file` publie bien un MP3 signe
- Limites restantes:
  - le patch a ete valide localement, pas deploye en production dans cette session
  - la vraie UI authentifiee n'a pas ete rejouee visuellement ici a cause du blocage Playwright MCP Windows
  - le symptome exact de l'utilisateur n'a donc pas ete reproduit pixel pour pixel, mais le flux backend prod a ete prouve et le principal ecart de configuration runtime a ete corrige localement
- Intention exacte:
  - faire en sorte qu'une generated app ne soit pas seulement une belle coquille UI, mais qu'elle execute reellement les bons outils avec les bons modeles

## Mise a jour complementaire - 2026-04-02 (prod Vercel / crash global de la function resolu)
- Besoin traite:
  - l'utilisateur remonte un popup `Erreur d'envoi : Server returned 500` dans le chat standard et dans Cowork
  - le badge Vertex AI en sidebar donne l'impression que Vertex est deconnecte
- Cause racine confirmee:
  - les logs Vercel de `vertex-ai-app-pearl.vercel.app` montrent un crash au boot sur `generated-app-sdk`:
    - premier etat: `Cannot find module '/var/task/src/generated-app-sdk.tsx'`
    - premier redeploy trop etroit: `Cannot find module '/var/task/src/generated-app-sdk.js'`
  - `api/index.ts` importe `server/lib/generated-apps.ts` au chargement
  - la vraie cause n'etait pas seulement l'extension, mais la dependance serverless a un module frontend local utilise uniquement pour le bundle generated app diagnostique
  - comme cette dependance vivait au chargement du module, toute la function serverless plantait avant meme la route `/api/status`
- Correctifs appliques:
  - `server/lib/generated-apps.ts`
    - suppression de la dependance runtime a `generated-app-sdk`
    - `renderGeneratedAppSource()` reecrit en composant React autonome et self-contained pour le bundle diagnostique
  - `shared/generated-app-sdk.tsx` / `src/generated-app-sdk.tsx`
    - le canvas natif reste cote frontend via un petit re-export stable
  - `shared/generated-app-bundle.ts`
    - detection `bundle skipped` rendue compatible avec les vieux logs `.tsx` et les nouveaux `.js`
  - `test-generated-app-bundle-state.ts`
    - fixture de regression alignee sur le nouveau chemin de diagnostic
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - `npx tsx test-generated-app-bundle-state.ts` : OK
  - `npx tsx test-generated-app-stream.ts` : OK
  - `npx vercel build` : OK
  - inspection du bundle Vercel local:
    - `.vercel/output/functions/api/index.func/server/lib/generated-apps.js` ne reference plus `generated-app-sdk`
  - redeploy production effectue
  - probes HTTP prod:
    - `GET /api/status` : 200
    - `POST /api/chat` : 200
    - `POST /api/cowork` : 200
- Limites restantes:
  - il reste a verifier l'UI reelle apres refresh pour confirmer que le badge Vertex se recale bien et que les popups 500 ont disparu visuellement
  - le flux generated app authentifie complet reste a rejouer maintenant que l'API prod boote a nouveau
- Intention exacte:
  - eliminer durablement le crash global au boot de la function prod
  - sortir le bundle generated app diagnostique du chemin critique de survie de l'API

## Mise a jour complementaire - 2026-04-01 (bundle generated app reclasse en `skipped` quand seul l'environnement empaquete manque)
- Besoin traite:
  - l'utilisateur voit encore des drafts generated app en faux echec bundle avec:
    - `Could not resolve "./src/generated-app-sdk.tsx"`
    - `Could not resolve "react/jsx-runtime"`
  - produitement, cela donne une alerte rouge alors que le preview natif et la publication restent fonctionnels
- Cause racine confirmee:
  - `server/lib/generated-apps.ts` faisait resoudre `esbuild` depuis `process.cwd()`, trop fragile en environnement empaquete
  - les erreurs de resolution connues du SDK partage / runtime React n'etaient pas distinguees d'un vrai echec applicatif
  - le contrat SSE/frontend ne connaissait que `bundle_ready` ou `bundle_failed`
- Correctifs appliques:
  - `shared/generated-app-bundle.ts`
    - normalisation partagee du statut bundle
    - detection des erreurs d'environnement connues (`generated-app-sdk`, `react/jsx-runtime`, `lucide-react`)
  - `server/lib/generated-apps.ts`
    - `absWorkingDir` et `resolveDir` derives de `import.meta.url`
    - import reelle de `../../src/generated-app-sdk.tsx` pour forcer la presence du SDK partage dans le package server
    - reclassement des erreurs d'environnement en `bundleStatus='skipped'`
    - nouveau phase SSE `bundle_skipped`
  - `src/types.ts` / `src/App.tsx`
    - prise en charge du nouveau phase `bundle_skipped`
  - `src/utils/generatedAppSnapshots.ts`
    - normalisation locale des anciennes drafts `failed` -> `skipped` quand le log correspond seulement au skip d'environnement
  - `src/components/GeneratedAppHost.tsx`
    - diagnostic affiche seulement sur vrai `bundle failed`
    - copy neutre pour `bundle skipped`
  - tests:
    - ajout de `test-generated-app-bundle-state.ts`
    - `test-generated-app-stream.ts` passe maintenant par `bundle_skipped`
    - `test-generated-app-lifecycle.ts` conserve un vrai scenario `bundle failed`
- Verification effectuee:
  - pas encore rejouee au moment de cette note dans la vraie app authentifiee
  - la verification code locale ciblee reste a lancer apres patch:
    - `npm run lint`
    - `npm run build`
    - `npx tsx test-generated-app-manifest.ts`
    - `npx tsx test-generated-app-bundle-state.ts`
    - `npx tsx test-generated-app-lifecycle.ts`
    - `npx tsx test-generated-app-stream.ts`
- Limites restantes:
  - il faut encore confirmer sur une vraie draft deja persistée que le sanitize/frontend la rehydrate bien en `skipped`
  - d'autres erreurs de resolution non repertoriees peuvent encore remonter en vrai `failed`
- Intention exacte:
  - ne plus afficher un faux rouge quand seul le bundle optionnel est saute sur l'environnement serverless
  - garder une signalisation rouge uniquement pour un vrai echec de build applicatif

## Mise a jour complementaire - 2026-04-01 (generated apps stabilisees + creation visible en direct)
- Besoin traite:
  - le preview generated app cassait en prod a cause du bundling runtime dans la function backend empaquetee
  - l'utilisateur veut voir la creation d'app se faire visuellement dans `Cowork Apps`
- Cause racine confirmee:
  - le bundling de draft s'appuyait sur des modules frontend non garantis dans la function serverless packagee
  - le host faisait encore du bundle charge le chemin principal de rendu
  - `Cowork Apps` n'exposait qu'un spinner binaire, pas une vraie creation visible
- Correctifs appliques:
  - `server/lib/generated-apps.ts`
    - `bundleStatus` ajoute au contrat version
    - succes bundle nettoye: plus de faux `buildLog` positif
    - sanitation des vieux `status='failed'` vers `draft` quand une source reste exploitable
    - `publishGeneratedApp()` n'exige plus de bundle
  - `server/routes/standard.ts`
    - extraction de `streamGeneratedAppCreation()`
    - route SSE `POST /api/generated-apps/create/stream`
  - `src/App.tsx`
    - parsing SSE durci avec garde de type
    - `generatedAppCreationRun` hydrate la timeline de creation
  - `src/components/GeneratedAppHost.tsx`
    - preview natif canonique via `GeneratedAppCanvas`
    - bundle charge seulement comme diagnostic secondaire
  - `src/components/AgentsHub.tsx`
    - panneau `Creation visible` branche aux vraies phases backend
    - rehierarchisation du labo de creation:
      - formulaire compact quand une creation est en cours
      - creation prioritaire sur mobile
      - preview d'app remonte avant la timeline pour rendre la materialisation visible
  - `tmp/cowork-apps-preview.tsx`
    - nouvelles vues harness:
      - `?view=creation`
      - `?view=generated-host`
  - nouveaux tests:
    - `test-generated-app-lifecycle.ts`
    - `test-generated-app-stream.ts`
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - `npx tsx test-generated-app-manifest.ts` : OK
  - `npx tsx test-generated-app-lifecycle.ts` : OK
  - `npx tsx test-generated-app-stream.ts` : OK
  - captures Edge headless:
    - `C:\Users\Yassine\AppData\Local\Temp\cowork-apps-creation-desktop-apr01-v3.png`
    - `C:\Users\Yassine\AppData\Local\Temp\cowork-apps-creation-mobile-apr01-v3.png`
    - `C:\Users\Yassine\AppData\Local\Temp\generated-app-host-desktop-apr01.png`
    - `C:\Users\Yassine\AppData\Local\Temp\generated-app-host-mobile-apr01.png`
- Limites restantes:
  - le flux complet authentifie `create -> open -> run -> publish -> update draft` reste a observer dans la vraie app
  - les captures actuelles restent des preuves harness, pas encore des preuves Firestore/Gemini reelles
- Intention exacte:
  - rendre le host produit robuste meme quand le bundle tombe
  - transformer la creation generated app en scene visible et stylisee plutot qu'en attente opaque

## Mise a jour complementaire - 2026-04-01 (`Cowork Apps` ne crash plus a la creation et la scene respire enfin)
- Besoin traite:
  - l'utilisateur a remonte un popup bloquant pendant la creation d'apps dans `Cowork Apps`
  - en plus du bug, il jugeait l'interface trop serree, avec des textes coupes et une impression de scene etouffee
- Cause racine confirmee:
  - `server/lib/generated-apps.ts` lisait `options.length` dans `sanitizeFields()` meme quand le champ `uiSchema` n'etait pas un `select`
  - une generated app avec `textarea` / `text` cassait donc `/api/generated-apps/create` avant meme l'insertion dans le store
  - cote frontend, le hub et plusieurs surfaces supposaient encore des arrays toujours presents (`uiSchema`, `tools`, `capabilities`, `toolAllowList`)
  - la composition `AgentsHub` etait trop dense pour un viewport desktop reel de type `1440x900`
- Correctifs appliques:
  - `server/lib/generated-apps.ts`
    - garde sur `options.length` dans `sanitizeFields()`
  - `test-generated-app-manifest.ts`
    - nouveau test de regression sur un manifest avec champs non-`select`
  - `src/utils/agentSnapshots.ts`
    - export de `normalizeAgent()`
  - `src/utils/generatedAppSnapshots.ts`
    - export de `normalizeGeneratedApp()`
  - `src/App.tsx`
    - normalisation plus dure des agents/apps au moment de l'adaptation, de la persistance et de la rehydratation workspace
  - `src/components/AgentAppPreview.tsx`
    - garde sur `uiSchema`
  - `src/components/AgentWorkspacePanel.tsx`
    - garde sur `capabilities` et `tools`
  - `src/generated-app-sdk.tsx`
    - garde sur `manifest.uiSchema`
  - `src/components/AgentsHub.tsx`
    - hero plus court
    - cartes plus larges et moins bavardes
    - labo de creation simplifie
    - compaction sur viewport court
    - suppression du bloc `Derniers projets` sur les hauteurs desktop trop serrees
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - `npx tsx test-generated-app-manifest.ts` : OK
  - captures Edge headless via harness:
    - desktop: `C:\Users\Yassine\AppData\Local\Temp\cowork-apps-hub-apr01-desktop-fix-v3.png`
    - mobile: `C:\Users\Yassine\AppData\Local\Temp\cowork-apps-hub-apr01-mobile-fix-v3.png`
- Limites restantes:
  - le flux reel authentifie `create -> open -> run -> publish -> update` reste a rejouer dans la vraie app
  - le rendu mobile a ete nettoye et ne coupe plus les textes visibles, mais merite encore une revalidation produit dans le shell complet
- Intention exacte:
  - tuer le bug a sa vraie source serveur
  - blinder le store contre les manifests partiels
  - transformer `Cowork Apps` en scene plus calme et plus lisible, sans copy tronquee

## Derniere mise a jour
- Date: 2026-03-29
- Contexte: chantier Cowork / Hub Agents

## Mise a jour complementaire - 2026-04-01 (`Nasheed Studio` / generated apps ne doivent plus devenir un faux accueil)
- Besoin traite:
  - l'utilisateur est bloque quand il revient depuis `Nasheed Studio` ou une generated app
  - le hub `Cowork Apps` s'ouvrait, mais la session app restait en fond et donnait l'impression que `Nasheed Studio` etait devenu l'accueil
  - fermer le hub pouvait renvoyer immediatement dans la meme app au lieu de revenir a une vraie surface d'accueil
- Cause racine confirmee:
  - `src/App.tsx` passait bien `setActiveMode('cowork')` + `setShowAgentsHub(true)` depuis `onBackToHub`
  - mais cela ne reactualisait pas la session active ; la session `agent-*` / `gapp-*` restait selectionnee
  - le hub etait donc affiche comme une surcouche sur une app encore active, pas comme un vrai retour d'accueil
- Correctifs appliques:
  - `src/App.tsx`
    - ajout du helper `openCoworkAppsHome()`
    - ce helper appelle `activateMode('cowork')` avant d'ouvrir `showAgentsHub`, ce qui rebascule aussi la session active vers la vraie surface Cowork (session preferee ou `local-new`)
    - les callbacks `onBackToHub` de `NasheedStudioWorkspace` et `GeneratedAppHost` utilisent maintenant ce helper commun
  - `src/components/NasheedStudioWorkspace.tsx`
    - libelle du bouton clarifie en `Retour a l'accueil`
  - `src/components/GeneratedAppHost.tsx`
    - libelle du bouton clarifie en `Retour a l'accueil`
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
- Limites restantes:
  - le flow reel authentifie `app ouverte -> Retour a l'accueil -> fermeture du hub` n'a pas encore ete rejoue dans la vraie app locale
  - la validation visuelle reste partielle ici a cause des limites outils/auth locales
- Intention exacte:
  - faire du retour accueil un vrai changement de surface et de session, pas juste un overlay
  - eviter que `Nasheed Studio` ou une generated app donne l'impression d'etre devenue la page d'accueil du produit

## Mise a jour complementaire - 2026-04-01 (pivot `generated app` deploye de bout en bout)
- Besoin traite:
  - l'utilisateur veut que Cowork cree une vraie app experte "comme lui", avec son propre systeme, ses outils, son UI et un rendu sans chat generique
  - il ne veut plus seulement un agent du hub, mais un mini-produit deployable avec draft/live
- Cause racine confirmee:
  - l'architecture precedente etait encore centree sur le blueprint d'agent (`Hub Agents` + `AgentWorkspacePanel`)
  - meme quand l'UX devenait plus "app", le contrat de donnees restait celui d'un specialiste legacy, sans source/bundle versionnes ni cycle `preview -> publish`
  - `/api/cowork` savait faire tourner Cowork ou un agent, mais pas une app experte avec allowlist/model profile propre
- Correctifs appliques:
  - contrat / types:
    - `src/types.ts`
      - nouveaux types `GeneratedAppManifest`, `GeneratedAppVersion`, `GeneratedAppWorkspaceState`, `GeneratedAppModelProfile`, `GeneratedAppRuntimeDefinition`
      - ajout de `sessionKind='generated_app'`
    - `server/lib/schemas.ts`
      - schemas `GeneratedAppCreateSchema`, `GeneratedAppManifestSchema`, `GeneratedAppPublishSchema`, `GeneratedAppRuntimeSchema`
  - backend generated app:
    - `server/lib/generated-apps.ts`
      - generation du spec JSON via Gemini 3.1 Flash Lite
      - sanitation du manifest, allowlist, model profile et direction visuelle
      - rendu d'un vrai fichier TSX
      - bundling ESM navigateur via `esbuild`
      - upload best effort de la source et du bundle
      - cycle `draft | published | failed`
    - `server/routes/standard.ts`
      - nouvelles routes `POST /api/generated-apps/create` et `POST /api/generated-apps/publish`
  - runtime Cowork:
    - `api/index.ts`
      - nouveaux outils `create_generated_app` et `update_generated_app`
      - prise en charge de `generatedApps` et `appRuntime` dans `/api/cowork`
      - nouveau prompt runtime pour app experte : "Tu es cette app experte, concue par Cowork"
      - tool filtering par `toolAllowList`
      - priorite modeles via `modelProfile.textModel`
      - emission SSE `generated_app_manifest`
  - frontend:
    - `src/generated-app-sdk.tsx`
      - mini-SDK de rendu partage pour les bundles generes
    - `src/components/GeneratedAppHost.tsx`
      - host plein ecran avec badges draft/live, etats d'erreur bundle, run/publish/evolution
    - `src/utils/generatedAppBundle.ts`
      - chargement dynamique du bundle ESM via blob URL
    - `src/utils/generatedAppSnapshots.ts`
      - cache local-first des generated apps
    - `src/App.tsx`
      - store `generatedApps`
      - sync Firestore `users/{uid}/generatedApps`
      - ouverture des generated apps dans `GeneratedAppHost`
      - relance via `appRuntime`
      - publication de la draft
      - edition Cowork = nouvelle draft sur le meme `id`
    - `src/components/SidebarLeft.tsx`
      - section `Apps` dans l'historique
    - `src/utils/sessionRecovery.ts` / `src/utils/sessionShells.ts`
      - prise en charge des sessions `gapp-*` et nettoyage des gros payloads `sourceCode` / `bundleCode`
    - `firestore.rules`
      - `generatedAppWorkspace`
      - collection `generatedApps`
      - `sessionKind='generated_app'`
  - stabilisation de reprise:
    - `src/App.tsx`
      - ajout de `hasLoadedRemoteAgents` et `hasLoadedRemoteGeneratedApps`
      - la reparation des sessions orphelines attend maintenant que les catalogues agents/apps soient charges avant de reconstruire les workspaces
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - smoke shell local deja observe sur `http://127.0.0.1:3000` : HTTP 200
- Limites restantes:
  - pas encore de capture visuelle fiable du `GeneratedAppHost` sur cette machine
  - le flux produit reel `create -> open -> run -> publish -> update draft` reste a rejouer dans une vraie session authentifiee
  - les agents legacy existent encore ; la trajectoire produit privilegie maintenant les generated apps mais le code garde les deux chemins
- Intention exacte:
  - sortir definitivement de la logique "Cowork cree un agent du hub"
  - faire de Cowork un generateur de mini-produits experts, chacun avec sa propre surface, son propre runtime et son propre lifecycle de publication

## Mise a jour complementaire - 2026-04-01 (`Nasheed Studio` passe en version epuree)
- Besoin traite:
  - l'utilisateur rejette la premiere version du studio musical dedie: trop de texte, pas assez esthetique
  - il faut garder le vrai studio Nasheed, mais avec une hierarchie plus nette et une scene moins bavarde
- Cause racine confirmee:
  - `src/components/NasheedStudioWorkspace.tsx` empilait trop de copy de contexte entre header, hero, lancement et rail droit
  - les aides de champs et les paragraphes d'explication noyaient la vraie matiere du morceau
  - la composition manquait d'un centre de gravite unique; tout demandait de lire plutot que de sentir la surface
- Correctifs appliques:
  - `src/components/NasheedStudioWorkspace.tsx`
    - refonte complete de la hierarchie visuelle
    - header resserre: retour, nom, statut, pills
    - rail gauche compact: `Direction`, `Reglages`, `Session`
    - scene centrale recentree sur une headline courte, un wave bus et un plan compact
    - rail droit simplifie autour de `Sorties` et `Run`
    - coupe des longues explications et condensation des labels d'etat
  - memoire projet:
    - `NOW.md`
    - `DECISIONS.md`
    - `COWORK.md`
    - `QA_RECIPES.md`
    - `SESSION_STATE.md`
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - captures Edge headless via harness:
    - desktop: `C:\Users\Yassine\AppData\Local\Temp\nasheed-studio-desktop-apr01-v2.png`
    - mobile: `C:\Users\Yassine\AppData\Local\Temp\nasheed-studio-mobile-apr01-v2.png`
- Intention exacte:
  - faire sentir un vrai poste de composition, pas une page qui explique son propre fonctionnement
  - laisser la prochaine etape au niveau produit reel: vraie app, vraies donnees, vrai premier run audio/cover

## Mise a jour complementaire - 2026-04-01 (`Nasheed Studio` sort enfin du chat)
- Besoin traite:
  - l'utilisateur refuse que `Nasheed Studio` ouvre encore un chat ou un workspace agent trop generique depuis le hub
  - il veut une vraie interface specialisee de creation de nasheed avec Lyria 3, construite par Cowork
- Cause racine confirmee:
  - `openAgentWorkspace()` ouvrait toujours une session agent dans `mode: 'chat'`
  - `AgentWorkspacePanel` restait une bonne peau "app", mais pas assez radicalement differente d'un studio + conversation
  - le contrat agent ne distinguait pas encore une vraie famille `music`; tout le son creatif glissait vers `podcast`
- Correctifs appliques:
  - `src/types.ts`
    - ajout de `outputKind: 'music'`
  - `server/lib/agents.ts`
    - blueprints Cowork capables de generer de vraies apps `music`
    - UI schema par defaut pour un studio musical/Nasheed
    - outils par defaut recentres sur `generate_music_audio`, `generate_image_asset`, `release_file`
    - regles prompt corrigees: nasheed/chanson/Lyria => `music`, podcast/narration => `podcast`
  - `src/utils/agentStudio.ts`
    - detection des apps a rendre comme surface `nasheed`, y compris pour des apps historiques mal classees en `podcast`
  - `src/components/AgentAppPreview.tsx`
    - nouvelle famille visuelle `music`
    - previews et palettes reorientees `Nasheed Studio`
  - `src/components/NasheedStudioWorkspace.tsx`
    - nouvelle surface plein ecran dediee
    - colonne direction/reglages
    - hero central de composition
    - sorties recentes + journal Cowork non-chat
  - `src/App.tsx`
    - redirection des apps `nasheed/music` vers la nouvelle surface dediee
    - hint runtime Lyria 3 si le blueprint n'expose pas encore son propre select moteur
  - harness / memoire:
    - `tmp/cowork-apps-preview.tsx`
    - `QA_RECIPES.md`
    - `TECH_RADAR.md`
    - `DECISIONS.md`
    - `NOW.md`
    - `COWORK.md`
    - `SYSTEM_MAP.md`
    - `SESSION_STATE.md`
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - validation visuelle via harness `tmp/cowork-apps-preview.html?view=workspace`
  - captures Edge headless:
    - desktop: `C:\Users\Yassine\AppData\Local\Temp\nasheed-studio-desktop.png`
    - mobile: `C:\Users\Yassine\AppData\Local\Temp\nasheed-studio-mobile.png`
- Intention exacte:
  - faire sentir un vrai studio musical Cowork, pas un chat de delegation
  - donner a `Nasheed Studio` un contrat produit juste (`music`) et une surface coherente avec Lyria 3
  - laisser comme prochaine etape la revalidation sur une app persistee reelle dans le shell complet

## Mise a jour complementaire - 2026-04-01 (`Cowork Apps` recadre comme un vrai laboratoire Cowork)
- Besoin traite:
  - l'utilisateur a fourni une reference visuelle explicite et veut que le hub agent s'en rapproche franchement
  - il fallait conserver le plein ecran et les flows deja valides, mais remplacer la composition actuelle par une scene plus "Cowork produit final"
- Cause racine confirmee:
  - `src/components/AgentsHub.tsx` etait deja premium, mais encore trop minimal dans sa structure
  - il manquait les codes visuels de la reference: topbar avec recherche, hero statement tres fort, rail d'apps plus studio, panneau lateral de co-creation
- Correctifs appliques:
  - `src/components/AgentsHub.tsx`
    - topbar utilitaire avec recherche locale des apps
    - hero editorial recentre sur un grand statement
    - rail bas d'apps recompose en cartes mini-studio avec CTA plus courts
    - panneau lateral avec vision, notes, type d'application et projets recents
    - compaction desktop/mobile pour garder le tout dans un rendu propre
  - `QA_RECIPES.md`
    - attendus visuels enrichis pour couvrir topbar, hero complet et panneau lateral
  - memoire projet:
    - `NOW.md`
    - `DECISIONS.md`
    - `COWORK.md`
    - `SESSION_STATE.md`
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - validation visuelle reelle via harness `tmp/cowork-apps-preview.html`
  - captures Edge headless:
    - desktop: `C:\Users\Yassine\AppData\Local\Temp\cowork-hub-reference-desktop-v4.png`
    - mobile: `C:\Users\Yassine\AppData\Local\Temp\cowork-hub-reference-mobile-v4.png`
- Intention exacte:
  - faire sentir un vrai "Cowork app store + labo"
  - coller a la reference sans perdre les invariants produit deja verrouilles
  - laisser comme prochaine etape la revalidation sur donnees reelles dans le shell complet

## Mise a jour complementaire - 2026-04-01 (startup auth durci pour la validation reelle)
- Besoin traite:
  - en voulant revalider la vraie app locale, le shell restait bloque sur `Chargement du studio...` dans le navigateur headless
  - tant que ce spinner ne tombait pas, impossible meme d'atteindre proprement l'empty state ou de preparer une validation reelle de `Cowork Apps`
- Cause racine confirmee:
  - `src/App.tsx` dependait integralement du callback `onAuthStateChanged(auth, ...)` pour sortir du spinner
  - dans l'environnement headless local, ce callback pouvait tarder ou ne pas revenir assez vite, laissant `isAuthReady=false` indefiniment
- Correctifs appliques:
  - `src/App.tsx`
    - ajout d'un fallback timeout autour de l'initialisation auth
    - si Firebase Auth ne repond pas rapidement, l'app bascule quand meme vers le shell/empty state au lieu de rester bloquee
    - le vrai callback auth garde la priorite s'il arrive ensuite
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - validation visuelle reelle via Edge headless sur la vraie app locale `http://127.0.0.1:3000`
    - avant fix: spinner infini `Chargement du studio...`
    - apres fix desktop: shell + topbar + empty state chat visibles
    - apres fix mobile: shell visible, plus de spinner infini
  - captures utiles:
    - desktop apres fallback auth: `C:\Users\Yassine\AppData\Local\Temp\cowork-real-app-desktop-after-auth-fallback.png`
    - mobile apres fallback auth: `C:\Users\Yassine\AppData\Local\Temp\cowork-real-app-mobile-after-auth-fallback.png`
- Limite restante:
  - la validation reelle de `Cowork Apps` elle-meme reste bloquee sans session Google/authentifiee dans ce contexte de capture headless
  - le fix auth doit encore etre observe une fois dans un navigateur normal pour verifier qu'il reste invisible quand Firebase repond normalement
- Fichiers touches:
  - `src/App.tsx`
  - `NOW.md`
  - `AI_LEARNINGS.md`
  - `SESSION_STATE.md`
- Intention exacte:
  - transformer un blocage de QA en etat de repli propre
  - garantir qu'un probleme d'initialisation auth ne masque pas toute la surface de l'app

## Mise a jour complementaire - 2026-04-01 (`Cowork Apps` tient enfin dans l'ecran et pagine les apps)
- Besoin traite:
  - l'utilisateur ne voyait pas toute la page du lobby et ne pouvait pas descendre
  - il voulait un lobby qui prenne tout l'ecran sans scroll, avec des fleches si trop d'apps doivent etre montrees
- Cause racine confirmee:
  - `src/components/AgentsHub.tsx` etait deja en plein ecran, mais sa pile verticale restait trop haute: hero, spotlight, grille d'apps et creation s'empilaient encore
  - `overflow-hidden` masquait le symptome sans corriger le budget de hauteur reel
  - le CTA d'ouverture restait trop bas, donc il pouvait disparaitre du viewport sur desktop standard
- Correctifs appliques:
  - `src/components/AgentsHub.tsx`
    - passage a un vrai layout `h-[100dvh]`
    - grille `auto / minmax(0,1fr) / auto` pour garder un centre respirant sans scroll
    - compactage pilote par `window.innerWidth` / `window.innerHeight`
    - dock d'apps pagine avec `page`, `pageSize`, `totalPages`
    - fleches gauche/droite pour changer de page quand il y a trop d'apps
    - page courante synchronisee automatiquement avec l'app selectionnee
    - footer desktop partage entre dock et creation via une grille laterale
    - CTA d'ouverture de l'app deplace dans l'en-tete du dock pour rester visible
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - validation visuelle reelle via harness local `tmp/cowork-apps-preview.html`
  - captures Edge headless validees:
    - desktop fit: `C:\Users\Yassine\AppData\Local\Temp\cowork-apps-lobby-desktop-fit.png`
    - mobile fit: `C:\Users\Yassine\AppData\Local\Temp\cowork-apps-lobby-mobile-fit.png`
  - constat cle:
    - desktop: dock + creation + CTA d'ouverture tiennent dans le viewport
    - mobile: la page tient sans scroll et les fleches apparaissent bien avec `Page 1/2`
- Fichiers touches:
  - `src/components/AgentsHub.tsx`
  - `NOW.md`
  - `QA_RECIPES.md`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `COWORK.md`
  - `SESSION_STATE.md`
- Intention exacte:
  - faire du lobby une vraie scene "poster" qui se voit en un coup d'oeil
  - eviter tout scroll masque ou CTA coupe
  - rendre la croissance du nombre d'apps propre grace a une pagination simple

## Mise a jour complementaire - 2026-04-01 (Hub Agents reframed en vrai app store Cowork)
- Besoin traite:
  - l'utilisateur a rejete le modele precedent: meme execute, le `Hub Agents` restait trop proche d'un catalogue technique d'agents
  - le besoin precise est un app store local d'apps creees par Cowork, avec plusieurs mini-produits et une interface propre a chaque app
- Cause racine confirmee:
  - `src/components/AgentsHub.tsx` exposait encore trop un vocabulaire et une structure de type "hub / agent / formulaire"
  - `src/components/AgentWorkspacePanel.tsx` ressemblait encore trop a un panneau agent generique
  - le systeme manquait d'une couche de preview partagee capable de rendre des familles d'apps visuellement distinctes a partir du meme contrat `StudioAgent`
- Correctifs appliques:
  - ajout de `src/components/AgentAppPreview.tsx`
    - previews/specimens d'app par `outputKind`
    - palettes derivees par app pour casser l'effet uniforme
    - helpers `getRenderableFields`, `createInitialFieldValues`, `getAgentAppMeta`, `getAgentPalette`
  - refonte de `src/components/AgentsHub.tsx`
    - hero/store `Cowork Apps`
    - apps featured + detail selectionne + vitrine/catalogue
    - creation guidee "forge une nouvelle app" au lieu d'un simple create-agent
  - refonte de `src/components/AgentWorkspacePanel.tsx`
    - studio d'app dedie avec poste de lancement et preview app-specifique
    - CTA et copy repositionnes pour parler d'app, pas d'agent
  - ajustements de copy dans `src/App.tsx`, `src/components/StudioEmptyState.tsx` et `server/lib/agents.ts`
    - runtime et create/edit flows requalifies en apps Cowork
  - correctif responsive:
    - CTA des surfaces hub/workspace empiles sur petit viewport pour eviter le clipping
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - validation visuelle reelle via harness local:
    - `tmp/cowork-apps-preview.html`
    - `tmp/cowork-apps-preview.tsx`
  - captures Edge headless validees:
    - store desktop haut: `C:\Users\Yassine\AppData\Local\Temp\cowork-apps-store-desktop-tall.png`
    - studio mobile complet: `C:\Users\Yassine\AppData\Local\Temp\cowork-apps-workspace-mobile-fullish.png`
  - constat cle:
    - le store se lit maintenant comme une vitrine d'apps
    - le studio mobile affiche bien le CTA sans clipping apres le fix
- Fichiers touches:
  - `src/components/AgentsHub.tsx`
  - `src/components/AgentWorkspacePanel.tsx`
  - `src/components/AgentAppPreview.tsx`
  - `src/components/StudioEmptyState.tsx`
  - `src/App.tsx`
  - `server/lib/agents.ts`
  - `NOW.md`
  - `SYSTEM_MAP.md`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `COWORK.md`
  - `QA_RECIPES.md`
  - `SESSION_STATE.md`
- Intention exacte:
  - faire sentir immediatement que Cowork construit des mini-produits utilisables, pas des agents abstraits
  - garder le runtime agentique existant, mais lui donner une peau produit beaucoup plus juste
  - laisser comme prochaine vraie etape la validation sur des apps reelles persistees, pas seulement sur fixtures locales

## Mise a jour complementaire - 2026-04-01 (`Cowork Apps` sort completement du shell)
- Besoin traite:
  - l'utilisateur trouvait encore le hub "degueulasse" et surtout trop serre
  - il voulait une sensation de vraie autre app: sidebars retirees, surface sublime, apps rendues comme icones + noms, et une seule barre de chatbox pour en creer une nouvelle
- Cause racine confirmee:
  - `AgentsHub` restait monte comme un overlay a l'interieur du shell standard
  - l'ancienne composition gardait encore trop de panneaux, de textes et de structures proches d'un dashboard
  - l'ouverture d'une app depuis le hub partait directement en auto-run, ce qui faisait du hub un poste de configuration/lancement trop lourd
- Correctifs appliques:
  - `src/App.tsx`
    - ajout d'un vrai mode de rendu plein ecran `isCoworkAppsView`
    - sidebars et shell principal non rendus quand `showAgentsHub` est actif
    - fermeture automatique des sidebars si on entre dans `Cowork Apps`
    - `openAgentWorkspace()` accepte maintenant `autoRun:false`
  - `src/components/AgentsHub.tsx`
    - refonte quasi totale en lobby minimaliste
    - hero/scene plein ecran
    - app selectionnee mise en avant
    - liste d'apps sous forme d'icones + noms
    - une seule chatbox de creation en bas
    - corrections responsive mobiles sur:
      - largeur de headline
      - grille d'icones
      - bloc de creation
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - captures Edge headless:
    - desktop: `C:\Users\Yassine\AppData\Local\Temp\cowork-apps-lobby-desktop.png`
    - mobile final: `C:\Users\Yassine\AppData\Local\Temp\cowork-apps-lobby-mobile-tall-v4.png`
  - constat cle:
    - le hub ressemble maintenant a une vue a part
    - la mobile view ne coupe plus ni la headline ni les icones
    - la creation est recentree sur une seule chatbox basse
- Fichiers touches:
  - `src/App.tsx`
  - `src/components/AgentsHub.tsx`
  - `NOW.md`
  - `SYSTEM_MAP.md`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `COWORK.md`
  - `QA_RECIPES.md`
  - `SESSION_STATE.md`
- Intention exacte:
  - transformer le hub en experience d'entree ultra simple et desiree
  - faire du hub un selecteur/createur d'apps, pas un outil de configuration dense
  - repousser le vrai travail de lancement dans le studio de l'app ouverte

## Mise a jour complementaire - 2026-03-31 (Cowork garde enfin la memoire textuelle du dernier livrable pour les follow-ups)
- Besoin traite:
  - l'utilisateur signalait qu'apres une generation reussie suivie d'un mauvais lien final, un simple "ton lien est mauvais" faisait souvent repartir Cowork presque comme au premier message
  - il fallait distinguer la vraie persistance UI de la memoire reellement reinjectee au modele au tour suivant
- Cause racine confirmee:
  - `src/utils/cowork.ts` et `src/App.tsx` persistaient bien `activity`, `runMeta` et `attachments`, donc l'UI gardait une trace riche du run
  - mais `src/utils/chat-parts.ts` reconstruisait l'historique API avec `content + attachments` seulement; aucune memoire textuelle du `release_file`, du `runState`, de `artifactState` ou des derniers `tool_result` n'etait renvoyee au modele
  - quand une piece jointe etait rehydratee en `inlineData`, l'URL signee exacte pouvait meme disparaitre du contexte textuel disponible pour le modele
  - `api/index.ts` relancait chaque nouveau `/api/cowork` avec un etat runtime frais; sans memoire structuree dans `history`, le modele n'avait pas assez d'ancrage pour corriger simplement le lien precedent
- Correctifs appliques:
  - `src/utils/chat-parts.ts`
    - ajout d'un mode `includeCoworkMemory`
    - ajout d'une synthese textuelle compacte pour les messages modele Cowork: `runState`, `phase`, `artifactState`, dernieres etapes utiles, URLs et metas des livrables deja presents
  - `src/App.tsx`
    - activation de `includeCoworkMemory: true` uniquement pour le chemin `/api/cowork` (et donc les workspaces agent)
  - `api/index.ts`
    - consigne systeme Cowork enrichie: si l'utilisateur signale un lien mauvais/expire/mal rendu, commencer par relire la memoire de conversation et reutiliser l'artefact deja cree/publie avant toute regeneration
  - `test-cowork-loop.ts`
    - ajout d'une regression qui verifie que `buildApiHistoryFromMessages(..., { includeCoworkMemory: true })` conserve bien l'URL publiee et le contexte `release_file`
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npm run build` : OK
- Fichiers touches:
  - `src/utils/chat-parts.ts`
  - `src/App.tsx`
  - `api/index.ts`
  - `test-cowork-loop.ts`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `SESSION_STATE.md`
  - `COWORK.md`
- Intention exacte:
  - faire la difference entre "le produit garde une trace" et "le modele recoit vraiment la memoire utile"
  - permettre a Cowork de corriger un mauvais lien ou de reutiliser un livrable deja publie sans rejouer inutilement toute la mission
  - rester modele-led tout en rendant la memoire inter-tours concretement exploitable

## Mise a jour complementaire - 2026-03-31 (livrables Cowork medias previewables dans la page)
- Besoin traite:
  - l'utilisateur voulait que Cowork livre ses produits generes directement dans la conversation
  - il fallait une vraie preview in-page pour les formats media (`mp3`, `mp4`, etc.), avec ouverture dans un nouvel onglet et telechargement
- Cause racine confirmee:
  - `api/index.ts` n'emetait aucun evenement SSE riche quand `release_file` publiait un fichier; le message final restait surtout un lien texte
  - `release_file` renvoyait seulement `url` + `message`, sans `mimeType`, `fileName` ni type de media exploitable cote frontend
  - `src/utils/cowork.ts` ne savait pas transformer une publication de fichier en `attachments` persistantes sur le message Cowork
  - `src/components/AttachmentGallery.tsx` affichait deja la preview, mais l'audio n'avait ni bouton `Ouvrir` ni `Telecharger`, et la video n'avait pas d'ouverture en nouvel onglet
  - `server/lib/path-utils.ts` ne reconnaissait pas encore plusieurs mimes de livraison reellement utiles (`.mp4`, `.webm`, `.mov`, `.m4a`, etc.)
- Correctifs appliques:
  - `shared/released-artifacts.ts`
    - nouveau helper partage pour inferer le type de livrable publie (`image`, `video`, `audio`, `document`)
    - derive aussi un nom propre de fichier a partir du `fileName`, du `path` ou de l'URL
  - `api/index.ts`
    - `release_file` renvoie maintenant `path`, `fileName`, `mimeType`, `attachmentType` et `fileSizeBytes`
    - ajout d'un payload partage de livrable publie + emission d'un nouvel evenement SSE `released_file`
    - `run_hub_agent` peut maintenant aussi remonter un livrable publie dans le meme mecanisme d'affichage
    - `tool_result` pour `release_file` affiche des metas plus utiles
  - `src/utils/cowork.ts`
    - ajout du type d'evenement `released_file`
    - hydratation du fichier publie dans `msg.attachments`
    - fusion/deduplication des attachments pour la persistence snapshot + rehydratation Firestore
  - `src/components/AttachmentGallery.tsx`
    - carte audio enrichie avec preview plus lisible et actions `Ouvrir` / `Telecharger`
    - carte video enrichie avec `Ouvrir` / `Telecharger`
    - harmonisation du nom de telechargement pour les documents
  - `server/lib/path-utils.ts`
    - ajout des mimes manquants pour les livraisons media frequentes
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - validation visuelle partielle:
    - un harness temporaire de preview a ete genere localement a partir du vrai composant `AttachmentGallery`
    - la capture navigateur automatisee via Playwright MCP reste bloquee par la permission Windows sur `C:\\Windows\\System32\\.playwright-mcp`
    - la capture OS de fenetre a ete tentee, mais Windows a systematiquement reactive un autre onglet Edge deja ouvert; pas de preuve visuelle fiable conservee pour cette session
- Fichiers touches:
  - `api/index.ts`
  - `server/lib/path-utils.ts`
  - `src/components/AttachmentGallery.tsx`
  - `src/utils/cowork.ts`
  - `shared/released-artifacts.ts`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `COWORK.md`
  - `SESSION_STATE.md`
- Intention exacte:
  - faire d'un `release_file` un vrai livrable visible et exploitable dans la conversation
  - conserver la logique modele-led de Cowork, sans auto-publication magique
  - rendre la livraison media plus premium et plus claire pour l'utilisateur final

## Mise a jour complementaire - 2026-03-31 (Lyria 3 / erreurs Cowork mieux classees)
- Besoin traite:
  - l'utilisateur signalait que certaines requetes musique Cowork "n'y arrivaient pas" sans raison claire
  - un run Lyria 3 pouvait enchainer un blocage policy puis un `Internal server error`, avant que l'anti-boucle coupe tout
- Cause racine confirmee:
  - `api/index.ts` traitait encore `generate_music_audio` comme un scope global dans `getToolFailureScope`
  - `server/lib/google-genai.ts` ne classait pas `Internal server error` / `500` comme incident serveur retryable
  - `api/index.ts` ne considerait transitoires que `web_search` / `web_fetch`, donc un hoquet Lyria comptait a tort comme echec definitif
  - le tool `generate_music_audio` renvoyait un throw brut sur policy block, sans guidance de reformulation
- Correctifs appliques:
  - `api/index.ts`
    - ajout de `getCoworkToolFailureScope()` exporte pour les scopes d'echec plus fins
    - scope media par `model + prompt/intent family` pour `generate_music_audio` et autres tools media proches
    - ajout de `isTransientCoworkToolIssue()` exporte
    - `generate_music_audio` retourne maintenant un echec `recoverable:true` avec guidance si Lyria bloque le prompt par policy
    - consigne systeme Cowork enrichie pour simplifier les prompts Lyria bloques
  - `server/lib/google-genai.ts`
    - `retryWithBackoff()` reconnait maintenant `500`, `502`, `internal server error`, `timeout` comme erreurs serveur retryables
  - `server/lib/media-generation.ts`
    - ajout de `isLyriaPolicyBlockedError()`
  - tests:
    - `test-cowork-loop.ts` couvre maintenant aussi le scope musique, la classification transitoire et le retry `Internal server error`
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npx tsx test-podcast-media.ts` : OK
  - verification doc officielle Google:
    - Lyria 3 Vertex AI est bien documente au `2026-03-31` avec `lyria-3-pro-preview` / `lyria-3-clip-preview`
    - endpoint REST officiel confirme: `POST https://aiplatform.googleapis.com/v1beta1/projects/PROJECT_ID/locations/global/interactions`
- Fichiers touches:
  - `api/index.ts`
  - `server/lib/google-genai.ts`
  - `server/lib/media-generation.ts`
  - `test-cowork-loop.ts`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `SESSION_STATE.md`
- Intention exacte:
  - faire la difference entre un prompt musical mal formule et un incident infra temporaire
  - empecher l'anti-boucle de bloquer toute la musique sur deux echecs heterogenes
  - rendre les echecs Lyria 3 plus honnetes, plus explicables, et plus reformulables

## Mise a jour complementaire - 2026-03-31 (historique prioritaire, plus migre en barre haute)
- Besoin traite:
  - l'utilisateur trouvait encore l'historique trop resserre apres la premiere simplification
  - il ne voulait plus voir une "case" dediee pour le nouveau `+` dans la sidebar
  - il preferait un `+` discret, carre/rectangle, place soit en haut de l'ecran soit dans la barre haute
- Cause racine confirmee:
  - meme sans les `+` dupliques par mode, la grosse ligne CTA restait une bande verticale complete au-dessus de l'historique
  - la colonne gauche gardait encore trop de hauteur reservee au branding, aux modes et aux panneaux bas
- Correctifs appliques:
  - `src/App.tsx`
    - ajout de `activeModeCreateLabel`
    - ajout d'un bouton `+` carre contextuel dans la barre haute, a cote du menu
  - `src/components/SidebarLeft.tsx`
    - suppression totale de la ligne CTA "nouveau"
    - compaction supplementaire du branding
    - compaction des rows de modes (padding, icones, spacing)
    - reduction des paddings du panneau compte et du footer Vertex
    - conservation de la colonne presque uniquement pour modes + historique
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - tentative de validation visuelle locale:
    - capture Windows active-window relancee
    - limite: Edge a expose un autre onglet comme fenetre active, donc pas de preuve visuelle fiable du bon onglet pour cette ultime variante
- Fichiers touches:
  - `src/App.tsx`
  - `src/components/SidebarLeft.tsx`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `SESSION_STATE.md`
- Intention exacte:
  - donner un maximum de place verticale a l'historique
  - garder la creation de discussion visible mais beaucoup plus discrete
  - eviter toute surcharge en supprimant la grosse carte CTA de la colonne gauche

## Mise a jour complementaire - 2026-03-31 (sidebar gauche plus utile, historique elargi)
- Besoin traite:
  - l'utilisateur trouvait la zone historique trop petite dans la sidebar gauche
  - il voulait aussi supprimer les `+` dupliques sur chaque mode et n'en garder qu'un seul, adapte au mode actif
- Cause racine confirmee:
  - `src/components/SidebarLeft.tsx` consacrait trop de hauteur au haut de colonne: header large, espacement genereux, rows de mode assez hautes, et duplication d'un bouton `+` dans chaque mode
  - sur petit viewport, les labels des modes wrapaient plus vite et accentuaient encore la hauteur prise avant l'historique
- Correctifs appliques:
  - `src/components/SidebarLeft.tsx`
    - ajout de `modeActionCopy`
    - ajout de `activeModeMeta` / `ActiveModeIcon`
    - suppression des boutons `+` dans chaque ligne de mode
    - ajout d'un seul bouton contextuel `onNewChat` sous les modes
    - densification de la liste des modes (padding, gap, icones, spacing)
    - sidebar legerement elargie (`304px`) pour limiter les retours a la ligne parasites
    - header de l'historique simplifie avec compteur au lieu d'un second bouton `+`
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - verification visuelle locale:
    - capture Windows du rendu live via Edge: `C:\\Users\\Yassine\\AppData\\Local\\Temp\\codex-shot-2026-03-31_02-38-35.png`
    - constat: un seul bouton `+` visible, rows de modes plus compactes, historique remonte plus haut
- Fichiers touches:
  - `src/components/SidebarLeft.tsx`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `SESSION_STATE.md`
- Intention exacte:
  - faire de l'historique la vraie masse utile de la colonne
  - clarifier l'action "nouvelle discussion" en un seul point d'entree contextuel
  - rendre la sidebar plus dense et moins repetitive

## Mise a jour complementaire - 2026-03-31 (fin de reponse plus stable + thinking replie)
- Besoin traite:
  - l'utilisateur signalait un petit "sursaut" visuel quand le message IA se terminait
  - il voulait aussi que le volet thinking se ferme automatiquement a la livraison, sans disparaitre du message final
- Cause racine confirmee:
  - le chat standard rendait un bloc `streaming` separe, puis basculait ensuite vers le vrai `modelMessage`
  - a la fin du stream, le bloc temporaire pouvait disparaitre avant que Firestore ne rehydrate le message final, et ce message final rejouait en plus l'animation d'entree de `MessageItem`
  - `src/App.tsx` ouvrait explicitement les thoughts du message final avec `[modelMsgId]: true`
- Correctifs appliques:
  - `src/App.tsx`
    - ajout de `recentlyCompletedMessageId`
    - insertion immediate du `modelMessage` final dans `optimisticMessages` des la fin du stream
    - fermeture automatique de `streamingThoughtsExpanded`
    - etat des thoughts du message final initialise a `false`
    - passage d'un flag `disableEntranceAnimation` au rendu des messages normaux et virtualises
  - `src/components/MessageItem.tsx`
    - ajout de la prop `disableEntranceAnimation`
    - neutralisation de l'animation `initial` Motion pour le seul message qui sort du stream
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - limite de validation:
    - la verification navigateur automatisee reste bloquee localement par la permission Playwright MCP sur `C:\\Windows\\System32\\.playwright-mcp`
    - pas de capture visuelle automatique dans cette session
- Fichiers touches:
  - `src/App.tsx`
  - `src/components/MessageItem.tsx`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `SESSION_STATE.md`
- Intention exacte:
  - faire en sorte que la fin de reponse paraisse continue, sans rupture ni rebond
  - garder le thinking consultable, mais replie proprement par defaut une fois la reponse livree

## Mise a jour complementaire - 2026-03-31 (chat qui ne force plus la descente pendant une reponse)
- Besoin traite:
  - l'utilisateur signalait que quand le modele repondait a un message, l'ecran etait automatiquement force vers le bas
  - il ne voulait plus perdre sa position de lecture en remontant la conversation pendant le stream
- Cause racine confirmee:
  - `src/App.tsx` avait un `useEffect` qui appelait `messagesEndRef.current?.scrollIntoView(...)` a chaque variation de `streamingContent`, `streamingThoughts`, `displayedMessages.length` ou `isLoading`
  - ce comportement etait inconditionnel, donc meme si l'utilisateur remontait dans l'historique, le prochain chunk le ramenait immediatement en bas
- Correctifs appliques:
  - `src/App.tsx`
    - ajout de `AUTO_SCROLL_BOTTOM_THRESHOLD = 96`
    - ajout du helper `isScrolledNearBottom()`
    - remplacement de `scrollRef` par `parentRef` comme source de verite du scroll principal
    - ajout de `shouldAutoScrollRef` pour memoriser si le chat doit encore suivre le bas
    - ecoute du scroll utilisateur pour desactiver le suivi quand il quitte le bas
    - recentrage volontaire uniquement au changement de session
    - au moment de `handleSend`, conservation du suivi seulement si l'utilisateur etait deja proche du bas ou sur une conversation vide
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - `npm run start` local : OK, serveur demarre sur le port `3000`
  - limite de validation:
    - la verification navigateur interactive a ete tentee mais le MCP Playwright local est bloque par une permission Windows lors de la creation de `C:\\Windows\\System32\\.playwright-mcp`
    - je n'ai donc pas de preuve visuelle automatisee du comportement final dans cette session, meme si le correctif compile et que la logique de scroll est maintenant conditionnelle
- Fichiers touches:
  - `src/App.tsx`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `SESSION_STATE.md`
- Intention exacte:
  - laisser l'utilisateur lire librement l'historique pendant qu'une reponse arrive
  - conserver un comportement de chat fluide quand on reste deja en bas
  - eviter les descentes forcees sans casser l'ouverture normale des conversations

## Mise a jour complementaire - 2026-03-29 (chat long rendu sur 15 messages visibles max)
- Besoin traite:
  - l'utilisateur signalait qu'une conversation tres longue faisait lagger le shell et donnait un rendu ou les messages semblaient se superposer
  - il voulait voir seulement les 15 derniers messages, sans supprimer la conversation ni la memoire
- Cause racine confirmee:
  - `src/App.tsx` rendait toute la liste fusionnee `displayedMessages`, donc chaque long thread continuait a charger/rendre tout l'historique visible
  - un simple `slice(-15)` aurait casse `modifier` / `renvoyer`, car `MessageItem` envoie un index utilise ensuite par `handleEdit` et `handleRetry` sur l'historique complet
- Correctifs appliques:
  - `src/App.tsx`
    - ajout de `MESSAGE_VISIBILITY_LIMIT = 15`
    - conservation de `displayedMessages` comme historique complet fusionne
    - ajout de `visibleMessages`, `hiddenMessagesCount` et `visibleMessageOffset`
    - rendu limite aux 15 derniers messages dans les chemins virtualises et non virtualises
    - passage des index absolus aux `MessageItem` pour garder les actions coherentes
    - ajout d'un bandeau "Affichage allege" pour rassurer que les anciens messages restent bien conserves
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - validation visuelle locale:
    - capture desktop du shell buildé: OK
    - capture mobile Chromium du shell buildé: OK pour le chargement
  - limite restante:
    - la validation visuelle exacte du cas "thread authentifie avec >15 messages" n'a pas ete rejouee ici car la session de test automatisee n'embarque pas le compte utilisateur et donc pas l'historique Firestore reel
- Fichiers touches:
  - `src/App.tsx`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `SESSION_STATE.md`
- Intention exacte:
  - garder tout l'historique produit intact
  - alleger radicalement la surface visible du chat
  - eviter toute regression sur les actions de message existantes

## Mise a jour complementaire - 2026-03-29 (pieces jointes chat/cowork enfin exploitees)
- Besoin traite:
  - l'utilisateur voulait pouvoir envoyer des images, PDF et liens YouTube sans que le modele dise ensuite qu'il ne voit rien
  - il signalait aussi un rendu "bizarre" quand un lien etait colle dans le chat
  - le probleme devait etre corrige pour `chat & raisonnement` mais aussi pour `cowork` et les workspaces qui reutilisent le meme pipeline
- Cause racine confirmee:
  - `src/App.tsx` persistait bien les pieces jointes, mais `/api/chat` et `/api/cowork` reconstruisaient le tour courant a partir du texte seul et ignoraient `attachments`
  - l'historique etait encore plus fragile: une fois la `base64` retiree apres upload, le frontend reconstituait des `inlineData` vides, donc les anciennes images/PDF devenaient invisibles pour Gemini
  - les liens YouTube etaient convertis en faux `fileData video/mp4`, ce qui ne correspondait pas au vrai besoin produit
- Correctifs appliques:
  - nouveau contrat partage:
    - `shared/chat-parts.ts`
    - `src/utils/chat-parts.ts`
    - `server/lib/chat-parts.ts`
  - `src/App.tsx`
    - separation entre pieces jointes "riches" pour la requete courante et pieces jointes "light" pour la persistence
    - serialisation uniforme de l'historique via `buildApiHistoryFromMessages()`
    - envoi explicite des pieces jointes courantes au backend pour `chat` et `cowork`
  - `server/lib/schemas.ts`
    - schema `attachments` et `parts.attachment` durci
  - `server/routes/standard.ts`
    - `/api/chat` reconstruit maintenant les vraies parts multimodales via `buildModelContentsFromRequest()`
    - `/api/metadata` utilise d'abord l'oEmbed YouTube pour recuperer un titre propre
  - `api/index.ts`
    - `/api/cowork` reutilise le meme resoluteur de pieces jointes que le chat standard
  - `src/components/AttachmentGallery.tsx`
    - nouveau rendu visuel des images, PDF, audio, video et YouTube dans les messages
  - `src/components/MessageItem.tsx`
    - les messages utilisateur n'affichent plus seulement des chips opaques; ils montrent de vraies cartes de piece jointe
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - smoke backend reels:
    - `/api/chat` + image de test => `IMAGE TEST OK`
    - `/api/chat` + PDF de test => le modele retrouve `BONJOUR PDF TEST`
    - `/api/chat` + YouTube => le titre `Rick Astley - Never Gonna...` remonte
    - `/api/cowork` + PDF de test => la phrase `BONJOUR PDF TEST` est bien lue
  - validation Playwright:
    - le shell charge correctement apres build
    - la validation du flow chat authentifie reste partielle en local a cause de `auth/unauthorized-domain` sur Firebase Auth
- Fichiers touches:
  - `src/App.tsx`
  - `src/components/AttachmentGallery.tsx`
  - `src/components/MessageItem.tsx`
  - `src/utils/chat-parts.ts`
  - `server/lib/chat-parts.ts`
  - `server/lib/schemas.ts`
  - `server/routes/standard.ts`
  - `shared/chat-parts.ts`
  - `api/index.ts`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `BUGS_GRAVEYARD.md`
- Intention exacte:
  - faire en sorte qu'une piece jointe soit reellement lue par le modele, pas seulement affichee dans l'UI
  - rendre l'historique des pieces jointes robuste apres upload / rehydratation
  - assainir le rendu des liens/documents pour qu'il soit lisible et premium

## Mise a jour complementaire - 2026-03-29 (home chat epuree + glow typographique theme-aware)
- Besoin traite:
  - l'utilisateur trouvait l'image/hero de l'accueil chat trop chargee, pas assez belle et pas assez lisible
  - il voulait une home plus premium, plus calme, tres responsive, avec un petit effet d'ecritures lumineuses adapte au mode clair/sombre
  - contrainte forte: rester discret et privilegier les perfs, sans animations lourdes ni mini-dashboard parasite
- Cause racine confirmee:
  - `src/components/StudioEmptyState.tsx` etait construit comme une surface de demonstration avec plusieurs cartes secondaires animees
  - la home racontait trop de choses a la fois pour un simple ecran avant envoi de message
  - le signal visuel dependait trop de blocs UI et pas assez d'une composition calme avec une seule idee forte
- Correctifs appliques:
  - `src/components/StudioEmptyState.tsx`
    - refonte complete en poster state unique au lieu d'un mini-dashboard
    - headline resserree, CTA clarifie, suggestions raccourcies et plus sobres
    - rails d'information reduits a 3 points utiles
    - direction visuelle harmonisee pour tous les modes
  - `src/index.css`
    - ajout d'un systeme d'ecritures d'ambiance (`studio-empty-state__word*`) avec glow pilote par variables CSS
    - palettes distinctes pour sombre, light et oled via variables theme-aware
    - animation ultra legere sur l'opacite uniquement, avec `prefers-reduced-motion` respecte
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - captures reelles locales:
    - desktop sombre valide
    - mobile sombre valide
    - mobile light valide
  - validation navigateur:
    - `npx playwright screenshot --browser chromium ...` utilise pour verifier la home finale sur viewport desktop et mobile
- Fichiers touches:
  - `src/components/StudioEmptyState.tsx`
  - `src/index.css`
- Intention exacte:
  - faire disparaitre l'effet "trop de trucs sur l'image"
  - garder une home chat haut de gamme mais non intrusive
  - remplacer les animations de cartes par un fond typographique lumineux, lent et peu couteux

## Mise a jour complementaire - 2026-03-29 (empty state sans scroll + poster container-aware)
- Besoin traite:
  - l'utilisateur ne voulait aucune barre de defilement dans le panneau central tant qu'il n'y a pas encore de discussion
  - il voulait aussi que l'accueil se recale proprement selon la largeur reelle du centre, y compris quand les volets lateraux s'ouvrent ou se ferment
- Cause racine confirmee:
  - `src/App.tsx` rendait toujours un spacer de fin de messages (`messagesEndRef` en `h-32 / h-40`) meme quand l'historique etait vide
  - les `main` centraux dans le layout flex n'avaient pas `min-h-0`, ce qui laissait l'empty state depasser plus facilement
  - `src/components/StudioEmptyState.tsx` restait calibre avec une hauteur minimale trop rigide et une typo peu sensible a la largeur effective du panneau
- Correctifs appliques:
  - `src/App.tsx`
    - `main` central passe en `min-h-0`
    - scroll vertical verrouille quand `shouldShowEmptyState` est vrai
    - spacer `messagesEndRef` rendu seulement s'il y a des messages, un stream ou un statut actif
  - `src/components/StudioEmptyState.tsx`
    - section vide convertie en surface `h-full` au lieu d'une hauteur minimale rigide
    - headline passe en taille `clamp(...cqw...)` pour suivre la largeur du container
    - espacements verticaux compactes pour rester dans le viewport utile
  - `src/index.css`
    - `container-type: inline-size` sur `.studio-empty-state`
    - mots d'ambiance et composition ajustes pour les petites hauteurs et les largeurs contraintes
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - captures locales Playwright:
    - `1440x1200` : pas de scroll central visible sur l'empty state
    - `1180x980` : poster recale proprement en largeur contrainte
    - `390x844` : version mobile compacte sans barre de scroll visible
- Fichiers touches:
  - `src/App.tsx`
  - `src/components/StudioEmptyState.tsx`
  - `src/index.css`
- Intention exacte:
  - obtenir un ecran d'accueil totalement fixe et propre au repos
  - faire en sorte que le poster s'adapte a la vraie place restante du panneau central

## Mise a jour complementaire - 2026-03-29 (podcast duo plus expressif + Lyria 3 rebranchee)
- Besoin traite:
  - l'utilisateur a signale que les podcasts duo donnaient deux intervenants nommes mais une impression de meme voix / rendu monotone
  - il voulait aussi que les mots et noms etrangers soient ecrits dans leur ecriture d'origine pour fluidifier l'audio
  - il a demande de verifier si Lyria 3 pouvait etre activee sans perdre le bon rendu deja obtenu avec `lyria-002`
- Verification externe faite avant correctif:
  - doc officielle Gemini-TTS relue:
    - multi-speaker = 2 intervenants max
    - aliases multi-speaker documentes en alphanumerique sans whitespace
  - doc officielle Lyria relue:
    - `lyria-002` = endpoint `predict`
    - `lyria-3-clip-preview` / `lyria-3-pro-preview` = endpoint `https://aiplatform.googleapis.com/v1beta1/projects/PROJECT_ID/locations/global/interactions`
- Cause racine confirmee:
  - le pipeline acceptait encore qu'un duo arrive avec 2 voix identiques ou des notes de jeu trop proches, ce qui ecrasait la perception des roles
  - les prompts podcast/TTS ne rappelaient pas assez la contrainte "voix distinctes + contrastes de jeu + ecriture d'origine des mots etrangers"
  - le chemin Lyria 3 pointait vers `global-aiplatform.googleapis.com`, qui renvoyait 404 sur `interactions`
- Correctifs appliques:
  - `server/lib/media-generation.ts`
    - normalisation duo durcie avec 2 voix distinctes garanties
    - ajout d'aliases TTS internes (`ttsAlias`) et remap des labels via `remapDialogueSpeakerLabelsForTts()`
    - prompts podcast TTS/script enrichis:
      - contraste de cadence / energie / role
      - ecriture d'origine des noms et mots etrangers
    - endpoint Lyria 3 corrige vers `aiplatform.googleapis.com`
  - `api/index.ts`
    - consignes Cowork et descriptions d'outils audio mises a jour pour:
      - forcer 2 voix distinctes en duo
      - recommander l'ecriture d'origine pour les mots etrangers
      - garder `lyria-002` comme defaut robuste et Lyria 3 en preview optionnelle
  - `server/lib/agents.ts`
    - prompt architecte agent realigne sur ces nouvelles regles podcast/TTS
  - `test-podcast-media.ts`
    - nouveaux tests sur aliases TTS, remap de labels et diversification automatique des voix
- Verification effectuee:
  - `npx tsx test-podcast-media.ts` : OK
  - `npm run lint` : OK
  - `npm run build` : OK
  - `npx tsx verify-agent-blueprints.ts` : OK
  - smoke test reel Gemini TTS:
    - duo avec 2 speakers dont la meme voix demandee => sortie normalisee en 2 voix distinctes (`Charon | Kore`)
    - analyse audio Gemini confirme `speakerCount: 2`, `voicesClearlyDifferent: true`
  - smoke test reel Lyria:
    - `lyria-3-clip-preview` : OK, sortie `audio/mpeg`
    - `create_podcast_episode` + `musicModel: 'lyria-3-clip-preview'` : OK, mix `ffmpeg`
- Limites restantes:
  - `lyria-002` reste le meilleur defaut produit pour la robustesse globale
  - si l'hebergement cible n'a pas `ffmpeg`, un podcast avec musique Lyria 3 peut toujours retomber sur le fallback voix seule car le fallback WAV maison ne decode pas le MP3 preview
  - la perception exacte "voix suffisamment differentes" reste une question de DA; le moteur est durci, mais un peu de direction manuelle peut encore affiner le rendu
- Fichiers touches:
  - `server/lib/media-generation.ts`
  - `api/index.ts`
  - `server/lib/agents.ts`
  - `test-podcast-media.ts`
  - `AI_LEARNINGS.md`
  - `DECISIONS.md`
  - `TECH_RADAR.md`
  - `BUGS_GRAVEYARD.md`
  - `COWORK.md`
- Intention exacte:
  - faire en sorte qu'un "duo podcast" s'entende vraiment comme un duo
  - fluidifier la diction des noms et termes etrangers
  - ouvrir Lyria 3 comme option reelle sans degrader le chemin robuste adore par l'utilisateur avec `lyria-002`

## Mise a jour complementaire - 2026-03-29 (historique discussions local-first)
- Besoin traite:
  - l'utilisateur a signale qu'une nouvelle discussion apparaissait dans l'historique puis disparaissait aussitot
  - le probleme touchait `cowork`, `chat & raisonnement` et les autres modes
- Cause racine confirmee:
  - `src/App.tsx` faisait un `setSessions(snapshot.docs.map(...))` sur le listener Firestore
  - toute session creee localement et non encore confirmee par `users/{uid}/sessions/{sessionId}` etait donc ecrasee par la liste distante
  - le symptome se produisait surtout quand l'ecriture du shell de session etait degradee ou plus lente que l'update locale
- Correctifs appliques:
  - nouveau helper `src/utils/sessionShells.ts`
    - cache local des session shells
    - marqueur `pendingRemote`
    - fusion `mergeSessionsWithLocal()`
  - `src/App.tsx`
    - charge d'abord les shells locaux
    - fusionne local + distant dans le listener `sessions`
    - sauvegarde chaque shell local avant la tentative Firestore
    - marque le shell comme confirme quand Firestore reussit
  - `src/components/SidebarLeft.tsx`
    - supprime aussi le shell local et les snapshots locaux lors d'une suppression de conversation
  - nouveau test `test-session-shells.ts`
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-session-shells.ts` : OK
  - `npm run build` : OK
- Limite restante:
  - validation visuelle authentifiee non rejouee dans cette session a cause du blocage Firebase Auth local deja documente (`auth/unauthorized-domain`)
  - le correctif couvre la stabilite de l'historique cote frontend, mais ne remplace pas une vraie resolution d'un refus Firestore cote cloud si celui-ci persiste
- Fichiers touches:
  - `src/App.tsx`
  - `src/components/SidebarLeft.tsx`
  - `src/utils/sessionShells.ts`
  - `test-session-shells.ts`
- Intention exacte:
  - rendre l'historique robuste meme quand Firestore n'est pas immediatement coherent
  - supprimer l'effet produit le plus anxiogene: voir sa conversation naitre puis disparaitre

## Mise a jour complementaire - 2026-03-29 (Gemini TTS duo + mix podcast)
- Besoin traite:
  - l'utilisateur a signale que Cowork ne savait pas assez bien exploiter Gemini TTS pour:
    - plusieurs intervenants
    - style instructions globales et par role
    - choix mono vs duo
    - catalogue complet des voix
  - retour produit annexe: le fond musical des podcasts etait trop bas
- Verification externe faite avant correctif:
  - doc officielle Google confirmee:
    - `gemini-2.5-pro-tts` et `gemini-2.5-flash-tts` = single + multi-speaker
    - `gemini-2.5-flash-lite-preview-tts` = single-speaker uniquement
    - multi-speaker = exactement 2 speakers max
    - style control via prompts / natural-language instructions
    - 30 voix officielles confirmees
  - references mix/mastering verifiees:
    - Apple Podcasts: cible autour de `-16 LKFS`, true peak <= `-1 dBFS`
    - Auphonic: loudness normalization en fin de chaine
    - Adobe: reduction du rumble sous `80 Hz`, clarte voix et auto-ducking
- Correctifs appliques:
  - nouveau module partage `shared/gemini-tts.ts`
    - catalogue des 30 voix Gemini
    - aides de normalisation des model IDs
    - capacites mono/duo par modele
  - `server/lib/media-generation.ts`
    - support `speakers` dans `generateGeminiTtsBinary()`
    - support duo natif dans `generatePodcastEpisode()`
    - prompts podcast single-speaker vs two-speaker reecrits
    - validation stricte des labels `Nom:` et des 2 speakers exacts
    - mix podcast remonte et moins agressif sur le ducking
    - ajout d'une normalisation loudness sur le chemin `ffmpeg`
  - `api/index.ts`
    - descriptions d'outils Cowork enrichies avec:
      - quand choisir 1 voix vs 2
      - limite a 2 intervenants
      - modele Flash Lite mono seulement
      - liste officielle des voix
    - `generate_tts_audio` accepte maintenant `styleInstructions` et `speakers`
    - `create_podcast_episode` accepte maintenant `styleInstructions` et `speakers`
    - retour recoverable si le modele demande un multi-speaker invalide
  - `server/lib/agents.ts`
    - prompt architecte agent mis a jour pour savoir quand choisir mono/duo et comment utiliser les style instructions
  - UI standard audio:
    - `src/components/SidebarRight.tsx` affiche maintenant les 30 voix officielles dans un select
    - note visible sur le support ou non du duo selon le modele choisi
    - nouveau champ `Style instructions`
    - `/api/generate-audio` prend maintenant ce champ en compte
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-podcast-media.ts` : OK
  - `npm run build` : OK
- Fichiers touches:
  - `shared/gemini-tts.ts`
  - `server/lib/media-generation.ts`
  - `api/index.ts`
  - `server/lib/agents.ts`
  - `server/lib/schemas.ts`
  - `server/routes/standard.ts`
  - `src/App.tsx`
  - `src/components/SidebarRight.tsx`
  - `src/store/useStore.ts`
  - `src/types.ts`
  - `test-podcast-media.ts`
  - `TECH_RADAR.md`
  - `DECISIONS.md`
- Limites restantes:
  - le multi-speaker reste borne a 2 voix exactes par Gemini TTS
  - le mode audio standard expose les style instructions, mais pas encore une UI complete de script builder multi-speaker type AI Studio
  - la normalisation loudness "podcast parfaite" est plus robuste sur le chemin `ffmpeg`; le fallback WAV reste plus artisanal
- Intention exacte:
  - faire monter Cowork d'un cran sur l'audio en lui donnant la vraie grammaire Gemini TTS actuelle
  - eviter les faux monologues quand un vrai duo est possible
  - rendre les podcasts plus vivants musicalement sans perdre l'intelligibilite

## Mise a jour complementaire - 2026-03-29 (synchro multi-appareils Firestore)
- Besoin traite:
  - les conversations n'etaient pas visibles entre appareils malgre une impression de persistance locale correcte
- Cause racine confirmee:
  - `firestore.rules` refusait les session shells car le frontend ecrit `sessionKind` et parfois `agentWorkspace`
  - `runMeta` Cowork cote regles etait obsolete, ce qui maintenait certains messages riches en mode degrade `legacy`
  - des sous-collections `messages` pouvaient donc exister sans document parent `sessions/{sessionId}`
- Correctifs appliques:
  - `firestore.rules` accepte maintenant le vrai schema des sessions et le vrai schema `runMeta`
  - `src/firebase.ts` exporte `collectionGroup` et `where` pour la reparation
  - nouveau helper `src/utils/sessionRecovery.ts`
  - `src/App.tsx` lance une reparation one-shot des session shells manquants a partir de `collectionGroup('messages')`
- Deploiements effectues:
  - `npm run deploy-rules` : OK sur `gen-lang-client-0229561140`
  - `vercel deploy --prod --yes` : OK
  - alias prod confirme: `https://vertex-ai-app-pearl.vercel.app`
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - verification HTTP prod: `STATUS 200`
- Limite restante:
  - la validation visuelle authentifiee automatisee reste bloquee localement par `auth/unauthorized-domain` sur `127.0.0.1`; le correctif synchro est bien en prod, mais pas rejoue en login automatise dans cette session

## Accompli dans cette session
- Un `Hub Agents` natif a ete branche dans Cowork au lieu de rester une idee separee.
- Le backend Cowork sait maintenant concevoir un agent specialise via l'outil `create_agent_blueprint`.
- Cowork sait maintenant relancer un agent deja present dans le hub comme vraie sous-mission via `run_hub_agent`.
- Chaque requete `/api/cowork` embarque maintenant le catalogue des agents du hub pour que le modele puisse choisir entre reutiliser un specialiste existant ou en creer un nouveau.
- Le sous-agent execute une mini-boucle reelle avec le `systemInstruction` du blueprint et seulement les outils autorises par cet agent.
- La timeline Cowork expose des etapes explicites `Sous-mission` / `Sous-mission terminee` pendant la delegation reelle.
- Les regles Firestore du projet ont ete redeployees (`npm run deploy-rules`) pour corriger le `Missing or insufficient permissions` sur `users/{uid}/agents`.
- Le frontend n'interrompt plus tout le run Cowork si la persistance Firestore d'un `agent_blueprint` echoue: il affiche maintenant un warning de synchronisation du hub et continue la reponse.
- La boucle `/api/cowork` emet un nouvel evenement SSE `agent_blueprint`.
- Le frontend persiste les blueprints dans Firestore sous `users/{uid}/agents`.
- Une interface `Hub Agents` a ete ajoutee pour visualiser les agents crees, leur mission, leurs outils et leur premiere UI.
- Une route manuelle `/api/agents/create` a ete ajoutee pour creer un agent depuis l'interface sans passer par un run Cowork.
- Les regles Firestore ont ete mises a jour pour autoriser la collection `agents`.
- `AI_LEARNINGS.md` et `COWORK.md` ont ete enrichis avec la decision Hub Agents.

## Intentions du dernier changement
- Faire de la delegation une vraie capacite produit de Cowork.
- Eviter que Cowork dise "je t'ai cree un agent" sans objet persistant, sans UI et sans reutilisation possible.
- Poser le socle du futur modele "Cowork = agent general + possibilite de creer et relancer des specialistes".
- Passer du niveau "blueprint persiste" au niveau "specialiste relancable" sans introduire un sous-systeme multi-sessions separe.

## Fichiers modifies ou crees
- `api/index.ts`
- `api/lib/agents.ts`
- `api/lib/schemas.ts`
- `src/App.tsx`
- `src/components/AgentsHub.tsx`
- `test-cowork-loop.ts`
- `firestore.rules` (redeploy cote cloud, pas de contenu change dans cette session)

## Verification effectuee
- `npm run lint` : OK
- `npm run build` : OK
- `npx tsx test-cowork-loop.ts` : OK
- `npm run deploy-rules` : OK
- Validation navigateur authentifiee toujours non rejouee cette session : le blocage Firebase Auth local sur `127.0.0.1` reste actif.

## Blocages et pieges actifs
- Blocage principal: `auth/unauthorized-domain` sur `127.0.0.1` pendant le login Google en local.
- Consequence: impossible de valider visuellement en session connectee le cycle complet "creer un agent -> persistance Firestore -> reaffichage" tant que le domaine local n'est pas autorise dans Firebase Auth ou tant qu'on ne valide pas sur le domaine de deploiement.
- Attention: les consignes projet disent de privilegier la validation sur l'URL de production plutot que `localhost`.

## Ce qu'il reste a faire
- Transformer `uiSchema` en vraie surface de generative UI executable avec formulaire borne.
- Ajouter un point d'entree UI plus direct pour forcer ou suggerer explicitement la relance d'un agent du hub depuis l'interface si on veut reduire la dependance au choix autonome du modele.
- Ajouter l'auto-fill pour remplir le schema d'un agent a partir d'une demande libre.
- Cadrer le pipeline podcast pour script + TTS + musique Lyria avec verification officielle des model IDs et des APIs exactes.
- Valider visuellement le Hub Agents sur un domaine autorise Firebase.

## Reprise ideale la prochaine session
1. Verifier le domaine de validation disponible (Vercel ou domaine Firebase autorise).
2. Rejouer un run Cowork qui choisit un agent deja existant du hub et verifier qu'il appelle `run_hub_agent` au lieu de recreer un blueprint.
3. Si la relance autonome marche, ajouter si besoin une commande/UI explicite pour "forcer la delegation a cet agent".

## Mise a jour complementaire - 2026-03-29 (image + TTS + Lyria)
- Nouveau besoin implemente: Cowork peut maintenant appeler nativement la generation d'image, Gemini TTS et Lyria sans heuristiques de mots-cles.
- Backend:
  - nouveau helper partage `api/lib/media-generation.ts`
  - nouvelles routes `POST /api/generate-audio` et `POST /api/generate-music`
  - nouveaux `localTools` Cowork:
    - `generate_image_asset`
    - `generate_tts_audio`
    - `generate_music_audio`
- UI:
  - le mode `audio` de `src/App.tsx` est enfin branche vers `/api/generate-audio`
  - `src/components/SidebarRight.tsx` expose maintenant le choix du modele TTS, de la voix et de la locale
  - le modele audio par defaut est passe a `gemini-2.5-flash-tts`
- Point technique notable:
  - `createGoogleAI()` force maintenant `global` aussi pour les modeles `tts`
  - Lyria 2 renvoie l'audio dans `predictions[0].bytesBase64Encoded`
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK

## Mise a jour complementaire - 2026-03-29 (frontend premium shell)
- Nouveau besoin implemente: refonte transversale du frontend pour sortir du rendu "template glassmorphism" et aller vers une DA type studio editorial premium.
- Direction visuelle retenue:
  - shell cinematographique sombre avec accents cyan / ambre
  - empty state central transforme en vrai poster produit actionnable
  - rail gauche, scene centrale et panneau droit reunis dans une meme langue visuelle
- Modifications principales:
  - `src/index.css`: nouveau systeme de tokens, nouveaux composants visuels (`studio-panel`, `studio-panel-strong`, `studio-button-*`, `studio-input`), fond global plus riche, typographie `Sora` + `IBM Plex Mono`
  - `src/components/StudioEmptyState.tsx`: nouveau hero central par mode (`chat`, `cowork`, `image`, `video`, `audio`)
  - `src/App.tsx`: shell, header, overlays, empty states et footer de composition realignes; titre mobile tronque proprement
  - `src/components/SidebarLeft.tsx`: rail gauche deja refondu et confirme visuellement
  - `src/components/SidebarRight.tsx`: inspector harmonise avec la nouvelle DA, meilleur drawer mobile, cartes de reglages plus lisibles
  - `src/components/ChatInput.tsx`: zone de saisie plus premium, boutons utilitaires et CTA d'envoi mieux cadres
  - `src/components/MessageItem.tsx`: avatars, bulles et actions mieux integres dans le nouveau langage visuel
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - validation Playwright desktop: shell global OK, panneau droit OK
  - validation Playwright mobile: hero OK, header plus propre, drawer parametres OK
- Limites restantes:
  - les snapshots d'accessibilite Playwright continuent de montrer certains drawers "ouverts" meme quand le screenshot reel est correct; se fier au rendu capture, pas uniquement a l'arbre
  - `AgentsHub` et `AgentWorkspacePanel` sont deja mieux relies au shell global via `App.tsx`, mais une passe de polish dediee reste possible si on veut pousser encore le niveau "awwwards" sur ces surfaces
  - test reel minimal `generateImageBinary()` : OK
  - test reel minimal `generateGeminiTtsBinary()` : OK
  - test reel minimal `generateLyriaBinary()` : OK
- Limite restante:
  - pas encore de vrai mode UI dedie a la musique, seulement la route backend et l'outil Cowork/agents

## Mise a jour complementaire - 2026-03-29 (retour prod Hub Agents)
- Le popup `Missing or insufficient permissions` cote Hub Agents ne doit plus bloquer l'app: la liste agents et la creation passent maintenant en mode degrade local si Firestore refuse la lecture ou l'ecriture.
- Un cache local `src/utils/agentSnapshots.ts` hydrate le hub avant synchro Firestore, conserve les agents crees localement, et fusionne les snapshots cloud quand ils reviennent.
- `src/App.tsx` n'utilise plus `handleFirestoreError()` pour la liste d'agents; il affiche un warning non bloquant et garde le hub utilisable sur l'appareil courant.
- `persistAgentBlueprint()` sauvegarde d'abord l'agent en etat local, puis tente Firestore en best effort sans casser le run ni la creation manuelle.
- `src/components/AgentsHub.tsx` n'est plus un simple registre: le panneau droit rend maintenant un vrai formulaire a partir du `uiSchema` (avec fallback `missionBrief` si le schema est vide) et expose un CTA `Lancer dans Cowork`.
- `handleRunAgentFromHub()` construit une relance explicite sur l'agent existant du hub et force le chemin "reutilise ce specialiste / n'en cree pas un nouveau".
- Deploiement prod effectue: `vercel deploy --prod --yes` a re-aliasse `https://vertex-ai-app-pearl.vercel.app` sur la build contenant le correctif Hub + l'UI executable.
- Verification supplementaire:
  - `npm run lint` : OK
  - `npm run build` : OK
  - chargement Playwright de `https://vertex-ai-app-pearl.vercel.app` : OK sur la surface publique
- Limite restante: le flow Hub authentifie n'a toujours pas ete revalide en navigateur de test sans session Google; la validation complete depend d'un compte connecte sur le domaine autorise.

## Mise a jour complementaire - 2026-03-29 (correction du modele produit agent)
- Le besoin produit a ete clarifie: l'utilisateur ne veut PAS que Cowork utilise l'agent a sa place.
- Nouveau modele produit retenu:
  - Cowork cree l'agent
  - Cowork peut ensuite modifier l'agent
  - l'utilisateur ouvre l'agent dans son propre workspace et l'utilise directement
- `src/App.tsx` gere maintenant des sessions `sessionKind='agent'` avec `agentWorkspace` (snapshot d'agent + valeurs de formulaire).
- Une session agent passe par la boucle outillee `/api/cowork`, mais en runtime agent:
  - prompt systeme = `systemInstruction` de l'agent
  - tools visibles = tools de l'agent uniquement
  - branding runtime = agent, pas Cowork
- Le frontend ouvre maintenant une vraie session `Agent · <Nom>` quand on lance un agent depuis le hub, puis envoie une mission initiale construite depuis `starterPrompt` + les champs remplis.
- Un nouveau panneau `AgentWorkspacePanel` affiche:
  - les champs de l'interface de l'agent
  - un bouton `Relancer l'agent`
  - une zone `Envoyer a Cowork` pour demander une evolution de l'agent
- Cowork sait maintenant modifier un agent existant via un nouvel outil backend `update_agent_blueprint`, qui emet a nouveau `agent_blueprint` avec le meme `id` d'agent pour ecraser le blueprint existant.
- Deploiement prod re-execute apres ce vrai changement de cap:
  - `vercel deploy --prod --yes`
  - alias prod confirme sur `https://vertex-ai-app-pearl.vercel.app`

## Ce qu'il reste a faire
- Valider en session connectee le cycle complet:
  - ouvrir un agent depuis le hub
  - verifier que le workspace agent apparait
  - relancer l'agent dans sa propre conversation
  - demander une modif a Cowork
  - verifier que le meme agent du hub est mis a jour
- Ajuster eventuellement la copy restante qui parle encore de `run_hub_agent` dans certaines reponses libres du modele.

## Mise a jour complementaire - 2026-03-29 (faux positif artefact/PDF)
- Bug reproduit et corrige: une demande non artefact du type `c quoi le mieux entre le plus et le business` pouvait basculer en pipeline PDF si le texte colle contenait un mot ambigu comme `presentation` (ex: `sur presentation d'un numero de TVA valide`).
- Cause racine: `requestNeedsDownloadableArtifact()` et `requestNeedsPdfArtifact()` lisaient tout le message brut, y compris les longs contenus colles, au lieu de se concentrer sur l'intention de la demande.
- Correctif applique dans `api/index.ts`:
  - ajout de `getCoworkIntentWindow()`
  - ajout de `requestHasDeliverableIntent()`
  - durcissement des heuristiques pour que les noms ambigus (`presentation`, `document`, `rapport`, etc.) ne declenchent un livrable que s'ils sont portes par une vraie intention de creation/export
- Regression ajoutee dans `test-cowork-loop.ts`:
  - le cas `presentation d'un numero de TVA valide` doit rester `false`
  - une vraie demande `cree moi une presentation...` doit rester `true`
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npm run build` : OK
  - reproduction isolee via `npx tsx -` : prompt fautif => `{ downloadable: false, pdf: false }`

## Mise a jour complementaire - 2026-03-29 (suppression du forcing runtime par mots-cles)
- Retour produit explicite: l'utilisateur ne veut plus de backend qui decide "il faut un PDF / un fichier / une recherche" a partir de mots-cles. La logique voulue est: intelligence du modele + bon prompt systeme, avec garde-fous fondes sur l'etat reel, pas sur le lexique.
- Correctif applique dans `api/index.ts`:
  - `buildCoworkSystemInstruction()` n'injecte plus de directives runtime conditionnelles basees sur `requestNeedsDownloadableArtifact()` / `requestNeedsPdfArtifact()` / `requestNeedsExternalGrounding()`
  - `computeCompletionState()` ne bloque plus un run juste parce que le prompt contenait `pdf` ou `document`
  - les blockers artefact ne se declenchent maintenant que si un livrable est reellement en cours (`activePdfDraft`) ou deja cree (`latestCreatedArtifactPath`)
  - `buildArtifactCompletionPrompt()` ne force plus la completion d'apres le texte utilisateur; il ne pousse a `create_pdf` / `release_file` que si l'artefact est deja amorce
  - les messages de fallback finaux ne parlent plus de PDF a partir du prompt; ils se calent sur l'etat reel du run
- Regressions ajoutees dans `test-cowork-loop.ts`:
  - un prompt `Cree-moi un PDF de test` sans brouillon ni fichier cree ne bloque plus artificiellement la completion
  - un brouillon PDF actif + aucun fichier final cree => `artifact_not_created`
  - un fichier deja cree mais non publie => `artifact_not_released`
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK

## Mise a jour complementaire - 2026-03-29 (Cowork plus engage sans plan impose)
- Nouveau retour produit: Cowork etait encore trop paresseux sur les livrables editoriaux type `pdf actu du soir`, avec peu de recherches, aucune source lue, et un brouillon/artefact lance trop tot.
- Correctif applique:
  - le system prompt Cowork pousse maintenant explicitement a calibrer l'effort sur l'ambition reelle de la mission et a refuser les versions maigres
  - ajout d'un helper `buildCoworkEngagementNudge()` dans `api/index.ts`
  - apres un tour outils, si l'etat reel montre une matiere trop mince pour la promesse du livrable (ex: recherches sans lecture directe, brouillon editorial trop court ou peu source), la boucle injecte une relance qualite douce au modele
  - cette relance n'impose pas un plan fixe; elle dit au modele d'enrichir, varier, lire, pivoter ou assumer une version courte, mais lui laisse choisir la meilleure suite
- Etat technique:
  - nouveau champ session `lastEngagementNudgeSignature` pour eviter les relances qualite repetitives sur le meme etat
  - couverture de tests ajoutee sur les cas:
    - `web_search` repete sans `web_fetch`
    - brouillon PDF editorial encore trop maigre
    - brouillon suffisamment dense et source => pas de nudge
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npm run build` : OK

## Mise a jour complementaire - 2026-03-29 (suppression des heuristiques restantes et des relances backend)
- Nouveau retour produit explicite: l'utilisateur ne veut plus aucun moteur backend pilote par mots-cles ni aucune relance qui dicte la strategie au modele pendant le run.
- Correctif applique dans `api/index.ts`:
  - retrait de la relance `buildCoworkEngagementNudge()` du chemin runtime
  - retrait de la relance automatique `artifactCompletionPrompt` quand Cowork essaye de conclure sans avoir fini le livrable; le run echoue maintenant honnetement au lieu de recevoir un ordre backend supplementaire
  - `web_search` n'aligne plus la requete sur la date ni sur une categorie deduite du prompt; le modele peut maintenant passer explicitement `topic`, `searchDepth`, `strict`, `timeRange`, `includeDomains`, `directSourceUrls`
  - `web_fetch` accepte maintenant `contextQuery` et `strict` explicitement, sans deduire la severite depuis le prompt utilisateur
  - `buildTavilySearchPlan()` et `searchWeb()` ne choisissent plus `news`, `advanced`, des domaines de confiance ou des sources directes a partir de mots du prompt; sans option explicite, les defaults sont neutres
  - `getPdfQualityTargets()` retourne maintenant `null` par defaut et les choix PDF auto (`theme`, `engine`, exigences editoriales) ne sont plus derives du message utilisateur
  - `resolvePdfEngine()` ne force plus `latex` depuis le prompt; `auto` tombe maintenant sur `pdfkit` tant que le modele n'exprime pas autre chose
- Correctif applique dans les tests:
  - refonte de `test-cowork-loop.ts` pour verifier les nouveaux defaults neutres et les options explicites
  - refonte de `test-pdf-heuristics.ts` pour verifier le contrat PDF sans heuristiques implicites
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npx tsx test-pdf-heuristics.ts` : OK
  - `npm run build` : OK

## Mise a jour complementaire - 2026-03-29 (LaTeX premium par section/page)
- Nouveau besoin implemente: les PDF LaTeX peuvent maintenant changer de direction artistique par section/page sans exiger un raw `.tex` complet.
- Backend / contrat:
  - `PdfSectionInput` et `NormalizedPdfSection` acceptent maintenant:
    - `visualTheme`
    - `accentColor`
    - `mood`
    - `motif`
    - `pageStyle`
    - `pageBreakBefore`
    - `flagHints`
  - `begin_pdf_draft`, `append_to_draft`, `review_pdf_draft` et `create_pdf` documentent ces champs dans leurs schemas d'outil et les preservent dans le brouillon/state.
- Rendu:
  - `server/pdf/latex.ts` sait maintenant produire:
    - un `report` premium avec couverture soignee
    - un `news` premium via le nouveau chemin `buildNewsLatexDocumentV2`
    - des spreads de section TikZ avec palettes, motifs et badges drapeaux
  - le mode `legal` reste volontairement sobre.
- Compatibilite LaTeX:
  - `ALLOWED_LATEX_PACKAGES` a ete etendu pour accepter plus de packages de mise en page premium (`calc`, `array`, `booktabs`, `fontawesome5`, `lettrine`, `charter`, `helvet`, etc.)
  - correction technique importante: les mini-drapeaux utilisent maintenant des couleurs TikZ valides via `fill={[HTML]...}`.
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-latex-provider.ts` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npm run build` : OK
  - smoke test compile LaTeX reelle via provider externe (`ytotech`, `xelatex`) : OK, PDF binaire recu (~23 KB)
- Intention du dernier changement:
  - rendre Cowork capable de faire un PDF "arbres" vraiment theme arbre
  - permettre a un journal multi-sujets d'avoir une vraie DA differente par page/section (ex: guerre puis football)
  - rester modele-led: aucun forcing backend par mots-cle, seulement des champs explicites que le modele peut choisir

## Mise a jour complementaire - 2026-03-29 (brouillon PDF vraiment revisable)
- Retour produit explicite: le brouillon PDF etait encore traite comme un quasi-export, car la seule mutation riche etait `append_to_draft`; Cowork pouvait donc ecrire un premier jet puis filer trop vite vers `create_pdf`.
- Correctif applique dans `api/index.ts`:
  - ajout d'un vrai helper `reviseActivePdfDraft()` cote backend
  - ajout d'un nouvel outil `revise_pdf_draft`
  - le brouillon peut maintenant:
    - changer `title`, `subtitle`, `summary`, `author`
    - remplacer toute la liste de sections
    - appliquer des operations structurelles 1-based (`replace`, `remove`, `insert_before`, `insert_after`, `append`)
    - remplacer ou enrichir les sources via `sourcesMode=append|replace`
  - garde-fou honnete pour le mode LaTeX raw:
    - si le brouillon est en `sourceMode='raw'`, une vraie revision structurelle en LaTeX exige un `latexSource` complet mis a jour
    - seule exception pratique: l'agent peut aussi basculer explicitement vers `engine='pdfkit'`
  - la consigne systeme Cowork parle maintenant du brouillon comme d'un atelier de travail:
    - premier jet
    - relecture
    - revision
    - export seulement quand le texte est mur
  - le fallback artefact n'ordonne plus "termine-le maintenant", il rappelle aussi les options `get_pdf_draft`, `revise_pdf_draft`, `review_pdf_draft`
- Effet produit:
  - Cowork n'est plus limite a "ajouter encore un bloc"
  - il peut reellement revenir sur le plan, reecrire une section, supprimer un passage faible, reordonner la structure et reprendre son texte avant export
- Tests ajoutes:
  - revision d'un brouillon avec remplacement / insertion / suppression de sections
  - refus honnete d'une vraie revision sur brouillon LaTeX raw sans `latexSource` complet
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npx tsx test-latex-provider.ts` : OK
  - `npm run build` : OK

## Mise a jour complementaire - 2026-03-29 (podcast audio complet)
- Retour produit explicite: l'utilisateur veut que Cowork puisse creer un vrai podcast, pas seulement un texte ou deux assets audio separes. Le texte parle doit pouvoir etre cree/narre par `gemini-2.5-pro-tts`, et le fond sonore doit venir de Lyria.
- Correctif applique:
  - `api/lib/media-generation.ts`
    - ajout de `DEFAULT_PODCAST_TTS_MODEL = 'gemini-2.5-pro-tts'`
    - ajout des builders:
      - `buildPodcastNarrationPrompt()`
      - `buildPodcastMusicPrompt()`
    - ajout de `generatePodcastEpisode()`
    - le pipeline fait maintenant:
      - narration TTS
      - generation du bed musical Lyria
      - mix final local via `ffmpeg`/`ffprobe`
  - `api/index.ts`
    - ajout du tool Cowork `create_podcast_episode`
    - ce tool accepte soit:
      - `script` exact a narrer
      - soit `brief` pour laisser `gemini-2.5-pro-tts` creer et dire lui-meme le texte parle
    - sortie: vrai fichier audio final dans `/tmp/`, pret a publier via `release_file`
- Contrat actuel:
  - modeles par defaut du tool podcast:
    - TTS: `gemini-2.5-pro-tts`
    - musique: `lyria-002`
  - le mix ajoute une petite intro musicale, cale la voix dessus, baisse le fond, puis fait une outro courte
  - le tool renvoie aussi des apercus de prompts (`narrationPromptPreview`, `musicPromptPreview`) pour debug utile
- Tests / verification:
  - `npm run lint` : OK
  - `npx tsx test-podcast-media.ts` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npx tsx test-latex-provider.ts` : OK
  - `npm run build` : OK
  - smoke test reel minimal:
    - narration: `gemini-2.5-pro-tts`
    - musique: `lyria-002`
    - mix final: OK
    - fichier cree: `C:\\Users\\Yassine\\AppData\\Local\\Temp\\codex-podcast-smoke.mp3`
    - taille: ~350 KB
    - duree voix: ~12.7 s
    - duree finale: ~14.5 s
- Limite restante:
  - le mix final depend de `ffmpeg` present sur la machine serveur. Valide localement ici, mais non encore verifie sur l'hebergement distant.

## Mise a jour complementaire - 2026-03-29 (batterie Cowork)
- Nouveau besoin:
  - l'utilisateur a demande une vraie batterie de tests pour mesurer Cowork sur recherche, documents, raisonnement, stress et iteration
  - contrainte produit reconfirmee: corriger par personnalite / prompt systeme / descriptions d'outils, pas en remettant des forcing backend
- Correctifs appliques:
  - ajout du runner `test-cowork-battery.ts`
  - renforcement du prompt systeme Cowork dans `api/index.ts` pour:
    - dissocier clairement `web_search` (reperage) et `web_fetch` (lecture/verif directe)
    - pousser la couverture multi-angle / multi-pays / multi-entites
    - pousser la verification pour business / juridique / finance / RH / marche
    - rappeler qu'une couverture large avec trop peu de lectures directes reste mince
  - `buildCoworkProgressFingerprint()` compte maintenant aussi `webSearchCount` et `webFetchCount`, ce qui evite les faux stalls quand l'agent est encore en collecte utile
  - le message de resultat `web_search` dit maintenant explicitement que les pistes ne sont pas encore des sources lues
- Methode de test retenue:
  - les runs batterie les plus fiables se font avec un serveur backend ephemere lance dans le meme process shell que la batterie
  - le vieux serveur detache sur `:3000` etait instable pour les longues series de tests et produisait des faux negatifs
- Etat mesure:
  - rapports generes dans `tmp/cowork-battery/`
  - la batterie complete a ete jouee presque entierement puis completee par des sous-ensembles cibles pour finir `5.2` / `5.3`
  - passes robustes observes:
    - `2.1` CV + lettre
    - `3.1` arbitrage complexe
    - `4.2` tache impossible
    - `4.4` multilingue
    - `5.1` feedback loop
  - progres nets mais encore insuffisants:
    - `1.1` dossier eau: lit enfin plusieurs sources mais ne cherche pas encore assez large
    - `1.2` fact-check: forte hausse des recherches, ouverture de sources partielle mais encore sous le seuil cible
    - `5.3` chaine startups: va maintenant jusqu'aux 2 PDF et a la traduction, mais l'etayage direct des profils reste trop mince
  - faiblesse dominante restante:
    - Cowork reste encore sous-source sur certains dossiers larges, comparatifs de marche et taches multi-entites
    - plusieurs demandes business / juridiques / memo peuvent encore partir trop "de tete" ou avec trop peu de `web_fetch`
- Fichiers touches:
  - `api/index.ts`
  - `test-cowork-battery.ts`
  - `test-cowork-loop.ts`

## Mise a jour complementaire - 2026-03-29 (Vercel Hobby / limite de fonctions)
- Nouveau besoin:
  - la prod Vercel echouait avec `No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan`
  - l'utilisateur a demande une correction sans perte de performances ni de fonctionnalites
- Cause racine confirmee:
  - `vercel.json` rewrite deja tout `/api/(.*)` vers `/api`, donc l'architecture cible etait bien un seul point d'entree backend
  - malgre ca, le dossier `api/` contenait encore `lib/*`, `middleware/*` et `routes/*`
  - Vercel Hobby comptait ces fichiers `.ts` comme fonctions serveur supplementaires
- Correctif applique:
  - deplacement de tout l'interne hors de `api/` vers:
    - `server/lib/*`
    - `server/middleware/*`
    - `server/routes/*`
  - `api/index.ts` reste l'unique entree serverless routable
  - imports recables dans `api/index.ts`, `server/routes/standard.ts`, `test-cowork-loop.ts`, `test-podcast-media.ts`
  - suppression des dossiers vides `api/lib`, `api/middleware`, `api/pdf`, `api/routes`
- Verification:
  - `npm run lint` : OK
  - `npm run build` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npx tsx test-pdf-heuristics.ts` : OK
  - `npx tsx test-latex-provider.ts` : OK
  - `npx tsx test-podcast-media.ts` : OK
  - `npx tsx test-image-gen.ts` : OK
  - `npx vercel build --prod` : OK
  - preuve cle: `.vercel/output/functions` ne contient plus qu'une seule fonction `api/index.func`
- Fichiers touches:
  - `api/index.ts`
  - `server/lib/agents.ts`
  - `server/lib/config.ts`
  - `server/lib/google-genai.ts`
  - `server/lib/logger.ts`
  - `server/lib/media-generation.ts`
  - `server/lib/path-utils.ts`
  - `server/lib/schemas.ts`
  - `server/lib/storage.ts`
  - `server/middleware/api-errors.ts`
  - `server/middleware/auth.ts`
  - `server/middleware/request-hardening.ts`
  - `server/routes/standard.ts`
  - `test-cowork-loop.ts`
  - `test-podcast-media.ts`
- Intention exacte:
  - aligner l'arborescence backend avec l'intention produit et la semantique Vercel: un backend Express monolithique expose via une seule function, avec le reste du code en modules internes non routables

## Mise a jour complementaire - 2026-03-29 (podcast master unique)
- Nouveau besoin:
  - l'utilisateur veut que Cowork livre un vrai podcast final, pas des stems separes voix/musique
  - il faut un seul fichier bien monte, avec la voix prioritaire sur la musique
  - il faut eviter que `create_podcast_episode` casse si `ffprobe` ou `ffmpeg` ne sont pas disponibles
- Correctifs appliques:
  - `server/lib/media-generation.ts`
    - suppression de la dependance dure a `ffprobe` pour mesurer la duree: la narration TTS est maintenant lue directement depuis son header WAV
    - ajout d'un fallback de mix WAV pur TypeScript quand `ffmpeg` est indisponible ou echoue
    - fallback avec:
      - resampling lineaire
      - adaptation mono/stereo
      - high-pass doux sur la voix
      - ducking du bed sous la voix
      - loop crossfade leger pour rendre la repetition musicale plus propre
      - limitation de pic en sortie
    - chemin `ffmpeg` ameliore quand disponible:
      - high-pass / low-pass
      - compression de voix
      - sidechain ducking
      - limiter final
  - `api/index.ts`
    - `create_podcast_episode` expose maintenant `outputExtension`
    - le tool est decrit comme le chemin normal pour un podcast pret a publier
    - `generate_tts_audio` / `generate_music_audio` sont explicitement recadres vers les cas ou l'utilisateur demande les composants separes
    - les resultats remontent maintenant `mixStrategy`
  - `server/lib/agents.ts`
    - `create_podcast_episode` rejoint la bibliotheque d'outils autorises
    - les agents podcast par defaut utilisent maintenant:
      - `web_search`
      - `web_fetch`
      - `generate_image_asset`
      - `create_podcast_episode`
      - `release_file`
    - le prompt d'architecte d'agents dit de preferer le master final unique aux stems separes
  - `src/components/AgentsHub.tsx`
    - copy et suggestion mises a jour pour pousser "master final bien mixe + cover"
- Verification:
  - `npm run lint` : OK
  - `npm run build` : OK
  - `npx tsx test-podcast-media.ts` : OK
  - `npx tsx verify-agent-blueprints.ts` : OK
- Fichiers touches:
  - `server/lib/media-generation.ts`
  - `api/index.ts`
  - `server/lib/agents.ts`
  - `src/components/AgentsHub.tsx`
  - `test-podcast-media.ts`
  - `verify-agent-blueprints.ts`
- Limites restantes:
  - si on force un modele `lyria-3-*` et que l'hebergement n'a pas `ffmpeg`, le fallback WAV ne peut pas encore decoder le MP3 Lyria 3; le chemin le plus robuste reste `lyria-002` boucle sous toute la narration
  - la cover n'est pas encore embeddee dans le MP3; le bon chemin produit reste `create_podcast_episode` pour le master audio puis `generate_image_asset` pour la cover
- Intention exacte:
  - faire de "podcast" un vrai artefact audio premium de premiere classe dans Cowork
  - eviter que le modele livre des composants separes quand l'utilisateur attend un episode pret a publier

## Mise a jour complementaire - 2026-03-29 (stabilisation chat/agent + perf frontend)
- Retour produit traite:
  - frontend trop serre
  - selecteur de modeles recouvert par `Capacites & outils`
  - warning Hub local trop envahissant
  - sessions agent qui polluent `Chat & Raisonnement`
  - copy/runtime qui affichait encore Cowork dans un workspace agent
  - thinking Gemini invisible en chat standard
  - shell visuellement trop lourd et moins fluide
- Correctifs appliques:
  - `server/routes/standard.ts` envoie maintenant `thinkingConfig` avec `includeThoughts: true` sur `/api/chat`
  - `server/lib/google-genai.ts` centralise `buildThinkingConfig()` pour Gemini 3.x/3.1 et 2.5
  - `api/index.ts` migre aussi vers `thinkingConfig` pour Cowork/agent et pour les reponses finales bloquees
  - `src/store/useStore.ts` n'ecrase plus `lastSessionIdsByMode` pour `local-new` ou les sessions agent quand `remember` est desactive
  - `src/components/SidebarLeft.tsx` separe maintenant l'historique normal et les sessions `sessionKind='agent'`
  - `src/App.tsx` distingue mieux Cowork vs agent runtime dans les labels, placeholders et snapshots riches
  - le gros bandeau jaune Hub local est remplace par une ligne d'etat compacte en pills
  - `src/components/SidebarRight.tsx` remplace l'ancien dropdown absolu par une liste de modeles inline
  - `src/index.css`, `MessageItem.tsx`, `ChatInput.tsx`, `SidebarLeft.tsx`, `SidebarRight.tsx` et `App.tsx` ont ete alleges pour la fluidite
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - validation Playwright locale sur `http://127.0.0.1:3000` : OK pour le shell, les libelles de mode et le selecteur de modeles non recouvert
  - validation SSE brute `/api/chat` avec `gemini-3.1-pro-preview` : OK, le stream renvoie maintenant des events `thoughts` avant `text`
- Limites restantes:
  - le rendu live du bloc thinking dans l'UI complete n'a pas ete rejoue en session Google connectee pendant cette passe
  - le warning Vite sur les chunks > 500 kB reste a traiter dans une prochaine passe perf si on veut pousser encore la fluidite

## Mise a jour complementaire - 2026-03-29 (podcast actu robuste)
- Bug produit traite:
  - un run `FAIS MOI UN PODCAST SUR LACTU DU JOUR` pouvait echouer en chaine avec:
    - blocage recitation
    - `ffmpeg ENOENT`
    - fallback WAV declare tronque
    - puis une reponse finale mensongere qui accusait le manque de sources au lieu du pipeline podcast
- Correctifs appliques:
  - `server/lib/media-generation.ts`
    - generation d'un script podcast original via `gemini-3.1-flash-lite-preview` avant passage au TTS
    - prompt musique Lyria rendu beaucoup plus abstrait pour eviter les recitation checks lies aux noms propres / titres d'actualite
    - retry musique avec prompt degrade si le premier prompt se fait bloquer
    - fallback final `voice-only` si le fond musical ou le mix ne sont pas disponibles
    - parser WAV assoupli quand seul le `data chunk` est tronque/plus court qu'annonce
    - si `ffmpeg` est absent, le fallback `wav-fallback` prend proprement le relais
  - `api/index.ts`
    - `create_podcast_episode` remonte maintenant `warning`, `narrationScriptPreview` et un message honnete si le master est cree en `voice-only`
    - la cloture Cowork conserve la vraie cause d'echec recente (`latestFailureContext`) au lieu d'inventer un probleme de sources
    - `buildCoworkBlockedUserReplyPrompt()` insiste pour ne pas blamer la recherche si le blocage principal vient d'un media/podcast/PDF
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-podcast-media.ts` : OK
  - `npm run build` : OK
  - smoke test reel `generatePodcastEpisode()` sur un brief d'actu charge en noms propres : OK (`ffmpeg`, MP3)
  - smoke test reel sans `ffmpeg` dans le `PATH` : OK (`wav-fallback`, WAV final au lieu d'un crash)

## Mise a jour complementaire - 2026-04-02 (home Cowork Apps reframee en gestionnaire d'apps + chat bas)
- Nouveau besoin:
  - l'utilisateur juge la home Cowork trop serree, trop textuelle et pas assez fidele a sa vision
  - il veut une metaphore type tablette/gestionnaire d'applications:
    - toutes les apps visibles
    - une vraie preview d'interface propre a l'app selectionnee
    - une petite zone de chat en bas pour decrire une idee
    - Cowork doit clarifier la vision avant generation, pas pousser un wizard generique
- Correctif applique:
  - `src/components/AgentsHub.tsx`
    - suppression de l'ancienne scene hero + labo lateral trop bavarde
    - nouvelle composition en 3 zones:
      - bibliotheque d'apps a gauche sous forme de tiles type app manager
      - preview centrale grand format de l'interface de l'app selectionnee
      - rail droit consacre au cap produit/clarification/live creation
    - nouvelle barre de creation basse sur toute la largeur:
      - prompt libre
      - reponse de clarification si Cowork attend un retour
      - suggestions d'idees discretes
    - la creation preview reste visible dans la preview centrale quand une app est en train d'emerger
    - les actions d'ouverture d'app sont gardees mais compactees pour ne plus casser la respiration
- Validation effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - captures Edge headless locales via `tmp/cowork-apps-preview.html`:
    - `tmp/cowork-store-desktop-apr02.png`
    - `tmp/cowork-store-mobile-apr02.png`
    - `tmp/cowork-creation-desktop-apr02.png`
    - `tmp/cowork-creation-mobile-apr02.png`
- Fichiers modifies:
  - `src/components/AgentsHub.tsx`
  - `NOW.md`
  - `SESSION_STATE.md`
  - `DECISIONS.md`
  - `COWORK.md`
  - `QA_RECIPES.md`
- Intention exacte:
  - faire de `Cowork Apps` un vrai store/launcher d'apps avec une sensation "autre app dans l'app"
  - reduire radicalement le texte inutile
  - montrer visuellement que chaque app a sa propre interface et que Cowork clarifie d'abord le besoin avant de generer
- Limites restantes:
  - la validation reelle sur donnees/auth utilisateur reste a faire
  - sur mobile, la bibliotheque passe vite sous la ligne de flottaison si le store grossit ou si le clavier prend beaucoup d'espace

## 2026-04-24 - Fix synchro multi-appareils: generated apps boot + replay agents/apps

### Diagnostic
- Retour utilisateur: les sauvegardes et synchronisations entre appareils ne fonctionnaient pas de facon fiable.
- Cause racine trouvee dans le frontend:
  - le listener Firestore `users/{uid}/generatedApps` faisait `if (!isStorageResetReady) return`, mais son `useEffect` ne dependait que de `user`;
  - si l'utilisateur etait deja authentifie avant la fin du reset navigateur, ce listener ne redemarrait jamais;
  - `hasLoadedRemoteGeneratedApps` restait donc `false`;
  - le replay local des sessions/messages et la reparation de shells orphelins restaient bloques car ils attendent sessions + agents + generated apps charges.
- Trou produit adjacent:
  - les agents et generated apps etaient sauvegardes en cache local avant Firestore, mais sans file `pendingRemote` rejouable;
  - apres un refus Firestore/reseau ponctuel, une app pouvait rester disponible seulement sur l'appareil courant.

### Correctif applique
- `src/App.tsx`
  - le listener `generatedApps` depend maintenant de `isStorageResetReady` et de `user`;
  - les creations/updates d'agents et generated apps marquent le cache local en `pendingRemote: true` avant `setDoc`;
  - apres succes Firestore, le pending local est nettoye;
  - le replay local inclut maintenant les agents et generated apps en attente avant les shells/messages.
- `src/utils/agentSnapshots.ts`
  - ajout d'une file locale `studio-pro-agents-pending-v1`;
  - ajout de `loadPendingLocalAgents()`;
  - `saveLocalAgent(..., { pendingRemote })` sait marquer/nettoyer l'etat distant en attente.
- `src/utils/generatedAppSnapshots.ts`
  - ajout d'une file locale `studio-pro-generated-apps-pending-v1`;
  - ajout de `loadPendingLocalGeneratedApps()`;
  - `saveLocalGeneratedApp(..., { pendingRemote })` sait marquer/nettoyer l'etat distant en attente.

### Validation effectuee
- `npm run lint` : OK
- `npm run build` : OK
- `npx vercel deploy --prod --yes` : OK
- Prod alias actif: `https://vertex-ai-app-pearl.vercel.app`
- Smokes prod:
  - `GET /` : `200`
  - `GET /storage-reset.json` : `200`
  - `GET /api/status` : `200`
  - bundle prod `assets/main-D616cpFf.js` contient `studio-pro-agents-pending-v1` et `studio-pro-generated-apps-pending-v1`

### Validation restante
- Rejouer sur prod avec le meme compte sur deux appareils:
  - creer un agent/app pendant une degradation Firestore ou hors ligne;
  - retablir reseau / focus;
  - verifier que l'autre appareil voit l'agent/app et que les conversations locales en attente remontent.

### Intention exacte
- Retirer le blocage global du replay local cause par `hasLoadedRemoteGeneratedApps`.
- Faire des agents/generated apps des donnees local-first rejouables, pas des sauvegardes terminales mono-appareil en cas d'echec Firestore.

