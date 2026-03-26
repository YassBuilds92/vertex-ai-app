# COWORK - Projet Studio Pro

## Vision
L'agent **Cowork** est une boucle autonome intégrée dans AI Studio. Contrairement au chat classique, il peut planifier, rechercher (via des outils locaux) et exécuter des tâches directement sur le système de fichiers.

## Architecture
- **Frontend** : React (Zustand pour l'état). Le mode `cowork` envoie des requêtes à `/api/cowork`.
- **Backend** : Express (Node.js). La route `/api/cowork` gère une boucle d'itération (jusqu'à 8 tours) avec streaming des pensées (`thought`) et des appels d'outils (`functionCall`).
- **IA** : Gemini 3.1 Pro Preview (Vertex AI).

## Outils Locaux (localTools)
- `list_files` : Liste les fichiers à la racine.
- `read_file` : Lit le contenu d'un fichier (sécurisé).
- `write_file` : Écrit un fichier (forcé vers `/tmp/` sur Vercel).
- `list_recursive` : Exploration profonde du projet.
- `release_file` : Uploade un fichier vers Google Cloud Storage et renvoie une URL signée de 7 jours.

## État d'Avancement
- [x] Initialisation du mode Cowork.
- [x] Boucle agentique avec support des outils locaux.
- [x] Support du streaming des pensées (thoughts).
- [x] Correction des erreurs de lecture seule sur Vercel.
- [x] Ajout d'un outil d'exécution de script.

## Prochaines Étapes
1. Déployer la correction de la validation des chemins (priorité `/tmp/`).
2. Implémenter `execute_script` pour permettre la génération dynamique de PDF via Python.
3. Mettre à jour les instructions système pour une meilleure autonomie.
