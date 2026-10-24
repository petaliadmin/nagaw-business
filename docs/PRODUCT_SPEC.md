# Spécification produit — Nagaw Business

> « Gérer sa boutique aussi simplement qu'on compte sa caisse, même sans connexion. »

> **Repositionnement du 2026-10-24 (ADR-019, proposé)** : Nagaw Business devient une application SaaS de **gestion de boutique**. La vision précédente (délégation de responsabilités à une équipe, ADR-017 et ADR-018) est remplacée. Le socle déjà livré (comptes, organisations, équipe, rôles, journal d'audit) est conservé.

## Vision

Nagaw Business est une application SaaS multi-boutiques, **mobile first**, utilisable sur ordinateur, qui **fonctionne hors connexion**. Elle permet à un commerçant de tenir son stock, d'enregistrer ses ventes, de suivre son chiffre d'affaires et sa trésorerie, de produire ses factures et devis, et de tenir une comptabilité simple, depuis son téléphone.

Elle est pensée pour des personnes **peu à l'aise avec les outils numériques** : interface jolie et colorée, vocabulaire du quotidien, gros boutons, une action principale par écran, et aucune notion comptable imposée pour vendre (voir [`DESIGN.md`](./DESIGN.md)).

Marché : Afrique de l'Ouest francophone (Q4). Devise par défaut : franc CFA (`XOF`, sans décimales). Référentiel comptable : SYSCOHADA révisé.

L'application reste **manuelle** au sens d'ADR-017 : pas d'IA, pas d'agent, pas de tâche planifiée. Les calculs déterministes déclenchés par une saisie (décrément du stock à la vente, écriture comptable d'une facture) font partie de l'opération saisie et ne sont pas de l'automatisation.

## Personas

| Persona                         | Profil                                                                                                                                                                                           | Besoin principal                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **Aïssatou, propriétaire**      | Tient une boutique (alimentation, cosmétiques, quincaillerie, prêt-à-porter). Smartphone Android d'entrée de gamme, lit le français mais n'aime pas les écrans chargés. Connexion intermittente. | Savoir ce qu'elle a vendu, ce qu'il lui reste en stock, et combien elle a gagné. |
| **Moussa, vendeur**             | Employé au comptoir, peu de formation. Partage parfois le téléphone de la boutique.                                                                                                              | Encaisser vite, sans se tromper, même sans réseau.                               |
| **Fatou, gérante multi-points** | Deux ou trois boutiques, utilise aussi un ordinateur.                                                                                                                                            | Comparer ses boutiques, faire ses factures et devis professionnels.              |
| **Comptable externe**           | Consulte, exporte, ne vend pas.                                                                                                                                                                  | Récupérer journaux et états au format SYSCOHADA.                                 |

## Concepts

| Concept            | Définition                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Boutique           | Organisation cliente (tenant, table `organizations`). Toutes les données lui appartiennent et en sont isolées. Un compte peut gérer plusieurs boutiques.              |
| Membre             | Utilisateur d'une boutique avec un rôle : propriétaire, administrateur (gérant), vendeur (`member`), lecteur (`viewer`, par exemple le comptable).                    |
| Produit            | Article vendu : nom, photo, catégorie, unité (pièce, kg, litre, carton…), prix de vente, prix d'achat, taux de taxe, code-barres facultatif, seuil d'alerte de stock. |
| Mouvement de stock | Entrée ou sortie datée et non modifiable : achat, vente, retour, perte, inventaire. Le stock d'un produit est la somme de ses mouvements.                             |
| Vente              | Encaissement au comptoir : lignes de produits, remise éventuelle, un ou plusieurs paiements, ticket de caisse. Peut être saisie hors ligne.                           |
| Paiement           | Moyen d'encaissement : espèces, Mobile Money (Wave, Orange Money, Free Money… saisi à la main, sans intégration), carte, ou **crédit client** (vente à crédit).       |
| Client             | Personne ou entreprise, facultative pour une vente, obligatoire pour une facture, un devis ou une vente à crédit. Solde dû suivi.                                     |
| Fournisseur        | Origine des achats de marchandises.                                                                                                                                   |
| Devis              | Proposition chiffrée à un client, avec une validité. Accepté, il se transforme en facture sans ressaisie.                                                             |
| Facture            | Document numéroté sans trou ni doublon, non modifiable une fois émise (correction par avoir). Peut être payée en plusieurs fois.                                      |
| Dépense            | Sortie d'argent hors marchandises : loyer, électricité, salaires, transport.                                                                                          |
| Caisse             | Lieu d'argent : caisse espèces, compte Mobile Money, compte bancaire. La trésorerie est la somme des caisses.                                                         |
| Écriture comptable | Traduction d'une opération (vente, facture, achat, dépense) dans les comptes SYSCOHADA. Générée par l'opération, jamais saisie par un vendeur.                        |
| Appareil           | Téléphone ou ordinateur enregistré pour travailler hors ligne. Chaque appareil a son préfixe de numérotation des tickets.                                             |

## Modules

### 1. Produits et stock

- catalogue avec photo, catégorie, recherche par nom ou code-barres (lecture par la caméra en option) ;
- stock en temps réel, alerte « bientôt épuisé » selon un seuil **configurable par produit** ;
- entrées de marchandises (achat fournisseur, avec prix d'achat), sorties manuelles (perte, casse, usage), inventaire avec écarts ;
- historique des mouvements par produit ;
- valeur du stock au prix d'achat.

### 2. Ventes

- écran de vente façon caisse : grosses tuiles produits, panier, quantités au pavé numérique, total en grand ;
- paiements multiples sur une même vente (espèces avec calcul du rendu de monnaie, Mobile Money, carte, crédit) ;
- ticket de caisse imprimé sur imprimante thermique Bluetooth, même hors ligne (ADR-022), ou partagé en image ou PDF (WhatsApp) ;
- vente à crédit et remboursements du client ;
- retour et annulation d'une vente (droits réservés au gérant, motif obligatoire, audité) ;
- **fonctionne hors ligne** : la vente est enregistrée sur l'appareil puis synchronisée (ADR-020).

### 3. Statistiques et trésorerie

- tableau de bord du jour : ventes, nombre de tickets, argent encaissé par moyen de paiement ;
- chiffre d'affaires, marge brute et panier moyen par jour, semaine, mois ;
- produits les plus vendus, produits qui ne tournent pas, ruptures ;
- trésorerie : solde de chaque caisse, entrées et sorties, clôture de caisse journalière avec comptage ;
- créances clients (qui me doit combien) ;
- comparaison entre boutiques pour un propriétaire multi-boutiques.

### 4. Comptabilité

- premier niveau, **au MVP** : **système minimal de trésorerie (SMT) du SYSCOHADA révisé**, adapté aux très petites entités — journal des recettes et dépenses, état de fin d'exercice ;
- second niveau (après le MVP) : partie double SYSCOHADA (journaux, grand livre, balance, compte de résultat simplifié) ;
- dépenses saisies avec catégorie et justificatif photographié ;
- export pour le comptable (CSV, puis PDF) ;
- taux de taxe (TVA) configurables en base par boutique, jamais codés en dur.

### 5. Factures et devis

- création depuis une vente, un devis ou de zéro ;
- numérotation légale séquentielle par boutique et par année, attribuée par le serveur ;
- PDF aux couleurs de la boutique (logo, coordonnées, NINEA / RCCM), partage WhatsApp et e-mail (envoi automatique soumis au choix d'un fournisseur, ADR-015) ;
- devis → facture en un geste ; suivi : brouillon, émis, payé partiellement, payé, annulé par avoir ;
- relance manuelle des factures impayées.

## Principes d'expérience

1. **Mobile first** : chaque écran est conçu d'abord pour un téléphone de 360 px de large, puis élargi pour l'ordinateur.
2. **Hors ligne d'abord pour vendre** : le vendeur ne doit jamais être bloqué par le réseau. L'état de synchronisation est toujours visible et compréhensible (« 3 ventes en attente d'envoi »).
3. **Simple** : vocabulaire du quotidien (« Ce qui reste » plutôt que « Stock disponible »), icônes accompagnées d'un libellé, montants en grand, une action principale par écran.
4. **Joli et coloré** : une couleur par module pour se repérer, illustrations et retours visuels positifs, sans sacrifier les contrastes (WCAG 2.2 AA).
5. **Sans peur de se tromper** : confirmation avant toute action irréversible, annulation immédiate quand c'est possible, messages d'erreur qui disent quoi faire.

Les règles détaillées sont dans [`DESIGN.md`](./DESIGN.md).

## Fonctionnalités disponibles

Socle livré : comptes (inscription, connexion, réinitialisation), organisations (futures boutiques), équipe (invitations par lien, rôles, désactivation), journal d'audit, paramètres. Les modules Responsabilités et Tâches (Phases 6 et 7) sont encore dans le code ; leur retrait est décidé et sera fait en Phase 8 (ADR-019). Aucun module boutique n'est encore développé.

## Périmètre MVP

Voir [`ROADMAP.md`](./ROADMAP.md) § Critères d'acceptation du MVP.
