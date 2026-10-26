import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'gestion-quincaillerie',
  title:
    'Gérer une quincaillerie : des milliers d’articles, au mètre, au kilo et au sac',
  seoTitle: 'Gestion d’une quincaillerie : stock, unités et crédit',
  description:
    'Ventes au mètre et au kilo, milliers de références, clients artisans à crédit, devis de chantier : les bonnes pratiques pour gérer le stock d’une quincaillerie.',
  category: 'metiers',
  keywords: [
    'gestion quincaillerie',
    'logiciel quincaillerie',
    'stock quincaillerie',
    'vente au mètre et au kilo',
    'matériaux de construction boutique',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Une quincaillerie vend des milliers d’articles dans des unités différentes : pièce, mètre, kilo, sac, litre.',
    'Choisissez pour chaque produit l’unité dans laquelle vous le vendez, et suivez le stock dans cette unité.',
    'Les artisans achètent souvent à crédit et sur devis : plafond par client et devis rapides sont indispensables.',
    'Classez les articles par familles et faites un inventaire tournant : impossible de tout compter d’un coup.',
  ],
  body: `
La **quincaillerie** est l’un des commerces les plus difficiles à gérer : des milliers de références, des produits vendus à la pièce, au mètre, au kilo ou au sac, des prix de matériaux qui bougent, et une clientèle d’artisans et de chantiers qui achète souvent à crédit. Le cahier n’y suffit plus très vite.

## Les défis d’une quincaillerie

| Défi | Exemple | Bonne pratique |
| --- | --- | --- |
| Beaucoup de références | Vis, clous, chevilles de toutes tailles | Familles et catégories claires |
| Unités différentes | Fil électrique au mètre, clous au kilo, ciment au sac | Une unité de vente par produit |
| Produits lourds et encombrants | Ciment, fer à béton, tôles | Stock compté à la livraison |
| Clients artisans | Plombiers, électriciens, maçons | Crédit plafonné par client |
| Commandes de chantier | Liste de matériaux pour une maison | Devis rapides et précis |
| Prix qui varient | Ciment, fer, tôles | Prix d’achat mis à jour |

## Choisir la bonne unité pour chaque produit

Le stock doit être suivi **dans l’unité où vous vendez** :

- **au mètre** : fil électrique, câble, tuyau, grillage ;
- **au kilo** : clous, pointes, fil d’attache ;
- **au sac** : ciment, plâtre ;
- **au litre** : peinture, diluant ;
- **à la pièce** : outils, robinets, interrupteurs, tôles ;
- **au paquet ou au carton** : vis et chevilles conditionnées.

Si vous achetez un rouleau de 100 mètres de fil électrique et le vendez au mètre, entrez **100 mètres** en stock à la réception, pas « 1 rouleau ». Si vous vendez aussi le rouleau entier, créez un produit à part pour le rouleau.

## Organiser des milliers d’articles

- Classez les produits par **familles** : plomberie, électricité, peinture, visserie, outillage, matériaux, quincaillerie de bâtiment.
- Donnez des **noms précis et réguliers** : « Vis bois 4 × 40 mm », « Tuyau PVC 32 mm », pour que la recherche trouve le bon article.
- Utilisez le **code-barres** quand le produit en a un.
- Ajoutez une photo pour les articles qui se ressemblent.

## L’inventaire tournant, indispensable

Compter toute une quincaillerie le même jour est presque impossible. Comptez **une famille par semaine** : visserie la première semaine, plomberie la deuxième, et ainsi de suite. Commencez par les produits chers (outillage électrique, câbles) et ceux qui disparaissent facilement. Voir [faire un inventaire](/blog/faire-un-inventaire).

## Les artisans et le crédit

Les artisans sont souvent les meilleurs clients d’une quincaillerie, et ils achètent à crédit en attendant d’être payés par leur propre client. Pour que ce crédit reste sain :

- fixez un **plafond par artisan** ;
- notez chaque enlèvement de marchandise, avec la date ;
- convenez d’une date de règlement (fin de chantier, fin de mois) ;
- faites un point régulier avec chacun.

Voir [gérer le crédit des clients](/blog/credit-clients-boutique).

## Les devis de chantier

Un client qui construit arrive avec une liste de matériaux et veut un prix global. Un devis précis, rapide et lisible, avec la durée de validité (les prix du ciment et du fer changent), vous donne un avantage sur la concurrence. Une fois accepté, transformez-le en facture sans ressaisie. Voir [faire un devis](/blog/faire-un-devis).

## Suivre les prix des matériaux

Le ciment, le fer à béton et les tôles changent de prix plusieurs fois par an. Si vous continuez à vendre au même prix alors que le fournisseur a augmenté le sien, votre marge fond sans que vous le voyiez. À chaque nouvelle livraison :

1. comparez le prix d’achat au précédent ;
2. mettez à jour le **prix d’achat** dans votre logiciel ;
3. recalculez le prix de vente avec votre coefficient habituel ;
4. changez l’étiquette ou le prix affiché avant de vendre la nouvelle marchandise.

Pour fixer un prix à partir du prix d’achat, voir [calculer sa marge](/blog/calculer-marge-benefice). Pour les gros clients, gardez une trace du prix promis dans le devis, valable seulement pendant sa durée de validité.

## Avec Nagaw Business

Nagaw Business accepte les unités d’une quincaillerie : pièce, carton, paquet, sac, kg, litre et **mètre**, avec des quantités à virgule pour le poids, le volume et la longueur (par exemple 2,5 mètres de câble). Les produits se classent par catégorie, se retrouvent par nom ou code-barres, et chaque entrée, vente, perte et inventaire est gardé. Le crédit est plafonné par client, et les devis deviennent des factures sans ressaisie. Le stock se suit dans l’unité de vente du produit : un rouleau acheté se saisit en mètres.
`,
  faq: [
    {
      question: 'Comment gérer le stock d’une quincaillerie ?',
      answer:
        'Suivez chaque produit dans son unité de vente (mètre, kilo, sac, pièce), classez les articles par familles et faites un inventaire tournant, une famille par semaine.',
    },
    {
      question: 'Comment vendre au mètre ou au kilo avec un logiciel ?',
      answer:
        'Choisissez le mètre ou le kilo comme unité du produit et saisissez la quantité vendue avec une virgule si besoin, par exemple 2,5 mètres. Le stock baisse de la même quantité.',
    },
    {
      question: 'Comment gérer le crédit des artisans ?',
      answer:
        'Fixez un plafond par artisan, notez chaque enlèvement avec la date, convenez d’une date de règlement et faites un point régulier.',
    },
  ],
  related: [
    'gestion-de-stock-boutique',
    'credit-clients-boutique',
    'faire-un-devis',
  ],
};
