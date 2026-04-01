# QA RECIPES

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

## Attendus visuels
- Store:
  - sidebars absentes, sensation de vue plein ecran
  - aucun scroll requis pour voir la scene complete
  - apps visibles surtout comme icones + noms, sans panneaux lourds
  - CTA d'ouverture visible
  - dock pagine + bloc de creation visibles dans le meme ecran
- Mobile:
  - pas de clipping horizontal sur la headline
  - pas d'icone coupee dans la liste d'apps
  - fleches visibles quand la page ne peut pas tout montrer
  - bloc de creation lisible meme sur 430 px

## Limite connue
- Si Playwright MCP reste bloque par `C:\Windows\System32\.playwright-mcp`, utiliser ce chemin Edge headless comme validation visuelle de reference.
