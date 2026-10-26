import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'syscohada-commercant',
  title: 'Le SYSCOHADA expliqué aux commerçants : ce que vous devez tenir',
  seoTitle: 'SYSCOHADA pour commerçants : système minimal de trésorerie',
  description:
    'SYSCOHADA révisé, système minimal de trésorerie, journal des recettes et dépenses, plan de comptes : ce qu’un commerçant doit tenir, expliqué simplement.',
  category: 'factures',
  keywords: [
    'SYSCOHADA',
    'SYSCOHADA révisé',
    'système minimal de trésorerie',
    'comptabilité commerçant',
    'plan comptable SYSCOHADA',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Le SYSCOHADA est le système comptable commun aux pays de l’OHADA ; sa version révisée s’applique depuis 2018.',
    'Les très petites entités peuvent tenir un système minimal de trésorerie (SMT) : un journal des recettes et des dépenses et un état de fin d’exercice.',
    'Chaque recette et chaque dépense est datée, classée dans un compte et appuyée par une pièce (ticket, facture, reçu).',
    'Votre comptable reste le bon interlocuteur pour votre régime exact ; votre rôle est de lui donner des données complètes.',
  ],
  body: `
Le **SYSCOHADA** (système comptable de l’OHADA) est le cadre comptable commun aux pays membres de l’Organisation pour l’harmonisation en Afrique du droit des affaires, dont le Sénégal, la Côte d’Ivoire, le Mali, le Burkina Faso, le Cameroun ou le Bénin. Sa version **révisée** est entrée en vigueur en 2018. Pour un commerçant, la bonne nouvelle est que les plus petites entreprises peuvent tenir une comptabilité très simplifiée.

> Cet article vulgarise les grands principes. Les seuils et obligations exacts dépendent de votre activité, de votre pays et de votre forme juridique : votre comptable ou un centre de gestion agréé reste le bon interlocuteur.

## Le système minimal de trésorerie (SMT)

L’Acte uniforme relatif au droit comptable prévoit, pour les **très petites entités**, un **système minimal de trésorerie** (SMT). Il s’adresse aux entreprises dont les recettes annuelles restent sous des seuils fixés par l’Acte uniforme, qui dépendent de l’activité (négoce, artisanat, services). Pour une boutique, c’est le seuil des activités de **négoce** qui compte ; demandez à votre comptable s’il s’applique à vous.

Le SMT repose sur une idée simple : on enregistre **l’argent qui entre et l’argent qui sort**, au moment où il bouge.

## Ce que vous devez tenir

### 1. Un journal des recettes et des dépenses

Chaque ligne contient :

| Colonne | Exemple |
| --- | --- |
| Date | 12/03/2026 |
| Pièce | Ticket B-000045, facture F-2026-0007, reçu DEP-2026-0012 |
| Libellé | Vente au comptoir, achat de marchandises, électricité |
| Compte | 70, 601, 605… |
| Caisse | Caisse, Wave, banque |
| Recette ou dépense | Montant |

### 2. Un état de fin d’exercice

À la fin de l’année (l’exercice correspond à l’année civile), on résume :

- les recettes et les dépenses par compte ;
- le **résultat** (recettes − dépenses) ;
- la trésorerie au début et à la fin de l’année ;
- ce que les clients vous doivent ;
- la valeur du stock.

### 3. Les pièces justificatives

Chaque mouvement doit pouvoir être prouvé : ticket de caisse, facture, reçu du fournisseur, relevé Mobile Money. Gardez-les classées par date ; une photo nette est un bon début.

## Les comptes utiles pour une boutique

Le plan SYSCOHADA compte des centaines de comptes, mais une boutique en utilise une poignée :

| Compte | Intitulé | Exemple |
| --- | --- | --- |
| 70 | Ventes | Ventes au comptoir, paiements de factures |
| 601 | Achats de marchandises | Commande au fournisseur |
| 605 | Autres achats (eau, électricité…) | Facture d’électricité |
| 61 | Transports | Transport de marchandises |
| 622 | Locations | Loyer de la boutique |
| 64 | Impôts et taxes | Patente, taxes municipales |
| 66 | Charges de personnel | Salaire du vendeur |
| 571 | Caisse | Espèces |
| 55 | Instruments de monnaie électronique | Wave, Orange Money |
| 521 | Banques | Compte bancaire |

## Les erreurs qui compliquent le travail du comptable

1. **Mélanger l’argent personnel et celui de la boutique.**
2. **Oublier des dépenses** payées en espèces, sans reçu.
3. **Ne pas distinguer** un retrait Wave (déplacement d’argent) d’une dépense. Voir [suivre Wave et Orange Money](/blog/suivre-wave-orange-money).
4. **Rendre un carton de reçus** en fin d’année au lieu d’un journal tenu au fil de l’eau.
5. **Ne pas compter le stock** au 31 décembre : voir [faire un inventaire](/blog/faire-un-inventaire).

## Ce qu’un logiciel peut faire pour vous

Un bon logiciel de boutique ne remplace pas votre comptable, mais il lui donne un journal **déjà rempli et classé**, tiré de vos ventes et de vos dépenses, sans ressaisie. Vous gagnez des heures de tri ; il gagne du temps (et vous coûte moins cher).

## La comptabilité dans Nagaw Business

Le module **Comptabilité** de Nagaw Business suit le système minimal de trésorerie du SYSCOHADA révisé. Le **journal** se remplit tout seul à partir des ventes, des paiements de factures et des dépenses, chaque ligne avec sa pièce (numéro de ticket, de facture ou de dépense DEP-) et son compte (70 pour les ventes, le compte de la catégorie pour une dépense, 571, 55 ou 521 pour la caisse). L’**état de fin d’exercice** donne le résultat, la trésorerie, les créances et le stock au prix d’achat. Le comptable peut être invité avec un accès en lecture et exporter le journal et l’état en tableur (CSV). Il s’agit d’une comptabilité de trésorerie : pas de partie double, de dettes fournisseurs ni d’immobilisations.

Pour bien noter vos dépenses, voir aussi [la trésorerie d’un petit commerce](/blog/tresorerie-petit-commerce).
`,
  faq: [
    {
      question: 'Qu’est-ce que le SYSCOHADA ?',
      answer:
        'C’est le système comptable commun aux pays de l’OHADA, en Afrique de l’Ouest et du Centre. Sa version révisée est entrée en vigueur en 2018.',
    },
    {
      question: 'Qu’est-ce que le système minimal de trésorerie ?',
      answer:
        'C’est la comptabilité simplifiée prévue pour les très petites entités : un journal des recettes et des dépenses, tenu au fil de l’eau, et un état de fin d’exercice. Les seuils d’accès dépendent de l’activité.',
    },
    {
      question: 'Un commerçant doit-il tenir une comptabilité ?',
      answer:
        'Oui, toute entreprise doit tenir une comptabilité adaptée à sa taille. Pour une petite boutique, le système minimal de trésorerie suffit souvent ; votre comptable vous confirmera votre régime.',
    },
  ],
  related: [
    'tresorerie-petit-commerce',
    'mentions-obligatoires-facture-senegal',
    'faire-un-inventaire',
  ],
};
