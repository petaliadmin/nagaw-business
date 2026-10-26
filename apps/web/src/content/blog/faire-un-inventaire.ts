import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'faire-un-inventaire',
  title: 'Comment faire l’inventaire de sa boutique, étape par étape',
  seoTitle: 'Comment faire un inventaire de boutique : étapes et conseils',
  description:
    'Préparer, compter, comparer, expliquer les écarts : la méthode pas à pas pour faire l’inventaire de votre boutique, avec l’inventaire tournant pour ne pas fermer.',
  category: 'stock',
  keywords: [
    'faire un inventaire',
    'inventaire de stock',
    'inventaire boutique',
    'écart d’inventaire',
    'inventaire tournant',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Un inventaire, c’est compter ce qui reste vraiment et le comparer au stock théorique.',
    'Préparez-le : rangez, envoyez les ventes en attente, comptez à deux, rayon par rayon.',
    'Chaque écart doit être expliqué : perte non notée, livraison oubliée, erreur de vente ou vol.',
    'L’inventaire tournant (un rayon par semaine) évite de fermer la boutique.',
  ],
  body: `
Faire un **inventaire**, c’est compter physiquement ce qui reste de chaque produit, puis comparer ce chiffre au stock que vous pensiez avoir. La différence s’appelle l’**écart d’inventaire**. Un inventaire bien fait corrige le stock, mais surtout il explique pourquoi il était faux.

## Pourquoi faire un inventaire, même avec une application ?

Une application retire le stock à chaque vente, mais elle ne voit pas ce que personne n’a noté : un produit cassé et jeté, une livraison incomplète, un article offert, un vol. Sans inventaire, ces petites erreurs s’accumulent et vos chiffres de stock perdent toute valeur. L’inventaire est aussi utile pour la comptabilité : la valeur du stock en fin d’année entre dans l’état de fin d’exercice.

## Inventaire complet ou inventaire tournant ?

| Méthode | Principe | Avantages | Inconvénients |
| --- | --- | --- | --- |
| Inventaire complet | Tout compter le même jour | Photo exacte à une date | Long, souvent boutique fermée |
| Inventaire tournant | Un rayon ou une famille par semaine | Pas de fermeture, comptage plus soigné | Demande de la régularité |

Pour une boutique, le plus efficace est de combiner les deux : un **inventaire tournant** toute l’année, et un comptage complet en fin d’année pour la comptabilité.

## Les étapes d’un inventaire réussi

### 1. Préparer

- Choisissez un moment calme : tôt le matin, ou après la fermeture.
- **Rangez** le rayon : regroupez les mêmes produits au même endroit.
- Mettez de côté les produits abîmés ou périmés : ce sont des **pertes** à noter à part.
- Si vous utilisez une caisse hors ligne, **envoyez toutes les ventes en attente** avant de compter.

### 2. Compter

- Comptez à deux si possible : l’un compte, l’autre note.
- Comptez dans un ordre fixe, de gauche à droite et de haut en bas.
- Pour les cartons fermés, comptez les cartons puis multipliez, mais ouvrez-en un au hasard pour vérifier.
- Ne vendez pas les produits du rayon pendant que vous comptez, ou notez la vente tout de suite.

### 3. Comparer

Pour chaque produit, comparez le **stock compté** au **stock prévu**. Dans une application, il suffit de saisir le chiffre compté : l’écart est calculé et gardé.

### 4. Expliquer les écarts

Un écart a toujours une cause. Les plus fréquentes :

1. une **perte** non enregistrée (casse, péremption, produit abîmé) ;
2. une **livraison** saisie avec une mauvaise quantité ;
3. une **erreur de vente** : un produit vendu à la place d’un autre ;
4. un **produit sorti sans vente** : cadeau, consommation de la boutique ;
5. un **vol**.

Si un même produit a souvent un écart, regardez-le de près. Notre article sur [les vols et pertes en boutique](/blog/eviter-vols-pertes-boutique) donne des pistes.

### 5. Corriger et tirer les leçons

Enregistrez le stock compté comme nouveau stock, avec un motif. Puis demandez-vous ce qui doit changer : mieux noter les pertes, vérifier les livraisons à la réception, ranger autrement. L’inventaire est aussi le bon moment pour repérer les produits qui dorment en rayon : voir [quoi racheter, quoi arrêter](/blog/reapprovisionnement-stock-dormant).

## Exemple d’écarts à analyser

Voici un exemple fictif de résultats d’inventaire pour trois produits :

| Produit | Stock prévu | Stock compté | Écart | Piste |
| --- | --- | --- | --- | --- |
| Savon de Marseille | 48 | 48 | 0 | Rien à signaler |
| Lait en poudre 400 g | 30 | 27 | −3 | Vérifier les boîtes cabossées jetées |
| Chargeur USB-C | 12 | 10 | −2 | Petit article de valeur : à surveiller |

## À quelle fréquence faire l’inventaire ?

- **Produits chers ou petits** (téléphones, accessoires, parfums) : chaque semaine.
- **Produits qui se vendent beaucoup** : chaque mois.
- **Le reste** : chaque trimestre, en inventaire tournant.
- **Toute la boutique** : au moins une fois par an, à la clôture de l’exercice comptable.

## L’inventaire dans Nagaw Business

Sur la fiche d’un produit, le bouton « J’ai compté ce qui reste » enregistre le stock compté. L’écart est calculé, gardé dans les mouvements du produit et jamais effacé : vous pouvez toujours retrouver quand et de combien le stock a été corrigé. Pour la méthode complète de suivi, voir [la gestion de stock d’une boutique](/blog/gestion-de-stock-boutique).
`,
  faq: [
    {
      question: 'Comment faire l’inventaire d’une boutique ?',
      answer:
        'Rangez le rayon, mettez de côté les produits abîmés, comptez à deux dans un ordre fixe, comparez au stock prévu et expliquez chaque écart avant de corriger le stock.',
    },
    {
      question: 'Qu’est-ce qu’un écart d’inventaire ?',
      answer:
        'C’est la différence entre le stock compté et le stock prévu. Il vient d’une perte non notée, d’une erreur de livraison ou de vente, d’un produit sorti sans vente ou d’un vol.',
    },
    {
      question: 'Qu’est-ce que l’inventaire tournant ?',
      answer:
        'C’est compter une partie du stock à la fois, par exemple un rayon par semaine, au lieu de tout compter le même jour. La boutique n’a pas besoin de fermer.',
    },
  ],
  related: [
    'gestion-de-stock-boutique',
    'eviter-vols-pertes-boutique',
    'syscohada-commercant',
  ],
};
