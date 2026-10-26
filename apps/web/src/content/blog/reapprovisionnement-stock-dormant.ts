import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'reapprovisionnement-stock-dormant',
  title: 'Quoi racheter, quoi arrêter : réapprovisionner sans stock dormant',
  seoTitle: 'Réapprovisionnement et stock dormant : quoi racheter',
  description:
    'Racheter au bon moment, en bonne quantité, et repérer les produits qui dorment en rayon : une méthode simple de réapprovisionnement pour les boutiques.',
  category: 'stock',
  keywords: [
    'réapprovisionnement stock',
    'stock dormant',
    'produits qui ne se vendent pas',
    'quand commander chez le fournisseur',
    'rotation de stock',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Rachetez d’abord les produits qui se vendent et qui passent sous leur seuil d’alerte.',
    'La quantité à commander dépend de ce que vous vendez pendant le délai de livraison et jusqu’à la commande suivante.',
    'Un produit qui ne s’est pas vendu depuis des semaines est du stock dormant : de l’argent immobilisé.',
    'Écoulez le stock dormant (promotion, lot, retour fournisseur) et arrêtez de le racheter.',
  ],
  body: `
Le **réapprovisionnement**, c’est décider quoi racheter, quand et en quelle quantité. Le **stock dormant**, ce sont les produits qui restent en rayon sans se vendre. Les deux sont liés : chaque franc mis dans un produit qui dort est un franc qui manque pour racheter ce qui se vend.

## Les trois questions avant chaque commande

1. **Qu’est-ce qui se vend ?** Regardez les produits les plus vendus de la période, pas votre intuition.
2. **Qu’est-ce qui va manquer ?** Regardez les produits sous leur seuil d’alerte.
3. **Qu’est-ce qui dort ?** Regardez les produits qui ne se sont pas vendus : ne les rachetez pas.

## Combien commander ?

Une règle simple pour une boutique :

> Quantité à commander = ventes par jour × (délai de livraison + jours jusqu’à la commande suivante) − stock actuel

Prenons un exemple : vous vendez environ 4 bidons d’huile par jour, le fournisseur livre en 2 jours et vous commandez chaque semaine (7 jours). Il vous faut 4 × (2 + 7) = 36 bidons pour tenir. S’il en reste 10, commandez 26 bidons.

Adaptez ensuite selon la saison, les fêtes et la trésorerie disponible. Si l’argent manque, servez en priorité les produits qui rapportent le plus de marge. Voir [calculer sa marge](/blog/calculer-marge-benefice).

## Repérer le stock dormant

Un produit est dormant quand il ne s’est **pas vendu depuis longtemps** alors qu’il en reste en rayon. « Longtemps » dépend du produit : une semaine pour du pain, plusieurs mois pour une perceuse.

| Signal | Ce qu’il veut dire |
| --- | --- |
| Aucune vente sur la période | Produit dormant |
| Ventes en baisse depuis plusieurs mois | Produit qui passe de mode |
| Stock élevé par rapport aux ventes | Commandes trop grosses |
| Produit souvent abîmé ou périmé | Mauvaise rotation |

## Que faire d’un produit dormant ?

- **Le mettre en avant** : près du comptoir, à hauteur des yeux.
- **Faire une promotion** ou le vendre en lot avec un produit qui marche.
- **Le rendre ou l’échanger** chez le fournisseur, si c’est possible.
- **Arrêter de le racheter** : c’est la décision la plus importante.
- En dernier recours, le **solder** pour récupérer au moins une partie de l’argent.

Un produit vendu à perte libère de la place et de l’argent ; un produit qui dort coûte chaque jour un peu plus (place, poussière, péremption).

## La rotation du stock, en clair

La **rotation** mesure combien de fois votre stock se renouvelle sur une période. Une boutique d’alimentation fait tourner son stock très vite ; une quincaillerie beaucoup plus lentement. Inutile de calculer un ratio savant : comparez simplement la **valeur de votre stock** à vos **ventes du mois**. Si le stock représente plusieurs mois de ventes, vous achetez trop.

## Exemple de liste de commande

Voici un exemple fictif de liste préparée avant de passer chez le fournisseur, avec des ventes par jour, un délai de livraison de 2 jours et une commande par semaine (9 jours à couvrir) :

| Produit | Ventes par jour | Besoin sur 9 jours | Stock actuel | À commander |
| --- | --- | --- | --- | --- |
| Huile 1 L | 4 | 36 | 10 | 26 |
| Sucre 1 kg | 6 | 54 | 60 | 0 |
| Savon | 3 | 27 | 5 | 22 |
| Lait concentré | 0 | 0 | 24 | 0 (produit dormant) |

Le sucre n’a pas besoin d’être racheté cette semaine, et le lait concentré ne s’est pas vendu : au lieu d’en racheter, cherchez pourquoi. L’argent économisé sert aux produits qui partent. Pour vérifier que les chiffres de stock sont justes avant de commander, voir [faire un inventaire](/blog/faire-un-inventaire).

## Les bonnes habitudes

- Une commande fournisseur par semaine, au même moment, liste en main.
- Une liste « à racheter » tirée des produits sous le seuil, pas de mémoire.
- Un coup d’œil mensuel aux produits qui ne se vendent pas.
- La réception des livraisons contrôlée et saisie le jour même. Voir [gestion de stock](/blog/gestion-de-stock-boutique).

## Avec Nagaw Business

L’accueil de Nagaw Business affiche les produits épuisés, bientôt épuisés et ceux à racheter, d’après le seuil d’alerte de chaque produit. Les statistiques montrent, pour la période choisie, les produits les plus vendus et **ceux qui ne se vendent pas**, ainsi que la valeur du stock au prix d’achat. Les entrées de marchandise se saisissent sur la fiche du produit.
`,
  faq: [
    {
      question: 'Comment savoir quand réapprovisionner ?',
      answer:
        'Quand le stock passe sous le seuil d’alerte, c’est-à-dire sous la quantité que vous vendez pendant le délai de livraison, plus une marge de sécurité.',
    },
    {
      question: 'Qu’est-ce qu’un stock dormant ?',
      answer:
        'Ce sont des produits qui restent en rayon sans se vendre depuis longtemps. Ils immobilisent de l’argent, prennent de la place et risquent de s’abîmer.',
    },
    {
      question: 'Que faire des produits qui ne se vendent pas ?',
      answer:
        'Mettez-les en avant, proposez une promotion ou un lot, rendez-les au fournisseur si possible, et surtout arrêtez de les racheter.',
    },
  ],
  related: [
    'gestion-de-stock-boutique',
    'calculer-marge-benefice',
    'faire-un-inventaire',
  ],
};
