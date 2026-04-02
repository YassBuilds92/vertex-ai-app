# NOW

## Objectif actuel
- Etendre et valider la refonte shell `three.js` sur les autres surfaces:
  - hero vide beaucoup plus epure
  - scene 3D editoriale lazy-load
  - rails gauche/droit allegees
  - reverification sur les modes `cowork`, `image`, `video`, `audio`, `lyria`

## Blocage actuel
- La nouvelle DA est validee localement sur le shell `chat` vide (desktop/mobile) en build + captures reelles, mais pas encore rejouee en session authentifiee ni sur les autres modes vides / avec contenu.

## Prochaine action exacte
- Rejouer la refonte en conditions reelles:
  - ouvrir l'app connectee
  - verifier `chat`, `cowork`, `image`, `video`, `audio`, `lyria` a vide
  - verifier qu'une vraie conversation / un vrai resultat ne casse pas l'equilibre plus aerien du shell
  - decider si la scene `three.js` reste reservee a l'accueil vide ou merite des echos sur d'autres surfaces
  - surveiller le poids du chunk `StudioHeroScene` si la scene grossit encore

## Fichiers chauds
- `src/components/StudioHeroScene.tsx`
- `src/components/StudioEmptyState.tsx`
- `src/index.css`
- `src/components/SidebarRight.tsx`
- `src/components/SidebarLeft.tsx`
- `QA_RECIPES.md`
- `TECH_RADAR.md`
- `DECISIONS.md`

## Validations restantes
- Verifier les etats vides des autres modes apres refonte.
- Verifier un shell authentifie avec historique reel.
- Verifier que le panneau droit reste lisible quand les vrais reglages / erreurs sont rendus.
- Verifier que la scene `three.js` ne degrade pas la fluidite percue sur laptop/mobile.

## Risques immediats
- Le shell vide `chat` est valide, mais les autres modes n'ont pas encore leur passe visuelle reelle.
- Le chunk lazy `StudioHeroScene` pese environ `505 kB` minifie: acceptable pour un hero charge a la demande, mais a surveiller.
- Une vraie session avec messages/artefacts peut encore paraitre trop dense meme si l'accueil est enfin beaucoup plus calme.
