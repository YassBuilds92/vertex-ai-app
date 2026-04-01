# QA RECIPES

## Generated Apps - flux critique
- Objectif:
  - verifier que Cowork cree une vraie `generated app` avec manifest, source, bundle et host dedie
  - verifier que l'ouverture d'une generated app ne retombe ni dans un chat generique ni dans `AgentWorkspacePanel`
  - verifier le lifecycle `draft -> publish -> update draft`
- Scenarios cibles:
  - `app de cartes Pokemon personnalisees`
  - `app nasheed`
- Etapes manuelles:
  - creer l'app depuis la chatbox de `Cowork Apps`
  - ouvrir l'app creee depuis le store
  - lancer un premier run depuis le host
  - publier la draft
  - demander une evolution via Cowork depuis le host
- Attendus:
  - l'app apparait dans le store avec une vraie identite produit
  - le host affiche bien la draft courante, le badge live si deja publiee, et un bouton `Publier la draft`
  - l'appel runtime passe par `appRuntime` et limite les outils au `toolAllowList`
  - apres publication, la version live reste stable
  - apres evolution Cowork, une nouvelle draft apparait sans effacer la version publiee
  - si le bundle est invalide, le host affiche le `buildLog` au lieu de casser silencieusement

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
- `npx tsx test-generated-app-manifest.ts`

## Validation shell local
- `Invoke-WebRequest http://127.0.0.1:3000`
  - attendu: `StatusCode 200`

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
- Generated App Host:
  - header avec retour store + badges draft/live visibles
  - pas de shell chat classique ni de sidebars standard
  - panneau gauche = mission + formulaire + CTA run/publish
  - panneau droit = artefacts / sorties / evolution Cowork
  - en cas d'erreur de bundle, un etat bloque lisible avec `buildLog`
- Nasheed Studio:
  - aucun rail de messages ou chatbox visible
  - header avec retour `Cowork Apps`, nom d'app et pills Lyria visibles
  - pas de longs paragraphes marketing ou d'explication repetee dans le hero
  - colonne gauche dediee a la direction musicale et aux reglages
  - grande scene centrale avec headline courte, plan compact et wave bus
  - colonne droite avec sorties recentes et journal Cowork non-chat, sans verbosite inutile
  - rendu premium, plus proche d'un studio musical que d'un formulaire
- Store:
  - topbar utilitaire visible avec recherche centree
  - grand hero editorial lisible en entier, sans ligne coupee ni recadrage vertical
  - panneau lateral de co-creation visible dans le meme ecran
  - sidebars absentes, sensation de vue plein ecran
  - aucun scroll requis pour voir la scene complete
  - apps visibles comme mini-studios premium, pas comme dashboard SaaS
  - titres d'app et copy des cartes ne doivent pas etre tronques
  - CTA d'ouverture visible
  - rail d'apps + bloc de creation visibles dans le meme ecran
- Mobile:
  - sur Nasheed Studio, header + pills Lyria + bloc `Direction musicale` visibles au premier viewport
  - pas de clipping horizontal sur la direction ni sur les pills
  - pas de clipping horizontal sur la headline
  - pas d'empilement de longs textes explicatifs avant d'atteindre les vrais controles
  - topbar et recherche restent lisibles
  - pas d'icone coupee dans la liste d'apps
  - fleches visibles quand la page ne peut pas tout montrer
  - bloc de creation lisible meme sur 430 px

## Limite connue
- Si Playwright MCP reste bloque par `C:\Windows\System32\.playwright-mcp`, utiliser ce chemin Edge headless comme validation visuelle de reference.
- Sur cette machine, la preuve visuelle automatisee du `GeneratedAppHost` n'a pas encore pu etre capturee a cause des limites outils Windows ; ne pas pretendre cette validation faite tant qu'un rendu reel n'a pas ete observe.
