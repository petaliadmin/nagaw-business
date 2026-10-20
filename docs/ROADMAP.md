# Roadmap

Les phases suivent le prompt maître, avec des ajustements tirés de l'audit (dépôt vide). Chaque phase se termine par une PR, un rapport et une validation explicite du propriétaire.

| Phase | Intitulé | Ajustements par rapport au prompt maître | MVP | État |
|---|---|---|:-:|---|
| 0 | Audit et plan | — | ✔ | **Terminée — en attente de validation** |
| 1 | Socle technique | Création complète du monorepo (rien à consolider) : web, api, worker, shared, CI, Docker local, page de santé | ✔ | À faire |
| 2 | BDD, Auth, multi-tenant | **Ajout** : `audit_logs` et service d'audit dès cette phase (requis par toutes les suivantes) ; pages connexion/inscription minimales pour tester l'auth réelle | ✔ | À faire |
| 3 | Interface et navigation | La navigation n'affiche que les modules livrés (aucun lien mort) ; i18n FR prête | ✔ | À faire |
| 4 | Organisations, équipe | Invitations par e-mail : utilise l'adaptateur e-mail minimal (initialement dans la phase 9) | ✔ | À faire |
| 5 | Agents | « Test contrôlé » branché sur le fournisseur IA réel → adaptateur `LlmProvider` minimal ramené ici | ✔ | À faire |
| 6 | Responsabilités | Déclencheurs manuels ; la planification cron est activée en Phase 7 avec le worker | ✔ | À faire |
| 7 | Moteur d'exécution | **Ajout** : `usage_records` et limites de consommation (contrôle des coûts dès la première exécution réelle) | ✔ | À faire |
| 8 | Approbations | — | ✔ | À faire |
| 9 | Outils et intégrations | Registre d'outils + premier outil métier réel (envoi d'e-mail par agent) | ✔ | À faire |
| 10 | Documents | — | | À faire |
| 11 | Notifications, planification | Notifications in-app minimales livrées dès la Phase 8 (demandes d'approbation) ; cette phase complète les canaux, reprises et l'historique | partiel | À faire |
| 12 | Abonnements, quotas | Quotas de base dès la Phase 7 (plan gratuit unique) ; paiement ici | partiel | À faire |
| 13 | Administration, observabilité | — | | À faire |
| 14 | Sécurité, tests, stabilisation | Tests de sécurité écrits à chaque phase ; cette phase est un passage global | ✔ | À faire |
| 15 | Déploiement, pilote | La préproduction est déployée dès la Phase 2 pour valider l'auth réelle | ✔ | À faire |

## Critères d'acceptation du MVP

Le MVP est atteint lorsque le parcours de recette global (prompt maître § 14, étapes 1 à 15) fonctionne **en préproduction**, sur le backend réel, couvert par un test end-to-end automatisé, avec :

- une isolation inter-organisations démontrée par des tests d'intégration sur chaque endpoint ;
- aucune action soumise à approbation exécutable sans approbation valide (test de contournement) ;
- une consommation IA bornée par organisation et par exécution ;
- aucune clé privilégiée présente dans le bundle frontend (vérification automatisée en CI).
