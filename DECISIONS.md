# DECISIONS

## 2026-04-16 - Cowork pur adopte une boucle consciente explicite, mais gatee par flag
- Statut: adopte localement
- Contexte: le comportement courant de Cowork pouvait encore livrer trop vite, poser une question sans vrai etat de pause, ou publier un artefact sans verification reelle. L'utilisateur demandait une experience plus proche de Codex / Claude Code / Claude Cowork: progression visible, pause propre, clarification ciblee, et preuve avant cloture.
- Decision:
  - introduire `COWORK_ENABLE_CONSCIOUS_LOOP` et laisser la feature OFF par defaut
  - restreindre cette v1 a `Cowork` pur seulement
  - ajouter un vrai tool `ask_user_clarification` qui met le run en `paused` au lieu de traiter une question comme une livraison
  - promouvoir `publish_status` et `report_progress` dans ce mode conscient, tout en gardant `report_progress` non expose brutement en UI
  - bloquer la cloture sur:
    - demande factualisee/current sans lecture validante
    - artefact cree mais non verifie
    - clarification encore en attente
  - refuser `release_file` si le fichier n'a pas passe la verification d'artefact
- Pourquoi:
  - garder Cowork modele-led sans figer sa strategie
  - rendre la pause/reprise et la verification natives plutot que heuristiques ou cosmetiques
  - limiter le risque produit en gardant une activation progressive
- Consequence:
  - `api/index.ts` porte maintenant un vrai etat `clarification` + `runState=paused`
  - la conversation frontend sait afficher une clarification comme une vraie prise de parole assistant
  - la memoire de conversation transporte assez d'etat pour reprendre correctement apres pause

## 2026-04-15 - Le mode voix standard passe sur `gemini-3.1-flash-tts-preview`, mais le podcast garde `gemini-2.5-pro-tts`
- Statut: adopte localement
- Contexte: l'utilisateur demande d'inclure le nouveau modele TTS `Gemini 3.1 Flash TTS` dans le mode voix et Cowork. Le repo utilisait deja Gemini TTS, mais seulement via les familles 2.5, avec duplication des listes de modeles entre UI, backend et prompts Cowork.
- Decision:
  - centraliser le catalogue TTS partage dans `shared/gemini-tts.ts`
  - exposer `gemini-3.1-flash-tts-preview` dans le mode `audio`, dans Cowork et dans les generated apps
  - en faire le defaut pour la generation voix generique
  - conserver `gemini-2.5-pro-tts` comme defaut du chemin podcast
- Pourquoi:
  - `3.1 Flash TTS` est la nouvelle offre officielle Google pour une TTS expressive, controllable et basse latence
  - le mode voix court gagne a suivre le modele le plus recent
  - le chemin podcast a deja une promesse plus premium et plus longue, donc on evite une bascule brusque de sa signature sonore sans besoin produit explicite
- Consequence:
  - l'UI audio et le runtime Cowork partagent maintenant la meme source de verite pour les modeles TTS
  - le multi-speaker est explicitement autorise pour `gemini-3.1-flash-tts-preview`
  - les alias utilisateur du type `gemini-3.1-flash-tts` sont normalises vers l'identifiant officiel `gemini-3.1-flash-tts-preview`

## 2026-04-15 - Un changement de prompt system sur une session standard ouvre un nouveau contexte logique au prochain envoi
- Statut: adopte localement
- Contexte: l'utilisateur changeait l'instruction systeme puis envoyait un message, mais le premier tour repartait encore avec l'ancien prompt et l'ancien historique. Le symptome disparaissait seulement apres un envoi annule puis relance, signe d'un ordre de priorite d'etat incorrect entre `config` visible et `session shell`.
- Decision:
  - prendre la config visible de la sidebar comme source d'autorite immediate pour `systemInstruction` sur les sessions `standard`
  - commit ce prompt dans `systemPromptHistory` au moment du `send`, pas a chaque frappe
  - couper l'historique envoye au modele a partir du dernier commit du prompt courant
- Pourquoi:
  - un prompt system modifie doit avoir un effet immediat et net des le premier tour
  - on veut eviter de gonfler `systemPromptHistory` a chaque caractere tape
  - le contexte precedent doit rester visible dans l'UI mais ne plus contaminer le run suivant si le cadre systeme a change
- Consequence:
  - `src/App.tsx` resout maintenant `activeSystemInstruction` via helper
  - le premier send apres changement de prompt part avec un historique vide cote API
  - les tours suivants reutilisent uniquement l'historique cree sous ce nouveau prompt

## 2026-04-15 - Le mode video utilise maintenant un flux Veo synchrone avec sortie GCS
- Statut: adopte localement
- Contexte: l'UI `video` etait exposee mais `/api/generate-video` renvoyait encore un `501 Non implemente`.
- Decision:
  - implementer `/api/generate-video` via `@google/genai` + `client.models.generateVideos(...)`
  - poller l'operation via `client.operations.getVideosOperation(...)`
  - retourner au frontend une URL lisible a partir du `gs://...` genere, avec fallback proxy si la signed URL n'est pas disponible
- Pourquoi:
  - corrige le trou fonctionnel le plus visible sans rajouter de dependance
  - reutilise le bucket de sortie et l'auth Vertex AI deja verifies dans le projet
- Consequence:
  - `server/routes/standard.ts` porte maintenant un vrai flux Veo
  - `server/lib/storage.ts` sait transformer un `storageUri` existant en URL lisible
  - le risque restant se concentre sur la duree du polling en environnement serverless strict

## 2026-04-11 - `Cowork Apps` est retire du shell principal
- Statut: adopte localement
- Contexte: l'utilisateur a demande une suppression nette de `Cowork Apps`. La surface etait encore exposee a plusieurs endroits frontend: bouton d'entree dans le header `Cowork`, CTA secondaire dans l'empty state, overlay plein ecran, section `Apps` dans la sidebar et harness de preview dedie.
- Decision:
  - retirer les points d'entree `Cowork Apps` du shell principal
  - supprimer les composants frontend specifiques `src/components/AgentsHub.tsx` et `src/components/CoworkCreationChat.tsx`
  - retirer aussi le harness `tmp/cowork-apps-preview.*`
  - laisser le backend/generated-app lifecycle en place pour l'instant, mais ne plus l'exposer dans la navigation principale
  - rediriger une session `generated_app` historique vers `Cowork` au lieu d'ouvrir une surface app dediee
- Pourquoi:
  - repond exactement a la demande utilisateur sans lancer une migration backend plus large et plus risquee
  - supprime la surface produit visible, les doublons UX et les retours vers un hub qui n'existe plus
  - garde une marche arriere technique possible si l'utilisateur veut ensuite supprimer aussi le lifecycle backend
- Consequence:
  - le mode `Cowork` revient a une entree simple basee sur mission + conversation
  - la sidebar ne montre plus de section `Apps`
  - les composants/generated apps legacy restent dans le repo mais ne sont plus accessibles depuis le shell principal

## 2026-04-11 - La prod Vercel tourne desormais sur `project-82b8c612-ea3d-49f5-864` via un JSON ADC `authorized_user`
- Statut: adopte en production
- Contexte: la prod etait bien deployee avec le dernier code, mais `/api/status` montrait encore un `serviceAccount` sur l'ancien projet `gen-lang-client-0405707007`, ce qui expliquait les erreurs de billing utilisateur. Le remplacement par une nouvelle cle de service account sur le bon projet a ensuite ete bloque par la policy `constraints/iam.disableServiceAccountKeyCreation`.
- Decision:
  - remplacer en Vercel `GOOGLE_APPLICATION_CREDENTIALS_JSON` par le JSON ADC `authorized_user` issu de `gcloud auth application-default login` sur le compte `yassinebenks5@gmail.com`
  - remplacer aussi `VERTEX_PROJECT_ID` et `VERTEX_GCS_OUTPUT_URI` en `production` et `preview`
  - faire distinguer cote code `authorized-user-json` et `service-account-json` dans `server/lib/storage.ts`
  - trim `VERTEX_PROJECT_ID` / `VERTEX_LOCATION` dans `server/lib/google-genai.ts`
- Pourquoi:
  - corrige reellement la prod Vercel sans revenir sur le mauvais projet
  - respecte au mieux la contrainte utilisateur "gcloud auth only" dans un contexte Vercel
  - contourne proprement l'interdiction de creer une nouvelle cle de service account
- Consequence:
  - `/api/status` prod affiche maintenant `googleAuthMode: "authorized-user-json"`
  - `/api/chat` prod ne renvoie plus l'erreur de billing sur `gen-lang-client-0405707007`
  - les uploads GCS prod ecrivent maintenant dans `gs://project-82b8c612-ea3d-49f5-864-studio-output/output`
  - une evolution future vers Workload Identity Federation reste souhaitable si on veut une auth serveur plus stricte

## 2026-04-11 - Le projet GCP final est `project-82b8c612-ea3d-49f5-864`, et le mode ADC utilisateur utilise un proxy fichier si GCS ne peut pas signer
- Statut: adopte localement
- Contexte: apres plusieurs clarifications utilisateur, le vrai projet cible est `My First Project` (`project-82b8c612-ea3d-49f5-864`) avec le compte `yassinebenks5@gmail.com`. Sur ce projet, Vertex fonctionne bien et un bucket dedie peut etre cree, mais `@google-cloud/storage` ne peut pas generer de signed URL classique avec des ADC utilisateur simples (`Cannot sign data without client_email`).
- Decision:
  - garder `project-82b8c612-ea3d-49f5-864` comme projet GCP cible
  - creer un bucket dedie `project-82b8c612-ea3d-49f5-864-studio-output`
  - faire deriver les uploads runtime de `VERTEX_GCS_OUTPUT_URI`
  - conserver les ADC utilisateur (`gcloud auth only`) et, quand la signature GCS echoue, servir les fichiers via une route proxy backend `/api/storage/object`
- Pourquoi:
  - respecte exactement la contrainte utilisateur "pas de JSON service account"
  - garde Vertex et GCS sur la meme identite runtime
  - transforme un blocage technique des signed URLs en chemin applicatif compatible avec le backend existant
- Consequence:
  - `.env` cible maintenant `project-82b8c612-ea3d-49f5-864` + `gs://project-82b8c612-ea3d-49f5-864-studio-output/output`
  - `server/lib/storage.ts` fallback sur un proxy applicatif au lieu d'echouer
  - `server/routes/standard.ts` expose `GET /api/storage/object`
  - le worker Cloud Run reference aussi ce nouveau bucket

## 2026-04-11 - Seul `yassinebenks5@gmail.com` porte l'identite GCP, et les uploads derivent maintenant de `VERTEX_GCS_OUTPUT_URI`
- Statut: adopte localement
- Contexte: l'utilisateur a precise que `yayaben92y@gmail.com` ne sert qu'au volet Firebase et qu'il est normal qu'il n'ait aucun acces au projet GCP. En parallele, le backend principal envoyait encore ses uploads vers le bucket hardcode `videosss92`, ce qui contredisait le changement de projet.
- Decision:
  - utiliser `yassinebenks5@gmail.com` comme seule identite `gcloud` / ADC pour `famous-design-492918-s7`
  - laisser `yayaben92y@gmail.com` hors du scope GCP/Vertex
  - faire deriver les uploads runtime du bucket + prefix definis dans `VERTEX_GCS_OUTPUT_URI`
  - aligner aussi le worker Cloud Run sur ce bucket cible plutot que sur `videosss92`
- Pourquoi:
  - clarifie la separation de responsabilites entre Firebase et GCP
  - supprime un faux diagnostic recurrent base sur le mauvais compte Google
  - garantit que le changement de projet modifie aussi la cible GCS reelle, pas seulement le project id Vertex
- Consequence:
  - `gcloud auth login yassinebenks5@gmail.com --update-adc`
  - `.env` cible maintenant `gs://famous-design-492918-s7-studio-output/output`
  - `server/lib/storage.ts` et `cloud-run/cowork-workers/src/lib/gcs.js` derivent le bucket depuis l'env
  - blocage restant explicitement isole sur la facturation du projet (`BILLING_DISABLED`)

## 2026-04-11 - Le backend Studio utilise uniquement Vertex AI via `gcloud auth` / ADC
- Statut: adopte localement
- Contexte: l'utilisateur ne veut plus aucun chemin `Vertex Express` / API key. Le backend GenAI fonctionnait deja en Vertex AI classique, mais le client GCS restait encore lie a `GOOGLE_APPLICATION_CREDENTIALS_JSON`, ce qui cassait les uploads/media des qu'on voulait tourner uniquement avec `gcloud auth application-default login`.
- Decision:
  - garder un seul mode backend: `Vertex AI` + `application-default credentials` (`gcloud auth`) ou, en override explicite uniquement, un JSON service account
  - ignorer `VERTEX_EXPRESS` et `GEMINI_API_KEY` cote backend
  - initialiser `@google-cloud/storage` aussi en mode ADC pour que GCS et Gemini partagent le meme socle d'auth
  - retirer l'injection de variables Google inutiles dans le bundle frontend
- Pourquoi:
  - un mode d'auth unique reduit les faux diagnostics et la dette de configuration
  - Gemini et GCS doivent converger sur la meme identite runtime pour eviter les cas "chat OK, upload KO"
  - exposer des variables Google au frontend sans usage reel n'apporte rien et augmente le bruit/secrets surface
- Consequence:
  - `server/lib/storage.ts` tombe maintenant sur ADC si `GOOGLE_APPLICATION_CREDENTIALS_JSON` est vide
  - `server/lib/google-genai.ts` journalise qu'`Express/API key` est ignore cote backend
  - `/api/status` expose `googleAuthMode`
  - `vite.config.ts` n'injecte plus `GEMINI_API_KEY` / `VERTEX_*` dans le client
  - `.env.example` documente un flux unique `gcloud config set project` + `gcloud auth application-default login`

## 2026-04-09 - Les shells de session Firestore ne doivent jamais republier `id`, et l'auth navigateur Google passe en redirect
- Statut: adopte localement, rules redeployees et frontend redeploye en production
- Contexte: un fil pouvait apparaitre puis disparaitre parce que `ChatSession.id` etait republié dans `users/{uid}/sessions/{sessionId}` alors que `firestore.rules` ne l'acceptait pas. En parallele, le login Google popup etait casse sur le fixe par un blocage COOP autour de `window.closed`.
- Decision:
  - projeter explicitement `ChatSession` vers un payload Firestore sans `id` ni `messages`
  - garder temporairement `id` tolere dans `firestore.rules` pour couvrir les bundles deja en cache
  - migrer le login navigateur de `signInWithPopup` vers `signInWithRedirect`
- Pourquoi:
  - le document parent `sessions/{id}` doit rester strictement conforme au schema Firestore reel
  - accepter temporairement `id` cote rules evite une panne residuelle tant que tous les clients n'ont pas recharge
  - `signInWithRedirect` est plus robuste que le popup dans les navigateurs qui imposent COOP
- Consequence:
  - `src/App.tsx` porte maintenant `toSessionFirestorePayload()`
  - `firestore.rules` accepte `id` de facon defensive
  - `src/firebase.ts` et `src/App.tsx` utilisent maintenant le couple `signInWithRedirect` / `getRedirectResult`

## 2026-04-09 - Un reset global doit combiner purge cloud et reset navigateur versionne
- Statut: adopte localement et deploye en production
- Contexte: l'utilisateur a demande une remise a zero totale. Effacer seulement Firestore ou seulement `localStorage` ne suffit pas, car des sous-collections orphelines peuvent survivre cote cloud et un navigateur peut garder IndexedDB/caches.
- Decision:
  - purger Firestore par `collectionGroup` (`messages`, `files`, `agents`, `generatedApps`, `custom_prompts`, `sessions`) avant reverification de `users`
  - vider aussi le bucket GCS applicatif
  - servir un marker `/storage-reset.json` cote frontend
  - faire vider par le client:
    - `localStorage`
    - `sessionStorage`
    - IndexedDB
    - Cache Storage
    - cookies accessibles en JS
  - versionner la cle de marker de reset pour qu'un ancien build ne puisse pas acquitter un reset plus fort qu'il ne sait pas executer
- Pourquoi:
  - un reset "partiel" recree exactement le probleme de divergence et de fantomes que l'utilisateur veut eliminer
  - la remise a zero doit etre robuste meme si un onglet ancien est encore ouvert sur une machine
- Consequence:
  - `src/utils/storageReset.ts` porte maintenant un marker `v2`
  - `public/storage-reset.json` force un reset global navigateur
  - la recette de verif dediee vit dans `QA_RECIPES.md`

## 2026-04-09 - Le cache local des conversations devient une file de replay vers Firestore, pas une persistance terminale
- Statut: adopte localement
- Contexte: meme avec Firestore branche comme source de verite, une conversation pouvait rester de fait prisonniere d'un appareil si le `session shell` ou les messages echouaient a s'ecrire au mauvais moment puis restaient seulement dans le cache local.
- Decision:
  - conserver le cache local comme filet de securite
  - exposer explicitement les `session shells` en `pendingRemote` et les snapshots locaux de messages
  - rejouer automatiquement ces ecritures vers Firestore au retour reseau ou retour de focus
  - recreer une session shell si des messages locaux existent encore sans parent distant connu
- Pourquoi:
  - un cache de secours sans replay se transforme fonctionnellement en stockage mono-appareil
  - Firestore doit rester la source de verite de l'historique multi-appareils
  - la correction doit vivre dans le produit lui-meme, pas dans une procedure manuelle
- Consequence:
  - `src/App.tsx` orchestre maintenant ce replay automatique
  - `src/utils/sessionShells.ts`, `src/utils/sessionSnapshots.ts` et `src/utils/cowork.ts` exposent les files locales necessaires
  - `QA_RECIPES.md` porte une regression dediee multi-appareils

## 2026-04-09 - Un snapshot Firestore serveur a autorite sur les shells locaux deja synchronises
- Statut: adopte localement
- Contexte: une fois le replay local ajoute, une divergence restait possible entre machines si la liste des sessions continuait a fusionner des shells locaux deja synchronises mais absents du cloud.
- Decision:
  - distinguer explicitement un snapshot Firestore de cache et un snapshot Firestore autoritaire
  - quand le snapshot est autoritaire (`fromCache === false`), ne conserver localement hors cloud que les shells encore `pendingRemote`
  - purger du store local les shells deja synchronises mais absents du serveur
- Pourquoi:
  - sinon chaque appareil peut entretenir ses propres sessions fantomes
  - le compteur de sessions ne converge jamais vraiment entre machines
  - Firestore doit rester la source de verite finale des listes de sessions
- Consequence:
  - `src/utils/sessionShells.ts` porte maintenant cette notion via `remoteIsAuthoritative`
  - `src/App.tsx` l'active dans le listener `onSnapshot(users/{uid}/sessions)`

## 2026-04-08 - Cowork multi-tour doit etre pilote par le dernier message, pas par le poids de l'historique
- Statut: adopte localement
- Contexte: sur des runs Cowork longs et riches en recherche, un follow-up court pouvait etre noye sous l'historique precedent. Le modele repartait alors sur le premier dossier, relancait des recherches deja faites et ignorait la nouvelle question de l'utilisateur.
- Decision:
  - compacter l'historique envoye a Cowork
  - limiter cet historique aux derniers messages utiles
  - encapsuler le message courant dans un prompt explicite qui rappelle que la priorite absolue est la derniere demande utilisateur
- Pourquoi:
  - un agent de recherche utile doit savoir changer de focale sans rerunner tout le dossier precedent
  - l'utilisateur percoit sinon une IA "bloquee" ou "qui se repete"
  - la correction doit vivre dans le contrat runtime, pas dans un simple wording frontend
- Consequence:
  - `src/utils/chat-parts.ts` porte maintenant un mode `coworkCompact`
  - `api/index.ts` ajoute `buildCoworkCurrentTurnPrompt(...)`
  - la system instruction Cowork rappelle que l'historique precedent n'est qu'un contexte

## 2026-04-08 - Les medias generes conservent leurs metas de generation comme contrat produit de premiere classe
- Statut: adopte localement
- Contexte: sans trace fiable du prompt source, du prompt raffine, du modele et du profil de raffineur, il est impossible de proposer une vraie copie de prompt, une galerie d'instructions exploitable ou un futur createur d'instructions base sur les generations passees.
- Decision:
  - attacher aux medias generes une structure `generationMeta`
  - y conserver `mode`, `prompt`, `refinedPrompt`, `model`, `refinerProfileId` et `refinerCustomInstructions`
  - preservrer cette meta a la sanitization, a la persistance et a la relecture historique
- Pourquoi:
  - la source du rendu est une donnee produit, pas juste un detail debug
  - cela alimente directement les galeries image/audio/video/lyria et le futur chantier "instruction creator"
  - cela evite de recalculer ou de deviner les invites apres coup
- Consequence:
  - `src/types.ts` et `src/App.tsx` portent maintenant ce contrat
  - `AttachmentGallery`, `ImageStudio`, `AudioStudio`, `LyriaStudio` et `VideoStudio` peuvent rendre et recopier les prompts fiables
  - `src/utils/instruction-gallery.ts` peut agreger les instructions depuis l'historique reel

## 2026-04-08 - Le raffineur IA devient configure par mode, pas global
- Statut: adopte localement
- Contexte: l'utilisateur veut un raffineur par mode et des profils beaucoup plus specialises, surtout pour l'image. Un reglage unique global tirait toute l'app vers un comportement trop generique et plus lent a ajuster.
- Decision:
  - stocker `refinerEnabled`, `refinerProfileId` et `refinerCustomInstructions` par mode
  - definir un catalogue partage de profils specialises selon le mode
  - laisser le panneau droit basculer de profil sans casser les autres modes
- Pourquoi:
  - un raffineur image "manga/shonen" n'a rien a voir avec un raffineur chat, audio ou video
  - la personnalisation produit doit etre locale au contexte de creation
  - cela prepare une vraie famille de raffineurs personnalisables au lieu d'un toggle monolithique
- Consequence:
  - `shared/prompt-refiners.ts` devient la source de verite des profils
  - `src/store/useStore.ts` porte la configuration par mode
  - `src/components/SidebarRight.tsx` expose maintenant une UX de profils/refinements par mode

## 2026-04-07 - Les sessions sandbox Phase 2 ne doivent jamais dependre du filesystem local Cloud Run seul
- Statut: adopte localement et valide reellement sur le worker Cloud Run
- Contexte: `install_python_package` pouvait reussir sur une requete, puis `run_python` ou `run_shell` retomber sur un autre instance Cloud Run et perdre le venv/local workspace. Une "session" basee sur `/tmp` uniquement donnait donc un faux sentiment de persistance.
- Decision:
  - considerer `/tmp` comme espace de travail temporaire par requete/instance
  - persister le manifest packages et le workspace de session dans GCS
  - restaurer cette session au debut des requetes suivantes pour le meme `sessionId`
- Pourquoi:
  - Cloud Run reste un runtime disposable et multi-instance
  - la Phase 2 promet une vraie session sandbox, pas juste une execution isolee mono-requete
  - GCS est deja dans la stack, Google-native et suffisant pour ce besoin
- Consequence:
  - ajout de `cloud-run/cowork-workers/src/sandbox/persistence.js`
  - `python.js` et `shell.js` restaurent/persistent l'etat de session
  - les smokes reels incluent maintenant obligatoirement un test sur 2 requetes avec le meme `sessionId`

## 2026-04-07 - Les images du worker `cowork-workers` passent par Artifact Registry, pas Container Registry classique
- Statut: adopte localement et valide reellement
- Contexte: le pipeline initial Phase 2 deployait avant push effectif et utilisait encore `gcr.io`, ce qui a rendu le flux fragile puis bloque par les contraintes/quota du registre cible.
- Decision:
  - construire et pousser l'image worker dans un repo Artifact Registry regional
  - deployer Cloud Run depuis cette image `pkg.dev`
  - garder un `docker push` explicite avant le `gcloud run deploy`
- Pourquoi:
  - meilleur fit actuel GCP / Cloud Run
  - permet un repository regional proche du runtime (`europe-west1`)
  - evite de garder une dependance historique a Container Registry
- Consequence:
  - creation du repo `europe-west1-docker.pkg.dev/.../cowork-workers`
  - `cloudbuild.yaml` migre vers Artifact Registry
  - le pipeline de reference Phase 2 devient `build -> push -> deploy`

## 2026-04-07 - Les routes `chat` et `cowork` doivent ouvrir leur SSE immediatement avec un `traceId` et un heartbeat
- Statut: adopte localement
- Contexte: un PDF joint pouvait laisser `/api/chat` muet jusqu'au timeout gateway, et Cowork souffrait du meme risque structurel tant que le premier octet SSE dependait du premier token modele.
- Decision:
  - ouvrir le SSE des que la requete est validee
  - `flushHeaders()` immediat
  - premier event debug/initialisation avant le travail modele
  - heartbeat `: keep-alive`
  - header `X-Studio-Trace-Id` et propagation du `traceId` dans les events SSE
- Pourquoi:
  - un endpoint SSE ne doit jamais rester une boite noire tant qu'il prepare un prompt, un PDF ou une memoire
  - cela supprime le faux signal "l'IA ne fait rien" et rend les blocages diagnostiquerables depuis F12
  - le meme pattern doit servir de norme pour toutes les futures routes longues (`sandbox`, `browser`, `healing`)
- Consequence:
  - `server/routes/standard.ts` et `api/index.ts` ont maintenant un chemin SSE "ouvert tot"
  - le frontend loggue les `traceId` et les stages backend

## 2026-04-07 - Cowork pur ignore maintenant toute `systemInstruction` custom envoyee par le client
- Statut: adopte, deploye en production
- Contexte: un prompt galerie persiste du type `GEO-PALANTIR` pouvait etre envoye dans `/api/cowork` puis ajoute a `buildCoworkSystemInstruction(...)`, ce qui detournait completement la boucle Cowork et rendait les runs hors sujet.
- Decision:
  - supprimer cote frontend la transmission de cette instruction pour Cowork pur
  - ignorer cote backend `config.systemInstruction` quand le run n'est ni un workspace agent ni une generated app
  - garder une note UI pour clarifier que le champ reste local/visuel mais n'ecrase plus le runtime autonome
- Pourquoi:
  - Cowork a besoin d'un cerveau stable et outille; le laisser etre remplace par une instruction arbitraire casse sa promesse produit
  - les workspaces agent/generated app gardent eux, par definition, un prompt systeme specialise
  - le fix doit vivre aussi au backend, pas seulement dans l'UI, pour couvrir les anciens clients ou payloads sales
- Consequence:
  - `src/App.tsx` supprime l'override pour Cowork pur et le loggue explicitement
  - `api/index.ts` journalise puis ignore cette valeur pour les runs Cowork purs
  - un test prod hostile avec `systemInstruction = "reponds uniquement GEO-PALANTIR"` laisse maintenant Cowork repondre normalement

## 2026-04-07 - La console F12 devient la source de verite client pour les runs Cowork
- Statut: adopte, deploye en production
- Contexte: l'utilisateur ne pouvait pas voir clairement si le blocage venait d'un appel API, d'une synchro Firestore, d'un event SSE Cowork ou d'un fallback local.
- Decision:
  - ajouter `src/utils/client-debug.ts`
  - instrumenter globalement les fetchs `/api/*` et Firestore network side-effects visibles
  - logguer explicitement les preparatifs de requete, les SSE Cowork/chat, les persistences Firestore et les degradations
  - retirer les `alert(...)` Firestore au profit de logs structurés en console
- Pourquoi:
  - le debuggage produit doit partir des faits observables, pas de l'impression UI seule
  - les erreurs Firestore etaient deja presentes mais pas assez structurees pour remonter la vraie cause
  - les alertes bloquantes aidaient moins que des logs riches et persistants dans F12
- Consequence:
  - nouveaux prefixes `[StudioDebug][...]` dans la console
  - `src/firebase.ts` n'affiche plus d'alertes modales sur les erreurs Firestore
  - `src/App.tsx` trace maintenant `/api/chat`, `/api/cowork`, les events SSE et les degradations de persistance

## 2026-04-07 - Sur Vercel, `pdf-parse` reste retenu mais seulement via chargement lazy + worker officiel
- Statut: adopte localement et valide en production
- Contexte: la prod Vercel etait integralement tombee (`/api/status`, `/api/chat`, `/api/cowork`) apres introduction du parsing PDF RAG, parce que `pdf-parse` et `pdfjs-dist` se chargeaient au boot de la function.
- Decision:
  - conserver `pdf-parse` plutot que changer de librairie dans l'urgence
  - ne plus jamais l'importer au top-level
  - charger `pdf-parse/worker` puis `pdf-parse` dans un helper runtime memoise
  - passer `CanvasFactory` au constructeur `PDFParse`
- Pourquoi:
  - la doc officielle `pdf-parse` documente explicitement ce correctif pour les environnements serverless / Vercel
  - cela corrige la panne immediate sans reouvrir un chantier de migration de dependance
  - cela desacouple le boot de la function des besoins PDF, donc `/api/status` et les modes non-PDF restent vivants
- Consequence:
  - `server/lib/chunking.ts` charge maintenant le parser PDF a la demande
  - la validation de reference n'est plus seulement `npm run build`, mais aussi un smoke prod `GET /api/status`

## 2026-04-07 - Phase 1B indexe les medias via resume lisible + embed contextuel, avec fallback texte
- Statut: adopte localement et valide reellement
- Contexte: la Phase 1B doit memoriser image/audio/video, mais un embed media brut seul donne peu de lisibilite pour le debug et peut echouer selon la modalite, la taille ou le quota.
- Decision:
  - generer d'abord un resume/transcript court via `gemini-3.1-flash-lite-preview`
  - appeler ensuite `gemini-embedding-2-preview` sur le media avec ce contexte
  - si l'embed media echoue, fallback propre sur un embedding texte du resume/transcript
  - stocker `summaryKind` et `embeddingStrategy` dans Qdrant
- Pourquoi:
  - garde une memoire lisible dans `### MEMOIRE PERTINENTE`
  - permet un fallback honnete au lieu d'un echec silencieux
  - simplifie le rappel de medias longs ou ambigus
- Consequence:
  - nouveau `server/lib/media-understanding.ts`
  - `server/lib/cowork-memory.ts` passe par `indexFileToMemory()`
  - `server/lib/qdrant.ts` porte un payload multimodal plus riche

## 2026-04-07 - Phase 1A RAG: backend direct vers Qdrant, `userIdHint` explicite et `fileId` genere cote backend
- Statut: adopte localement
- Contexte: le workspace Cowork existant persistait les fichiers via Firestore cote frontend, mais la memoire semantique exige maintenant un index backend vers un vector DB. Sans identite utilisateur backend native, ni `fileId` stable connu cote serveur, l'indexation aurait ete fragile ou melangee.
- Decision:
  - garder Firestore workspace en mode frontend-mediated pour l'UI
  - mais laisser le backend ecrire directement dans Qdrant pour le RAG
  - transmettre `userIdHint` dans le body `/api/cowork`
  - faire generer le `fileId` dans `release_file` cote backend, puis persister ce meme id cote frontend dans Firestore
- Pourquoi:
  - Qdrant ne peut pas dependre d'un aller-retour frontend pour chaque chunk et chaque embedding
  - `userIdHint` est indispensable tant que le backend n'a pas d'identite Firebase utilisateur propre
  - un `fileId` commun backend/frontend evite les index orphelins et rend `memory_recall` / `memory_forget` fiables
- Consequence:
  - `api/index.ts` parse `userIdHint` et `memorySearchEnabled`
  - `release_file` emet `workspace_file_created` avec `fileId`
  - `src/App.tsx` utilise `setDoc(..., fileId)` pour le workspace
  - Qdrant filtre toujours par `userId`

## 2026-04-07 - Cowork v2 demarre par un unique worker Cloud Run et toutes les nouvelles capacites restent gatees
- Statut: adopte localement
- Contexte: le brief Cowork v2 ajoute 4 familles de capacites lourdes (RAG, sandbox, GitOps/healing, browser). Les brancher directement dans `api/index.ts` sans runtime externe recreerait les limites Vercel serverless que le projet veut justement depasser.
- Decision:
  - introduire un seul service `cowork-workers` sur Cloud Run comme point d'extension transverse
  - centraliser son appel dans `server/lib/cowork-workers.ts`
  - etendre `RunMeta` tout de suite pour accueillir les compteurs v2
  - garder toutes les nouvelles capacites OFF par defaut derriere `COWORK_ENABLE_*`
- Pourquoi:
  - un service unique simplifie le deploy, le warm pool, le bearer token et la suite des integrations
  - un helper unique evite que `api/index.ts` accumule des `fetch` Cloud Run disparates
  - le gating OFF par defaut permet un rollback instantane tant que les smokes reels ne sont pas faits
- Consequence:
  - nouveau sous-projet `cloud-run/cowork-workers/`
  - nouveau client `server/lib/cowork-workers.ts`
  - `api/index.ts`, `src/types.ts`, `src/utils/cowork.ts` et `src/components/MessageItem.tsx` portent deja le contrat meta v2
  - la prochaine etape obligatoire est le deploy reel du worker avant toute Phase 1/2/3/4

## 2026-04-07 - Une instruction selectionnee depuis la galerie devient une reference de session editable depuis le panneau droit
- Statut: adopte localement
- Contexte: l'utilisateur veut pouvoir choisir une instruction personnalisee, la modifier pendant qu'il l'utilise, puis sauvegarder directement cette nouvelle version sans repasser par le mode `Modifier` de la galerie.
- Decision:
  - memoriser dans `ChatSession.selectedCustomPrompt` le prompt personnalise actuellement lie a la session
  - afficher dans `SidebarRight` un bloc `Instruction liee` avec un bouton `Mettre a jour`
  - pousser cette mise a jour directement dans `users/{uid}/custom_prompts/{id}` tout en gardant `systemInstruction` sync cote session
- Pourquoi:
  - le flux voulu est une iteration rapide sur une instruction deja choisie, pas un aller-retour permanent vers la galerie
  - garder la reference au niveau session permet de transporter correctement le lien quand une `local-new` devient une vraie conversation
- Consequence:
  - `src/App.tsx`, `src/types.ts` et `src/utils/sessionShells.ts` portent maintenant un vrai lien `selectedCustomPrompt`
  - `src/components/SidebarRight.tsx` peut detecter une divergence locale et proposer une mise a jour directe
  - le snapshot de session peut diverger d'une edition externe jusqu'a re-selection ou mise a jour directe

## 2026-04-06 - Workspace Cowork : frontend-mediated (pas firebase-admin)
- Statut: livré (commit 1f86135)
- Contexte: l'utilisateur veut que l'agent Cowork ait une mémoire persistante de ses créations (type VM)
- Decision: pattern frontend-mediated identique à hubAgents/generatedApps
  - Frontend lit Firestore (/users/{uid}/workspace/files) avant chaque run
  - Envoie les fichiers dans le body (workspaceFiles)
  - Backend injecte dans le system prompt via buildCoworkSystemInstruction
  - release_file émet workspace_file_created → frontend persiste dans Firestore
  - Nouvel outil workspace_delete → émet workspace_file_deleted → frontend supprime
- Pourquoi pas firebase-admin:
  - Le backend n'a pas d'identité par utilisateur (pas de token JWT user)
  - Ajouter firebase-admin demanderait un refactor auth complet
  - Le pattern frontend-mediated est déjà utilisé pour hubAgents, cohérent et sans dépendance nouvelle
- Conséquence:
  - storageUri (gs://) est stocké → permanent, jamais expiré, passable aux modèles Gemini
  - Signed URLs (7j) dans les messages restent valides pour le téléchargement utilisateur

## 2026-04-06 - Fix history media: historyMode remplace raw attachments par texte
- Statut: livré (commit 1f86135)
- Contexte: l'IA re-décrivait les images/médias à chaque message suivant car buildApiMessageParts renvoyait les données binaires pour tous les messages historiques
- Decision: option historyMode dans buildApiMessageParts → remplace attachment data par "[Pièce jointe: nom — mimeType]"
- Pourquoi: le message courant continue d'envoyer les vraies données via le champ attachments séparé; l'historique n'a besoin que d'une référence textuelle

## 2026-04-04 - Migration design system: cyan → indigo, border-radius standardises
- Statut: deploye sur main (commit cdbdc0b)
- Contexte: l'utilisateur trouve le site moche et demande un redesign complet de toute l'UI/UX
- Decision:
  - Accent principal: indigo (#818cf8 dark / #6366f1 light) remplace cyan (#81ecff / #44c4ff)
  - Font: Inter + JetBrains Mono remplace Sora
  - Background: #09090b (zinc-950) remplace les gradients complexes
  - Border-radius: 3 paliers standardises (lg/xl/2xl) remplacent 15+ valeurs custom
  - Retrait de la scene Three.js du StudioEmptyState (hero simplifie)
- Pourquoi:
  - Cyan etait trop "generique chatbot IA", indigo donne plus de personnalite
  - Les border-radius custom creaient une inconsistance visuelle entre composants
  - Inter est plus lisible que Sora a petite taille et mieux supporte
  - Le hero Three.js alourdissait le premier ecran pour un gain visuel marginal
- Consequence:
  - Tous les composants partagent le meme langage visuel
  - StudioHeroScene reste dans le codebase mais n'est plus charge par l'empty state

## 2026-04-02 - Le hero vide passe sur une scene `three.js` lazy-load, sans `react-three-fiber`
- Statut: adopte localement
- Contexte: l'utilisateur veut une vraie refonte plus Awwwards, plus epuree, avec beaucoup plus d'air et explicitement une presence `three.js`.
- Decision:
  - remplacer l'ancien empty state multi-sections par un hero editorial unique
  - ajouter `src/components/StudioHeroScene.tsx` en `three` brut
  - charger cette scene uniquement a la demande depuis `src/components/StudioEmptyState.tsx`
  - garder `react-three-fiber` hors de ce lot
- Pourquoi:
  - la demande porte sur une seule grande scene d'ambiance, pas sur une app 3D composee de nombreux composants reactifs
  - `three` seul ajoute une dependance de moins qu'un couple `three` + `react-three-fiber`
  - le lazy load garde le cout hors du chemin critique des surfaces qui n'affichent pas l'accueil vide
- Consequence:
  - nouvel axe visuel porte par `src/components/StudioHeroScene.tsx`
  - `src/components/StudioEmptyState.tsx` devient un hero court, tres peu texte, fortement guide par l'image
  - dette assumee: le chunk lazy `StudioHeroScene` reste lourd et devra etre surveille si la scene s'etend

## 2026-04-02 - Cowork ne doit deleguer au Hub que sur opt-in explicite
- Statut: adopte localement
- Contexte: l'utilisateur signale que Cowork se mettait a utiliser le Hub Agents "par defaut" des qu'on lui demandait quelque chose. Cela brouille la promesse produit de Cowork comme runtime autonome generaliste.
- Decision:
  - ajouter un toggle visible dans `SidebarRight`:
    - `Utiliser les agents du Hub`
  - laisser ce toggle desactive par defaut
  - quand il est coupe:
    - ne pas envoyer `hubAgents` au backend
    - ne pas exposer les tools de delegation a Cowork
    - ne pas injecter de consignes systeme sur le Hub
- Pourquoi:
  - la delegation doit etre un choix utilisateur, pas une surprise de runtime
  - cela garde Cowork lisible quand on veut juste un run direct
  - cela evite des bifurcations produit implicites difficiles a comprendre
- Consequence:
  - `src/App.tsx` gate maintenant `hubAgents`
  - `api/index.ts` filtre la consigne et les tools hub selon `agentDelegationEnabled`
  - le comportement par defaut de Cowork redevient non delegue

## 2026-04-02 - Lyria devient un mode de premiere classe, separe du TTS
- Statut: adopte localement
- Contexte: la surface `audio` melangeait implicitement plusieurs intentions produit. Or `text-to-speech` et `generation musicale` n'ont ni les memes controles, ni la meme metaphore, ni la meme direction visuelle.
- Decision:
  - garder `audio` pour `text-to-speech`
  - ajouter un mode dedie `lyria`
  - donner a `lyria`:
    - son entree sidebar
    - sa propre copie
    - ses propres reglages (`sampleCount`, `negativePrompt`, `seed`)
    - sa propre restauration de session
- Pourquoi:
  - rend la navigation plus claire
  - permet une DA et une UX plus justes pour la composition musicale
  - evite de surcharger le mode TTS avec des reglages qui n'ont rien a y faire
- Consequence:
  - `src/types.ts`, `src/store/useStore.ts`, `src/App.tsx`, `SidebarLeft`, `SidebarRight`, `StudioEmptyState` et `sessionRecovery` portent maintenant un vrai chemin `lyria`

## 2026-04-02 - Les liens YouTube passent nativement par `fileData.fileUri` avec `videoMetadata`
- Statut: adopte localement
- Contexte: apres la correction `gs://` pour les fichiers uploadees, les liens YouTube restaient encore reduits a un texte `Titre + URL`. L'utilisateur veut explicitement le comportement de Google AI Studio, qui traite YouTube comme une vraie entree video et expose des reglages `debut / fin / FPS`.
- Decision:
  - stocker les reglages YouTube sur l'attachment lui-meme via `videoMetadata`
  - construire cote backend une vraie part Gemini:
    - `fileData.fileUri = url YouTube`
    - `fileData.mimeType = video/mp4`
    - `videoMetadata.startOffset|endOffset|fps`
  - ne garder le fallback texte que si l'URL est absente ou invalide
- Pourquoi:
  - aligne l'app sur la voie native documentee par Google au lieu d'un contexte textuel appauvri
  - permet enfin au modele de raisonner sur les frames et le contenu reel de la video
  - garde une persistance claire des reglages utilisateur entre chat et Cowork
- Consequence:
  - `server/lib/chat-parts.ts` porte maintenant la conversion native YouTube
  - `src/components/ChatInput.tsx` expose un modal de reglages video
  - `src/components/AttachmentGallery.tsx` rend visibles ces reglages sur la carte persistente
  - `verify-chat-parts.ts` couvre ce contrat

## 2026-04-02 - Les pieces jointes persistentes gardent 2 adresses: URL signee pour l'UI, `gs://` pour le modele
- Statut: adopte localement
- Contexte: une video uploadee dans le chat ou dans Cowork arrivait bien en GCS, mais le backend essayait ensuite de la relire via l'URL signee HTTP. Pour les videos un peu lourdes, cela finissait en fallback texte (`Nom + URL`) et Gemini ne voyait plus le contenu reel. Les documents texte non-PDF etaient egalement sous-traites.
- Decision:
  - stocker `storageUri` (`gs://bucket/object`) sur les attachments en plus de l'URL signee
  - preferer `fileData` pour image/audio/video/PDF quand un `gs://` est disponible
  - decoder explicitement les documents texte (`txt`, `md`, `csv`, `json`, etc.) en part `text`
- Pourquoi:
  - l'URL signee sert bien la preview/telechargement UI, mais c'est un mauvais contrat de relecture multimodale pour le modele
  - `gs://` stabilise la rehydratation des anciens messages et evite le downgrade a un simple titre
  - le texte brut gagne un rendu lisible sans dependre d'un parseur de fichier cote modele
- Consequence:
  - `src/App.tsx`, `shared/chat-parts.ts`, `server/lib/storage.ts`, `server/lib/chat-parts.ts` et `api/index.ts` portent maintenant ce double contrat
  - les regressions de pieces jointes se valident via `verify-chat-parts.ts`

## 2026-04-02 - L'etat d'accueil doit court-circuiter completement la pile messages
- Statut: adopte localement
- Contexte: le shell pouvait rester vide tant que l'accueil premium et la pile messages/virtualizer etaient encore evalues ensemble sur une session sans vrai contenu.
- Decision:
  - quand il n'y a ni conversation rendable ni historique actif sur la surface, `App` rend uniquement l'ecran d'accueil
  - la virtualisation et les composants de messages ne sont plus evalues dans ce cas
- Pourquoi:
  - l'entree produit doit etre deterministe et visible
  - l'etat vide ne doit dependre d'aucune subtilite de rendu de la timeline
- Consequence:
  - `src/App.tsx` short-circuite explicitement la pile messages
  - `src/components/StudioEmptyState.tsx` devient une vraie scene canonique pour le premier ecran

## 2026-04-02 - Les surfaces secondaires sortent du bundle critique
- Statut: adopte localement
- Contexte: le bundle principal etait devenu trop lourd pour le premier chargement du shell, surtout avec les surfaces Cowork/generated apps importees systematiquement.
- Decision:
  - charger a la demande:
    - `AgentsHub`
    - `AgentWorkspacePanel`
    - `NasheedStudioWorkspace`
    - `GeneratedAppHost`
    - `SystemInstructionGallery`
- Pourquoi:
  - le shell doit afficher vite son entree principale
  - ces surfaces n'ont pas a peser sur le premier paint tant qu'elles ne sont pas ouvertes
- Consequence:
  - `main` Vite descend d'environ `928 kB` a `816 kB` minifies
  - le warning chunk reste present, mais la dette est sensiblement reduite

## 2026-04-02 - Une generated app se definit par transcript, planner et source, pas par un wizard local
- Statut: adopte localement
- Contexte: le hub `Cowork Apps` imposait encore une structure produit locale avant generation, ce qui contredisait le besoin utilisateur d'apps vraiment auto-definies.
- Decision:
  - retirer les cartes/types de creation du hub
  - laisser l'utilisateur envoyer un brief libre
  - laisser Cowork poser lui-meme une clarification conversationnelle si necessaire
  - faire produire ensuite par Cowork le contrat complet de l'app et sa source TSX
- Pourquoi:
  - la bonne intelligence doit vivre dans Cowork, pas dans un wizard frontend
  - cela permet des apps hybrides ou inattendues sans forcer l'utilisateur a rentrer dans une taxonomie locale
- Consequence:
  - `src/components/AgentsHub.tsx` ne dirige plus la creation via des options
  - `server/lib/generated-apps.ts` opere maintenant en `transcript -> planner -> source`
  - `server/routes/standard.ts` et `src/App.tsx` supportent un vrai cycle de clarification SSE

## 2026-04-02 - `outputKind` devient un champ de compatibilite legacy, pas une autorite produit
- Statut: adopte localement
- Contexte: les generated apps etaient encore partiellement pilotees par des familles produit (`podcast`, `debate`, etc.), ce qui redonnait au backend un role de directeur creatif.
- Decision:
  - garder `outputKind` seulement comme derive/fallback de compatibilite store et historique
  - faire porter l'intention reelle par:
    - `identity`
    - `modalities`
    - `uiSchema`
    - `runtime.toolDefaults`
    - la source TSX generee
- Pourquoi:
  - une app peut etre hybride, evolutive ou non classable proprement dans une famille unique
  - la specialisation doit venir du manifest complet et du composant genere, pas d'une etiquette reductrice
- Consequence:
  - `server/lib/generated-apps.ts` sanitise de facon neutre
  - `api/index.ts` n'utilise plus `outputKindHint` pour `create_generated_app`
  - les prompts frontend/runtime n'injectent plus `Type de sortie attendu`

## 2026-04-02 - Les defaults d'outils appartiennent au manifest via `runtime.toolDefaults`
- Statut: adopte localement
- Contexte: l'ancien helper media injectait des comportements specialises cote backend a partir de branches produit. Cela fuyait encore une logique "famille d'app" au lieu d'une logique "app souveraine".
- Decision:
  - remplacer `applyRuntimeMediaToolDefaults()` par `applyRuntimeToolDefaults()`
  - merger generiquement les arguments outils avec `manifest.runtime.toolDefaults`, puis appliquer seulement les fallbacks de modeles autorises
- Pourquoi:
  - le comportement runtime doit etre declare par l'app elle-meme
  - le backend doit rester un mergeur et un garde-fou, pas un auteur de comportement cache
- Consequence:
  - `test-cowork-loop.ts` couvre maintenant l'interpolation et le merge generique
  - une app peut declarer ses propres defaults pour audio, image ou autres modalites sans ajouter une nouvelle branche backend

## 2026-04-02 - Le composant genere devient le rendu principal, le host natif devient un fallback
- Statut: adopte localement
- Contexte: tant que le canvas natif restait le chemin principal, les generated apps restaient produitement des manifests rendus par un host, plus que de vraies apps auto-definies.
- Decision:
  - preferer le composant genere des qu'il est pret et que l'app est en mode autonome
  - conserver le canvas natif uniquement comme filet de securite legacy / erreur bundle
- Pourquoi:
  - respecte mieux la promesse "Cowork genere une vraie app"
  - garde une migration douce sans casser les apps deja creees
- Consequence:
  - `src/components/GeneratedAppHost.tsx` distingue maintenant `autonomous_component` et `legacy_manifest`
  - les anciennes apps restent ouvrables, les nouvelles prennent le chemin principal le plus autonome possible

## 2026-04-02 - Une generated app de debat ne doit pas rester un podcast generique
- Statut: adopte localement
- Contexte: `IA Duel Podcast` etait bien classee comme app audio/podcast, mais rien n'obligeait vraiment le manifest ni le runtime a rester dans un vrai mode debat contradictoire. Le resultat pouvait donc glisser vers une chronique solo.
- Decision:
  - detecter l'intention `debat/duel` des la sanitation du manifest
  - specialiser a la fois l'UI, les capacites et la consigne runtime
  - injecter des defaults duo dans `create_podcast_episode` quand l'app est un duel
- Pourquoi:
  - le type `podcast` seul est trop large et ne suffit pas a garantir la promesse produit "deux IA qui debattent"
  - la specialisation doit vivre dans les donnees, pas seulement dans le wording marketing
- Consequence:
  - `server/lib/generated-apps.ts` et `api/index.ts` portent maintenant une branche produit explicite pour les generated apps de debat
  - une app duel peut se regenerer avec un vrai schema contradictoire et un runtime duo par defaut

## 2026-04-02 - La creation generated app doit poser une clarification initiale avant de lancer Cowork
- Statut: adopte localement
- Contexte: le besoin utilisateur n'est pas toujours totalement specifie dans le premier brief. Sans clarification, Cowork peut fabriquer une app correcte techniquement mais mal cadree produitement.
- Decision:
  - inserer une premiere couche de clarification dans `Cowork Apps` avec 2-3 options concretes, une recommandation expliquee et une voie `Autre direction`
  - n'envoyer la creation reelle qu'apres cette validation utilisateur
- Pourquoi:
  - rapproche l'experience de travail de celle d'un bon binome produit/tech
  - reduit les drafts "a cote du besoin" sans figer le systeme en wizard trop lourd
- Consequence:
  - `src/components/AgentsHub.tsx` gere maintenant un etat de clarification avant generation
  - les prompts de creation generes sont enrichis par le choix ou la direction libre de l'utilisateur

## 2026-04-02 - Le livrable audio principal d'une generated app doit etre mis en avant comme un master, pas comme un attachment anonyme
- Statut: adopte localement
- Contexte: la liste d'artefacts brute rendait l'audio final peu lisible et peu desirable, surtout pour une app premium type podcast/debat.
- Decision:
  - promouvoir le dernier artefact audio comme `Master audio`
  - exposer ses metas de speakers/mix/duree dans une carte dediee avec lecteur et actions explicites
- Pourquoi:
  - renforce la lisibilite produit
  - transforme un resultat technique en sortie editoriale assumee
- Consequence:
  - `shared/generated-app-sdk.tsx` calcule un `featuredAudioArtifact`
  - les metas podcast remontees par `api/index.ts` sont maintenant visibles dans le host

## 2026-04-02 - Une generated app doit imposer ses defaults media via le runtime, pas seulement les suggerer
- Statut: adopte localement
- Contexte: une generated app podcast pouvait afficher `ttsModel: gemini-2.5-flash-tts` dans son host, tout en executant `create_podcast_episode` avec le default global `gemini-2.5-pro-tts` si le modele n'explicitait pas `ttsModel` dans l'appel outil.
- Decision:
  - injecter `modelProfile.imageModel|ttsModel|musicModel` comme vrais defaults techniques dans les outils media du runtime generated app
  - ne plus se contenter de les mentionner dans `buildGeneratedAppRuntimeSystemInstruction()`
- Pourquoi:
  - une config visible mais non appliquee degrade la confiance produit
  - cela aligne enfin l'identite de l'app, son host et son execution reelle
- Consequence:
  - `api/index.ts` applique maintenant `applyRuntimeMediaToolDefaults()` avant le meta/log et avant l'execution de `generate_image_asset`, `generate_tts_audio`, `generate_music_audio`, `create_podcast_episode`
  - les tests Cowork couvrent explicitement ces defaults runtime

## 2026-04-02 - Les generated apps doivent filtrer leurs outils par famille produit
- Statut: adopte localement
- Contexte: la creation d'apps intersectait seulement la `toolAllowList` avec la librairie globale. Une app `podcast` pouvait donc garder `write_file` ou d'autres outils peu coherents avec sa promesse produit.
- Decision:
  - introduire une allowlist d'outils par `outputKind`
  - imposer des outils minimums pour certaines familles (`podcast` => `create_podcast_episode` + `release_file`, etc.)
- Pourquoi:
  - reduit les chemins d'execution parasites
  - augmente les chances que l'app fasse naturellement le bon geste principal
- Consequence:
  - `server/lib/generated-apps.ts` filtre maintenant les outils podcast hors famille
  - les manifests generated app restent specialises au niveau de l'UX et du runtime

## 2026-04-01 - Un bundle optionnel indisponible en environnement empaquete devient `skipped`, pas `failed`
- Statut: adopte
- Contexte: plusieurs drafts generated app remontaient un faux echec build avec `Could not resolve "./src/generated-app-sdk.tsx"` et `Could not resolve "react/jsx-runtime"`. Le rendu natif et la publication continuaient pourtant de fonctionner, donc le produit affichait une alarme rouge pour une capacite secondaire.
- Decision:
  - distinguer trois etats reellement utiles: `ready`, `skipped`, `failed`
  - reclasser les erreurs de resolution connues liees a l'environnement empaquete en `bundleStatus='skipped'`
  - ne reserver `failed` qu'aux vrais echec de bundle applicatifs
  - masquer le diagnostic UI pour le cas `skipped`
- Pourquoi:
  - aligne l'UI avec la verite produit: le preview natif est canonique
  - evite de faire croire qu'une draft est cassée alors que seul son bundle optionnel manque
  - garde quand meme le rouge et le diagnostic pour les vrais echecs applicatifs
- Consequence:
  - le flux SSE generated app inclut maintenant `bundle_skipped`
  - `sanitizeGeneratedAppManifest()` et `normalizeGeneratedApp()` nettoient aussi les anciennes drafts touchees par ce faux echec
  - `GeneratedAppHost` n'affiche plus de panneau diagnostic sur un simple skip d'environnement

## 2026-04-01 - Le preview generated app devient natif, le bundle devient un diagnostic optionnel
- Statut: adopte
- Contexte: le vrai point de rupture produit n'etait pas la generation de source, mais le bundling runtime dans la function backend empaquetee. En prod, la function ne retrouve pas toujours les modules frontend utilises au build de draft, alors que le meme chemin marche localement.
- Decision:
  - faire de `GeneratedAppCanvas` le chemin de rendu canonique dans `GeneratedAppHost`
  - conserver `sourceCode` comme verite produit de la draft
  - garder `bundleCode` / `bundleUrl` comme diagnostic best-effort avec `bundleStatus`
  - autoriser `publish` tant que la source reste exploitable, meme si le bundle de preview a echoue
  - normaliser les vieux `status='failed'` vers `draft` quand une source reste utilisable
- Pourquoi:
  - le code genere aujourd'hui est un scaffold autour du canvas natif; faire du bundle la condition de survie produit etait donc une complexite fragile sans vrai gain UX
  - cela supprime la regression prod "draft inexploitable juste parce que la function empaquetee ne rebundle pas"
  - cela garde un panneau diagnostic honnete sans bloquer l'utilisateur
- Consequence:
  - lifecycle reel retenu: `spec -> source -> native preview -> optional bundle -> publish`
  - `GeneratedAppVersion` porte maintenant `bundleStatus`
  - `GeneratedAppHost` doit toujours rester ouvrable si le manifest et la source existent

## 2026-04-01 - Cowork doit generer de vraies apps deployables, pas seulement des agents du hub
- Statut: adopte
- Contexte: le besoin utilisateur a change de nature. Le modele "Cowork cree un agent du Hub" restait trop proche d'un specialiste interne. Le besoin reel est: Cowork doit sortir une vraie app experte avec son propre prompt systeme, sa propre UI, sa liste d'outils autorises, et une ouverture sans chat generique.
- Decision:
  - introduire une nouvelle famille d'entites `generated app`, distincte du contrat agent legacy
  - faire porter a chaque app un `GeneratedAppManifest` complet : identite produit, `systemInstruction`, `toolAllowList`, `modelProfile`, UI, direction visuelle, versions source/bundle et statut
  - ouvrir ces apps dans `GeneratedAppHost`, jamais dans `AgentWorkspacePanel`
  - faire tourner leur execution sur `/api/cowork` avec un nouveau payload `appRuntime`
- Pourquoi:
  - le bon niveau de specialisation produit n'est plus "un agent de plus", mais un mini-produit deploye dans le produit
  - cela permet de garder Cowork comme architecte/editeur tout en donnant a l'utilisateur final une vraie surface d'usage
  - le runtime reste mutualise, mais l'identite et les permissions deviennent propres a chaque app
- Consequence:
  - `src/types.ts`, `server/lib/schemas.ts`, `api/index.ts` et `src/App.tsx` portent maintenant un vrai chemin `generated_app`
  - le store peut afficher a la fois des agents legacy et des generated apps, mais le flux produit cible privilegie ces dernieres

## 2026-04-01 - Le lifecycle generated app est `spec -> source -> bundle -> preview -> publish`
- Statut: adopte
- Contexte: l'utilisateur veut du "deployed-first" sans que Cowork ecrive directement le repo de production. Il faut donc une version source et une version bundle, puis une distinction nette entre draft et live.
- Decision:
  - generer le code React/TSX en string cote serveur
  - bundler cette source en ESM navigateur via `esbuild`
  - conserver la draft meme si le build echoue, avec `status: failed` et `buildLog`
  - publier uniquement par action explicite, en recopiant la draft vers `publishedVersion`
  - lors d'une evolution Cowork, regenerer une nouvelle draft sans casser la version live existante
- Pourquoi:
  - respecte la demande "vrai code React" et "preview puis publish"
  - donne un host fiable pour la previsualisation et le debug
  - evite d'ecraser silencieusement une app publiee a chaque iteration Cowork
- Consequence:
  - `server/lib/generated-apps.ts` devient le coeur de la chaine de build/versioning
  - le host frontend peut charger soit le `bundleCode`, soit le `bundleUrl`
  - les tests produit doivent maintenant couvrir explicitement les cas `failed draft`, `publish`, `update draft`

## 2026-04-01 - `Nasheed Studio` doit privilegier une scene utilitaire courte plutot qu'un studio bavard
- Statut: adopte
- Contexte: le premier `Nasheed Studio` dedie remplissait bien sa mission fonctionnelle, mais le retour utilisateur est net: l'interface restait peu esthetique et surtout surchargee de texte. Header, hero, lancement et journal repetaient trop d'explications.
- Decision:
  - recentrer `src/components/NasheedStudioWorkspace.tsx` sur une seule grande scene de composition
  - couper les paragraphes marketing ou explicatifs redondants
  - garder seulement trois zones lisibles: direction/reglages a gauche, scene + wave bus au centre, sorties/run a droite
  - condenser le vocabulaire d'etat (`Pret`, `En rendu`, `Master pret`) et les demandes d'evolution du studio dans un dock compact
- Pourquoi:
  - une app studio doit se lire comme un instrument de travail, pas comme une brochure
  - la direction visuelle premium vient plus de la hierarchie, de l'espace et de la retenue que de la quantite de blocs
  - cela laisse respirer les vraies donnees du morceau au lieu de noyer l'utilisateur sous du texte produit
- Consequence:
  - `src/components/NasheedStudioWorkspace.tsx` porte maintenant une DA plus sobre et poster-like
  - les validations QA doivent verifier explicitement l'absence de longues copies redondantes
  - la prochaine verification critique se fera sur des blueprints reels pour confirmer que la compaction tient avec du contenu moins controle

## 2026-04-01 - Les apps musicales sortent du bucket podcast et ouvrent un vrai studio
- Statut: adopte
- Contexte: le besoin utilisateur est explicite: cliquer sur `Nasheed Studio` depuis le hub ne doit pas ouvrir un chat ni un panneau agent generique. L'architecture precedente forçait encore les experiences audio creatrices dans `podcast`, puis dans un workspace hybride studio + timeline.
- Decision:
  - ajouter `outputKind: music` au contrat blueprint/app
  - laisser le runtime outille `/api/cowork` intact, mais rendre la surface utilisateur via un composant plein ecran dedie `NasheedStudioWorkspace`
  - traiter aussi comme `music` les apps historiques mal classees en `podcast` quand leur identite parle clairement de nasheed/musique/Lyria
- Pourquoi:
  - la metaphore produit "podcast" etait fausse pour un studio de composition musicale
  - le bon niveau de specialisation doit venir de la surface, pas seulement du prompt systeme
  - cette separation permet a Cowork de continuer a architecturer les apps sans imposer au user final une UX de conversation
- Consequence:
  - `server/lib/agents.ts` peut maintenant generer de vraies apps `music` avec `generate_music_audio`
  - le hub et les previews savent reconnaitre/rendre cette famille d'apps
  - les futures surfaces specialisees pourront suivre le meme schema sans recoder le backend agentique

## 2026-04-01 - `Cowork Apps` adopte une composition "laboratoire Cowork" proche de la reference produit
- Statut: adopte
- Contexte: le lobby plein ecran precedent etait deja plus propre qu'un dashboard, mais il restait trop abstrait face a la reference utilisateur. Le besoin reel etait une scene plus proche d'un produit Cowork final: topbar utilitaire, hero central tres editorial, rail d'apps en bas et panneau de co-creation lateral.
- Decision:
  - refaire `src/components/AgentsHub.tsx` en layout 2 colonnes type "laboratoire"
  - ajouter une vraie barre de recherche visuelle en topbar
  - recentrer le hero sur un statement fort, avec moins de chrome parasite
  - transformer le dock bas en rail de mini-studios avec CTA courts
  - remplacer le simple create box par un panneau lateral de co-creation avec type d'app, brief et notes
- Pourquoi:
  - colle beaucoup mieux a la reference visuelle attendue
  - garde le cap premium/non generique sans revenir a un catalogue technique
  - rend plus evidente la promesse produit "ouvrir une app ou en co-creer une nouvelle"
- Consequence:
  - `src/components/AgentsHub.tsx` porte maintenant une vraie composition desktop type poster + labo
  - la QA visuelle doit verifier explicitement la topbar, le hero complet et la colonne laterale
  - la prochaine verification prioritaire se fait dans la vraie app avec des donnees reelles

## 2026-04-01 - `Cowork Apps` doit tenir dans un seul viewport et paginer au lieu de scroller
- Statut: adopte
- Contexte: meme en vue plein ecran, le lobby `Cowork Apps` restait coupe sur des hauteurs desktop courantes. Le besoin utilisateur est explicite: tout voir sans descendre, puis utiliser des fleches si le nombre d'apps depasse la place disponible.
- Decision:
  - verrouiller `src/components/AgentsHub.tsx` sur un vrai layout `100dvh` sans scroll
  - remplacer la liste libre d'apps par un dock pagine avec fleches gauche/droite
  - faire suivre automatiquement la page courante a l'app selectionnee
  - partager le footer desktop entre le dock et la creation pour economiser la hauteur
  - remonter le CTA d'ouverture dans le header du dock plutot que sous le spotlight
- Pourquoi:
  - respecte le besoin produit "je vois toute la page"
  - evite qu'un simple overflow cache l'action principale d'ouverture
  - garde un lobby calme meme quand le nombre d'apps augmente
- Consequence:
  - `src/components/AgentsHub.tsx` gere maintenant `page`, `pageSize`, `viewport` et `totalPages`
  - le dock d'apps n'a plus besoin de scroll vertical
  - les validations QA doivent se faire sur des tailles de viewport reelles (`1440x900`, `430x932`)

## 2026-04-01 - `Cowork Apps` doit s'ouvrir comme une vraie surface a part
- Statut: adopte
- Contexte: meme reframed en store, le hub restait percu comme une vue serree injectee dans le shell principal. Le retour utilisateur est explicite: quand on ouvre le hub, les sidebars doivent disparaitre et la surface doit ressembler a une autre app.
- Decision:
  - faire de `showAgentsHub` un vrai mode de rendu plein ecran cote `src/App.tsx`
  - ne plus rendre `SidebarLeft`, `SidebarRight`, le header standard, le chat et les overlays quand `Cowork Apps` est ouvert
  - simplifier `src/components/AgentsHub.tsx` en lobby minimal: icones, noms, app selectionnee, chatbox de creation en bas
  - ouvrir une app depuis le hub sans auto-run initial; l'execution part ensuite depuis le studio dedie
- Pourquoi:
  - colle beaucoup mieux au modele mental "autre app dans l'app"
  - supprime immediatement la sensation de densite et de shell compresse
  - clarifie le role du hub: selection/creation d'apps, pas configuration exhaustive
- Consequence:
  - `src/App.tsx` route maintenant vers une vue plein ecran `Cowork Apps`
  - `src/components/AgentsHub.tsx` est devenu une scene tres epuree
  - `openAgentWorkspace()` accepte maintenant une ouverture sans auto-run pour respecter ce flow

## 2026-04-01 - Le Hub devient un app store Cowork, pas un registre d'agents
- Statut: adopte
- Contexte: le besoin produit a ete reprécise tres clairement. Une surface "hub agent" meme executable restait encore trop abstraite et trop technique. L'utilisateur veut voir un store local d'apps creees par Cowork, avec plusieurs mini-produits distincts, chacun ayant son interface, sa promesse et sa logique propre.
- Decision:
  - requalifier toute la surface hub en `Cowork Apps`
  - presenter les entites du hub comme des apps creees par Cowork, pas comme des agents a configurer
  - donner a chaque app une famille de rendu/studio selon `outputKind` via un composant partage `AgentAppPreview`
  - faire du workspace ouvert un studio d'app dedie plutot qu'un panneau agent generique
- Pourquoi:
  - c'est le vrai modele mental produit attendu par l'utilisateur
  - cela rend la valeur beaucoup plus concrete: promesse, type de sortie, studio et interface sont visibles avant meme l'ouverture
  - cela permet de garder le runtime agentique existant tout en changeant radicalement la perception produit
- Consequence:
  - `src/components/AgentsHub.tsx` devient une vitrine `app store`
  - `src/components/AgentWorkspacePanel.tsx` devient un studio d'app
  - `src/components/AgentAppPreview.tsx` centralise les previews/specimens d'interface par famille d'app
  - `src/App.tsx` et `server/lib/agents.ts` parlent maintenant d'apps Cowork plutot que d'agents abstraits

## 2026-03-31 - La memoire des runs Cowork doit etre explicitement reinjectee au modele sur les tours suivants
- Statut: adopte
- Contexte: Cowork persistait bien ses messages riches (`activity`, `runMeta`, `attachments`) pour l'UI et Firestore, mais au tour suivant le modele ne recevait plus que `content` + `attachments`. Sur une remarque comme "le lien est mauvais", il n'avait donc pas une memoire operationnelle fiable du `release_file` precedent et pouvait reexecuter toute la mission.
- Decision:
  - enrichir la serialisation d'historique cote frontend avec un mode `includeCoworkMemory`
  - injecter dans l'historique Cowork/agent une memoire textuelle compacte contenant l'etat du run, les derniers resultats utiles et les URLs des livrables deja publies
  - ajouter une consigne systeme Cowork demandant de reutiliser d'abord l'artefact deja cree/publie quand l'utilisateur signale un lien mauvais ou expire
- Pourquoi:
  - la persistance produit ne sert pas a l'agent si elle n'est pas relayee dans le prompt du tour suivant
  - les attachments inline peuvent cacher l'URL exacte au modele; il faut donc aussi une forme textuelle concise
  - cette approche reste modele-led: on n'impose pas un workflow, on restaure juste la memoire utile du run precedent
- Consequence:
  - `src/utils/chat-parts.ts` construit maintenant une memoire Cowork textuelle optionnelle
  - `src/App.tsx` active cette memoire seulement pour `/api/cowork`
  - un follow-up de correction de lien a beaucoup plus de chances de reutiliser le bon livrable au lieu de repartir de zero

## 2026-03-31 - Un livrable Cowork publie devient une vraie piece jointe de message
- Statut: adopte
- Contexte: Cowork savait deja creer et publier des fichiers, mais l'utilisateur ne recevait souvent qu'un lien texte dans la reponse finale. Cela cassait la promesse produit de "livrer" un media directement dans la page, surtout pour `mp3`, `mp4` et autres formats previewables.
- Decision:
  - enrichir `release_file` avec un payload riche (`path`, `fileName`, `mimeType`, `attachmentType`, `fileSizeBytes`)
  - emettre un evenement SSE explicite `released_file` apres une publication reussie
  - hydrater cet evenement dans `src/utils/cowork.ts` comme `msg.attachments` persistantes plutot que de tenter de parser le texte final
  - centraliser l'inference du type de livrable dans `shared/released-artifacts.ts` pour garder la meme logique entre backend et frontend
- Pourquoi:
  - l'UI media existe deja, donc la vraie lacune etait le contrat de livraison, pas le player lui-meme
  - parser les liens markdown finaux serait fragile, ambigu et trop dependant de la formulation du modele
  - un evenement dedie garde Cowork modele-led: le modele choisit toujours quand publier, tandis que l'orchestrateur expose honnetement le resultat publie
- Consequence:
  - un `mp3`, `wav`, `mp4` ou PDF publie par Cowork peut apparaitre immediatement dans la conversation comme livrable exploitable
  - l'historique Cowork rehydrate mieux les livraisons, y compris apres snapshot/local storage/Firestore
  - les cartes audio/video peuvent maintenant offrir preview + ouverture + telechargement de facon coherente

## 2026-03-31 - Les echecs media Cowork deviennent scopes et types, pas un bloc global opaque
- Statut: adopte
- Contexte: des runs Cowork sur Lyria 3 pouvaient enchainer un blocage policy de prompt puis un `Internal server error`, mais la boucle traitait encore `generate_music_audio` comme un scope global et additionnait ces deux echecs comme s'ils avaient la meme nature.
- Decision:
  - sortir un helper partage `getCoworkToolFailureScope()` et donner aux tools media un scope base sur le brief et le modele plutot qu'un scope global
  - reconnaitre les incidents transitoires media via `isTransientCoworkToolIssue()` (`500/502/503`, timeout, quotas)
  - transformer les policy blocks Lyria en retour `recoverable:true` avec guidance de reformulation, au lieu d'un throw brut
- Pourquoi:
  - un prompt bloque par safety et un backend Google indisponible ne doivent pas nourrir la meme logique anti-boucle
  - un essai musique rate ne doit pas empoisonner tout le reste du run Cowork
  - l'agent reste libre, mais le backend verifie les echecs avec une granularite plus juste
- Consequence:
  - `generate_music_audio` n'est plus bloque "globalement" apres deux echecs heterogenes
  - un `Internal server error` Lyria peut etre retrie/cooldown comme incident transitoire
  - la boucle peut guider une reformulation propre quand le prompt tombe sur le filtre policy

## 2026-03-31 - Le bouton de nouvelle discussion sort de la sidebar et monte dans la barre haute
- Statut: adopte
- Contexte: meme apres la simplification precedente, la sidebar restait trop contrainte verticalement. Le vrai probleme n'etait pas seulement le nombre de `+`, mais le fait qu'un gros CTA occupait encore une ligne complete au-dessus de l'historique.
- Decision:
  - retirer totalement le CTA "nouvelle discussion" de la sidebar
  - placer un seul bouton `+` carre et discret dans la barre haute, pres du bouton menu
  - compacter encore la sidebar (brand block, modes, panneau compte, footer) pour rendre le maximum de hauteur a l'historique
- Pourquoi:
  - degage franchement la colonne historique au lieu de simplement changer la forme du CTA
  - garde une action de creation visible sans surcharger la sidebar
  - produit une hierarchie plus claire: navigation a gauche, action globale en haut, historique prioritaire dans la colonne
- Consequence:
  - `src/App.tsx` porte maintenant le bouton `+` contextuel via `activeModeCreateLabel`
  - `src/components/SidebarLeft.tsx` n'a plus de ligne CTA dediee
  - la sidebar est plus dense verticalement et l'historique commence plus haut

## 2026-03-31 - Une seule creation contextuelle dans la sidebar, et davantage de place pour l'historique
- Statut: adopte
- Contexte: la sidebar gauche gaspillait trop de hauteur sur les modes, et chaque mode embarquait un `+` redondant. L'utilisateur voulait que l'historique prenne plus de place et qu'il n'y ait plus qu'un seul bouton de creation adapte au mode courant.
- Decision:
  - retirer tous les boutons `+` dans les lignes de mode
  - ajouter un seul CTA contextuel `onNewChat` sous la liste des modes
  - compacter la zone haute (header, spacing, rows de modes) pour redonner de la hauteur a l'historique
  - elargir legerement la sidebar pour limiter les retours a la ligne inutiles
- Pourquoi:
  - clarifie l'action de creation au lieu de la dupliquer cinq fois
  - rend l'historique plus visible et plus utile, surtout sur vue etroite
  - donne une sidebar plus calme et plus lisible
- Consequence:
  - `src/components/SidebarLeft.tsx` utilise maintenant `modeActionCopy` et `activeModeMeta`
  - la creation d'une nouvelle discussion se fait depuis un seul bouton adapte au mode actif
  - les rows de modes sont plus denses et la liste d'historique recupere davantage d'espace vertical

## 2026-03-31 - La fin d'une reponse chat reste stable et replie le thinking par defaut
- Statut: adopte
- Contexte: apres correction de l'auto-scroll, la fin d'une reponse chat gardait encore un petit sursaut visuel, et le volet reasoning restait ouvert alors que l'utilisateur voulait qu'il se ferme automatiquement sans disparaitre.
- Decision:
  - injecter le message final dans l'UI optimistic des la fin du stream, sans attendre le retour Firestore
  - desactiver l'animation d'entree uniquement pour ce message de transition
  - fermer automatiquement le volet thinking a la livraison, tout en laissant son toggle visible
- Pourquoi:
  - supprime la rupture visuelle entre le bloc de streaming et la bulle finale
  - garde les autres animations du chat intactes
  - respecte la demande produit "le thinking reste accessible mais replie"
- Consequence:
  - `src/App.tsx` suit maintenant `recentlyCompletedMessageId` pour lisser la sortie du stream
  - `src/components/MessageItem.tsx` accepte `disableEntranceAnimation`
  - les thoughts d'un message final ne s'ouvrent plus automatiquement apres livraison

## 2026-03-31 - Le chat ne suit plus la reponse si l'utilisateur a remonte la conversation
- Statut: adopte
- Contexte: pendant la generation d'une reponse, l'ecran etait force vers le bas a chaque nouveau chunk. Cela empechait de relire des messages precedents pendant que le modele continuait a ecrire.
- Decision:
  - remplacer l'auto-scroll inconditionnel par un suivi conditionnel base sur la position reelle du conteneur
  - considerer que le chat peut continuer a suivre le bas seulement si l'utilisateur est deja proche du bas
  - reinitialiser ce comportement a l'ouverture d'une autre session pour garder un atterrissage naturel sur les derniers messages d'un thread
- Pourquoi:
  - respecte l'intention de lecture de l'utilisateur au lieu de prioriser agressivement le flux entrant
  - garde le confort d'un chat "sticky" quand on est deja en bas
  - evite les sauts visuels repetes pendant le streaming
- Consequence:
  - `src/App.tsx` suit maintenant `shouldAutoScrollRef` via la position de `parentRef`
  - `scrollIntoView` n'est plus declenche pendant le stream si l'utilisateur a quitte le bas de la conversation
  - le changement de session garde un recentrage volontaire sur la fin du thread

## 2026-03-29 - Le chat n'affiche plus que les 15 derniers messages, sans tronquer la session
- Statut: adopte
- Contexte: les longues conversations rendaient le shell moins fluide et donnaient une impression de messages qui se chevauchent. Le besoin utilisateur etait de garder toute la memoire et toute la conversation, mais de n'afficher visuellement que la fin recente.
- Decision:
  - conserver l'historique complet dans l'etat frontend et dans Firestore
  - calculer une fenetre visible de `15` messages maximum dans `src/App.tsx`
  - afficher un bandeau explicite indiquant que les anciens messages sont masques visuellement mais toujours conserves
  - passer les index absolus aux actions `modifier` / `renvoyer` pour ne pas casser les handlers
- Pourquoi:
  - soulage le rendu sans toucher a la memoire ni a la persistance
  - respecte la demande produit "ne supprime pas ma conv"
  - evite une regression discrète sur les actions de message
- Consequence:
  - `src/App.tsx` derive maintenant `visibleMessages`, `hiddenMessagesCount` et `visibleMessageOffset`
  - seules les 15 dernieres bulles sont rendues dans le centre
  - les messages plus anciens restent disponibles pour l'historique, les exports et le contexte modele

## 2026-03-29 - Pipeline de pieces jointes partage entre frontend, chat standard et Cowork
- Statut: adopte
- Contexte: les images, PDF et liens YouTube pouvaient apparaitre dans l'interface mais ne pas etre exploites par le modele. Le message courant perdait ses `attachments` au moment de construire `contents`, et l'historique perdait ses pieces jointes une fois la `base64` retiree apres upload.
- Decision:
  - introduire un contrat partage `shared/chat-parts.ts` pour les parts frontend -> backend
  - serialiser l'historique via `buildApiHistoryFromMessages()` cote frontend
  - reconstruire les vraies parts multimodales via `buildModelContentsFromRequest()` cote backend pour `/api/chat` et `/api/cowork`
  - traiter YouTube comme un contexte texte (`titre + URL`) au lieu d'un faux `fileData` video
- Pourquoi:
  - corrige a la fois le message courant et l'historique recharge
  - evite de dependre de `base64` persistante en Firestore
  - garde un seul chemin de verite pour les modes texte et agentiques
- Consequence:
  - nouvelles briques `shared/chat-parts.ts`, `src/utils/chat-parts.ts` et `server/lib/chat-parts.ts`
  - `/api/chat` et `/api/cowork` utilisent maintenant le meme resoluteur de pieces jointes
  - les URL signees image/PDF peuvent etre rehydratees cote serveur si la base64 n'est plus disponible

## 2026-03-29 - Empty state chat en poster unique avec glow typographique CSS
- Statut: adopte
- Contexte: la home du chat etait esthetiquement riche mais trop demonstrative pour un simple ecran avant l'envoi d'un message. L'utilisateur voulait quelque chose de plus beau, plus discret et plus responsive.
- Decision:
  - remplacer la composition multi-cartes de `StudioEmptyState` par un seul poster state
  - faire porter le signal visuel par un fond typographique lumineux tres discret au lieu de plusieurs panneaux secondaires
  - garder les animations uniquement sur des proprietes peu couteuses (`opacity`) et respecter `prefers-reduced-motion`
- Pourquoi:
  - recentre l'accueil sur le premier geste produit: commencer a discuter
  - reduit fortement la sensation de surcharge visuelle
  - permet une DA plus forte sans payer le prix d'animations JS permanentes
- Consequence:
  - `src/components/StudioEmptyState.tsx` a ete recompose comme une hero scene unique
  - `src/index.css` expose maintenant un systeme de glow theme-aware pour dark, light et oled
  - les quick prompts et micro-infos restent presents, mais dans une hierarchie beaucoup plus calme

## 2026-03-29 - Shell idle sans scroll et hero calibre par largeur utile
- Statut: adopte
- Contexte: meme apres la refonte du poster, le panneau central pouvait encore afficher une barre de defilement au repos. Le probleme etait surtout visible avec les volets lateraux ouverts, quand la largeur utile du centre se resserrait.
- Decision:
  - verrouiller le scroll vertical du `main` quand on affiche l'empty state
  - ne plus rendre le spacer `messagesEndRef` tant qu'il n'y a ni messages ni streaming
  - rendre `StudioEmptyState` container-aware avec `container-type: inline-size` et des tailles pilotees par `cqw`
- Pourquoi:
  - supprime un scroll produit injustifie quand l'utilisateur n'a encore rien envoye
  - stabilise la composition quelle que soit la largeur restante apres ouverture/fermeture des volets
  - corrige le vrai budget de viewport au lieu de masquer le symptome
- Consequence:
  - `src/App.tsx` utilise maintenant `min-h-0` et un `overflow` conditionnel sur le panneau central
  - `src/components/StudioEmptyState.tsx` remplit la hauteur disponible sans min-height rigide
  - `src/index.css` adapte la typo et les mots d'ambiance a la largeur effective du hero

## 2026-03-29 - Duo podcast avec voix forcees distinctes et labels TTS internes
- Statut: adopte
- Contexte: un script duo pouvait bien contenir 2 intervenants, mais le rendu restait trop monotone ou pouvait retomber sur 2 voix insuffisamment differenciees si le modele choisissait mal les voix/performance notes.
- Decision:
  - imposer une normalisation des speakers duo avec 2 voix distinctes
  - ajouter des notes de jeu contrastees par defaut cote podcast
  - utiliser des aliases TTS alphanumeriques internes pour le routage voix, sans casser les noms visibles du script
- Pourquoi:
  - durcit le contrat produit "2 intervenants" en rendu reel, pas seulement en texte
  - colle mieux aux contraintes documentees du multi-speaker Gemini TTS
  - laisse l'utilisateur garder des noms riches dans le texte tout en fiabilisant la synthese
- Consequence:
  - `server/lib/media-generation.ts` remappe maintenant les labels de dialogue avant TTS
  - les metadonnees audio exposent `speakerAliases`
  - les prompts podcast poussent des contrastes vocaux plus nets et l'ecriture d'origine pour les noms/mots etrangers

## 2026-03-29 - Lyria 3 activee en preview, `lyria-002` conserve en defaut robuste
- Statut: adopte
- Contexte: l'utilisateur aime deja le rendu `lyria-002`, mais souhaite tester Lyria 3 si c'est reellement utilisable. Le code exposait Lyria 3 sans endpoint fonctionnel.
- Decision:
  - corriger l'appel Lyria 3 sur l'endpoint officiel `aiplatform.googleapis.com/.../interactions`
  - garder `lyria-002` comme defaut podcast robuste
  - laisser `lyria-3-clip-preview` et `lyria-3-pro-preview` en options preview, non par defaut
- Pourquoi:
  - permet les tests Lyria 3 reels sans casser le chemin fiable deja apprecie par l'utilisateur
  - respecte la documentation officielle et les limites preview actuelles
  - evite une migration produit precipitee vers un modele preview
- Consequence:
  - `generate_music_audio` et `create_podcast_episode` peuvent maintenant vraiment tester Lyria 3
  - la copy produit/orchestrateur continue de recommander `lyria-002` comme choix robuste

## 2026-03-29 - Historique des discussions en local-first tant que Firestore n'a pas confirme
- Statut: adopte
- Contexte: les nouvelles discussions de `chat`, `cowork`, `image`, `video` et `audio` pouvaient apparaitre un instant dans la sidebar puis disparaitre si le document `users/{uid}/sessions/{sessionId}` n'etait pas encore confirme par Firestore.
- Decision:
  - conserver un cache local des session shells dans `src/utils/sessionShells.ts`
  - marquer une session locale `pendingRemote` tant que Firestore n'a pas confirme son shell
  - fusionner `remoteSessions` + cache local dans `src/App.tsx` au lieu d'ecraser `sessions`
  - nettoyer le cache local a la suppression d'une session
- Pourquoi:
  - elimine l'effet produit "la conversation clignote puis disparait"
  - garde l'historique stable meme si Firestore refuse ou tarde a confirmer le shell
  - reste coherent avec l'approche local-first deja adoptee pour le Hub Agents
- Consequence:
  - nouvelle utilite `src/utils/sessionShells.ts`
  - creation / edition / ouverture d'un workspace agent sauve d'abord le shell local
  - le listener `users/{uid}/sessions` devient tolerant aux ecritures shell degradees

## 2026-03-29 - Gemini TTS duo natif a 2 voix max
- Statut: adopte
- Contexte: le pipeline podcast savait bien sortir un master final, mais il etait encore pense "single-host" alors que Gemini TTS supporte nativement le dialogue multi-speaker.
- Decision:
  - supporter officiellement 2 intervenants Gemini TTS dans `create_podcast_episode` et `generate_tts_audio`
  - rester honnete sur la limite: exactement 2 speakers max en multi-speaker, pas plus
  - guider le modele sur le choix mono vs duo via prompt systeme et descriptions d'outils
- Pourquoi:
  - colle mieux aux besoins reels: sketchs, interviews, duos, disputes, podcasts conversationnels
  - evite de simuler 2 personnes avec une seule voix quand le modele supporte mieux
  - conserve un contrat simple et fiable
- Consequence:
  - ajout d'un catalogue officiel des 30 voix Gemini
  - style instructions globales + par intervenant
  - messages d'erreur recuperables quand le modele essaye plus de 2 intervenants ou choisit Flash Lite pour un duo

## 2026-03-29 - Mix podcast plus present et normalise
- Statut: adopte
- Contexte: le fond musical des podcasts etait juge trop bas, ce qui donnait un rendu propre mais trop timide.
- Decision:
  - remonter le niveau de bed par defaut
  - rendre le ducking moins agressif
  - ajouter une normalisation loudness de fin de chaine sur le chemin `ffmpeg`
  - garder un fallback local quand `ffmpeg` n'est pas disponible
- Pourquoi:
  - meilleur ressenti "vrai podcast"
  - meilleur equilibre entre inteligibilite de la voix et presence musicale
  - alignement plus fort avec les references Apple/Auphonic
- Consequence:

## 2026-04-02 - `Cowork Apps` devient un gestionnaire d'apps avec composer bas, pas une hero scene textuelle
- Statut: adopte localement
- Contexte: le layout precedent restait trop serre et trop editorial. L'utilisateur a reformule une vision beaucoup plus nette: un ecran type tablette/app manager avec les apps visibles, une grande preview de l'app choisie, puis une petite zone de chat en bas ou Cowork clarifie le besoin avant de generer.
- Decision:
  - remplacer la hero textuelle de `src/components/AgentsHub.tsx` par une composition en 3 zones:
    - bibliotheque d'apps compacte a gauche
    - preview centrale de l'interface propre a l'app
    - rail droit reserve au cap produit et a la clarification/live creation
  - deplacer la creation d'app dans un composer bas pleine largeur, plus proche d'un chatbot de cadrage
  - garder les suggestions d'idees et la clarification, mais en version beaucoup plus compacte
- Pourquoi:
  - colle au modele mental "gestionnaire d'applications" plutot qu'a une landing page dans l'app
  - montre mieux que chaque app a sa propre interface
  - rend la clarification Cowork visible sans parasiter toute la scene
- Consequence:
  - `src/components/AgentsHub.tsx` porte maintenant un layout app manager + preview + composer
  - les validations visuelles doivent se faire sur `tmp/cowork-apps-preview.html` en vues `store` et `creation`
  - nouvelle courbe de mix dans `server/lib/media-generation.ts`
  - cible de master autour de `-16` avec true peak borne
  - fallback WAV conserve mais avec un bed plus audible qu'avant

## 2026-03-29 - Reparer les sessions Firestore orphelines depuis l'historique de messages
- Statut: adopte
- Contexte: des conversations existaient bien dans `users/{uid}/sessions/{sessionId}/messages`, mais pas dans `users/{uid}/sessions/{sessionId}` a cause d'un schema de regles trop strict. Resultat produit: aucune conversation visible sur les autres appareils.
- Decision: conserver Firestore comme source de verite, corriger les regles, puis reconstruire automatiquement les session shells manquants depuis une requete `collectionGroup('messages')` cote client.
- Pourquoi:
  - repare les conversations deja cassees sans migration admin separee
  - ne rajoute aucune dependance ni backend de maintenance
  - fonctionne aussi quand le parent de la sous-collection `messages` n'existe plus
- Alternatives ecartees:
  - script manuel admin ponctuel: trop fragile et non embarque dans le produit
  - reset total des conversations: inacceptable pour l'utilisateur
  - fallback local-only: ne resout pas la synchro multi-appareils

## 2026-03-29 - Hub Agents integre a Cowork
- Statut: adopte
- Contexte: l'utilisateur veut que Cowork soit l'essence du produit, capable soit d'executer lui-meme, soit de creer un specialiste delegable et reutilisable.
- Decision: integrer le Hub Agents dans l'univers Cowork au lieu de construire un produit annexe independant.
- Pourquoi:
  - colle a la vision produit "agent general + specialistes"
  - evite un hub decoratif sans lien avec la boucle agentique
  - permet a Cowork de livrer un objet concret et persistant quand il parle de delegation
- Consequence:
  - ajout de `create_agent_blueprint` cote backend
  - nouvel evenement SSE `agent_blueprint`
  - persistance Firestore `users/{uid}/agents`
  - UI `Hub Agents` cote frontend

## 2026-03-29 - Delegation via blueprint avant execution reelle
- Statut: adopte
- Contexte: il fallait livrer une premiere brique utile sans casser la boucle Cowork existante ni ouvrir tout de suite un sous-systeme multi-runs complexe.
- Decision: commencer par la creation et la persistance de blueprints d'agents avant de brancher l'execution d'un agent du hub comme sous-mission reelle.
- Pourquoi:
  - chemin le plus simple et le plus robuste pour livrer une valeur produit immediate
  - limite le risque de regression dans `/api/cowork`
  - fournit deja une base stable pour la future generative UI
- Alternatives ecartees:
  - sous-agents executes immediatement dans la meme session: trop de complexite pour un premier lot
  - hub frontend seulement: rejete car trop cosmetique

## 2026-03-29 - Pas de nouvelle dependance frontend pour le Hub
- Statut: adopte
- Contexte: le hub pouvait etre implemente avec la stack deja presente.
- Decision: reutiliser React, Motion, Firestore et la stack CSS existante sans ajouter de librairie d'UI ni de gestion de schema.
- Pourquoi:
  - aucune dependance additionnelle necessaire pour ce premier lot
  - limite la dette technique
  - accelere la livraison et le controle du rendu

## 2026-03-29 - Validation UI locale marquee comme partielle
- Statut: adopte
- Contexte: Playwright a permis de charger l'app, mais le login Google local est bloque par Firebase Auth.
- Decision: documenter explicitement la validation visuelle comme partielle et ne pas pretendre que le flow authentifie est valide.
- Pourquoi:
  - respect de l'honnetete radicale
  - evite de declarer un cycle Firestore/HUB verifie alors qu'il ne l'est pas completement

## 2026-03-29 - Relance d'un agent du hub par transmission explicite du catalogue
- Statut: adopte
- Contexte: le backend `/api/cowork` n'a pas acces nativement aux agents persistes dans Firestore cote client, donc il ne pouvait pas reutiliser un specialiste existant.
- Decision: transmettre le catalogue `hubAgents` dans chaque requete `/api/cowork`, puis ajouter un outil `run_hub_agent` qui relance un agent existant comme vraie sous-mission.
- Pourquoi:
  - garde l'architecture simple sans backend Firestore supplementaire
  - permet a Cowork de reutiliser un specialiste deja cree au lieu d'empiler des blueprints
  - rend la delegation reelle sans ouvrir tout de suite un sous-systeme multi-runs persistant
- Alternatives ecartees:
  - lecture Firestore directe cote backend: plus lourde et inutile pour cette etape
  - nouveau service dedie aux sous-agents: premature et trop risquee pour le lot actuel

## 2026-03-29 - Hub Agents local-first si Firestore degrade
- Statut: adopte
- Contexte: en production, des refus `Missing or insufficient permissions` pouvaient encore survenir sur `users/{uid}/agents`, et la lecture Firestore cassait l'UX du hub avec une popup bloquante.
- Decision: rendre le Hub Agents local-first avec snapshots `localStorage`, synchro Firestore en best effort et warning visible au lieu d'une erreur modale.
- Pourquoi:
  - l'agent cree doit rester utilisable meme si le cloud refuse temporairement la collection
  - la creation d'agent ne doit plus faire echouer Cowork ni l'interface manuelle
  - le hub reste coherent avec la promesse produit "delegation reutilisable"
- Consequence:
  - ajout de `src/utils/agentSnapshots.ts`
  - lecture `users/{uid}/agents` degradee en warning non bloquant
  - persistance locale avant tentative Firestore dans `persistAgentBlueprint()`

## 2026-03-29 - Le Hub doit etre une surface d'execution, pas un catalogue
- Statut: adopte
- Contexte: afficher seulement le `uiSchema` sous forme de badges donnait l'illusion d'une UI sans permettre de lancer reellement la mission.
- Decision: faire du Hub Agents une vraie interface de lancement avec renderer de champs, validation minimale et CTA direct vers Cowork.
- Pourquoi:
  - un agent sans interface executable reste trop abstrait pour l'utilisateur
  - la relance explicite reduit la dependance au choix implicite du modele
  - cela rend visible la difference entre blueprint, mission et execution
- Consequence:
  - `src/components/AgentsHub.tsx` rend maintenant un formulaire complet

## 2026-03-29 - Direction frontend "studio editorial premium"
- Statut: adopte
- Contexte: l'interface etait fonctionnelle mais encore trop proche d'un dashboard generique, avec un grand vide central et des panneaux visuellement inegaux.
- Decision: assumer une direction artistique forte type "atelier / control room" avec un hero editorial au centre, des panneaux unifies, une typographie plus marquee et un responsive pense des le shell.
- Pourquoi:
  - donne une vraie personnalite produit a Studio Pro au lieu d'un simple habillage
  - rend les etats vides utiles et desirables au lieu de montrer un trou dans l'interface
  - cree une base coherente pour tous les modes (`chat`, `cowork`, `image`, `video`, `audio`)
- Consequence:
  - refonte des fondations CSS dans `src/index.css`
  - ajout de `src/components/StudioEmptyState.tsx`
  - harmonisation de `src/App.tsx`, `SidebarLeft`, `SidebarRight`, `ChatInput` et `MessageItem`
  - validation visuelle systematique desktop + mobile via Playwright
  - `src/App.tsx` expose `handleRunAgentFromHub()`
  - le hub peut relancer un specialiste existant meme si son `uiSchema` est vide grace au fallback `missionBrief`

## 2026-03-29 - L'utilisateur utilise l'agent, Cowork l'edite
- Statut: adopte
- Contexte: le besoin produit a ete precise apres livraison du niveau 2. Le workflow vise n'est pas "Cowork utilise le specialiste pour toi", mais "Cowork construit l'agent, puis toi tu utilises cet agent directement".
- Decision: transformer les agents du hub en workspaces utilisateurs de premiere classe, et releguer Cowork a la creation et a l'edition de ces agents.
- Pourquoi:
  - colle au besoin reel formule par l'utilisateur
  - rend l'agent concret et accessible sans prompt technique
  - permet une boucle produit claire: usage direct -> feedback -> modification par Cowork
- Consequence:
  - sessions `sessionKind='agent'`
  - panneau `AgentWorkspacePanel`
  - runtime backend `agentRuntime` sur `/api/cowork`
  - nouvel outil `update_agent_blueprint` pour modifier un agent existant

## 2026-03-29 - Exigence qualitative guidee par l'etat, pas par un plan rigide
- Statut: adopte
- Contexte: l'utilisateur veut des boucles plus engagees et moins paresseuses, mais refuse qu'on code un plan fixe du type "8 recherches obligatoires" ou des checklists deterministes par demande.
- Decision: renforcer la posture du system prompt et ajouter des nudges qualite fondes sur l'etat reel du run (matiere collectee, sources ouvertes, densite du brouillon, artefact en cours), sans forcer une sequence d'actions predefinie.
- Pourquoi:
  - laisse le modele libre de sa strategie
  - corrige la paresse observable quand Cowork part trop vite en livraison avec peu de substance
  - evite de retomber dans des pipelines rigides pilotes par mots-cles
- Consequence:
  - system prompt Cowork plus exigeant sur la substance
  - ajout d'un helper `buildCoworkEngagementNudge()` dans `api/index.ts`
  - relance douce du modele quand un brouillon ou une recherche restent trop maigres pour la promesse implicite du livrable

## 2026-03-29 - Options explicites et defaults neutres
- Statut: adopte
- Contexte: meme apres avoir retire les gros faux positifs, le runtime restait encore partiellement pilote par des heuristiques lexicales et des relances backend invisibles.
- Decision: basculer Cowork vers des outils a options explicites et des defaults neutres, sans deduction backend de la strategie a partir du prompt utilisateur.
- Pourquoi:
  - colle au cap produit "le modele decide, le backend verifie"
  - supprime les derniers effets de bord ou le backend choisissait `news`, `strict`, `latex`, `theme`, `time_range` ou un nudge qualite a la place du modele
  - rend le comportement beaucoup plus lisible a debugger: si une recherche est stricte ou orientee news, c'est parce que le modele l'a demande
- Consequence:
  - `web_search` accepte maintenant `topic`, `searchDepth`, `strict`, `timeRange`, `includeDomains`, `directSourceUrls`
  - `web_fetch` accepte maintenant `contextQuery` et `strict`
  - `buildTavilySearchPlan()` et `searchWeb()` ont des defaults neutres quand ces options ne sont pas fournies
  - `getPdfQualityTargets()` retourne `null` par defaut et `resolvePdfEngine(auto)` tombe sur `pdfkit`
  - les relances backend `buildCoworkEngagementNudge()` et `artifactCompletionPrompt` sortent du chemin runtime normal

## 2026-03-29 - Les media generators deviennent des outils de premiere classe
- Statut: adopte
- Contexte: l'utilisateur veut que Cowork puisse appeler librement la generation d'image, Gemini TTS et Lyria, sans passer par des mots-cles backend ni des workflows caches.
- Decision: exposer trois vrais `localTools` (`generate_image_asset`, `generate_tts_audio`, `generate_music_audio`) qui creent des fichiers locaux dans `/tmp/`, puis laissent le modele decider s'il faut les publier via `release_file`.
- Pourquoi:
  - reste coherent avec la philosophie "le modele decide, le backend verifie"
  - rend ces capacites reutilisables par Cowork et par les agents du hub
  - evite de dupliquer des pipelines speciaux cote frontend uniquement
- Consequence:
  - ajout d'un helper partage `api/lib/media-generation.ts`
  - ajout des routes `/api/generate-audio` et `/api/generate-music`
  - le mode `audio` de l'UI fonctionne enfin reellement

## 2026-03-29 - PDF premium modele-led via metadonnees de section
- Statut: adopte
- Contexte: l'utilisateur veut des PDF LaTeX tres beaux et vraiment thematiques, y compris avec une ambiance differente d'une page/section a l'autre, sans revenir a des mots-cles backend qui imposent une strategie.
- Decision: faire porter l'art direction par les sections elles-memes (`visualTheme`, `mood`, `motif`, `flagHints`, `pageStyle`, `pageBreakBefore`) et laisser Cowork choisir explicitement `engine='latex'` quand il vise un rendu premium.
- Pourquoi:
  - permet des spreads visuels differents (ex: guerre puis football) sans raw `.tex` obligatoire
  - reste coherent avec la philosophie "le modele decide, le backend rend"
  - garde un fallback simple (`pdfkit`) pour les documents ordinaires
- Consequence:
  - `api/index.ts` accepte et preserve ces champs dans les brouillons PDF
  - `server/pdf/latex.ts` sait maintenant composer des couvertures/sections premium avec motifs et badges drapeaux
  - Cowork est informe dans son prompt et ses outils qu'il peut piloter cette DA sans heuristique backend

## 2026-03-29 - Le brouillon PDF devient un vrai atelier de revision
- Statut: adopte
- Contexte: l'utilisateur ne veut pas d'un "brouillon" qui est en pratique un premier jet pousse presque directement en PDF. Il veut que Cowork puisse relire, reprendre, couper, reordonner et maturer le texte avant export.
- Decision: ajouter un vrai verbe de revision au contrat PDF avec `revise_pdf_draft`, au lieu de garder un workflow limite a `begin_pdf_draft -> append_to_draft -> create_pdf`.
- Pourquoi:
  - `append_to_draft` seul cree un comportement d'empilement, pas de reecriture
  - la qualite editoriale demande parfois de remplacer ou supprimer, pas seulement d'ajouter
  - cela reste modele-led: on ne force pas une checklist, on donne juste au modele une vraie surface de travail
- Consequence:
  - `api/index.ts` expose `reviseActivePdfDraft()` et le tool `revise_pdf_draft`
  - revision possible des metas (`title`, `subtitle`, `summary`, `author`)
  - remplacement complet des sections ou operations 1-based (`replace`, `remove`, `insert_before`, `insert_after`, `append`)
  - `sourcesMode=append|replace`
  - la consigne systeme Cowork parle du brouillon comme d'un atelier de travail avant `create_pdf`

## 2026-03-29 - Le podcast devient un artefact audio de premiere classe
- Statut: adopte
- Contexte: l'utilisateur veut que Cowork puisse produire un vrai podcast audio complet, pas juste un script ou deux assets separes. La voix doit pouvoir venir de `gemini-2.5-pro-tts` et le fond sonore de Lyria.
- Decision: ajouter un tool autonome `create_podcast_episode` qui orchestre un pipeline complet:
  - narration TTS
  - bed musical Lyria
  - mix final audio unique
- Pourquoi:
  - correspond exactement au besoin produit "il fait ce qu'il veut" pour le podcast
  - garde la logique modele-led: Cowork choisit s'il fournit un `script` exact ou juste un `brief`
  - evite de demander a l'utilisateur de mixer lui-meme la voix et la musique
- Consequence:
  - `api/lib/media-generation.ts` expose `generatePodcastEpisode()`
  - defaut podcast narration = `gemini-2.5-pro-tts`
  - defaut podcast musique = `lyria-002`
  - le mix final passe par `ffmpeg` local avec intro/outro legeres
  - Cowork peut ensuite publier directement le fichier via `release_file`

## 2026-03-29 - Batterie Cowork pilotee par prompt, pas par veto backend
- Statut: adopte
- Contexte: l'utilisateur a explicitement refuse un retour aux mots-cles declencheurs, quotas backend caches ou nudges injectes comme ordres. Il voulait que l'amelioration passe par la personnalite de l'agent, son prompt systeme et la clarte de ses outils.
- Decision: corriger Cowork pour la batterie utilisateur via:
  - renforcement du prompt systeme
  - descriptions/outils de recherche plus explicites
  - fingerprint de progression plus honnete
  - mais sans reintroduire de blockers metier ou de forcing strategique cote backend
- Pourquoi:
  - reste coherent avec la philosophie produit "le modele decide, le backend verifie"
  - laisse une vraie autonomie de strategie
  - rend les progres observables sans theatre backend
- Consequence:
  - ajout de `test-cowork-battery.ts`
  - `buildCoworkProgressFingerprint()` compte aussi la collecte de recherche
  - `buildCoworkSystemInstruction()` insiste maintenant sur:
    - `web_search` = reperage
    - `web_fetch` = lecture/verif directe
    - couverture multi-angle / multi-entites
    - verification business / juridique / finance / RH / marche

## 2026-03-29 - `api/` doit rester un espace d'entree Vercel, pas un namespace backend complet
- Statut: adopte
- Contexte: le deploiement Vercel Hobby cassait avec une limite de nombre de functions, alors meme que le projet est concu comme un backend Express unique deja rewrite par `vercel.json`.
- Decision: reserver `api/` aux seuls entrypoints serverless et deplacer tout module interne backend dans `server/`.
- Pourquoi:
  - aligne l'arborescence avec le modele de deploiement Vercel
  - evite que des helpers `lib/`, `middleware/`, `routes/` soient comptes comme functions distinctes
  - ne change ni les capacites ni la perf utile, car le runtime cible restait deja `api/index.ts`
- Consequence:
  - `api/index.ts` devient l'unique fichier backend routable
  - `server/lib/*`, `server/middleware/*`, `server/routes/*` portent toute la logique interne
  - la verification de reference est `npx vercel build --prod` + un seul output `api/index.func`

## 2026-03-29 - Un podcast doit sortir comme un master final unique
- Statut: adopte
- Contexte: l'utilisateur a explicitement rejete les livraisons podcast en composants separes. Pour lui, "fais un podcast" signifie un vrai episode bien monte, pas une voix d'un cote et une musique de l'autre.
- Decision:
  - `create_podcast_episode` devient le chemin podcast principal
  - `generate_tts_audio` et `generate_music_audio` restent des outils de bas niveau, reserves aux demandes explicites de stems separes
  - les agents podcast par defaut doivent viser `create_podcast_episode` + `generate_image_asset` + `release_file`
- Pourquoi:
  - colle au sens produit reel du mot "podcast"
  - reduit les chances que le modele satisfasse techniquement la demande tout en ratant la promesse utilisateur
  - garde une voie simple pour la cover sans complexifier le master audio
- Consequence:
  - `server/lib/agents.ts` oriente les blueprints podcast vers un livrable unique
  - `api/index.ts` decrit explicitement `create_podcast_episode` comme le bon outil pour un podcast pret a publier
  - l'UI du Hub Agents pousse maintenant la formulation "master final bien mixe + cover"

## 2026-03-29 - Le pipeline podcast ne doit plus dependre durement de `ffprobe` / `ffmpeg`
- Statut: adopte
- Contexte: le premier pipeline podcast etait correct en local, mais fragile sur hebergement: `ffprobe` manquant cassait la mesure de duree, et sans `ffmpeg` il n'y avait plus de master final.
- Decision:
  - mesurer la duree de la narration directement depuis son WAV
  - conserver `ffmpeg` comme chemin premium quand il existe
  - ajouter un fallback TypeScript pur pour le mix WAV standard
- Pourquoi:
  - supprime le point de rupture `ffprobe ENOENT`
  - permet toujours de livrer un master final unique avec le couple robuste `gemini-2.5-pro-tts` + `lyria-002`
  - evite d'ajouter une dependance npm lourde de transcodage
- Consequence:
  - `server/lib/media-generation.ts` embarque maintenant parse WAV, resampling, adaptation mono/stereo, ducking, loop crossfade et limiter
  - en l'absence d'encodeur mp3 local, le systeme peut quand meme rendre un WAV final plutot que d'echouer
  - limite connue assumee: `lyria-3-*` reste plus dependant d'un decodeur externe si sa sortie est MP3

## 2026-03-29 - Les sessions agent ne doivent pas contaminer le mode chat
- Statut: adopte
- Contexte: ouvrir un agent depuis le Hub le faisait vivre sous `mode: 'chat'`, mais l'experience attendue n'est pas "remplacer le dernier chat", c'est "ouvrir un workspace voisin".
- Decision: conserver les agents sous la surface chat pour reutiliser le runtime, mais les isoler dans l'etat/navigation via `sessionKind='agent'`, une section historique dediee et une memorisation opt-in du dernier thread.
- Pourquoi:
  - evite l'impression que l'historique chat normal disparait
  - garde le routing simple sans creer un sixieme mode entier
  - permet a l'agent d'avoir son branding propre sans rebasculer en Cowork
- Consequence:
  - `setActiveSessionId()` accepte maintenant `remember` et `modeOverride`
  - `SidebarLeft` separe les agents du reste de l'historique
  - `App.tsx` choisit les bons placeholders et labels selon `sessionKind`

## 2026-03-29 - Le selecteur de modeles doit vivre inline, pas en overlay absolu
- Statut: adopte
- Contexte: dans le panneau droit, le dropdown modeles se faisait recouvrir par `Capacites & outils`.
- Decision: remplacer l'overlay absolu par une liste inline expandable dans le flux normal de `SidebarRight`.
- Pourquoi:
  - supprime les problemes de stacking context entre cartes
  - rend le layout plus stable sur desktop et mobile
  - simplifie le composant tout en donnant plus d'air au panneau
- Consequence:
  - `src/components/SidebarRight.tsx` utilise maintenant un bloc `AnimatePresence` en hauteur auto au lieu d'un menu flottant

## 2026-03-29 - La fluidite prime sur le glassmorphism lourd
- Statut: adopte
- Contexte: la DA premium etait reussie visuellement, mais le cout GPU/paint etait trop eleve pour l'objectif produit de fluidite maximale.
- Decision: conserver l'identite visuelle, mais retirer les effets globaux les plus couteux: transitions sur tout le DOM, flous trop forts et surfaces repetitives trop lourdes.
- Pourquoi:
  - le ressenti produit voulu est "fluide", pas "beau mais lourd"
  - les bulles/messages et panneaux repetes sont les vraies surfaces critiques pour les FPS
- Consequence:
  - `src/index.css` cible seulement les transitions utiles
  - les blur/shadows de `MessageItem`, `ChatInput`, `SidebarLeft`, `SidebarRight` et du shell sont reduits

## 2026-03-29 - Un podcast doit degrader vers un master voix seule plutot que tomber en echec
- Statut: adopte
- Contexte: pour l'utilisateur, un podcast avec voix seule reste un livrable utile. Un echec total a cause du fond musical ou de `ffmpeg` est pire qu'un master vocal propre et honnete.
- Decision: `create_podcast_episode` doit preferer un fallback `voice-only` quand le bed musical ou le mix local echouent.
- Pourquoi:
  - respecte la promesse produit "livrer quelque chose d'exploitable"
  - evite les faux echec totaux sur des problemes d'infra audio non essentiels
  - reste honnete si le fallback est expose dans le resultat et dans la copy
- Consequence:
  - `server/lib/media-generation.ts` peut maintenant retourner `mixStrategy: 'voice-only'`
  - `api/index.ts` remonte explicitement ce statut et son warning

