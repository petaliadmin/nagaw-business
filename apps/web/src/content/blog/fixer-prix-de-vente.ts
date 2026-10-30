import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'fixer-prix-de-vente',
  title: 'Comment fixer son prix de vente sans perdre d’argent',
  seoTitle: 'Comment fixer son prix de vente : méthode simple',
  description:
    'La méthode simple pour calculer un prix de vente : coût réel, marge, taxe et prix du marché, avec un exemple en F CFA pour un produit et pour un service.',
  category: 'argent',
  keywords: [
    'comment fixer son prix de vente',
    'calcul prix de vente',
    'coefficient multiplicateur',
    'calculer un prix de vente TTC',
    'fixer le prix d’un service',
    'prix de revient boutique',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Partez du coût réel : prix d’achat plus transport et frais, jamais du seul prix du fournisseur.',
    'Pour obtenir une marge de 25 % du prix de vente, divisez le coût par 0,75.',
    'Comparez ensuite au prix du marché : le bon prix doit être rentable et acceptable pour le client.',
    'Pour un service, calculez d’abord le coût d’une heure de travail.',
  ],
  body: `
Pour **fixer son prix de vente**, partez du coût réel de l’article, ajoutez la marge dont vous avez besoin, puis vérifiez que le prix obtenu est accepté par le marché. Le prix ne se copie pas sur le voisin : le voisin n’a ni votre loyer, ni vos frais de transport, ni votre fournisseur. Un prix trop bas fait tourner la boutique sans rien rapporter.

## Étape 1 : calculer le coût réel

Le coût d’un article n’est pas seulement ce que vous payez au grossiste. Ajoutez tout ce qu’il a fallu pour l’amener en rayon.

| Élément d’exemple | Montant |
| --- | --- |
| Prix d’achat du carton de 24 | 21 600 F |
| Transport jusqu’à la boutique | 2 400 F |
| **Coût total du carton** | **24 000 F** |
| **Coût réel par article** | **1 000 F** |

Sans le transport, vous auriez compté 900 F. Sur un mois, cet oubli se voit dans la caisse.

## Étape 2 : ajouter la marge

Il y a une confusion fréquente : ajouter 25 % au coût ne donne pas 25 % de marge.

- **Coût 1 000 F + 25 %** = 1 250 F de prix de vente, soit 20 % de marge sur le prix.
- **Pour vraiment garder 25 % du prix de vente**, divisez : 1 000 F ÷ 0,75 = **1 333 F**.

| Marge visée sur le prix | Diviser le coût par |
| --- | --- |
| 20 % | 0,80 |
| 25 % | 0,75 |
| 30 % | 0,70 |
| 40 % | 0,60 |

Pour distinguer marge et bénéfice, voir [comment calculer sa marge](/blog/calculer-marge-benefice).

## Étape 3 : vérifier la taxe

Si vous êtes soumis à la TVA, le prix affiché au client est un prix TTC : la taxe n’est pas à vous. Partez donc du prix hors taxe et ajoutez 18 %. Dans l’exemple, 1 333 F hors taxe deviennent environ 1 573 F TTC. Le calcul est détaillé dans [la TVA à 18 %](/blog/calcul-tva-18-ht-ttc).

## Étape 4 : comparer au marché

Regardez ce que vos concurrents demandent, puis arrondissez à un prix simple : 1 500 F plutôt que 1 573 F. Trois cas se présentent :

- **Votre prix est sous le marché** : vous pouvez gagner plus sans perdre de clients.
- **Il est au même niveau** : gardez-le.
- **Il est au-dessus** : cherchez un meilleur fournisseur, un autre format, ou justifiez-le par un service, comme la livraison ou le crédit.

Chaque article n’a pas besoin de la même marge. Les produits que tout le monde compare, comme le riz ou le sucre, rapportent peu. Les petits articles et les accessoires rattrapent le reste.

## Fixer le prix d’un service

Pour un service, le coût principal est le temps.

1. Additionnez les charges du mois et votre rémunération : 600 000 F, par exemple.
2. Divisez par les heures réellement facturables : 100 heures, pas 200.
3. Vous obtenez un **coût horaire de 6 000 F**.
4. Ajoutez la marge et les fournitures de chaque prestation.

Comptez seulement les heures vendues : les déplacements et le temps administratif ne se facturent pas, mais vous les payez. Voir [gérer une entreprise de services](/blog/gestion-entreprise-services).

## Quand revoir ses prix

Revoyez vos prix à chaque hausse du fournisseur, du transport ou de vos charges, et au moins une fois par an. Pour vérifier qu’ils couvrent vos charges, utilisez [le seuil de rentabilité](/blog/seuil-de-rentabilite).

## Dans Nagaw Business

Chaque article garde son prix de vente et son prix d’achat, ou son coût pour un service. La fiche affiche ce que vous gagnez par unité, et l’Accueil calcule la marge réelle des ventes. Une marge négative se repère donc tout de suite. Un vendeur peut baisser un prix dans la limite que vous fixez pour lui, et chaque prix négocié reste visible.
`,
  faq: [
    {
      question: 'Comment calculer un prix de vente ?',
      answer:
        'Calculez le coût réel de l’article, divisez-le selon la marge visée (par 0,75 pour 25 % de marge sur le prix), ajoutez la taxe si vous y êtes soumis, puis comparez au marché.',
    },
    {
      question: 'Quelle différence entre marge et majoration ?',
      answer:
        'La majoration s’ajoute au coût, la marge se calcule sur le prix de vente. Ajouter 25 % au coût donne 20 % de marge, pas 25 %.',
    },
    {
      question: 'Faut-il s’aligner sur les prix du voisin ?',
      answer:
        'Pas automatiquement. Vérifiez d’abord que ce prix couvre votre coût et vos charges, qui ne sont pas ceux du voisin.',
    },
    {
      question: 'Comment fixer le prix d’une prestation ?',
      answer:
        'Divisez vos charges et votre rémunération par vos heures réellement facturables, puis multipliez par le temps de la prestation et ajoutez les fournitures.',
    },
  ],
  related: [
    'calculer-marge-benefice',
    'seuil-de-rentabilite',
    'calcul-tva-18-ht-ttc',
    'gestion-entreprise-services',
  ],
};
