# DECISIONS

## 2026-03-29 - Hub Agents integre a Cowork
- Statut: adopte
- Contexte: l'utilisateur veut que Cowork soit l'essence du produit, capable soit d'executer lui-meme, soit de creer un specialiste delegable et reutilisable.
- Decision: integrer le Hub Agents dans l'univers Cowork au lieu de construire un produit annexe independant.
- Pourquoi:
  - colle a la vision produit "agent general + specialistes"
  - evite un hub decoratif sans lien avec la boucle agentique
  - permet a Cowork de livrer un objet concret et persistant quand il parle de delegation
- Consequence:
  - ajout de `create_agent_blueprint` cote backend
  - nouvel evenement SSE `agent_blueprint`
  - persistance Firestore `users/{uid}/agents`
  - UI `Hub Agents` cote frontend

## 2026-03-29 - Delegation via blueprint avant execution reelle
- Statut: adopte
- Contexte: il fallait livrer une premiere brique utile sans casser la boucle Cowork existante ni ouvrir tout de suite un sous-systeme multi-runs complexe.
- Decision: commencer par la creation et la persistance de blueprints d'agents avant de brancher l'execution d'un agent du hub comme sous-mission reelle.
- Pourquoi:
  - chemin le plus simple et le plus robuste pour livrer une valeur produit immediate
  - limite le risque de regression dans `/api/cowork`
  - fournit deja une base stable pour la future generative UI
- Alternatives ecartees:
  - sous-agents executes immediatement dans la meme session: trop de complexite pour un premier lot
  - hub frontend seulement: rejete car trop cosmetique

## 2026-03-29 - Pas de nouvelle dependance frontend pour le Hub
- Statut: adopte
- Contexte: le hub pouvait etre implemente avec la stack deja presente.
- Decision: reutiliser React, Motion, Firestore et la stack CSS existante sans ajouter de librairie d'UI ni de gestion de schema.
- Pourquoi:
  - aucune dependance additionnelle necessaire pour ce premier lot
  - limite la dette technique
  - accelere la livraison et le controle du rendu

## 2026-03-29 - Validation UI locale marquee comme partielle
- Statut: adopte
- Contexte: Playwright a permis de charger l'app, mais le login Google local est bloque par Firebase Auth.
- Decision: documenter explicitement la validation visuelle comme partielle et ne pas pretendre que le flow authentifie est valide.
- Pourquoi:
  - respect de l'honnetete radicale
  - evite de declarer un cycle Firestore/HUB verifie alors qu'il ne l'est pas completement

## 2026-03-29 - Relance d'un agent du hub par transmission explicite du catalogue
- Statut: adopte
- Contexte: le backend `/api/cowork` n'a pas acces nativement aux agents persistes dans Firestore cote client, donc il ne pouvait pas reutiliser un specialiste existant.
- Decision: transmettre le catalogue `hubAgents` dans chaque requete `/api/cowork`, puis ajouter un outil `run_hub_agent` qui relance un agent existant comme vraie sous-mission.
- Pourquoi:
  - garde l'architecture simple sans backend Firestore supplementaire
  - permet a Cowork de reutiliser un specialiste deja cree au lieu d'empiler des blueprints
  - rend la delegation reelle sans ouvrir tout de suite un sous-systeme multi-runs persistant
- Alternatives ecartees:
  - lecture Firestore directe cote backend: plus lourde et inutile pour cette etape
  - nouveau service dedie aux sous-agents: premature et trop risquee pour le lot actuel
