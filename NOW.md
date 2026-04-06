# NOW

## Objectif actuel
- Espace de travail persistant pour l'agent Cowork (type VM/gestionnaire de fichiers inter-sessions) — LIVRÉ et pushé.
- Fix bug media history Cowork (l'IA re-décrivait les images à chaque message) — LIVRÉ et pushé.

## Blocage actuel
- Aucun. Les deux features sont en prod (commit 1f86135).

## Prochaine action exacte
- Tester en conditions réelles :
  1. Lancer un run Cowork qui crée un fichier (podcast, PDF, image)
  2. Vérifier dans Firestore `/users/{uid}/workspace/files` qu'un doc est créé
  3. Ouvrir une nouvelle session Cowork → vérifier que l'agent liste ses créations passées
  4. Tester `workspace_delete` avec un fileId réel

## Fichiers chauds
- `api/index.ts` — release_file emit, workspace_delete tool, buildCoworkSystemInstruction
- `src/App.tsx` — fetch workspace, SSE handlers workspace_file_created/deleted
- `server/lib/schemas.ts` — ChatSchema.workspaceFiles
- `src/utils/chat-parts.ts` — historyMode (fix media re-processing)
- `firestore.rules` — règles workspace/files

## Validations restantes
- Test end-to-end workspace (création → Firestore → injection session suivante)
- Test workspace_delete (suppression Firestore)
- Vérifier que le fix history media règle bien le bug de re-description photo

## Risques immédiats
- Les signed URLs GCS expirent en 7 jours. Le workspace stocke les storageUri (permanents) donc OK pour l'accès modèle, mais les liens de téléchargement utilisateur expireront. Pas de régénération automatique pour l'instant.
- `limit` importé directement depuis `firebase/firestore` dans App.tsx — s'assurer que la version du SDK le supporte (elle le supporte, c'est une API stable).
