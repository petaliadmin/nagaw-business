# Roadmap

Les phases suivent le prompt maître, avec des ajustements tirés de l'audit (dépôt vide), puis le **repositionnement en application de gestion de boutique** du 2026-10-24 (ADR-019, accepté). Chaque phase se termine par une PR, un rapport et une validation explicite du propriétaire.

## Socle (phases livrées)

| Phase | Intitulé                  | Ajustements par rapport au prompt maître                                                                                                                        | État                                     |
| ----- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 0     | Audit et plan             | —                                                                                                                                                               | Validée                                  |
| 1     | Socle technique           | Création complète du monorepo : web, api, shared, CI, santé, projets Vercel                                                                                     | Validée                                  |
| 2     | BDD, Auth, multi-tenant   | **Ajout** : `audit_logs` et service d'audit dès cette phase (requis par toutes les suivantes) ; pages connexion/inscription minimales pour tester l'auth réelle | Validée                                  |
| 3     | Interface et navigation   | La navigation n'affiche que les modules livrés (aucun lien mort) ; interface en français uniquement (ADR-012)                                                   | Validée                                  |
| 4     | Organisations, équipe     | Invitations par lien, sans fournisseur d'e-mail (ADR-015). Les organisations deviennent les **boutiques** (ADR-019)                                             | Validée                                  |
| 5     | Agents                    | Livrée puis **retirée** sur décision du propriétaire (ADR-017) ; tables conservées en base, inutilisées                                                         | Retirée                                  |
| 6     | Responsabilités           | Responsabilités confiées à un membre, déclenchement manuel (ADR-017). **Retrait décidé** (2026-10-24, ADR-019) et fait en Phase 8                               | Retirée en Phase 8                       |
| 7     | Suivi des tâches (manuel) | Une personne lance, renseigne et clôt chaque tâche (ADR-018). **Retrait décidé** (2026-10-24, ADR-019) et fait en Phase 8                                       | Validée (2026-10-23), retirée en Phase 8 |

Les anciennes phases 8 (approbations), 9 (outils et intégrations), 10 (documents) et 11 (notifications, planification) sont **remplacées** par les phases ci-dessous.

## Application de gestion de boutique (phases à venir)

| Phase | Intitulé                         | Contenu                                                                                                                                                                                                                                                                                                                 |   MVP   | État                                                                    |
| ----- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----: | ----------------------------------------------------------------------- |
| 8     | Design system et application PWA | Jetons de couleur et typographie (ADR-021, `DESIGN.md`), composants accessibles, nouvelle navigation mobile / ordinateur, PWA installable qui s'ouvre hors ligne, bandeau d'état de connexion, retrait de Responsabilités et Tâches                                                                                     |    ✔    | Validée (2026-10-24)                                                    |
| 9     | Produits et stock                | Catégories, unités, produits avec photo (Supabase Storage), taux de taxe configurables, mouvements de stock en ajout seul, entrées fournisseur, pertes, inventaire, alertes de stock bas (seuil par produit)                                                                                                            |    ✔    | Validée (2026-10-24)                                                    |
| 10    | Ventes                           | Écran de caisse, panier, paiements multiples (espèces avec rendu, Mobile Money saisi, carte, crédit), clients et créances, ticket imprimé en Bluetooth (ADR-022, testé sur imprimantes réelles) ou partagé, retours et annulations (gérant, motif, audit). Identifiants d'opération générés côté client dès cette phase |    ✔    | Validée (2026-10-24) ; impression Bluetooth en attente d'une imprimante |
| 11    | Hors ligne et synchronisation    | Base locale IndexedDB, catalogue en cache, ventes et mouvements hors ligne, `POST /api/v1/sync` idempotent, appareils et numérotation des tickets, opérations refusées et conflits affichés (ADR-020)                                                                                                                   |    ✔    | Validée (2026-10-24)                                                    |
| 12    | Factures et devis                | Devis, conversion en facture, numérotation légale côté serveur, PDF aux couleurs de la boutique, paiements partiels, avoirs, partage WhatsApp                                                                                                                                                                           |    ✔    | Validée (2026-10-25)                                                    |
| 13    | Statistiques et trésorerie       | Tableau de bord du jour, chiffre d'affaires, marge, panier moyen, meilleurs produits, caisses (espèces, Mobile Money, banque), dépenses, clôture de caisse, créances, comparaison entre boutiques                                                                                                                       |    ✔    | **Livrée — en attente de validation**                                   |
| 14    | Comptabilité                     | Système minimal de trésorerie SYSCOHADA (journal des recettes et dépenses, état de fin d'exercice), export CSV pour le comptable ; partie double en option ultérieure                                                                                                                                                   | partiel | À faire                                                                 |
| 15    | Abonnements, quotas              | Plan gratuit et plans payants ; prestataire de paiement (Mobile Money) à choisir par le propriétaire                                                                                                                                                                                                                    | partiel | À faire                                                                 |
| 16    | Administration, observabilité    | Administration plateforme, métriques de synchronisation, alertes                                                                                                                                                                                                                                                        |         | À faire                                                                 |
| 17    | Sécurité, tests, stabilisation   | Passage global : isolation, sync, appareils perdus, accessibilité, performance sur téléphone d'entrée de gamme                                                                                                                                                                                                          |    ✔    | À faire                                                                 |
| 18    | Déploiement, pilote              | Production, pilote avec des boutiques réelles, test utilisateur avec des commerçants                                                                                                                                                                                                                                    |    ✔    | À faire                                                                 |

## Critères d'acceptation du MVP

Le MVP est atteint lorsque le parcours suivant fonctionne **en préproduction**, sur le backend réel, sur un téléphone (360 px) et sur ordinateur, couvert par des tests end-to-end automatisés :

1. un commerçant crée son compte et sa boutique, puis invite un vendeur ;
2. il ajoute des produits avec photo, prix et stock initial ;
3. le vendeur, **sans connexion**, enregistre plusieurs ventes payées en espèces, en Mobile Money et à crédit ;
4. au retour du réseau, les ventes sont synchronisées sans doublon, le stock et les créances sont à jour ;
5. le commerçant émet un devis, le transforme en facture numérotée et en partage le PDF ;
6. il consulte son chiffre d'affaires, sa marge et sa trésorerie du jour et du mois, et clôture sa caisse ;
7. le comptable exporte le journal des recettes et dépenses.

Avec, en plus :

- une isolation inter-boutiques démontrée par des tests d'intégration sur chaque endpoint, y compris la synchronisation ;
- un rejeu de synchronisation qui ne crée aucun doublon (test automatisé) ;
- aucune violation d'accessibilité sérieuse ou critique (axe-core) sur les parcours ;
- aucune clé privilégiée présente dans le bundle frontend (vérification automatisée en CI).
