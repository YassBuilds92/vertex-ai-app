# SESSION STATE

## Derniere mise a jour
- Date: 2026-03-29
- Contexte: chantier Cowork / Hub Agents

## Accompli dans cette session
- Un `Hub Agents` natif a ete branche dans Cowork au lieu de rester une idee separee.
- Le backend Cowork sait maintenant concevoir un agent specialise via l'outil `create_agent_blueprint`.
- Cowork sait maintenant relancer un agent deja present dans le hub comme vraie sous-mission via `run_hub_agent`.
- Chaque requete `/api/cowork` embarque maintenant le catalogue des agents du hub pour que le modele puisse choisir entre reutiliser un specialiste existant ou en creer un nouveau.
- Le sous-agent execute une mini-boucle reelle avec le `systemInstruction` du blueprint et seulement les outils autorises par cet agent.
- La timeline Cowork expose des etapes explicites `Sous-mission` / `Sous-mission terminee` pendant la delegation reelle.
- Les regles Firestore du projet ont ete redeployees (`npm run deploy-rules`) pour corriger le `Missing or insufficient permissions` sur `users/{uid}/agents`.
- Le frontend n'interrompt plus tout le run Cowork si la persistance Firestore d'un `agent_blueprint` echoue: il affiche maintenant un warning de synchronisation du hub et continue la reponse.
- La boucle `/api/cowork` emet un nouvel evenement SSE `agent_blueprint`.
- Le frontend persiste les blueprints dans Firestore sous `users/{uid}/agents`.
- Une interface `Hub Agents` a ete ajoutee pour visualiser les agents crees, leur mission, leurs outils et leur premiere UI.
- Une route manuelle `/api/agents/create` a ete ajoutee pour creer un agent depuis l'interface sans passer par un run Cowork.
- Les regles Firestore ont ete mises a jour pour autoriser la collection `agents`.
- `AI_LEARNINGS.md` et `COWORK.md` ont ete enrichis avec la decision Hub Agents.

## Intentions du dernier changement
- Faire de la delegation une vraie capacite produit de Cowork.
- Eviter que Cowork dise "je t'ai cree un agent" sans objet persistant, sans UI et sans reutilisation possible.
- Poser le socle du futur modele "Cowork = agent general + possibilite de creer et relancer des specialistes".
- Passer du niveau "blueprint persiste" au niveau "specialiste relancable" sans introduire un sous-systeme multi-sessions separe.

## Fichiers modifies ou crees
- `api/index.ts`
- `api/lib/agents.ts`
- `api/lib/schemas.ts`
- `src/App.tsx`
- `src/components/AgentsHub.tsx`
- `test-cowork-loop.ts`
- `firestore.rules` (redeploy cote cloud, pas de contenu change dans cette session)

## Verification effectuee
- `npm run lint` : OK
- `npm run build` : OK
- `npx tsx test-cowork-loop.ts` : OK
- `npm run deploy-rules` : OK
- Validation navigateur authentifiee toujours non rejouee cette session : le blocage Firebase Auth local sur `127.0.0.1` reste actif.

## Blocages et pieges actifs
- Blocage principal: `auth/unauthorized-domain` sur `127.0.0.1` pendant le login Google en local.
- Consequence: impossible de valider visuellement en session connectee le cycle complet "creer un agent -> persistance Firestore -> reaffichage" tant que le domaine local n'est pas autorise dans Firebase Auth ou tant qu'on ne valide pas sur le domaine de deploiement.
- Attention: les consignes projet disent de privilegier la validation sur l'URL de production plutot que `localhost`.

## Ce qu'il reste a faire
- Transformer `uiSchema` en vraie surface de generative UI executable avec formulaire borne.
- Ajouter un point d'entree UI plus direct pour forcer ou suggerer explicitement la relance d'un agent du hub depuis l'interface si on veut reduire la dependance au choix autonome du modele.
- Ajouter l'auto-fill pour remplir le schema d'un agent a partir d'une demande libre.
- Cadrer le pipeline podcast pour script + TTS + musique Lyria avec verification officielle des model IDs et des APIs exactes.
- Valider visuellement le Hub Agents sur un domaine autorise Firebase.

## Reprise ideale la prochaine session
1. Verifier le domaine de validation disponible (Vercel ou domaine Firebase autorise).
2. Rejouer un run Cowork qui choisit un agent deja existant du hub et verifier qu'il appelle `run_hub_agent` au lieu de recreer un blueprint.
3. Si la relance autonome marche, ajouter si besoin une commande/UI explicite pour "forcer la delegation a cet agent".
