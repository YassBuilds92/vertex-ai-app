# COWORK - Projet Studio Pro

## Vision
L'agent **Cowork** est une boucle autonome intégrée dans AI Studio. Contrairement au chat classique, il peut planifier, rechercher (via des outils locaux) et exécuter des tâches directement sur le système de fichiers.

## Architecture
- **Frontend** : React (Zustand pour l'état). Le mode `cowork` envoie des requêtes à `/api/cowork`.
- **Backend** : Express (Node.js). La route `/api/cowork` gère une boucle d'itération (jusqu'à 15 tours) avec streaming des pensées (`thought`) et des appels d'outils (`functionCall`).
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
- [x] Correction de la boucle infinie (Feedback UI + Listing /tmp/).
- [x] Installation de ReportLab pour PDF.
- [x] Activation du moteur de raisonnement (Thinking Mode Gemini 3.1).
- [x] Amélioration de la résilience aux erreurs d'environnement (python/python3).
- [x] Fusion systématique du prompt système Cowork backend avec les consignes utilisateur pour éviter qu'un prompt frontend minimal neutralise les règles critiques.
- [x] Propagation de `call.id` dans les `functionResponse` et ajout d'un fallback final si `release_file` réussit mais que Gemini ne génère aucun texte de conclusion.

## Prochaines Étapes
1. Déployer ces corrections sur Vercel et valider le cas réel "crée moi un fichier pdf test" sur l'URL de production.
2. Nettoyer les anciennes notes obsolètes (ex: ReportLab) pour que le document reflète uniquement l'architecture Node native actuelle.
3. Améliorer la robustesse de `execute_script` avec des timeouts et un reporting plus explicite des erreurs.
