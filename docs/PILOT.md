# Pilote avec des boutiques réelles

> **État** : prêt à démarrer côté application (Phase 18). Les choix marqués **« à décider »** reviennent au propriétaire ; ce document propose des valeurs par défaut.

## Objectif

Vérifier, avec de vrais commerçants et de vraies ventes, que Nagaw Business tient ses promesses : vendre vite, même sans réseau, sans erreur de caisse, et que le propriétaire comprend son argent (statistiques, trésorerie, comptabilité), le tout par des personnes peu à l'aise avec le numérique.

## Organisation proposée

| Point        | Proposition                                                                        | À décider  |
| ------------ | ---------------------------------------------------------------------------------- | ---------- |
| Durée        | 4 semaines                                                                         | ✔          |
| Boutiques    | 3 à 5, de types différents (épicerie, quincaillerie, téléphonie, cosmétiques)      | ✔          |
| Offre        | Pro, sans paiement pendant le pilote (changée dans **Administration → Boutiques**) | ✔          |
| Téléphones   | Celui du commerçant ; au moins un Android d'entrée de gamme parmi les boutiques    |            |
| Assistance   | Un numéro WhatsApp de l'équipe, et « Donner mon avis » dans l'application          | ✔ (numéro) |
| Consentement | Accord écrit de chaque boutique : données réelles, observation, prise de notes     | ✔          |

## Avant le premier jour (propriétaire)

1. **Sauvegardes** : passer le projet Supabase au plan Pro et activer la restauration à un instant donné (PITR) ; vérifier que les sauvegardes quotidiennes apparaissent.
2. **Restauration testée** : restaurer une sauvegarde dans un projet Supabase de préproduction, faire pointer une préversion Vercel dessus et vérifier qu'on s'y connecte et qu'on y retrouve les ventes. Noter la durée.
3. **Administrateur** : votre compte ajouté dans `app.platform_admins` (voir `docs/OPERATIONS.md`).
4. **Test de fumée** : `pnpm smoke https://nagaw-web.vercel.app https://nagaw-api-petalia.vercel.app` (lancé aussi par GitHub après chaque déploiement de production).
5. **Parcours complet sur vrais téléphones** : faire une fois, soi-même, les sept étapes des critères d'acceptation ci-dessous sur la production, dont la vente en mode avion.

## Accueil d'une boutique (30 à 45 minutes)

1. Le commerçant crée son compte et sa boutique sur son téléphone (on l'aide à taper, on ne tape pas pour lui).
2. Paramètres : nom, devise, identité pour les factures (NINEA, RCCM si disponibles).
3. Dix produits réels avec photo, prix et stock.
4. Invitation d'un vendeur, s'il y en a un.
5. Une vente en espèces, une en Mobile Money, une à crédit ; puis une vente en mode avion, et l'envoi au retour du réseau.
6. Installation de l'application sur l'écran d'accueil.
7. Lui montrer « Donner mon avis ».

## Suivi pendant le pilote (chaque jour, 10 minutes)

- **Administration → Tableau de bord** : alertes (refus de synchronisation, limites, téléphones silencieux).
- **Administration → Avis** : répondre à chaque message dans la journée.
- **Administration → Synchronisation** : motifs de refus ; un motif qui revient est un défaut à corriger.
- Une visite ou un appel par boutique et par semaine.

## Test utilisateur (une séance par boutique, semaine 2)

**Consignes** : la personne utilise son téléphone et dit à voix haute ce qu'elle pense ; l'observateur **n'aide pas** (sauf blocage de plus de 2 minutes, noté « avec aide »), ne commente pas, note.

| #   | Tâche                                                                    | Réussie seule | Avec aide | Échec | Durée | Remarques et citations |
| --- | ------------------------------------------------------------------------ | ------------- | --------- | ----- | ----- | ---------------------- |
| 1   | Ajouter un produit avec sa photo et son stock                            |               |           |       |       |                        |
| 2   | Vendre 3 articles en espèces et rendre la monnaie                        |               |           |       |       |                        |
| 3   | Vendre à crédit à un client, puis enregistrer son remboursement          |               |           |       |       |                        |
| 4   | Vendre sans réseau (mode avion), puis vérifier l'envoi                   |               |           |       |       |                        |
| 5   | Faire un devis, le transformer en facture et l'envoyer en PDF            |               |           |       |       |                        |
| 6   | Dire combien la boutique a gagné ce mois et ce qu'il y a en caisse       |               |           |       |       |                        |
| 7   | Clôturer la caisse du jour                                               |               |           |       |       |                        |
| 8   | (Comptable ou propriétaire) Exporter le journal des recettes et dépenses |               |           |       |       |                        |

**Questions de fin** (réponse de 1 à 5) : c'était facile ; je me suis senti en confiance ; je saurais le refaire seul ; les mots étaient clairs ; je le recommanderais à un autre commerçant. Puis : qu'est-ce qui vous a gêné ? qu'est-ce qui manque ?

## Critères de réussite du pilote (proposition)

- 80 % des tâches réussies **seul** ;
- aucune vente perdue ni comptée deux fois ;
- moins de 5 % d'opérations hors ligne refusées, chaque refus expliqué ;
- la caisse clôturée au moins 4 jours sur 7, avec des écarts expliqués ;
- au moins 3 boutiques sur 5 qui veulent continuer après le pilote.

## Critères d'acceptation du MVP (`docs/ROADMAP.md`)

| Critère                                                      | Couvert par des tests automatisés                                     | Reste à vérifier pendant le pilote          |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------- |
| 1. Compte, boutique, invitation d'un vendeur                 | e2e (faux backend), intégration (vraie base)                          | sur la production, vrais téléphones         |
| 2. Produits avec photo, prix, stock                          | e2e, intégration                                                      | idem                                        |
| 3. Ventes **sans connexion** (espèces, Mobile Money, crédit) | e2e hors ligne (coupure du réseau), intégration de la synchronisation | mode avion sur un Android d'entrée de gamme |
| 4. Synchronisation sans doublon, stock et créances à jour    | intégration (rejeu d'un lot)                                          | retour du réseau après une journée          |
| 5. Devis → facture numérotée → PDF partagé                   | e2e, intégration                                                      | partage WhatsApp réel                       |
| 6. CA, marge, trésorerie du jour et du mois, clôture         | e2e, intégration                                                      | une semaine de ventes réelles               |
| 7. Export du journal par le comptable                        | e2e, intégration                                                      | relecture par un comptable                  |
| Isolation entre boutiques sur chaque endpoint                | inventaire de toutes les routes (intégration)                         | —                                           |
| Rejeu de synchronisation sans doublon                        | intégration                                                           | —                                           |
| Aucune violation d'accessibilité sérieuse                    | axe-core sur toutes les pages                                         | lecteur d'écran (TalkBack) sur un téléphone |
| Aucune clé privilégiée dans le bundle                        | CI (leurres), test de fumée                                           | —                                           |

Les tests de bout en bout tournent contre un **faux backend** qui applique les mêmes règles partagées ; le parcours complet sur le **backend réel** (critère « en préproduction ») se fait à la main avant le premier jour (étape 5 ci-dessus), puis pendant le pilote.
