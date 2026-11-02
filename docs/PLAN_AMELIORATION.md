# Plan d'amélioration — marché sénégalais

> Issu de l'audit du 2026-11-01 (produit lu dans le code et la documentation, contexte local recherché en ligne). **Aucune boutique réelle n'a encore utilisé l'application** : ce plan est une suite d'hypothèses à confirmer pendant le pilote. Chaque lot suit la règle du projet : il ne démarre qu'après validation du propriétaire.

## Ce qui est déjà fait

| Point de l'audit               | État                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| Hors-ligne coupé (ADR-042)     | Réactivé : l'appareil est la référence (ADR-053), message à l'ouverture, bouton « Synchroniser » |
| Limites de produits            | Gratuit 10, Essentiel 50, Pro sans limite (ADR-054)                                              |
| Relance du crédit (3.1)        | Livrée : message WhatsApp prêt depuis la fiche client (ADR-056)                                  |
| Paiement de l'abonnement (3.2) | Livré à la main : montant, numéro Wave et référence (ADR-056), sans renouvellement               |
| Site recentré (4.2)            | Fait : « qui me doit » et « ce que je gagne » d'abord, SYSCOHADA en dernier                      |
| Téléphone retiré (5.1)         | Fait : il ne se réenregistre plus, perd prix et clients, et un gérant peut le remettre           |
| Scripts et terrain (4.1, 4.3)  | Prêts dans `docs/KIT_ADOPTION.md`, à enregistrer et à porter sur le terrain                      |
| Promesses du site              | De nouveau exactes pour la vente sans internet, à vérifier sur un vrai téléphone                 |

## Décisions déjà prises

- **Wolof** : en attente. Le lot 4 n'en dépend que pour la traduction de l'interface.
- **Free Money** : le nom reste tel quel (2026-11-01).
- **CDP et hébergement à Paris** : démarche reportée (2026-11-01). La politique de confidentialité dit où sont les données, sans annoncer d'autorisation.
- **Play Store** : pas pour l'instant. L'impression sur petites imprimantes Bluetooth reste donc bloquée (ADR-022).

## Lot 1 — Avant le pilote (corrections courtes)

Objectif : plus rien de faux ni de cassé devant un commerçant.

| #   | Action                                                                                              | Pourquoi                                                          | Taille |
| --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------ |
| 1.1 | Corriger `whatsappLink` et normaliser les numéros (indicatif 221 par défaut, réglable par boutique) | `wa.me/771234567` n'est pas un numéro international               | S      |
| 1.2 | Corriger la FAQ « invitez-les par e-mail » : les invitations passent par un lien                    | Texte faux                                                        | S      |
| 1.4 | Publier les conditions d'utilisation et la politique de confidentialité                             | Aucune page n'existe, et l'application garde téléphones et dettes | M      |

| 1.6 | Vérifier le SMTP dédié, les sauvegardes et la restauration (`docs/PILOT.md`) | Requis avant toute ouverture | S |
| 1.7 | Tester le mode avion sur un vrai Android d'entrée de gamme | Rien n'a été vérifié sur un vrai téléphone | S |

## Lot 2 — Pilote

Objectif : mesurer avant de construire davantage. Durée proposée : 4 semaines, 3 à 5 boutiques.

- ajouter au moins une boutique hors de Dakar, à réseau faible ;
- ajouter un critère dur : **la boutique paie à la fin**, plutôt que « veut continuer » ;
- suivre : ventes perdues (objectif 0), refus de synchronisation, tâches réussies seul, clôtures de caisse ;
- tester le message hors ligne et le bouton « Synchroniser » auprès de commerçants qui lisent peu.

## Lot 3 — Ce qui fait gagner de l'argent au commerçant

Objectif : donner une raison de payer. À affiner avec les résultats du pilote.

| #   | Action                                                                                                            | Pourquoi                                                                 | Taille |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ |
| 3.1 | **Relance du crédit en un toucher** : message WhatsApp prêt depuis la fiche client, sans prestataire              | Meilleure valeur pour le plus faible coût                                | S      |
| 3.2 | **Paiement de l'abonnement** : numéro ou QR Wave et Orange Money avec référence, validation dans l'administration | Aujourd'hui, personne ne peut payer                                      | M      |
| 3.3 | **Code vendeur** sur téléphone partagé                                                                            | Sans lui, une vente peut être attribuée à la mauvaise personne (ADR-053) | M      |
| 3.4 | **Argent pris dans la caisse** par le propriétaire                                                                | Sinon « combien je gagne » reste faux                                    | M      |
| 3.5 | **Dettes fournisseurs** (« Je dois »)                                                                             | Achats à crédit courants chez les grossistes                             | M      |
| 3.6 | **QR de la boutique** à l'étape du paiement, et **frais opérateur** dans la trésorerie                            | Le solde Mobile Money affiché s'écarte du solde réel                     | M      |
| 3.7 | **Retours partiels**                                                                                              | Reportés depuis ADR-024                                                  | M      |
| 3.8 | **Inscription par téléphone et code** (prestataire à choisir)                                                     | Le public vit sur son numéro, pas sur un e-mail                          | L      |

## Lot 4 — Adoption et distribution

| #   | Action                                                                                  | Dépend de                | Taille |
| --- | --------------------------------------------------------------------------------------- | ------------------------ | ------ |
| 4.1 | Vidéos courtes et messages vocaux en wolof sur WhatsApp, sans toucher à l'interface     | —                        | S      |
| 4.2 | Recentrer le site sur « qui me doit » et « combien je gagne », SYSCOHADA en second plan | —                        | S      |
| 4.3 | Terrain : grossistes, associations de commerçants, comptables prescripteurs, ADEPME     | Résultats du pilote      | M      |
| 4.4 | Interface en wolof                                                                      | Décision ADR-012         | L      |
| 4.5 | Publication Play Store, et impression Bluetooth qu'elle permettrait                     | Décision du propriétaire | L      |

## Lot 5 — Robustesse et croissance

| #   | Action                                                                | Pourquoi                                                                  |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 5.2 | Chiffrer ou protéger par code les données gardées sur le téléphone    | Prix d'achat et clients lisibles après déconnexion                        |
| 5.3 | Permettre stock et dépenses hors ligne                                | Seules la vente, le client et la correction de stock marchent sans réseau |
| 5.4 | Saisonnalité dans les prévisions (Tabaski, Korité, Magal, rentrée)    | Le rythme moyen se trompe sur ces périodes                                |
| 5.5 | Transfert de stock entre boutiques                                    | Besoin des gérantes multi-boutiques                                       |
| 5.6 | Résumé du soir sur WhatsApp, API payante                              | Coût à vérifier sur la grille officielle de Meta                          |
| 5.7 | Autres pays de l'UEMOA : opérateurs, indicatifs et fiscalité par pays | Seulement après la preuve au Sénégal                                      |

## À vérifier auprès de sources officielles

Les sources trouvées se contredisent ou sont commerciales : ne rien décider sur ces chiffres sans confirmation.

- facture électronique : aucune obligation générale confirmée, réforme à surveiller auprès de la DGID ;
- seuils CGU, TVA et système minimal de trésorerie : à faire relire par un comptable sénégalais ;
- taxe sur le Mobile Money et frais marchands Wave, Orange Money, agrégateurs ;
- tarifs WhatsApp Business pour le Sénégal.

## Ordre conseillé

Lot 1, puis le pilote (lot 2). Pendant le pilote, seuls 3.1 et 3.2 se justifient sans attendre, car ils sont nécessaires pour vérifier qu'une boutique paie. Le reste du lot 3 se classe ensuite d'après ce que les commerçants auront réellement demandé.
