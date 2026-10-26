import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'calculer-marge-benefice',
  title:
    'Calculer sa marge et son bénéfice : est-ce que ma boutique gagne de l’argent ?',
  seoTitle: 'Calcul de marge commerciale et bénéfice : exemples en F CFA',
  description:
    'Chiffre d’affaires, marge brute, taux de marge, taux de marque, coefficient et bénéfice : les formules expliquées simplement, avec des exemples en F CFA.',
  category: 'argent',
  keywords: [
    'calcul marge commerciale',
    'taux de marge',
    'taux de marque',
    'coefficient multiplicateur',
    'calculer son bénéfice',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'La marge d’un produit = prix de vente − prix d’achat. Le bénéfice = marge totale − dépenses de la boutique.',
    'Taux de marge = marge ÷ prix d’achat ; taux de marque = marge ÷ prix de vente. Ce ne sont pas les mêmes chiffres.',
    'Vendre beaucoup ne veut pas dire gagner : un produit très vendu à faible marge peut rapporter moins qu’un produit rare.',
    'Sans prix d’achat noté pour chaque produit, aucun calcul de marge n’est possible.',
  ],
  body: `
Beaucoup de commerçants savent combien ils vendent, mais pas combien ils **gagnent**. La différence entre les deux, c’est la **marge** et le **bénéfice**. Ce guide explique les formules avec des exemples en F CFA, sans jargon.

## Chiffre d’affaires, marge, bénéfice : trois chiffres différents

| Chiffre | Formule | Ce qu’il dit |
| --- | --- | --- |
| Chiffre d’affaires | Total des ventes | Combien vous avez vendu |
| Marge brute | Ventes − prix d’achat des produits vendus | Ce que les produits vous rapportent |
| Bénéfice | Marge brute − dépenses de la boutique | Ce qui vous reste vraiment |

Les **dépenses** sont tout ce que la boutique paie en dehors de la marchandise : loyer, électricité, transport, salaires, crédit téléphonique, taxes.

## La marge d’un produit

> Marge unitaire = prix de vente − prix d’achat

Exemple : vous achetez un sac de riz de 25 kg à 12 500 F et le revendez 14 000 F. La marge est de 1 500 F par sac.

Attention à utiliser le **vrai prix d’achat** : si le transport du fournisseur à la boutique vous coûte 200 F par sac, votre coût réel est de 12 700 F et la marge de 1 300 F.

## Taux de marge et taux de marque

Ces deux pourcentages sont souvent confondus.

> Taux de marge = marge ÷ prix d’achat × 100

> Taux de marque = marge ÷ prix de vente × 100

Avec le sac de riz (marge 1 500 F, achat 12 500 F, vente 14 000 F) :

- taux de marge = 1 500 ÷ 12 500 × 100 = **12 %** ;
- taux de marque = 1 500 ÷ 14 000 × 100 = **10,7 %**.

Le taux de marge sert à fixer un prix à partir du prix d’achat. Le taux de marque dit quelle part de chaque vente vous reste.

## Fixer un prix avec le coefficient multiplicateur

Le **coefficient** est le chiffre par lequel on multiplie le prix d’achat pour obtenir le prix de vente.

> Prix de vente = prix d’achat × coefficient

Pour un taux de marge de 25 %, le coefficient est 1,25. Un article acheté 2 000 F se vend alors 2 500 F. Si le prix de vente est TTC (avec la TVA), tenez-en compte : voir [le calcul de la TVA à 18 %](/blog/calcul-tva-18-ht-ttc).

## Exemple : le produit le plus vendu n’est pas toujours le plus rentable

Voici un exemple fictif sur un mois :

| Produit | Vendus | Marge par unité | Marge totale |
| --- | --- | --- | --- |
| Sachet d’eau | 1 200 | 10 F | 12 000 F |
| Pack de lait | 150 | 250 F | 37 500 F |
| Huile 5 L | 40 | 1 000 F | 40 000 F |

Le sachet d’eau est de loin le plus vendu, mais l’huile rapporte plus de trois fois plus. Avant de mettre de l’argent dans le stock, regardez la **marge totale**, pas seulement le nombre de ventes.

## Du bénéfice estimé au bénéfice réel

Prenons un mois d’exemple : 1 500 000 F de chiffre d’affaires, 1 200 000 F de prix d’achat des produits vendus et 180 000 F de dépenses.

- Marge brute = 1 500 000 − 1 200 000 = **300 000 F**
- Bénéfice = 300 000 − 180 000 = **120 000 F**

Ce bénéfice est une **estimation** : il dépend de prix d’achat justes et de dépenses toutes notées. Les pertes et vols non enregistrés le rendent trop optimiste ; d’où l’intérêt de [l’inventaire](/blog/faire-un-inventaire).

## Les erreurs qui faussent la marge

1. Oublier le transport et les frais d’achat dans le prix d’achat.
2. Ne pas mettre à jour le prix d’achat quand le fournisseur augmente ses prix.
3. Compter les remises accordées comme si elles n’existaient pas.
4. Prendre l’argent de la caisse pour soi sans le noter en dépense ou en retrait.
5. Confondre taux de marge et taux de marque en fixant les prix.

## La marge dans Nagaw Business

Nagaw Business garde le **prix d’achat de chaque produit au moment de la vente** : si le fournisseur augmente ses prix le mois prochain, la marge des ventes passées ne change pas. Les statistiques donnent, pour la période choisie, le chiffre d’affaires, la marge brute, les dépenses et un **bénéfice estimé**, ainsi que les produits qui rapportent le plus. La fiche d’un produit affiche le gain par unité.

Pour suivre où se trouve l’argent gagné, lisez [la trésorerie d’un petit commerce](/blog/tresorerie-petit-commerce).
`,
  faq: [
    {
      question: 'Comment calculer la marge d’un produit ?',
      answer:
        'Marge = prix de vente − prix d’achat. Par exemple, un article acheté 2 000 F et vendu 2 500 F a une marge de 500 F.',
    },
    {
      question:
        'Quelle est la différence entre taux de marge et taux de marque ?',
      answer:
        'Le taux de marge divise la marge par le prix d’achat ; le taux de marque la divise par le prix de vente. Pour une marge de 500 F sur un article acheté 2 000 F et vendu 2 500 F : 25 % de taux de marge, 20 % de taux de marque.',
    },
    {
      question: 'Comment calculer le bénéfice d’une boutique ?',
      answer:
        'Bénéfice = chiffre d’affaires − prix d’achat des produits vendus − dépenses de la boutique (loyer, électricité, transport, salaires…).',
    },
  ],
  related: [
    'tresorerie-petit-commerce',
    'reapprovisionnement-stock-dormant',
    'calcul-tva-18-ht-ttc',
  ],
};
