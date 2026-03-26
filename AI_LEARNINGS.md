# AI LEARNINGS (ai-studio)

## API Gemini (Versions 3.x)
- [Génération Image/Vidéo] -> Si le modèle renvoie du JSON au lieu d'une image en chat, c'est qu'il tente d'utiliser un outil inexistant. Solution : Brancher `handleSend` dans `App.tsx` pour appeler `/api/generate-image` ou `/api/generate-video` spécifiquement selon le mode actif, au lieu de tout envoyer à `/api/chat`.
- [Paramètres Veo] -> Le modèle `veo-3.1-generate-001` nécessite l'utilisation de `generateVideos` dans le SDK `@google/genai` (v1.x). Paramètres clés : `durationSeconds` (4, 6, 8), `aspectRatio` ("16:9", "9:16"), `resolution` ("720p", "1080p", "4k").
- [Modèle de référence] -> `gemini-3.1-pro-preview` pour les tâches complexes.
- [Modèle rapide/éco] -> `gemini-3.1-flash-lite-preview` (Sortie Mars 2026) à privilégier pour les tâches de fond comme le raffinement de prompt.
- [Obsolescence] -> `gemini-3-pro-preview` a été fermé le 9 mars 2026, utiliser la 3.1.
- [Localisation Vertex] -> Utiliser le point de terminaison `global` pour les modèles 3.x/3.1 et `preview` dans Vertex AI pour garantir la disponibilité si les régions spécifiques (ex: `us-central1`) renvoient un 404.

## SDK Google GenAI (Migration @google-cloud/vertexai -> @google/genai)
- [Deprecation VertexAI Class] -> Le SDK `@google-cloud/vertexai` (classe `VertexAI`) est deprecated depuis juin 2025, suppression prévue juin 2026. Le runtime lève un warning/erreur "The VertexAI class and all..." qui crashe l'API en 500. **Solution** : Migrer vers `@google/genai` avec `vertexai: true`. Installation : `npm install @google/genai`.
- [Initialisation @google/genai] -> `new GoogleGenAI({ vertexai: true, project: 'ID', location: 'global', googleAuthOptions: { credentials: gcpCredentials } })`. NE PAS utiliser `new VertexAI(...)`.
- [API generateContent] -> Ancienne syntaxe `client.getGenerativeModel({model}).generateContent({contents, systemInstruction, generationConfig})`. **Nouvelle** : `ai.models.generateContent({ model, contents, config: { systemInstruction, temperature, topP, topK, maxOutputTokens, tools } })`. La réponse : `result.text` (au lieu de `result.response.candidates[0]...`).
- [API generateContentStream] -> `ai.models.generateContentStream({ model, contents, config })`. Itération : `for await (const chunk of response) { chunk.text }`. Pour les thoughts : accéder via `chunk.candidates[0].content.parts` et vérifier `part.thought`.
- [Tools nouveau SDK] -> Utiliser `{ googleSearch: {} }`, `{ codeExecution: {} }` dans `config.tools` (et non `google_search_retrieval`).
- [Error Handling SSE] -> Ne pas setter les headers SSE (`Content-Type: text/event-stream`) AVANT d'avoir vérifié que le modèle/config est valide. Utiliser un flag `headersSent` pour savoir si on doit renvoyer du JSON (erreur avant stream) ou un event SSE d'erreur (erreur pendant stream).

## Déploiement Vercel (Express + Vite)
- [Écran Blanc / Routage] -> Sur Vercel, ne pas utiliser le champ legacy `builds` dans `vercel.json`. Préférer les `rewrites` pour tout rediriger vers `server.ts`.
- [Service Files Statiques] -> Dans `server.ts`, s'assurer que `app.use(express.static(distPath))` et le fallback `app.get('*', ...)` sont enregistrés en dehors de toute fonction `listen()` manuelle, car Vercel ignore les appels à `listen`.
- [Mur de Mot de Passe] -> Pour protéger tout le site (frontend + API), router toutes les requêtes `/(.*)` vers le serveur Express via `vercel.json`. S'assurer que `SITE_PASSWORD` est défini dans les variables d'environnement Vercel.

## UI & Thèmes
- [Synchronisation Thème] -> Pour éviter l'effet d'escalier lors du changement de thème, utiliser une règle CSS globale `* { transition: ... !important }` en dehors de la couche `@layer base` de Tailwind 4.0 pour une priorité maximale.
- [Mode OLED] -> Le noir absolu est `#000000`. S'assurer de l'appliquer via `html.oled` avec `!important` pour écraser les variables par défaut.

## Multimédia
- [YouTube Metadata] -> Utiliser l'API oEmbed (`https://www.youtube.com/oembed?url=...`) via un proxy backend pour récupérer les titres sans soucis de CORS.
- [Pièces Jointes] -> Toujours convertir en Base64 côté frontend pour le SDK Gemini 3.1.

## Firebase & Firestore
- [Champs Undefined] -> Firestore `addDoc`/`setDoc` rejette les valeurs `undefined`. Utiliser un utilitaire `cleanForFirestore` pour supprimer récursivement les propriétés `undefined`.
- [Validation Zod] -> Attention aux types `z.string().optional()` : ils n'acceptent pas `null`. Préférer `nullable().optional()` si le frontend peut envoyer des valeurs nulles, ou s'assurer d'envoyer `undefined`.
- [Incohérence API] -> Toujours vérifier que les noms de champs envoyés par `fetch` (`body: JSON.stringify({ prompt: ... })`) correspondent exactement aux schémas Zod du backend (`prompt` vs `message`).
- [Erreur Permissions] -> Si `Missing or insufficient permissions` persiste après avoir desserré les règles, vérifier si les règles locales `firestore.rules` ont bien été déployées sur le cloud via `firebase deploy --only firestore:rules`.
- [Connectivité Firestore (Net::ERR_...)] -> Les erreurs `ERR_BLOCKED_BY_CLIENT` ou `ERR_QUIC_PROTOCOL_ERROR` sont souvent dues à des AdBlockers ou des blocages réseau UDP. **Solution** : Forcer le mode HTTP dans `firebase.ts` avec `experimentalForceLongPolling: true` ET `experimentalAutoDetectLongPolling: false`.
- [Conflit Project ID / Database ID] -> Une erreur `403 Forbidden` ou `Blocked by client` peut survenir si le code frontend tente d'accéder à une base de données d'un projet différent (ex: Authentification sur Projet A mais Firestore sur Projet B). Toujours vérifier que `projectId` et `firestoreDatabaseId` dans `firebase-applet-config.json` pointent vers le même projet GCP.
- [Clés React Doublons] -> Dans les listes virtualisées, s'assurer d'utiliser `msg.id` comme clé plutôt que l'index pour éviter les problèmes de rendu (écran blanc).
- [Erreur de Référence Initialisation] -> Dans `App.tsx`, s'assurer que `displayedMessages` (utilisé par `rowVirtualizer`) est déclaré AVANT l'initialisation du virtualiseur pour éviter une `ReferenceError` (Temporal Dead Zone).
- [Bug Visuel Renvoyer/Regénérer] -> Si un message vide apparaît lors d'une régénération, vérifier `handleSend`. Il ne faut pas créer de nouveau message optimiste ou Firestore si `overrideMessages` est présent. La `message` envoyée à l'API doit être le dernier élément de l'historique, et l'historique doit être tronqué d'un élément pour éviter les doublons côté serveur.
- [Firestore Error] -> `addDoc` rejette les propriétés `undefined`. Toujours utiliser `value || null` pour les champs optionnels (ex: `iconUrl`).
- [Imagen 4/3] -> Obsolètes et supprimés. Utiliser la série **Nano Banana** (Gemini 2.5/3/3.1 Image).
- [Nano Banana Series] -> `gemini-3.1-flash-image-preview` (Nano Banana 2), `gemini-3-pro-image-preview` (Nano Banana Pro), `gemini-2.5-flash-image` (Nano Banana).
- [SDK Image Gen] -> Pour les modèles Gemini (ex: `gemini-2.5-flash-image`), il faut utiliser `client.models.generateContent` et NON `generateImages`. Les paramètres `imageSize`, `aspectRatio` et `personGeneration` sont supportés via `config`.
- [Génération d'icônes suspendue] -> En cas de quota (429), le `refine` échoue. Afficher une `alert()` au lieu de charger indéfiniment.
- [Sauvegarde Inopérante] -> Suivre l'état d'authentification avec `onAuthStateChanged`. Utiliser `serverTimestamp()` pour les dates.
- [Vertex AI Gemini Access Error] -> L'erreur `Gemini cannot be accessed through Vertex Predict/RawPredict API` survient si on utilise `generateImages` (Predict API) pour un modèle Gemini (ex: `gemini-2.5-flash-image`). Solution : utiliser `generateContent` et extraire l'image de `part.inlineData.data`. Toujours utiliser la localisation `global` pour les modèles Gemini 3.x/3.1 sur Vertex.
- [Imagen 3 Quota] -> L'erreur `RESOURCE_EXHAUSTED` sur `imagen-3.0-generate-001` (Predict API) indique un dépassement de quota ou une dépréciation. Solution : Utiliser `gemini-2.5-flash-image` via `generateContent` avec `location: 'global'`.
- [Icon Generation Error] -> Corrigé en utilisant `gemini-2.5-flash-image` (Nano Banana). Si l'erreur 500 persiste sur Vercel, vérifier les quotas Vertex AI ou les filtres de sécurité. L'API renvoie désormais un champ `details` pour faciliter le débugging côté frontend.
- [Detailed Error Reporting] -> Pour les erreurs d'API (500), s'assurer que le backend renvoie un objet JSON avec `{ error, message, details }`. Le frontend doit utiliser `errData.details || errData.message` pour afficher une alerte utile à l'utilisateur.
- [Gestion des Quotas (429)] -> Pour les erreurs `RESOURCE_EXHAUSTED`, implémenter un `retryWithBackoff` (3 tentatives, délai exponentiel) côté backend. Utiliser un helper `parseApiError` pour extraire le message JSON des erreurs Vertex AI (ex: `ApiError: {...}`) et fournir un message clair ("Quota dépassé, réessayez dans quelques minutes") au lieu de JSON brut.
- [Interruption Streaming / Troncature] -> Si la réponse s'arrête en plein milieu sans erreur, c'est souvent dû à `maxOutputTokens`. **Résolution finale** : Suppression de l'option "Illimité" qui causait des bugs de fallback à 2048. Utiliser exclusivement le slider "Max Output" qui monte désormais à 65536. Le fallback par défaut en cas de valeur nulle est passé à 8192 dans `App.tsx` et 65536 dans l'API.

## Tests & Déploiement
- [Validation des changements] -> Interdiction de tester via `localhost`. Tout changement doit être poussé sur Vercel via le workflow `/deploy` (git push) et testé directement sur l'URL de production : `https://vertex-ai-app-pearl.vercel.app/`.
- [Filtrage Modèles Image] -> Les modèles multimodaux (Gemini 3.1 Flash Lite) étaient mélangés aux modèles de génération (Imagen) en mode image. -> Filtrer la liste des modèles dans `SidebarRight.tsx` pour ne garder que ceux ayant le tag `image` et retirer `image` des modèles purement text/multimodal. Supprimer Gemini 3 Pro (obsolète).
- [Firestore Document Too Large] -> L'erreur `size exceeds the maximum allowed size of 1,048,576 bytes` survient si on stocke des images base64 directement dans Firestore. **Solution** : Toujours utiliser `uploadAttachment` pour uploader vers Firebase Storage et ne stocker que le `downloadURL`. S'assurer que `storage`, `ref`, `uploadBytes` et `getDownloadURL` sont bien importés dans `App.tsx`.
- [Firebase Storage Plan Spark (CORS/Quota)] -> Le forfait gratuit (Spark) limite les accès clients directs et peut causer des erreurs CORS insolubles. **Solution robuste** : Déporter l'upload côté Backend (Express) en utilisant le SDK `@google-cloud/storage`. Le client envoie le fichier via `POST /api/upload`, le serveur l'upload avec un compte de service et renvoie une URL signée ou publique.
- [GCS Permission 403 Forbidden] -> Si le backend renvoie une erreur 403 lors de l'upload, le compte de service (`google-ai-studio@...`) manque de droits. **Solution** : Lui donner le rôle `roles/storage.objectAdmin` sur le bucket via `gsutil iam ch serviceAccount:EMAIL:roles/storage.objectAdmin gs://BUCKET_NAME`.
- [Mise à jour Config Vercel] -> Si une modification d'un fichier JSON de config (ex: `firebase-applet-config.json`) n'est pas prise en compte après un push, faire un **Redeploy** sur Vercel en cochant **"Clean Build Cache"**.
- [Bug Multi-clic Renvoyer/Modifier] -> Des clics rapides sur "Renvoyer" ou "Modifier" peuvent déclencher plusieurs suppressions Firestore ou requêtes API en parallèle. **Solution** : Ajouter `if (isLoading) return;` au début des fonctions `handleRetry` et `handleEdit` dans `App.tsx`, et désactiver les boutons avec `disabled={isLoading}` dans `MessageItem.tsx` pour bloquer l'interaction utilisateur.
- [Zustand Persist / Shallow Merge Crash] -> L'ajout d'un nouveau mode (ex: `cowork`) dans `initialConfigs` peut causer un crash `TypeError: Cannot read properties of undefined (reading 'model')` si l'utilisateur a déjà un état persisté en `localStorage`. Par défaut, Zustand fait un shallow merge et remplace tout l'objet `configs`. **Solution** : Utiliser une fonction `merge` personnalisée dans les options de `persist` pour faire un deep merge (ou au moins merger les clés de `configs`) et ajouter des checks optionnels (`config?.model`) dans l'UI.
