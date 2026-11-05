# Journal des versions

Le numéro suit [SemVer](https://semver.org/lang/fr/) (ADR-061). Une version est close par une PR fusionnée dans `main`, puis l'étiquette `vX.Y.Z` posée par le propriétaire sur le commit de fusion.

## 1.0.0 — 2026-11-04

Première version complète de l'application de gestion de boutique (ADR-019). Elle couvre les phases 8 à 18 de `docs/ROADMAP.md`, les lots du plan d'amélioration fusionnés jusqu'au 2026-11-03 et les ADR jusqu'à ADR-060.

### Contenu

- **Compte et boutique** : connexion par numéro de téléphone et code secret (ADR-058), seul le code demandé sur un téléphone déjà connecté (ADR-059) ; boutiques, équipe, invitations par lien (ADR-015), rôles, logo de la boutique.
- **Produits et stock** : catégories, unités, photos, services (ADR-045), taxes configurables, mouvements de stock en ajout seul, entrées fournisseur, pertes, inventaire, alertes de stock bas.
- **Ventes** : caisse, paiements multiples (espèces avec rendu, Mobile Money avec logos Wave, Orange Money et Mixx, carte, crédit), clients et créances, relance sur WhatsApp, retours et annulations, ticket partagé.
- **Hors ligne** : l'appareil est la référence (ADR-053), opérations idempotentes (`client_operation_id`), synchronisation `POST /api/v1/sync`, preuve de réception, opérations refusées affichées et renvoyables.
- **Factures et devis** : numérotation par le serveur, conversion devis → facture, PDF aux couleurs de la boutique, paiements partiels, avoirs, partage WhatsApp, boutons flottants.
- **Clients et fournisseurs** : import et export des contacts du téléphone, menu « ⋮ », suppression par archivage (ADR-060).
- **Statistiques et trésorerie** : tableau de bord refondu, chiffre d'affaires, marge, dépenses, caisses, clôture de caisse, comparaison entre boutiques.
- **Comptabilité** : journal des recettes et dépenses SYSCOHADA, état de fin d'exercice, export CSV.
- **Offres** : Gratuit (10 produits), Essentiel (50), Pro (sans limite) ; demande d'offre payée par Wave avec référence, validée à la main (ADR-056).
- **Administration et observabilité** : administration plateforme, accès à une boutique, métriques de synchronisation, alertes, notifications.
- **Application** : PWA installable, mobile d'abord (360 px), design system de `docs/DESIGN.md`, interface en français, site public avec blog et pages légales.

### Hors de la version 1.0

- Impression du ticket en Bluetooth (ADR-022) : en attente d'une imprimante réelle.
- Paiement en ligne des offres, renouvellement et rappel mensuel.
- Comptabilité en partie double.
- Publication sur les magasins d'applications, interface en wolof.
- IA (ADR-007).

### Réserves connues

Voir la section « Version 1.0 » de `IMPLEMENTATION_STATUS.md` : migrations à appliquer en production, réglages Supabase et Vercel, sauvegardes, essais sur de vrais téléphones et contre le vrai Supabase, droit d'usage des logos Mobile Money, pilote à mener.
