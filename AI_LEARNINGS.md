# AI LEARNINGS (ai-studio)

## API Gemini (Versions 3.x)
- [Génération Image/Vidéo] -> Si le modèle renvoie du JSON au lieu d'une image en chat, c'est qu'il tente d'utiliser un outil inexistant. Solution : Brancher `handleSend` dans `App.tsx` pour appeler `/api/generate-image` ou `/api/generate-video` spécifiquement selon le mode actif, au lieu de tout envoyer à `/api/chat`.
- [Paramètres Veo] -> Le modèle `veo-3.1-generate-001` nécessite l'utilisation de `generateVideos` dans le SDK `@google/genai` (v1.x). Paramètres clés : `durationSeconds` (4, 6, 8), `aspectRatio` ("16:9", "9:16"), `resolution` ("720p", "1080p", "4k").
- [Modèle de référence] -> `gemini-3.1-pro-preview` pour les tâches complexes.
- [Modèle rapide/éco] -> `gemini-3.1-flash-lite-preview` (Sortie Mars 2026) à privilégier pour les tâches de fond comme le raffinement de prompt.
- [Obsolescence] -> `gemini-3-pro-preview` a été fermé le 9 mars 2026, utiliser la 3.1.
- [Localisation Vertex] -> Utiliser le point de terminaison `global` pour les modèles 3.x/3.1 et `preview` dans Vertex AI pour garantir la disponibilité si les régions spécifiques (ex: `us-central1`) renvoient un 404.

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
- [Clés React Doublons] -> Dans les listes virtualisées, s'assurer d'utiliser `msg.id` comme clé plutôt que l'index pour éviter les problèmes de rendu (écran blanc).
- [Erreur de Référence Initialisation] -> Dans `App.tsx`, s'assurer que `displayedMessages` (utilisé par `rowVirtualizer`) est déclaré AVANT l'initialisation du virtualiseur pour éviter une `ReferenceError` (Temporal Dead Zone).
- [Bug Visuel Renvoyer/Regénérer] -> Si un message vide apparaît lors d'une régénération, vérifier `handleSend`. Il ne faut pas créer de nouveau message optimiste ou Firestore si `overrideMessages` est présent. La `message` envoyée à l'API doit être le dernier élément de l'historique, et l'historique doit être tronqué d'un élément pour éviter les doublons côté serveur.
- [Firestore Error] -> `addDoc` rejette les propriétés `undefined`. Toujours utiliser `value || null` pour les champs optionnels (ex: `iconUrl`).
- [Imagen Vertex AI] -> `imagen-4.0-...` est obsolète ! **MIGRATE TO gemini-2.5-flash-image** avant juin 2026.
- [SDK Image Gen] -> Pour les modèles Gemini (ex: `gemini-2.5-flash-image`), il faut utiliser `client.models.generateContent` et NON `generateImages`.
- [Génération d'icônes suspendue] -> En cas de quota (429), le `refine` échoue. Afficher une `alert()` au lieu de charger indéfiniment.
- [Sauvegarde Inopérante] -> Suivre l'état d'authentification avec `onAuthStateChanged`. Utiliser `serverTimestamp()` pour les dates.
- [Vertex AI Gemini Access Error] -> L'erreur `Gemini cannot be accessed through Vertex Predict/RawPredict API` survient si on utilise `generateImages` (Predict API) pour un modèle Gemini (ex: `gemini-2.5-flash-image`). Solution : utiliser `generateContent` et extraire l'image de `part.inlineData.data`. Toujours utiliser la localisation `global` pour les modèles Gemini 3.x/3.1 sur Vertex.
- [Erreur Taille Firestore] -> L'erreur `exceeds the maximum allowed size of 1,048,576 bytes` survient lors de la sauvegarde de documents contenant des images Base64 trop grandes (ex: icônes générées). Solution : Redimensionner et compresser l'image en 256x256 (JPEG 0.7) côté client via Canvas avant `addDoc`.
# AI LEARNINGS (ai-studio)

## API Gemini (Versions 3.x)
- [Génération Image/Vidéo] -> Si le modèle renvoie du JSON au lieu d'une image en chat, c'est qu'il tente d'utiliser un outil inexistant. Solution : Brancher `handleSend` dans `App.tsx` pour appeler `/api/generate-image` ou `/api/generate-video` spécifiquement selon le mode actif, au lieu de tout envoyer à `/api/chat`.
- [Paramètres Veo] -> Le modèle `veo-3.1-generate-001` nécessite l'utilisation de `generateVideos` dans le SDK `@google/genai` (v1.x). Paramètres clés : `durationSeconds` (4, 6, 8), `aspectRatio` ("16:9", "9:16"), `resolution` ("720p", "1080p", "4k").
- [Modèle de référence] -> `gemini-3.1-pro-preview` pour les tâches complexes.
- [Modèle rapide/éco] -> `gemini-3.1-flash-lite-preview` (Sortie Mars 2026) à privilégier pour les tâches de fond comme le raffinement de prompt.
- [Obsolescence] -> `gemini-3-pro-preview` a été fermé le 9 mars 2026, utiliser la 3.1.
- [Localisation Vertex] -> Utiliser le point de terminaison `global` pour les modèles 3.x/3.1 et `preview` dans Vertex AI pour garantir la disponibilité si les régions spécifiques (ex: `us-central1`) renvoient un 404.

## Workflow & Déploiement
- [Déploiement Vercel] -> TOUTES les modifications doivent être suivies d'un `push` vers GitHub pour déclencher le déploiement automatique sur Vercel. Utiliser le workflow `/deploy` systématiquement une fois les tests locaux validés.

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
- [Clés React Doublons] -> Dans les listes virtualisées, s'assurer d'utiliser `msg.id` comme clé plutôt que l'index pour éviter les problèmes de rendu (écran blanc).
- [Erreur de Référence Initialisation] -> Dans `App.tsx`, s'assurer que `displayedMessages` (utilisé par `rowVirtualizer`) est déclaré AVANT l'initialisation du virtualiseur pour éviter une `ReferenceError` (Temporal Dead Zone).
- [Bug Visuel Renvoyer/Regénérer] -> Si un message vide apparaît lors d'une régénération, vérifier `handleSend`. Il ne faut pas créer de nouveau message optimiste ou Firestore si `overrideMessages` est présent. La `message` envoyée à l'API doit être le dernier élément de l'historique, et l'historique doit être tronqué d'un élément pour éviter les doublons côté serveur.
- [Firestore Error] -> `addDoc` rejette les propriétés `undefined`. Toujours utiliser `value || null` pour les champs optionnels (ex: `iconUrl`).
- [Imagen Vertex AI] -> `imagen-4.0-...` est obsolète ! **MIGRATE TO gemini-2.5-flash-image** avant juin 2026.
- [SDK Image Gen] -> Pour les modèles Gemini (ex: `gemini-2.5-flash-image`), il faut utiliser `client.models.generateContent` et NON `generateImages`.
- [Génération d'icônes suspendue] -> En cas de quota (429), le `refine` échoue. Afficher une `alert()` au lieu de charger indéfiniment.
- [Sauvegarde Inopérante] -> Suivre l'état d'authentification avec `onAuthStateChanged`. Utiliser `serverTimestamp()` pour les dates.
- [Vertex AI Gemini Access Error] -> L'erreur `Gemini cannot be accessed through Vertex Predict/RawPredict API` survient si on utilise `generateImages` (Predict API) pour un modèle Gemini (ex: `gemini-2.5-flash-image`). Solution : utiliser `generateContent` et extraire l'image de `part.inlineData.data`. Toujours utiliser la localisation `global` pour les modèles Gemini 3.x/3.1 sur Vertex.
- [Erreur Taille Firestore] -> L'erreur `exceeds the maximum allowed size of 1,048,576 bytes` survient lors de la sauvegarde de documents contenant des images Base64 trop grandes (ex: icônes générées). Solution : Redimensionner et compresser l'image en 256x256 (JPEG 0.7) côté client via Canvas avant `addDoc`.
- [Optimisation UX Icônes] -> Pour éviter d'attendre la génération d'icône avant de sauvegarder un prompt, implémenter une fonction `backgroundGenerateIcon` qui se déclenche après `addDoc`. Utiliser l'ID du document pour mettre à jour le champ `iconUrl` une fois l'image générée en "sous-marin".
- [Capacités Gemini 3.x] -> `gemini-3.1-pro-preview` supporte les niveaux de réflexion `LOW`, `MEDIUM`, `HIGH`. `gemini-3.1-flash-lite-preview` et `gemini-3-flash-preview` supportent `MINIMAL`, `LOW`, `MEDIUM`, `HIGH`.
- [Outils Flash Lite] -> Contrairement aux versions précédentes, `gemini-3.1-flash-lite-preview` supporte les outils (Google Search, Code Execution) mais sans streaming d'arguments (géré par le SDK).
- [Configuration Thinking] -> Pour les modèles Gemini 3.1, utiliser `thinkingConfig` dans l'API au lieu de `thinkingBudget`.
- [Motion TypeScript Error] -> Dans `motion/react` (v12), les transitions `type: 'spring'` peuvent être inferées comme `string` au lieu de `AnimationGeneratorType`. Solution : Utiliser `as const` sur l'objet `transition` ou les `variants`. (ex: `transition={{ type: 'spring' } as const}`).
- [Outils Gemini 3.1 / SDK Unified] -> L'activation de Google Search avec `googleSearchRetrieval` fait échouer les modèles. Cause : Le SDK `@google/genai` (v1.x) utilise `googleSearch`. Solution : Utiliser `googleSearch: {}`, `codeExecution: {}`, `googleMaps: {}` et `urlContext: {}` dans l'array `tools` de `config`.
- [Erreur Build / Dépendance] -> `Rollup failed to resolve import "clsx"` pendant le build Vercel. Cause : `clsx` utilisé dans `App.tsx` mais non listé dans `package.json`. Solution : `npm install clsx`.
- [Auth Google / Fenêtre qui se ferme] -> La popup de connexion Google se ferme immédiatement avec une erreur COOP dans la console. Cause : L'en-tête `Cross-Origin-Opener-Policy: same-origin` (par défaut ou trop restrictif) empêche la communication avec la popup. Solution : Ajouter `res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')` et `res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none')` dans les middlewares du serveur Express.
- [Auth Firebase / unauthorized-domain] -> Erreur survenant lors du déploiement ou du changement de domaine URL. Cause : Le nouveau domaine (ex: Vercel) n'est pas autorisé dans les paramètres Firebase (Console Firebase -> Authentification -> Paramètres -> Domaines Autorisés). Solution : Ajouter les domaines STABLES (`[projet].vercel.app` et `[projet]-git-main-[user].vercel.app`) une fois pour toutes et n'utiliser que ces URLs pour les tests.
- [Dépoiement Vercel / 404 API] -> Sur Vercel, placer le serveur dans `api/index.ts` (au lieu de la racine) pour une détection fiable des fonctions.
- [Vercel Rewrites / SPA] -> Utiliser `{ "source": "/(.*)", "destination": "/api" }` dans `vercel.json` pour rediriger tout le trafic vers le serveur Express dans `api/index.ts`.
- [Crash Vercel / Vite Import] -> Importer `vite` dynamiquement (`await import('vite')`) dans le serveur pour éviter que Vercel ne tente de packer cette grosse dépendance dans la fonction serverless.
- [URL Stable Vercel] -> Utiliser l'alias de branche `https://[PROJECT-NAME]-git-main-[TEAM].vercel.app/` pour tester les changements sans que l'URL ne change à chaque push.
