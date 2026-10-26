import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'mentions-obligatoires-facture-senegal',
  title: 'Mentions d’une facture au Sénégal : la liste à vérifier',
  seoTitle: 'Mentions obligatoires d’une facture au Sénégal : la liste',
  description:
    'NINEA, RCCM, numéro, date, TVA, total TTC : les mentions à faire figurer sur une facture au Sénégal et dans l’espace OHADA, avec un modèle et les erreurs à éviter.',
  category: 'factures',
  keywords: [
    'mentions obligatoires facture Sénégal',
    'modèle de facture Sénégal',
    'facture NINEA RCCM',
    'faire une facture',
    'numérotation des factures',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Une facture identifie le vendeur (nom, adresse, NINEA, RCCM) et le client, porte un numéro unique et une date.',
    'Elle détaille chaque ligne : désignation, quantité, prix unitaire, taux et montant de TVA, puis les totaux HT et TTC.',
    'Les numéros se suivent sans trou, et une facture émise ne se modifie pas : on l’annule par un avoir.',
    'Les règles fiscales évoluent : faites valider votre modèle par votre comptable ou l’administration fiscale.',
  ],
  body: `
Une **facture** est la preuve d’une vente entre une boutique et un client, en particulier une entreprise ou une administration. Au Sénégal comme dans le reste de l’espace OHADA, elle sert à la comptabilité du vendeur et de l’acheteur, et au calcul de la TVA. Une facture incomplète peut être refusée par le client ou poser problème en cas de contrôle.

> Cet article donne les mentions généralement attendues. Les règles fiscales évoluent et peuvent dépendre de votre régime d’imposition : faites valider votre modèle de facture par votre comptable ou par la Direction générale des impôts et des domaines (DGID).

## Les mentions à faire figurer

### Sur le vendeur (votre boutique)

- le nom de la boutique ou la raison sociale ;
- l’adresse et le téléphone ;
- le **NINEA** (numéro d’identification national des entreprises et des associations) ;
- le numéro **RCCM** (registre du commerce et du crédit mobilier) ;
- le régime fiscal, si votre comptable le recommande.

### Sur le client

- le nom ou la raison sociale ;
- l’adresse ;
- son **NINEA** s’il s’agit d’une entreprise : il en a besoin pour sa propre comptabilité.

### Sur la facture elle-même

- le mot « Facture » ;
- un **numéro unique**, qui suit le précédent sans trou ;
- la **date** d’émission ;
- la date de la vente ou de la livraison si elle est différente ;
- les conditions de paiement (comptant, à 30 jours…).

### Pour chaque ligne

- la désignation précise du produit ou du service ;
- la quantité et l’unité ;
- le prix unitaire hors taxes ;
- le taux de TVA applicable ;
- la remise éventuelle.

### Les totaux

- le total **hors taxes (HT)** ;
- le montant de **TVA**, par taux s’il y en a plusieurs ;
- le total **toutes taxes comprises (TTC)** ;
- les paiements déjà reçus et le **reste à payer**.

## Modèle de structure

| Zone | Contenu |
| --- | --- |
| En-tête | Boutique, adresse, téléphone, NINEA, RCCM |
| Client | Nom, adresse, NINEA |
| Références | Facture n° F-2026-0001, date, conditions de paiement |
| Lignes | Désignation, quantité, prix unitaire HT, TVA, total |
| Totaux | Total HT, TVA 18 %, total TTC |
| Paiement | Montant payé, reste à payer, moyens de paiement acceptés |

## Pourquoi la numérotation est si importante

Les numéros de facture doivent se suivre **sans trou ni doublon**, généralement par année : F-2026-0001, F-2026-0002, etc. Un trou dans la suite fait penser qu’une facture a été supprimée pour cacher une vente. C’est pour cela qu’une facture **émise ne se modifie plus** et ne se supprime pas : si elle est fausse, on émet un **avoir** qui l’annule, puis une nouvelle facture. Votre comptable s’appuie sur cette suite de numéros pour tenir le journal : voir [le SYSCOHADA expliqué aux commerçants](/blog/syscohada-commercant).

## Facture, ticket, devis, avoir : quelle différence ?

| Document | À quoi il sert |
| --- | --- |
| Ticket de caisse | Preuve d’achat pour un client particulier, au comptoir |
| Devis | Proposition de prix avant la vente, sans engagement de paiement |
| Facture | Demande de paiement et preuve de la vente, avec toutes les mentions |
| Avoir | Annulation totale ou partielle d’une facture émise |

Pour bien préparer une proposition de prix, voir [comment faire un devis](/blog/faire-un-devis).

## Les erreurs fréquentes

1. **Pas de NINEA** du vendeur, ou celui du client oublié pour une entreprise.
2. **TVA mal calculée**, souvent en confondant prix HT et TTC : voir [le calcul de la TVA à 18 %](/blog/calcul-tva-18-ht-ttc).
3. **Numéros en désordre** ou réutilisés.
4. **Facture modifiée** après envoi au lieu d’un avoir.
5. **Désignation vague** (« marchandises divers ») qui empêche le client de la comptabiliser.

## Les factures dans Nagaw Business

Dans Nagaw Business, les factures, devis et avoirs sont **numérotés par le serveur** (F-, D- et A- suivis de l’année et d’un numéro), sans trou. Une facture reste un brouillon modifiable jusqu’à « Émettre la facture » ; ensuite, elle ne peut plus être réécrite et s’annule par un avoir. Le PDF reprend l’identité de la boutique (dont le NINEA et le RCCM saisis dans Paramètres), le client et son NINEA, le total HT, la TVA par taux, le TTC, les paiements et le reste à payer. Il part sur WhatsApp ou par e-mail depuis le téléphone.
`,
  faq: [
    {
      question:
        'Quelles sont les mentions obligatoires d’une facture au Sénégal ?',
      answer:
        'Généralement : identité du vendeur (nom, adresse, NINEA, RCCM) et du client, numéro unique, date, désignation, quantité, prix unitaire HT, taux et montant de TVA, totaux HT et TTC. Faites valider votre modèle par votre comptable ou la DGID.',
    },
    {
      question: 'Peut-on modifier une facture déjà envoyée ?',
      answer:
        'Non. Une facture émise ne se modifie pas et ne se supprime pas : on émet un avoir qui l’annule, puis une nouvelle facture corrigée.',
    },
    {
      question: 'Comment numéroter ses factures ?',
      answer:
        'Avec une suite continue, sans trou ni doublon, souvent par année : F-2026-0001, F-2026-0002, etc.',
    },
  ],
  related: ['faire-un-devis', 'calcul-tva-18-ht-ttc', 'syscohada-commercant'],
};
