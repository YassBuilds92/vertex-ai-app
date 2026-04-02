# NOW

## Objectif actuel
- Valider et affiner la nouvelle home `Cowork Apps` en mode gestionnaire d'applications:
  - vraie grille d'apps lisible
  - preview centrale d'interface propre a chaque app
  - barre de creation basse qui laisse Cowork clarifier la vision avant generation

## Blocage actuel
- La refonte `AgentsHub` est validee localement en TypeScript/build + captures desktop/mobile, mais pas encore rejouee dans l'app authentifiee avec de vraies apps store.

## Prochaine action exacte
- Rejouer la home `Cowork Apps` en session reelle:
  - ouverture du store avec donnees utilisateur reelles
  - verification du flow clarification dans la vraie app
  - verification desktop + mobile sur le domaine/auth reels

## Fichiers chauds
- `src/components/AgentsHub.tsx`
- `tmp/cowork-apps-preview.tsx`
- `QA_RECIPES.md`
- `COWORK.md`
- `DECISIONS.md`

## Validations restantes
- Verifier que la home tient bien avec plus d'apps reelles et plusieurs pages.
- Verifier que la clarification live reste claire dans l'UI authentifiee.
- Verifier que le mobile garde assez de hauteur utile quand le clavier est ouvert.

## Risques immediats
- Sur mobile, la bibliotheque d'apps descend vite sous la ligne de flottaison si le store grossit ou si le clavier prend beaucoup de place.
- Le preview harness local valide bien la composition, mais pas encore les vraies donnees Firestore/local-first du store utilisateur.
