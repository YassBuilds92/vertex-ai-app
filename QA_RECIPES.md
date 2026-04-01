# QA RECIPES

## Nasheed Studio
- Objectif:
  - verifier qu'un clic sur une app musicale type `Nasheed Studio` n'ouvre plus une surface chat/workspace generique
  - verifier que l'interface se lit comme un vrai studio musical Lyria avec direction, scene centrale et sorties a droite
  - verifier que le desktop montre bien les trois zones cle au premier viewport
  - verifier que le mobile garde le header, les pills Lyria et le panneau de direction sans clipping horizontal

## Store Cowork Apps
- Objectif:
  - verifier que `Cowork Apps` se lit comme une vue a part, et non comme un overlay serre du shell
  - verifier que les apps sont rendues comme une selection simple icone + nom
  - verifier que tout le lobby tient dans un seul viewport sans scroll
  - verifier que les fleches paginent les apps quand la place manque
  - verifier que la creation se fait depuis une seule chatbox basse

## Validation code
- `npm run lint`
- `npm run build`

## Preview local du store
- Harness:
  - `tmp/cowork-apps-preview.html`
  - `tmp/cowork-apps-preview.tsx`
- URL store:
  - `http://127.0.0.1:4173/tmp/cowork-apps-preview.html`
- URL studio d'app:
  - `http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=workspace`

## Commandes de capture Windows
- Binaire navigateur:
  - `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
- Store desktop:
```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new `
  --disable-gpu `
  --hide-scrollbars `
  --window-size=1440,900 `
  --virtual-time-budget=2500 `
  --screenshot="$env:TEMP\cowork-apps-lobby-desktop-fit.png" `
  "http://127.0.0.1:4173/tmp/cowork-apps-preview.html"
```
- Lobby mobile:
```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new `
  --disable-gpu `
  --hide-scrollbars `
  --window-size=430,932 `
  --virtual-time-budget=2500 `
  --screenshot="$env:TEMP\cowork-apps-lobby-mobile-fit.png" `
  "http://127.0.0.1:4173/tmp/cowork-apps-preview.html"
```
- Nasheed Studio desktop:
```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new `
  --disable-gpu `
  --hide-scrollbars `
  --window-size=1440,980 `
  --virtual-time-budget=3000 `
  --screenshot="$env:TEMP\nasheed-studio-desktop.png" `
  "http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=workspace"
```
- Nasheed Studio mobile:
```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new `
  --disable-gpu `
  --hide-scrollbars `
  --window-size=430,932 `
  --virtual-time-budget=3000 `
  --screenshot="$env:TEMP\nasheed-studio-mobile.png" `
  "http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=workspace"
```

## Attendus visuels
- Nasheed Studio:
  - aucun rail de messages ou chatbox visible
  - header avec retour `Cowork Apps`, nom d'app et pills Lyria visibles
  - colonne gauche dediee a la direction musicale et aux reglages
  - grande scene centrale avec hero de composition et wave bus
  - colonne droite avec sorties recentes et journal Cowork non-chat
  - rendu premium, plus proche d'un studio musical que d'un formulaire
- Store:
  - topbar utilitaire visible avec recherche centree
  - grand hero editorial lisible en entier, sans ligne coupee
  - panneau lateral de co-creation visible dans le meme ecran
  - sidebars absentes, sensation de vue plein ecran
  - aucun scroll requis pour voir la scene complete
  - apps visibles comme mini-studios premium, pas comme dashboard SaaS
  - CTA d'ouverture visible
  - rail d'apps + bloc de creation visibles dans le meme ecran
- Mobile:
  - sur Nasheed Studio, header + pills Lyria + bloc `Direction musicale` visibles au premier viewport
  - pas de clipping horizontal sur la direction ni sur les pills
  - pas de clipping horizontal sur la headline
  - topbar et recherche restent lisibles
  - pas d'icone coupee dans la liste d'apps
  - fleches visibles quand la page ne peut pas tout montrer
  - bloc de creation lisible meme sur 430 px

## Limite connue
- Si Playwright MCP reste bloque par `C:\Windows\System32\.playwright-mcp`, utiliser ce chemin Edge headless comme validation visuelle de reference.
