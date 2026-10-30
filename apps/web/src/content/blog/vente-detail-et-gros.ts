import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'vente-detail-et-gros',
  title: 'Vendre au détail et en gros sans fausser son stock',
  seoTitle: 'Vente au détail et en gros : gérer sac, carton et kilo',
  description:
    'Sac, carton, kilo, mètre : comment vendre un même produit dans plusieurs unités, fixer les prix de gros et garder un stock juste, avec des exemples concrets.',
  category: 'ventes',
  keywords: [
    'vente au détail et en gros',
    'prix de gros et prix de détail',
    'vendre au sac et au kilo',
    'unité de vente stock',
    'demi-gros boutique',
    'grossiste gestion de stock',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Choisissez une seule unité de stock, la plus petite que vous vendez, et comptez tout dedans.',
    'Le sac et le carton deviennent des unités de vente, avec un facteur de conversion.',
    'Le prix de gros doit rester au-dessus du coût, même après la remise.',
    'Sans ces règles, le stock est faux dès la première vente en détail.',
  ],
  body: `
Pour **vendre au détail et en gros** sans erreur, choisissez une seule unité de stock, la plus petite que vous vendez, puis faites du sac ou du carton une unité de vente qui contient une quantité connue. Un sac de 50 kg vendu sort alors 50 kg du stock, et 2 kg vendus au détail en sortent 2. Ce sont les commerces qui mélangent les deux sans règle, quincailleries, boutiques de quartier, grossistes, qui ont les stocks les plus faux.

## Le problème des deux façons de compter

Prenons un sac de riz. Le matin, il reste 10 sacs. Vous vendez 7 kg au détail. Combien reste-t-il ? Neuf sacs et 43 kg, ou 9,86 sacs. Un cahier qui compte en sacs ne peut pas répondre. Il faut une seule unité de référence.

## Choisir son unité de stock

La règle est simple : **comptez dans la plus petite unité que vous vendez.**

| Produit | Unité de stock | Unités de vente |
| --- | --- | --- |
| Riz | kg | kg, sac de 50 kg |
| Boisson | bouteille | bouteille, casier de 12 |
| Boîte de lait | pièce | pièce, carton de 24 |
| Fer à béton | barre | barre, paquet de 10 |
| Tissu | mètre | mètre, pièce de 6 mètres |

Une fois choisie, ne la changez plus. Le stock s’affichera en kilos, et il est simple d’en déduire les sacs. Pour les inventaires, voir [comment faire un inventaire](/blog/faire-un-inventaire).

## Fixer le prix de gros

Le prix de gros doit tenir compte de votre coût réel. Exemple pour un sac de 50 kg :

| Élément d’exemple | Montant |
| --- | --- |
| Coût du sac, transport compris | 27 500 F |
| Prix au détail : 650 F le kg × 50 | 32 500 F |
| Prix de gros proposé | 30 000 F |
| Gain sur le sac en gros | 2 500 F |
| Gain sur le sac au détail | 5 000 F |

Le gros rapporte moins par kilo, mais il libère votre argent plus vite et réduit les pertes. Il devient intéressant quand le client revient régulièrement. Fixez un prix par quantité plutôt qu’à la tête du client. La méthode est dans [comment fixer son prix de vente](/blog/fixer-prix-de-vente).

## Gérer les prix négociés

Dans le commerce de gros, le prix se discute. Le danger est qu’un vendeur vende sous le coût pour faire plaisir. Fixez une limite de réduction par vendeur, et laissez les cas au-delà à un responsable. Voir [gérer ses vendeurs](/blog/gerer-vendeurs-boutique).

## Les erreurs à éviter

- **Saisir une vente de sac comme « 1 »** sur un produit compté en kilos.
- **Ouvrir un sac sans le noter** quand on compte en sacs.
- **Oublier les pertes au détail** : la balance, la poussière et les restes.
- **Accorder le prix de gros sur une petite quantité.**

Pour les pertes, voir [comment éviter les vols et les pertes](/blog/eviter-vols-pertes-boutique).

## Vendre à des professionnels

Un client professionnel demandera souvent un [devis](/blog/faire-un-devis), une facture et un délai de paiement. Définissez ces conditions à l’avance, avec un plafond : un gros client qui paie tard peut mettre votre trésorerie en danger. Voir [gérer le crédit client](/blog/credit-clients-boutique).

## Dans Nagaw Business

Le stock se compte dans une seule unité, et vous ajoutez à chaque produit ses unités de vente : sac de 50 kg, carton de 24, paquet de 10, avec un prix propre ou calculé à partir du prix de base. À la caisse, le vendeur choisit l’unité, et le stock baisse de la bonne quantité. Chaque vendeur a une limite de réduction, et un prix convenu avec le client reste visible sur la vente. Vous pouvez aussi préparer des modèles d’unités pour vos produits.
`,
  faq: [
    {
      question: 'Comment gérer le stock quand on vend au détail et en gros ?',
      answer:
        'Comptez tout dans la plus petite unité vendue, et donnez à chaque grande unité un facteur de conversion : un sac de 50 kg sort 50 kg du stock.',
    },
    {
      question: 'Comment fixer un prix de gros ?',
      answer:
        'Partez du coût réel, gardez une marge plus faible que le détail, et fixez le prix selon une quantité minimale, pas selon le client.',
    },
    {
      question: 'Vendre en gros est-il plus rentable ?',
      answer:
        'Le gain par article est plus faible, mais l’argent revient plus vite et les pertes baissent. Le gros est intéressant si les clients reviennent et paient à temps.',
    },
    {
      question: 'Comment suivre un produit vendu au mètre ?',
      answer:
        'Comptez le stock en mètres, avec des décimales si nécessaire, et faites de la pièce ou du rouleau une unité de vente qui contient une longueur connue.',
    },
  ],
  related: [
    'gestion-quincaillerie',
    'gestion-superette-alimentation',
    'fixer-prix-de-vente',
    'gestion-de-stock-boutique',
  ],
};
