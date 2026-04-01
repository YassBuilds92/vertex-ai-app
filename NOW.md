# NOW

## Objectif actuel
- Rejouer le nouveau `Cowork Apps` inspire de la reference utilisateur dans la vraie app, avec une session authentifiee et de vraies apps du store.

## Blocage actuel
- Pas de blocage technique immediat.
- La mise en page de reference est validee sur harness local, mais pas encore ressentie dans le shell complet avec de vraies donnees.
- Le comportement des noms tres longs et des stores plus fournis reste a confirmer hors fixtures.

## Prochaine action exacte
- Ouvrir `Cowork Apps` dans la vraie app et verifier que:
  - la topbar recherche + hero + rail d'apps + labo lateral tiennent bien sur desktop reel
  - l'ouverture d'une app depuis une carte garde le bon flow `autoRun:false`
  - le panneau lateral reste lisible avec des apps reelles et des titres plus longs

## Fichiers chauds
- `src/components/AgentsHub.tsx`
- `QA_RECIPES.md`
- `SESSION_STATE.md`
- `COWORK.md`
- `DECISIONS.md`

## Validations restantes
- Rejouer `Cowork Apps` dans la vraie app avec login/session reelle.
- Reconfirmer desktop/mobile sur des vraies donnees, pas seulement sur le harness `tmp`.
- Verifier les noms d'apps tres longs dans le rail et dans `Derniers projets collaboratifs`.
- Observer si la colonne de droite doit encore etre compacte sur des resolutions desktop plus basses.

## Risques immediats
- Des blueprints reels trop faibles peuvent rendre le rail d'apps moins singulier que dans le harness.
- Des titres reels trop longs peuvent casser l'equilibre des cartes et de la colonne laterale.
- Le rendu plein ecran est valide localement, mais doit encore etre ressenti dans le shell complet en session reelle.
