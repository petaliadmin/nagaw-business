# Journal des versions

Le numéro suit [SemVer](https://semver.org/lang/fr/) (ADR-061). Une version est close par une PR fusionnée dans `main`, puis l'étiquette `vX.Y.Z` posée par le propriétaire sur le commit de fusion.

## Non publié — branche `profils-affichage`

- **Une application à la taille de chaque boutique (ADR-067)** : à la création, « Comment travaillez-vous ? » (crédit, stock, factures, équipe) ; le Menu et l'Accueil n'affichent que ce qui sert ; Paramètres › Mon application pour cacher ou rallumer chaque partie, choisir si les nouveaux produits comptent leur stock, ou tout afficher ; « Produits » à la place de « Stock » dans la barre du bas quand rien n'est compté. Rien n'est supprimé, et les boutiques existantes ne voient aucun changement.
- **La barre du bas suit la boutique** : un atelier qui facture a « Factures », une boutique qui vend à crédit sans compter son stock a « Crédit » ; ce qui quitte la barre reste dans le Menu.
- **Création de boutique en trois étapes**, comme la maquette : votre boutique, ce que vous vendez, vos habitudes, puis un aperçu « Voici votre application ».
- **Ventes** : un bouton « Nouvelle vente » en haut de la page ouvre la caisse (pour qui peut vendre).
- **Caisse plus logique** : à l'étape « Encaisser », le panier d'abord, puis le moyen de paiement, puis « Valider la vente », toujours visible en bas de l'écran du téléphone.

## Non publié — branche `refonte-v3`

- **V3 « Teranga » (ADR-063)** : design épuré (page blanche, cartes grises sans ombre, boutons noirs), barre du bas Accueil · Ventes · Caisse · Stock · Argent, Menu en grille, Accueil avec carte sombre des ventes, raccourcis ronds et « Ils vous doivent », bouton « Masquer » les montants, crédit du client en discussion avec rappel WhatsApp modifiable, deux coches sur les ventes enregistrées, écran Argent avec une carte par compte, vue rapide du stock, site public réécrit.
- **Écrans alignés sur les maquettes V3** : dépense au pavé numérique, clôture de tous les comptes en une fois, Paramètres en menu, Équipe avec invitation WhatsApp et rôle en cartes, Factures qui s'ouvrent sur « À encaisser », fiche produit courte, création de boutique en une étape, caisse et paiement redessinés, Menu enrichi, Ventes compactes.
- **Densité native** : texte principal 16 px, secondaire 14 px, cibles de 44 px, titres et grands chiffres resserrés, marges et icônes réduites en proportion (ADR-066).
- **Gros montants** : `9,99 Md F CFA`, `2,42 M F CFA`, `12,5 k F CFA` seulement quand le montant entier ne tient pas, le montant exact restant en infobulle et pour les lecteurs d'écran (ADR-065).
- **Numéro de téléphone avec drapeau** : pays avec drapeau et indicatif, numéro mis en forme et vérifié selon le plan du pays (ADR-064) ; pages de connexion et d'inscription redessinées ; plus de lien « ancien compte avec une adresse e-mail ».
- **Diagrammes à la charte V3** : colonnes vertes arrondies, barres violettes fines, moyens de paiement en barres avec images.
- **Ticket en photo et en PDF** : fichiers préparés à l'avance (partage immédiat, iPhone compris), image plus nette, nom de fichier lisible, envoi possible aussi depuis la fiche d'une vente.
- **Images pour guider** : pavé numérique commun (connexion, dépense), logos et images des comptes, des catégories de dépense et des moyens de paiement.
- **Nouvelle dépense en trois étapes**, boutons du ticket en actions rondes, Accueil allégé avec la période en pastille dans la carte des ventes.

## 2026-11-17 — fusionné (PR #53)

- **Refonte de l'interface (ADR-062)** : teintes adoucies, barre du bas à cinq entrées avec « Vendre » au centre et « Menu » dans l'en-tête, Accueil qui commence par « Vous avez gagné » et « À faire aujourd'hui », caisse en trois étapes annoncées, « Relancer » sur la carte du client qui doit, écran Argent simplifié, page d'accueil publique raccourcie avec de nouvelles captures.

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
