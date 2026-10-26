import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'gestion-de-stock-boutique',
  title:
    'Gestion de stock d’une boutique : la méthode simple pour ne plus être en rupture',
  seoTitle: 'Gestion de stock boutique : méthode simple et gratuite',
  description:
    'Entrées, sorties, pertes, seuil d’alerte, inventaire : la méthode simple pour gérer le stock de votre boutique, éviter les ruptures et l’argent qui dort en rayon.',
  category: 'stock',
  keywords: [
    'gestion de stock',
    'gestion de stock boutique',
    'logiciel de gestion de stock gratuit',
    'fiche de stock',
    'suivi de stock commerce',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Gérer son stock, c’est savoir à tout moment ce qui reste, ce qu’il faut racheter et ce qui ne se vend pas.',
    'Le stock ne se corrige jamais en écrasant un chiffre : chaque entrée, vente, perte ou inventaire est un mouvement daté.',
    'Fixez un seuil d’alerte par produit pour racheter avant la rupture.',
    'Comptez régulièrement une partie du rayon plutôt que tout le magasin une fois par an.',
  ],
  body: `
La **gestion de stock** d’une boutique consiste à savoir, à tout moment, combien il reste de chaque produit, ce qu’il faut racheter et ce qui dort en rayon. Bien faite, elle évite deux pertes d’argent : la **rupture**, qui fait repartir le client chez le voisin, et le **surstock**, qui immobilise votre argent dans des marchandises qui ne partent pas.

## Les quatre mouvements du stock

Tout ce qui fait bouger votre stock entre dans l’une de ces quatre familles :

| Mouvement | Exemple | Effet sur le stock |
| --- | --- | --- |
| Entrée | Vous recevez 24 bouteilles d’huile du fournisseur | Augmente |
| Vente | Un client achète 2 bouteilles | Diminue |
| Perte | Une bouteille est cassée ou périmée | Diminue |
| Inventaire | Vous comptez 19 bouteilles au lieu de 20 | Corrige l’écart, avec trace |

La règle d’or : **on n’écrase jamais un chiffre de stock**. Si vous changez « 20 » en « 19 » sans rien noter, vous ne saurez jamais si la bouteille a été volée, cassée ou oubliée dans une vente. En notant chaque mouvement, vous pouvez toujours expliquer le stock d’aujourd’hui.

## La fiche de stock : ce qu’elle doit contenir

Pour chaque produit, une fiche de stock contient :

- le nom et, si possible, le code-barres ;
- le prix de vente et le **prix d’achat** ;
- l’unité (pièce, kilo, litre, mètre, carton) ;
- le stock actuel ;
- le **seuil d’alerte** ;
- la liste des mouvements datés.

Sur papier, cette fiche demande de la discipline. Dans une application, elle se remplit toute seule à chaque vente.

## Le seuil d’alerte : racheter avant la rupture

Le seuil d’alerte est la quantité en dessous de laquelle vous devez racheter. Pour le fixer, demandez-vous : **combien j’en vends pendant le temps qu’il faut pour être livré ?**

Prenons un exemple : vous vendez environ 5 paquets de lait par jour, et votre fournisseur livre en 3 jours. Il vous faut au moins 15 paquets pour tenir jusqu’à la livraison. Ajoutez une marge de sécurité, par exemple 5 paquets : votre seuil d’alerte est de 20.

Avec une application, les produits sous le seuil apparaissent dans une liste « bientôt épuisés ». Voir aussi [quand racheter et quoi arrêter de racheter](/blog/reapprovisionnement-stock-dormant).

## Les erreurs de stock les plus courantes

1. **Ne pas enregistrer les pertes.** Un produit cassé ou périmé non noté devient un « vol » mystérieux à l’inventaire.
2. **Oublier les entrées.** Une livraison non saisie donne un stock trop bas, et vous rachetez pour rien.
3. **Vendre hors système.** Une vente notée sur un papier « en attendant » n’enlève rien du stock.
4. **Donner des produits sans les sortir.** Les produits offerts ou consommés par la boutique sont des sorties.
5. **Ne jamais compter.** Même avec une application, un inventaire régulier repère ce que personne n’a noté.

## Combien d’argent dort dans votre stock ?

La **valeur du stock** est la somme, pour chaque produit, de la quantité restante multipliée par le prix d’achat. C’est de l’argent que vous avez déjà dépensé et qui n’est pas encore revenu. Si cette valeur grossit alors que vos ventes ne bougent pas, vous achetez trop.

## Compter le stock sans fermer la boutique

L’inventaire complet une fois par an est long et souvent bâclé. Préférez l’**inventaire tournant** : chaque semaine, comptez un rayon ou une famille de produits. En deux ou trois mois, tout le magasin a été compté, sans fermer un seul jour. Notre guide [faire un inventaire](/blog/faire-un-inventaire) détaille la méthode.

## Gérer le stock avec Nagaw Business

Dans Nagaw Business, chaque vente retire le stock toute seule. La fiche d’un produit propose trois boutons : « J’ai reçu de la marchandise », « Perte, casse ou produit abîmé » et « J’ai compté ce qui reste ». Chaque mouvement est gardé, le seuil d’alerte se règle par produit, et l’accueil montre les produits épuisés, bientôt épuisés et la valeur du stock. Une perte supérieure au stock est refusée, pour éviter les erreurs de saisie.

Pour les boutiques qui vendent au mètre ou au kilo, voir aussi [la gestion d’une quincaillerie](/blog/gestion-quincaillerie).
`,
  faq: [
    {
      question: 'Comment gérer le stock d’une petite boutique ?',
      answer:
        'Enregistrez chaque entrée, vente et perte, fixez un seuil d’alerte par produit et comptez régulièrement une partie du rayon. Une application retire le stock à chaque vente et vous dit quoi racheter.',
    },
    {
      question: 'Qu’est-ce qu’une fiche de stock ?',
      answer:
        'C’est la carte d’identité d’un produit : nom, prix de vente et d’achat, unité, stock actuel, seuil d’alerte et liste des mouvements datés (entrées, ventes, pertes, inventaires).',
    },
    {
      question: 'Comment calculer le seuil d’alerte de stock ?',
      answer:
        'Multipliez ce que vous vendez par jour par le nombre de jours de livraison, puis ajoutez une marge de sécurité. Exemple : 5 par jour × 3 jours + 5 = 20.',
    },
  ],
  related: [
    'faire-un-inventaire',
    'reapprovisionnement-stock-dormant',
    'eviter-vols-pertes-boutique',
  ],
};
