# QA RECIPES

## Store Cowork Apps
- Objectif:
  - verifier que le hub se lit comme un app store Cowork et non comme un catalogue d'agents
  - verifier qu'une app ouverte ressemble a un studio d'app avec une interface propre

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
  --window-size=1440,2200 `
  --virtual-time-budget=2500 `
  --screenshot="$env:TEMP\cowork-apps-store-desktop-tall.png" `
  "http://127.0.0.1:4173/tmp/cowork-apps-preview.html"
```
- Studio mobile:
```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new `
  --disable-gpu `
  --hide-scrollbars `
  --window-size=430,4200 `
  --virtual-time-budget=2500 `
  --screenshot="$env:TEMP\cowork-apps-workspace-mobile-fullish.png" `
  "http://127.0.0.1:4173/tmp/cowork-apps-preview.html?view=workspace"
```

## Attendus visuels
- Store:
  - hero clairement oriente "apps creees par Cowork"
  - plusieurs apps visibles dans la vitrine/catalogue
  - previews differencies selon les familles d'app
- Studio mobile:
  - la zone basse du poste de lancement reste lisible
  - le CTA principal se stacke correctement sous le texte explicatif
  - pas de clipping horizontal sur les boutons ou les champs

## Limite connue
- Si Playwright MCP reste bloque par `C:\Windows\System32\.playwright-mcp`, utiliser ce chemin Edge headless comme validation visuelle de reference.
