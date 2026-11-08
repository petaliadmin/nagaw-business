# Pilote avec des boutiques réelles

> **État** : lot 2 du plan d'amélioration, lancé par le propriétaire le 2026-11-01. **Le propriétaire a choisi de lancer sans attendre les sauvegardes** (étapes 1 et 2 d'« Avant le premier jour » reportées) : le 2026-11-01, la production n'avait aucune sauvegarde et le PITR était désactivé. Une perte de la base ne se récupérerait qu'en partie, depuis les téléphones. Les choix marqués **« à décider »** reviennent au propriétaire ; ce document propose des valeurs par défaut.

## Objectif

Vérifier, avec de vrais commerçants et de vraies ventes, que Nagaw Business tient ses promesses : vendre vite, même sans réseau, sans erreur de caisse, et que le propriétaire comprend son argent (statistiques, trésorerie, comptabilité), le tout par des personnes peu à l'aise avec le numérique.

## Organisation proposée

| Point        | Proposition                                                                                                                          | À décider  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Durée        | 4 semaines                                                                                                                           | ✔          |
| Boutiques    | 3 à 5, de types différents (épicerie, quincaillerie, téléphonie, cosmétiques), dont **au moins une hors de Dakar, à réseau faible**  | ✔          |
| Offre        | Pro, sans paiement pendant le pilote (changée dans **Administration → Boutiques**) ; à la fin, l'offre est proposée **au prix réel** | ✔          |
| Téléphones   | Celui du commerçant ; au moins un Android d'entrée de gamme parmi les boutiques                                                      |            |
| Assistance   | Le +221 76 905 58 52 (celui des pages légales), et « Donner mon avis » dans l'application                                            | ✔ (numéro) |
| Consentement | Accord écrit de chaque boutique : données réelles, observation, prise de notes                                                       | ✔          |

## Avant le premier jour (propriétaire)

1. **Sauvegardes** : passer le projet Supabase au plan Pro et activer la restauration à un instant donné (PITR) ; vérifier que les sauvegardes quotidiennes apparaissent.
2. **Restauration testée** : restaurer une sauvegarde dans un projet Supabase de préproduction, faire pointer une préversion Vercel dessus et vérifier qu'on s'y connecte et qu'on y retrouve les ventes. Noter la durée.
3. **E-mails** : SMTP dédié configuré (_Authentication → SMTP Settings_), puis une inscription réelle depuis une adresse extérieure, jusqu'au mail de confirmation et à celui du mot de passe oublié.
4. **Administrateur** : votre compte ajouté dans `app.platform_admins` (voir `docs/OPERATIONS.md`).
5. **Test de fumée** : `pnpm smoke https://nagaw-web.vercel.app https://nagaw-api-petalia.vercel.app` (lancé aussi par GitHub après chaque déploiement de production).
6. **Parcours complet sur vrais téléphones** : faire une fois, soi-même, les sept étapes des critères d'acceptation ci-dessous sur la production, dont la vente en mode avion, au moins une fois sur un Android d'entrée de gamme.
7. **Paramètres** : enregistrer l'indicatif du pays, ce qui vérifie la migration `phone_country_code`, puis ouvrir un lien WhatsApp vers un vrai numéro.

## Accueil d'une boutique (30 à 45 minutes)

1. Le commerçant crée son compte et sa boutique sur son téléphone (on l'aide à taper, on ne tape pas pour lui).
2. Paramètres : nom, devise, identité pour les factures (NINEA, RCCM si disponibles).
3. Dix produits réels avec photo, prix et stock.
4. Invitation d'un vendeur, s'il y en a un.
5. Une vente en espèces, une en Mobile Money, une à crédit ; puis une vente en mode avion, le message « Vous êtes hors ligne », et l'envoi au retour du réseau.
6. Installation de l'application sur l'écran d'accueil.
7. Lui montrer « Donner mon avis » et le bouton « Envoyer maintenant » du bandeau, qui apparaît quand une vente attend d'être envoyée.
8. Faire signer l'accord de participation (en fin de document).

## Suivi pendant le pilote (chaque jour, 10 minutes)

- **Administration → Tableau de bord** : alertes (refus de synchronisation, limites, téléphones silencieux).
- **Administration → Avis** : répondre à chaque message dans la journée.
- **Administration → Synchronisation** : motifs de refus ; un motif qui revient est un défaut à corriger.
- Une visite ou un appel par boutique et par semaine.
- **Noter chaque demande de fonction** avec la boutique : elle classera le lot 3 du plan d'amélioration.

## Test utilisateur (une séance par boutique, semaine 2)

**Consignes** : la personne utilise son téléphone et dit à voix haute ce qu'elle pense ; l'observateur **n'aide pas** (sauf blocage de plus de 2 minutes, noté « avec aide »), ne commente pas, note.

| #   | Tâche                                                                     | Réussie seule | Avec aide | Échec | Durée | Remarques et citations |
| --- | ------------------------------------------------------------------------- | ------------- | --------- | ----- | ----- | ---------------------- |
| 1   | Ajouter un produit avec sa photo et son stock                             |               |           |       |       |                        |
| 2   | Vendre 3 articles en espèces et rendre la monnaie                         |               |           |       |       |                        |
| 3   | Vendre à crédit à un client, puis enregistrer son remboursement           |               |           |       |       |                        |
| 4   | Vendre sans réseau (mode avion), puis vérifier l'envoi                    |               |           |       |       |                        |
| 5   | Faire un devis, le transformer en facture et l'envoyer en PDF             |               |           |       |       |                        |
| 6   | Dire combien la boutique a gagné ce mois et ce qu'il y a en caisse        |               |           |       |       |                        |
| 7   | Clôturer la caisse du jour                                                |               |           |       |       |                        |
| 8   | (Comptable ou propriétaire) Exporter le journal des recettes et dépenses  |               |           |       |       |                        |
| 9   | Ouvrir la caisse sans réseau, dire ce que signifie le message affiché     |               |           |       |       |                        |
| 10  | Une vente ne part pas : la faire partir soi-même (« Envoyer maintenant ») |               |           |       |       |                        |
| 11  | Vendre à deux sur le même téléphone, puis dire qui a vendu quoi           |               |           |       |       |                        |

**Questions de fin** (réponse de 1 à 5) : c'était facile ; je me suis senti en confiance ; je saurais le refaire seul ; les mots étaient clairs ; je le recommanderais à un autre commerçant. Puis : qu'est-ce qui vous a gêné ? qu'est-ce qui manque ?

## Critères de réussite du pilote (proposition)

- 80 % des tâches réussies **seul** ;
- aucune vente perdue ni comptée deux fois ;
- moins de 5 % d'opérations hors ligne refusées, chaque refus expliqué ;
- la caisse clôturée au moins 4 jours sur 7, avec des écarts expliqués ;
- au moins 3 boutiques sur 5 qui veulent continuer après le pilote ;
- **au moins une boutique paie réellement une offre** à la fin du pilote : c'est le critère dur. Le règlement passe par Wave ou Orange Money, à la main, puis l'offre est changée dans **Administration → Boutiques** ;
- noter pour chaque boutique qui refuse de payer **pourquoi**, et à quel prix elle aurait accepté.

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

## Accord de participation

À lire avec le commerçant, à signer en deux exemplaires. Texte à faire relire par un juriste avant usage.

> **Pilote de Nagaw Business**
>
> Boutique : ........................ Responsable : ........................ Téléphone : ........................
>
> BNS Digital propose à la boutique d'utiliser Nagaw Business pendant ...... semaines, du ........ au ........, sans payer.
>
> - Les ventes et les clients saisis sont de **vraies données** de la boutique. Elles sont gardées sur des serveurs en France et sur les téléphones de la boutique, comme l'explique la politique de confidentialité.
> - L'application est en essai : elle peut avoir des défauts. **La boutique garde son cahier ou sa façon de faire pendant le pilote.**
> - L'équipe peut observer l'utilisation, prendre des notes et appeler chaque semaine, sans publier le nom de la boutique ni ses chiffres sans son accord.
> - La boutique peut arrêter à tout moment et demander la suppression de ses données au +221 76 905 58 52.
> - À la fin, l'offre payante sera proposée. La boutique est libre de refuser.
>
> Date : ................ Pour la boutique : ................ Pour BNS Digital : ................
