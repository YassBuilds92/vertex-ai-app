# BUGS GRAVEYARD

## Format
- Date
- Statut
- Symptome
- Stack trace / message
- Tentatives
- Cause racine
- Resolution
- Prevention

## 2026-03-29 - Validation locale Hub Agents bloquee par Firebase Auth
- Statut: ouvert / non resolu
- Symptome:
  - impossible de verifier visuellement le flow authentifie du Hub Agents en local via Playwright
  - clic sur "Se connecter avec Google" ouvre le handler Firebase puis echoue
- Message observe:
  - `Firebase: Error (auth/unauthorized-domain).`
  - console Playwright: `Login error: FirebaseError: Firebase: Error (auth/unauthorized-domain).`
- Tentatives:
  - chargement local de l'app sur `http://127.0.0.1:3000`
  - tentative de login Google via Playwright
  - observation des logs console et du popup auth
- Cause racine probable:
  - le domaine `127.0.0.1` n'est pas autorise dans Firebase Authentication pour ce projet
  - la validation locale ne peut donc pas couvrir le cycle Firestore complet sans configuration console
- Resolution:
  - pas encore appliquee dans cette session
  - piste la plus probable: ajouter `127.0.0.1` et `localhost` dans les Authorized domains Firebase Auth, ou valider directement sur le domaine de deploiement autorise
- Prevention:
  - verifier les domaines Firebase autorises avant toute campagne de validation UI authentifiee en local
  - documenter clairement dans `SESSION_STATE.md` quand une validation visuelle reste partielle a cause d'un blocage d'environnement
