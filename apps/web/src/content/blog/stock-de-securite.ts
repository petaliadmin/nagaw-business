import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'stock-de-securite',
  title: 'Stock de sécurité : quand recommander pour éviter la rupture',
  seoTitle: 'Stock de sécurité et seuil d’alerte : calcul simple',
  description:
    'Quand recommander pour ne pas tomber en rupture ? Le calcul simple du stock de sécurité et du seuil d’alerte d’une boutique, avec un exemple chiffré.',
  category: 'stock',
  keywords: [
    'stock de sécurité',
    'calcul stock de sécurité',
    'seuil d’alerte stock',
    'point de commande',
    'éviter les ruptures de stock',
    'rupture de stock boutique',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Le stock de sécurité est la petite réserve qui vous protège d’un retard du fournisseur ou d’une hausse des ventes.',
    'Seuil d’alerte = ventes par jour × délai de livraison + stock de sécurité.',
    'Dans l’exemple, 10 bouteilles par jour, 5 jours de délai et 3 jours de sécurité donnent un seuil de 80.',
    'Réservez ce calcul aux articles qui comptent : ceux qui se vendent le plus.',
  ],
  body: `
Le **stock de sécurité** est la petite réserve que vous gardez pour ne pas tomber en rupture si le fournisseur a du retard ou si les ventes augmentent. Il sert à calculer le **seuil d’alerte**, c’est-à-dire le niveau de stock auquel il faut recommander : **ventes par jour × délai de livraison + stock de sécurité**. Ce simple chiffre évite la plupart des ruptures, sans remplir la boutique de cartons.

## Pourquoi une rupture coûte plus cher qu’on ne le croit

Une rupture ne fait pas seulement perdre une vente. Le client qui ne trouve pas son article va chez le voisin, et il y achète aussi le reste de son panier. S’il revient plusieurs fois sans trouver, il change d’habitude. À l’inverse, trop de stock bloque votre argent. Le but est de trouver le juste milieu. Voir [réapprovisionner sans surstocker](/blog/reapprovisionnement-stock-dormant).

## Le calcul en trois étapes

1. **Ventes moyennes par jour** : regardez les 30 derniers jours. Exemple : 10 bouteilles par jour.
2. **Délai de livraison** : entre la commande et l’arrivée en rayon, incluant le temps de passer la commande. Exemple : 5 jours.
3. **Marge de sécurité** : combien de jours de ventes pour absorber un imprévu ? Exemple : 3 jours, soit 30 bouteilles.

**Seuil d’alerte = (10 × 5) + 30 = 80 bouteilles.**

Quand il reste 80 bouteilles, vous commandez. Vous aurez encore de quoi vendre 5 jours, et 30 bouteilles de réserve à l’arrivée.

## Quel stock de sécurité choisir

| Situation | Marge conseillée |
| --- | --- |
| Fournisseur fiable et proche | 1 à 2 jours de ventes |
| Ventes irrégulières | 3 à 5 jours de ventes |
| Fournisseur lointain ou importation | 1 à 2 semaines de ventes |
| Période de fête ou rentrée | À augmenter avant la période |
| Produit qui périme vite | Le plus faible possible |

Ces ordres de grandeur sont un point de départ : ajustez-les à ce que vous observez.

## Ne pas le faire pour tout le monde

Calculer un seuil pour chaque article serait épuisant. Concentrez-vous sur les produits qui font l’essentiel de vos ventes, souvent une petite partie du catalogue. Pour les articles qui se vendent peu, un seuil approximatif suffit, ou même aucun. Une méthode de priorité est décrite dans [le guide de la gestion de stock](/blog/gestion-de-stock-boutique).

## Revoir ses seuils

Un seuil n’est pas éternel. Revoyez-le dans ces cas :

- avant une fête ou un événement : Tabaski, Korité, Noël, rentrée ;
- quand un fournisseur change de délai ;
- quand un produit se met à se vendre plus, ou moins ;
- après une rupture : c’est le signe que le seuil était trop bas.

## Les erreurs à éviter

- **Commander quand il n’y a plus rien** : le délai de livraison se passe en rupture.
- **Oublier le temps de commande** : le jour où vous passez chez le grossiste compte aussi.
- **Se fier à un stock faux** : un seuil ne sert à rien si le stock affiché est inexact. Faites des [inventaires](/blog/faire-un-inventaire).
- **Multiplier le stock par peur** : l’argent bloqué manque ailleurs. Voir [le fonds de roulement](/blog/fonds-de-roulement-boutique).

## Pour les pièces et les matières d’un atelier

La méthode vaut aussi pour un garage, un salon ou un atelier : les plaquettes, le défrisant ou le fil se calculent de la même façon, à partir de ce qui est consommé par semaine. Voir [gérer un garage](/blog/gestion-garage-mecanique).

## Dans Nagaw Business

Vous fixez pour chaque produit le niveau à partir duquel vous voulez être prévenu. Le produit passe alors en « Bientôt épuisé », apparaît dans « Produits à racheter » à l’Accueil et dans le filtre du stock, et l’application peut vous envoyer une notification. Le calcul du seuil reste à faire : il dépend de votre fournisseur, que vous connaissez mieux que personne.
`,
  faq: [
    {
      question: 'Comment calculer un stock de sécurité ?',
      answer:
        'Multipliez vos ventes moyennes par jour par le nombre de jours de marge que vous voulez garder, par exemple 3 jours pour un fournisseur moyennement fiable.',
    },
    {
      question:
        'Quelle est la différence entre stock de sécurité et seuil d’alerte ?',
      answer:
        'Le stock de sécurité est la réserve. Le seuil d’alerte est le niveau où commander : ventes par jour fois délai de livraison, plus le stock de sécurité.',
    },
    {
      question: 'Comment éviter les ruptures de stock ?',
      answer:
        'Fixez un seuil d’alerte sur vos articles principaux, recommandez dès qu’il est atteint, et revoyez-le avant les fêtes et après chaque rupture.',
    },
    {
      question: 'Faut-il un stock de sécurité pour tous les produits ?',
      answer:
        'Non. Réservez-le aux articles qui se vendent le plus. Pour un produit qui périme vite ou se vend peu, gardez une marge faible.',
    },
  ],
  related: [
    'gestion-de-stock-boutique',
    'reapprovisionnement-stock-dormant',
    'faire-un-inventaire',
    'gestion-superette-alimentation',
  ],
};
