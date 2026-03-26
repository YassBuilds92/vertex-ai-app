# COWORK - Projet Studio Pro

## Vision
L'agent **Cowork** est une boucle autonome integree dans AI Studio. Contrairement au chat classique, il peut planifier, rechercher (via des outils locaux) et executer des taches directement sur le systeme de fichiers.

## Architecture
- **Frontend** : React (Zustand pour l'etat). Le mode `cowork` envoie des requetes a `/api/cowork`.
- **Backend** : Express (Node.js). La route `/api/cowork` gere une boucle d'iteration (jusqu'a 15 tours) avec streaming des pensees (`thought`) et des appels d'outils (`functionCall`).
- **IA** : Gemini 3.1 Pro Preview (Vertex AI).

## Outils Locaux (localTools)
- `list_files` : Liste les fichiers a la racine.
- `read_file` : Lit le contenu d'un fichier (securise).
- `write_file` : Ecrit un fichier (force vers `/tmp/` sur Vercel).
- `list_recursive` : Exploration profonde du projet.
- `release_file` : Uploade un fichier vers Google Cloud Storage et renvoie une URL signee de 7 jours.

## Etat d'Avancement
- [x] Initialisation du mode Cowork.
- [x] Boucle agentique avec support des outils locaux.
- [x] Support du streaming des pensees (thoughts).
- [x] Correction des erreurs de lecture seule sur Vercel.
- [x] Ajout d'un outil d'execution de script.
- [x] Correction de la boucle infinie (feedback UI + listing `/tmp/`).
- [x] Migration du flux PDF vers un outil natif Node (`create_pdf`).
- [x] Activation du moteur de raisonnement (Thinking Mode Gemini 3.1).
- [x] Amelioration de la resilience aux erreurs d'environnement (python/python3).
- [x] Fusion systematique du prompt systeme Cowork backend avec les consignes utilisateur pour eviter qu'un prompt frontend minimal neutralise les regles critiques.
- [x] Propagation de `call.id` dans les `functionResponse` et ajout d'un fallback final si `release_file` reussit mais que Gemini ne genere aucun texte de conclusion.
- [x] Ajout d'un garde-fou "artifact completion" : si l'utilisateur demande un PDF/fichier et que le modele s'arrete apres une synthese texte, la boucle relance un tour guide pour terminer `create_pdf -> release_file -> lien final`.
- [x] Correction de la regression Vertex AI : suppression de `includeServerSideToolInvocations` dans `/api/cowork` car ce parametre n'est pas supporte par Vertex AI, tout en conservant `googleSearch` / `codeExecution` via `config.tools`.
- [x] Correction de l'ecran vide Cowork : les erreurs SSE (`data.error`) sont maintenant remontees cote frontend au lieu d'etre ignorees silencieusement.
- [x] Affinage du garde-fou d'artefact : une simple lecture de fichier ne declenche plus `release_file`; la relance automatique ne s'active que pour les vraies demandes de creation/export.

## Prochaines Etapes
1. Deployer ces corrections sur Vercel et revalider les cas reels `creer moi un pdf test` et `fais-moi l'actu du jour puis fournis un PDF` sur l'URL de production.
2. Nettoyer les anciennes notes obsoletes pour que le document ne mentionne plus de workaround incompatible Vertex AI.
3. Ameliorer la robustesse de `execute_script` avec des timeouts et un reporting plus explicite des erreurs.
