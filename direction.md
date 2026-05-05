# Manifeste de memoire Codex

Ce projet est une application web Studio IA multimodale (chat, cowork, images, voix, musique, video) avec frontend Vite/React et backend Node/Express/Cloud Functions. Avant chaque intervention, lire ce fichier puis charger seulement les fichiers de contexte pertinents ci-dessous.

## Fichiers de contexte

- `SYSTEM_MAP.md`: carte technique du systeme. Lire quand une modification touche l'architecture frontend/backend, les services, les routes API ou le flux de donnees.
- `TECH_RADAR.md`: choix technologiques, APIs IA, SDKs et notes d'obsolescence. Lire et mettre a jour quand une dependance, un modele ou un parametre fournisseur change.
- `DECISIONS.md`: decisions produit/techniques prises. Lire pour eviter de contredire les choix existants, mettre a jour apres toute decision durable.
- `SESSION_STATE.md`: etat courant, travaux recents, incidents et verification. Lire quand l'intervention est large ou reprend un chantier UI/API; mettre a jour apres chaque intervention.
- `INVARIANTS.md`: regles a ne pas casser. Lire pour les changements qui touchent la generation, les conversations, le stockage ou la compatibilite API.
- `BUGS_GRAVEYARD.md`: bugs connus/resolus et regressions. Lire si la demande mentionne un bug; mettre a jour apres correction.
- `AI_LEARNINGS.md`: apprentissages API/modeles/prompts. Lire pour les integrations IA; mettre a jour si une recherche officielle change les valeurs conseillees.
- `COWORK.md`: contexte historique du mode Cowork. Lire seulement pour modifier ou retirer des fonctions Cowork.
- `QA_RECIPES.md`: recettes de verification locale. Lire avant de lancer une verification UI ou E2E.

## Routine

1. Toujours commencer par lire `direction.md`.
2. Lire les fichiers ci-dessus qui correspondent a la zone modifiee.
3. Pour les APIs, modeles ou bibliotheques IA, verifier la documentation officielle recente avant de coder et noter la source dans `TECH_RADAR.md` ou `AI_LEARNINGS.md`.
4. Ne jamais simuler une fonctionnalite: si une API ou un materiel manque, l'indiquer clairement.
5. Avant de finir, mettre a jour les fichiers de memoire pertinents avec ce qui a ete change, les tests lances et les risques restants.
