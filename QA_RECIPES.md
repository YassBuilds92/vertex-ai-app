# QA RECIPES

## YouTube natif - chat et Cowork
- Objectif:
  - verifier qu'un lien YouTube est maintenant traite comme une vraie video Gemini, pas comme un simple titre
  - verifier que les reglages `debut / fin / FPS` restent visibles et persistents
- Scenarios cibles:
  - URL YouTube simple sans cadrage
  - URL YouTube avec `Start Time = 40s`, `End Time = 1m20s`, `FPS = 5`
  - follow-up apres persistance (`resume ce passage`, `decris les frames visibles`)
- Etapes manuelles:
  - ouvrir `chat & raisonnement`
  - coller une URL YouTube
  - ouvrir `Video settings` depuis la vignette
  - enregistrer un cadrage `40s -> 1m20s`, `5 FPS`
  - envoyer une consigne explicite de lecture (`decris ce passage`, `liste les elements visuels a l'ecran`)
  - rejouer la meme sequence dans `Cowork`
  - faire ensuite un follow-up sur le meme thread sans recoller la video
- Attendus:
  - la reponse parle du contenu reel de la video
  - la carte persistente affiche encore `debut / fin / FPS`
  - le modal mobile garde ses boutons visibles
  - aucun fallback `Titre + URL` sur le chemin normal
- Validation code:
  - `npm run lint`
  - `npm run build`
  - `npx tsx verify-chat-parts.ts`
  - `npx tsx test-cowork-loop.ts`
- Captures de reference locales:
  - `C:\Users\Yassine\AppData\Local\Temp\youtube-preview-card-apr02.png`
  - `C:\Users\Yassine\AppData\Local\Temp\youtube-preview-modal-apr02.png`
  - `C:\Users\Yassine\AppData\Local\Temp\youtube-preview-modal-mobile-apr02-fixed3.png`

## Pieces jointes - chat et Cowork
- Objectif:
  - verifier qu'une video uploadee reste vraiment lisible par Gemini en `chat` et en `cowork`
  - verifier que les types deja supportes (image, PDF, audio) ne regressent pas
  - verifier que les documents texte (`txt`, `md`, `csv`, `json`) remontent leur contenu au modele
- Scenarios cibles:
  - MP4 court avec dialogue ou sous-titres visibles
  - PDF texte simple
  - TXT ou Markdown court
  - JSON ou CSV court
- Etapes manuelles:
  - ouvrir `chat & raisonnement`
  - envoyer chaque fichier avec une consigne explicite de lecture (`decris la video`, `recopie le titre du JSON`, etc.)
  - rejouer la meme matrice dans `Cowork`
  - reouvrir ensuite un ancien message avec video deja persiste pour tester la rehydratation historique
- Attendus:
  - video: la reponse parle du contenu reel, pas seulement du nom du fichier
  - PDF/image/audio: comportement conserve
  - TXT/MD/CSV/JSON: la reponse cite bien des champs/lignes issus du contenu
  - pas de fallback pauvre `Nom + URL` pour les types supportes
- Validation code:
  - `npm run lint`
  - `npx tsx verify-chat-parts.ts`
  - `npx tsx test-cowork-loop.ts`

## Shell principal - accueil vide
- Objectif:
  - verifier que le shell d'accueil reste visible, utile et respirant avant toute conversation
  - verifier que la sidebar gauche propose un vrai geste `Nouveau ...`
  - verifier que le rendu tient sur desktop et mobile
- Etapes manuelles:
  - ouvrir `http://127.0.0.1:3000`
  - attendre la fin du chargement auth shell
  - verifier que le centre affiche l'ecran d'accueil premium au lieu d'un simple fond vide
  - verifier la presence du CTA `Nouveau ...` dans la sidebar gauche
  - verifier sur mobile que l'accueil reste lisible sans sidebar ouverte
- Attendus:
  - hero central visible
  - suggestions rapides presentes
  - aucun centre noir silencieux
  - le shell reste actionnable meme sans historique
- Captures de reference locales:
  - `tmp/audit-desktop-after4.png`
  - `tmp/audit-mobile-after4.png`

## Generated Apps - flux auto-defini
- Objectif:
  - verifier qu'aucun wizard local ne force de type d'app avant generation
  - verifier qu'un brief libre peut produire une app hybride
  - verifier qu'un brief ambigu declenche une clarification conversationnelle libre
  - verifier que le composant genere est bien le rendu principal des apps nouvelles
- Scenarios cibles:
  - brief hybride: `une app qui peut faire debat, extrait audio, cover et fiche`
  - brief ambigu: `je veux une app forte pour travailler une idee complexe`
  - reouverture d'une ancienne generated app creee avant ce chantier
- Etapes manuelles:
  - ouvrir `Cowork Apps`
  - verifier qu'il n'y a plus de cartes `podcast`, `musique`, `duel`, etc. a choisir avant creation
  - saisir le brief hybride librement
  - verifier que Cowork peut soit generer directement, soit poser une question libre en langage naturel
  - si une question apparait, repondre dans le meme hub sans quitter la creation
  - ouvrir l'app creee
  - verifier que son interface et sa mission reflÃ¨tent le brief, y compris si plusieurs modalites sont melangees
  - verifier qu'une ancienne app s'ouvre encore sans casse, meme si elle tombe sur le fallback legacy
- Attendus:
  - aucun libelle du type `Type d'application cible`, `Direction validee` ou `Type de sortie attendu`
  - la clarification visible vient de Cowork lui-meme, pas d'une liste de choix locale
  - l'app nouvelle charge d'abord son composant genere si disponible
  - le fallback natif n'apparait qu'en cas legacy / skip / echec
  - les defaults runtime observes correspondent au `manifest.runtime.toolDefaults` de l'app

## Validation code - flux auto-defini
- `npm run lint`
- `npx tsx test-generated-app-stream.ts`
- `npx tsx test-generated-app-manifest.ts`
- `npx tsx test-cowork-loop.ts`
- `npm run build`

## Generated Apps - debat audio / clarification / master final
- Objectif:
  - verifier qu'une app `duel/debat` ne retombe plus sur une chronique solo
  - verifier que la creation force une clarification avant generation
  - verifier que le host met bien en avant le `Master audio`
- Scenario cible:
  - creer ou regenir `IA Duel Podcast`
  - brief type: `je veux deux IA qui debattent vraiment`
- Etapes manuelles:
  - ouvrir `Cowork Apps`
  - lancer une creation `Podcast`
  - verifier qu'une couche de clarification apparait avant generation
  - choisir `Duel contradictoire` ou saisir `Autre direction`
  - generer l'app puis l'ouvrir
  - remplir `topic`, `stance_a`, `stance_b`, `debate_frame`, `duration`
  - cliquer `Produire maintenant`
- Attendus:
  - le formulaire generated app expose bien les champs de debat, pas seulement `topic/tone/duration`
  - l'audio final est presente dans une carte `Master audio`
  - la meta du host montre au moins les 2 speakers ou le mode duo
  - l'audio entendu est bien un vrai face-a-face a 2 voix

## Generated Apps - flux critique
- Objectif:
  - verifier le lifecycle reel `spec -> source -> native preview -> optional bundle -> publish`
  - verifier qu'une draft reste ouvrable et publiable meme si le bundle de preview casse
  - verifier que `Cowork Apps` montre une creation visible en direct
- Scenarios cibles:
  - `app de cartes Pokemon personnalisees`
  - `app nasheed`
  - `app duel audio`
- Etapes manuelles:
  - creer l'app depuis `Cowork Apps`
  - verifier la timeline SSE `brief_validated -> spec_ready -> source_ready -> bundle_* -> manifest_ready`
  - ouvrir l'app creee depuis le store
  - lancer un premier run depuis `GeneratedAppHost`
  - publier la draft
  - demander une evolution via Cowork depuis le host
- Attendus:
  - le preview natif apparait avant tout chargement de bundle
  - si le bundle est saute sur un environnement empaquete, l'UI reste neutre et le rendu natif reste canonique
  - si le bundle casse reellement, le host affiche le diagnostic mais ne bloque ni l'ouverture ni la publication
  - `Publier la draft` reste actif tant que la source est exploitable
  - apres publication, la live reste stable
  - apres evolution Cowork, une nouvelle draft apparait sans effacer la live

## Validation code
- `npm run lint`
- `npm run build`
- `npx tsx test-generated-app-manifest.ts`
- `npx tsx test-generated-app-bundle-state.ts`
- `npx tsx test-generated-app-lifecycle.ts`
- `npx tsx test-generated-app-stream.ts`

## Preview local du store
- Harness:
  - `tmp/cowork-apps-preview.html`
  - `tmp/cowork-apps-preview.tsx`
- URL store:
  - `http://127.0.0.1:4173/tmp/cowork-apps-preview.html`
- URL creation visible:
  - `http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=creation`
- URL studio nasheed:
  - `http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=workspace`
- URL generated host bundle failed:
  - `http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=generated-host`

## Commandes de capture Windows
- Binaire navigateur:
  - `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
- Creation visible desktop:
```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new `
  --disable-gpu `
  --hide-scrollbars `
  --window-size=1440,980 `
  --virtual-time-budget=3500 `
  --screenshot="$env:TEMP\cowork-apps-creation-desktop-apr01-v3.png" `
  "http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=creation"
```
- Creation visible mobile:
```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new `
  --disable-gpu `
  --hide-scrollbars `
  --window-size=430,932 `
  --virtual-time-budget=3500 `
  --screenshot="$env:TEMP\cowork-apps-creation-mobile-apr01-v3.png" `
  "http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=creation"
```
- GeneratedAppHost desktop:
```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new `
  --disable-gpu `
  --hide-scrollbars `
  --window-size=1440,980 `
  --virtual-time-budget=3500 `
  --screenshot="$env:TEMP\generated-app-host-desktop-apr01.png" `
  "http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=generated-host"
```
- GeneratedAppHost mobile:
```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new `
  --disable-gpu `
  --hide-scrollbars `
  --window-size=430,932 `
  --virtual-time-budget=3500 `
  --screenshot="$env:TEMP\generated-app-host-mobile-apr01.png" `
  "http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=generated-host"
```

## Attendus visuels
- Cowork Apps / creation visible:
  - le panneau `Creation visible` doit montrer un statut live, une timeline reelle et un preview d'app qui emerge
  - sur mobile, le labo de creation doit remonter avant le catalogue quand une creation est en cours
  - aucun faux pourcentage ni fausse barre de progression
- GeneratedAppHost:
  - badge `preview native` visible

## Cowork Apps - home type gestionnaire d'apps
- Objectif:
  - verifier que la home ressemble a un vrai gestionnaire d'apps, pas a une hero page trop serree
  - verifier que le composer bas reste lisible et qu'il exprime bien la clarification Cowork
- Etapes manuelles:
  - ouvrir `http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=store`
  - verifier la bibliotheque d'apps en tiles a gauche
  - verifier la grande preview centrale de l'app selectionnee
  - verifier le rail droit `Cap produit` ou `Cowork en direct`
  - verifier la barre de creation basse sur toute la largeur
  - ouvrir aussi `?view=creation` pour confirmer que la creation live garde la meme composition
- Attendus:
  - plus de grand hero bavard ni de panneau lateral envahissant
  - sensation visuelle de "tablette / app manager"
  - chaque app semble avoir sa propre interface grace a la preview centrale
  - la creation se lit comme un chat de cadrage, pas comme un wizard
- Captures de reference locales:
  - `tmp/cowork-store-desktop-apr02.png`
  - `tmp/cowork-store-mobile-apr02.png`
  - `tmp/cowork-creation-desktop-apr02.png`
  - `tmp/cowork-creation-mobile-apr02.png`
  - badge bundle coherent avec le cas (`ready`, `skipped` ou `failed`)
  - le panneau diagnostic n'apparait que sur vrai echec bundle
  - l'app native reste rendue dessous meme si le bundle est saute ou en echec
  - `Publier la draft` reste visible

## Limite connue
- La vraie validation produit restante reste le flux authentifie complet avec reponses Gemini/Firestore reelles.
