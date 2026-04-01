# QA RECIPES

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
  - badge bundle coherent avec le cas (`ready`, `skipped` ou `failed`)
  - le panneau diagnostic n'apparait que sur vrai echec bundle
  - l'app native reste rendue dessous meme si le bundle est saute ou en echec
  - `Publier la draft` reste visible

## Limite connue
- La vraie validation produit restante reste le flux authentifie complet avec reponses Gemini/Firestore reelles.
