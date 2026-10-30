import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'fonds-de-roulement-boutique',
  title: 'Fonds de roulement : l’argent qu’il faut pour faire tourner',
  seoTitle: 'Fonds de roulement d’une boutique : calcul simple',
  description:
    'Le fonds de roulement est l’argent nécessaire pour acheter, attendre et payer les charges. Comment l’estimer et ne plus manquer de liquidités.',
  category: 'argent',
  keywords: [
    'fonds de roulement',
    'fonds de roulement boutique',
    'calcul fonds de roulement',
    'manque de trésorerie commerce',
    'capital pour ouvrir une boutique',
    'besoin en fonds de roulement',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Le fonds de roulement est l’argent nécessaire pour faire tourner l’activité entre le moment où vous payez et celui où vous êtes payé.',
    'Il grossit quand le stock dort, quand les clients paient tard et quand les fournisseurs exigent d’être payés tout de suite.',
    'Une estimation simple : un mois de charges fixes, plus le stock de base, plus le crédit client.',
    'Une boutique rentable peut quand même manquer d’argent : bénéfice et liquidités sont deux choses différentes.',
  ],
  body: `
Le **fonds de roulement** est l’argent dont une boutique a besoin pour fonctionner entre le moment où elle paie ses marchandises et celui où elle encaisse ses ventes. C’est lui qui permet d’acheter le stock, de payer le loyer avant la fin du mois et d’absorber une semaine creuse. Beaucoup de commerces ferment non parce qu’ils ne sont pas rentables, mais parce qu’ils manquent d’argent à un moment précis.

## Bénéfice et argent disponible : deux choses différentes

Une boutique peut gagner de l’argent sur le papier et n’avoir rien en caisse. Prenons un exemple : vous vendez 100 000 F de marchandises à crédit, avec 30 000 F de bénéfice. Vous êtes rentable, mais le client n’a pas payé, et le fournisseur attend son argent.

Votre bénéfice est dans les comptes, pas dans le tiroir-caisse. La [trésorerie](/blog/tresorerie-petit-commerce) suit cet argent réel, jour après jour.

## Ce qui consomme votre fonds de roulement

| Ce qui bloque l’argent | Exemple |
| --- | --- |
| Le stock | Des cartons achetés il y a trois mois, encore en rayon |
| Le crédit client | Des ventes faites, pas encore payées |
| Les avances aux fournisseurs | Une commande payée, pas encore arrivée |
| Les charges payées d’avance | Loyer à l’avance, licence, forfait |

À l’inverse, un fournisseur qui vous accorde trente jours **vous prête de l’argent gratuitement** : c’est du fonds de roulement en plus.

## Estimer le montant nécessaire

Pour une petite boutique, une estimation simple donne déjà une bonne idée.

| Élément d’exemple | Montant |
| --- | --- |
| Stock de base | 1 500 000 F |
| Crédit client moyen | 300 000 F |
| Un mois de charges fixes | 400 000 F |
| Crédit accordé par les fournisseurs | -500 000 F |
| **Fonds de roulement à prévoir** | **1 700 000 F** |

Ces chiffres sont un exemple. Si vous ouvrez une boutique, ajoutez ce montant à votre budget : l’erreur classique est de tout dépenser dans le local et l’aménagement. Voir [ouvrir une boutique au Sénégal](/blog/ouvrir-boutique-senegal).

## Comment libérer de l’argent

1. **Écoulez le stock qui dort** : un lot à prix réduit vaut mieux qu’un carton oublié. Voir [réapprovisionner sans surstocker](/blog/reapprovisionnement-stock-dormant).
2. **Encaissez plus vite** : plafonnez le [crédit client](/blog/credit-clients-boutique) et [relancez les factures impayées](/blog/relancer-facture-impayee).
3. **Négociez avec vos fournisseurs** : quelques jours de délai changent tout.
4. **Commandez moins, plus souvent**, si le transport le permet.
5. **Ne sortez pas l’argent de la boutique** sans le noter. Voir [séparer son argent personnel](/blog/separer-argent-perso-boutique).

## Préparer les mois difficiles

L’activité n’est jamais régulière. Il y a les fêtes, la rentrée scolaire, la saison des pluies, et les semaines creuses qui suivent. Mettez de côté une réserve quand les ventes sont bonnes : l’objectif peut être un mois de charges fixes, sur un compte séparé. Ne comptez pas sur un prêt de dernière minute, souvent cher et lent.

## Les signaux d’alerte

- Vous payez les fournisseurs avec l’argent des ventes du jour même.
- Vous ne pouvez plus profiter d’une bonne occasion d’achat.
- Vous repoussez le loyer ou les salaires.
- Le stock augmente alors que les ventes stagnent.

## Dans Nagaw Business

La Trésorerie montre l’argent disponible en caisse, sur Mobile Money et en banque, et l’Accueil indique ce qu’on vous doit. La carte Stock donne la valeur de vos marchandises au prix d’achat, et « Ne se vendent pas » montre l’argent qui dort. Vous voyez donc d’un coup d’œil où est passé votre fonds de roulement. Le calcul complet reste à faire à partir de ces chiffres.
`,
  faq: [
    {
      question: 'Qu’est-ce que le fonds de roulement d’une boutique ?',
      answer:
        'C’est l’argent nécessaire pour faire tourner l’activité : payer le stock et les charges en attendant d’encaisser les ventes.',
    },
    {
      question: 'Comment calculer son fonds de roulement ?',
      answer:
        'Additionnez le stock de base, le crédit client moyen et un mois de charges fixes, puis retirez le crédit accordé par vos fournisseurs.',
    },
    {
      question: 'Pourquoi une boutique rentable manque-t-elle d’argent ?',
      answer:
        'Parce que le bénéfice peut être bloqué dans le stock et le crédit client. Il existe sur le papier, mais n’est pas disponible.',
    },
    {
      question: 'Comment augmenter son fonds de roulement ?',
      answer:
        'Écoulez le stock qui dort, encaissez plus vite, négociez des délais avec vos fournisseurs et limitez les retraits personnels.',
    },
  ],
  related: [
    'tresorerie-petit-commerce',
    'seuil-de-rentabilite',
    'reapprovisionnement-stock-dormant',
    'separer-argent-perso-boutique',
  ],
};
