import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'calcul-tva-18-ht-ttc',
  title: 'Calcul de la TVA à 18 % : passer du HT au TTC et inversement',
  seoTitle: 'Calcul TVA 18 % : formules HT, TTC et exemples en F CFA',
  description:
    'Formules pour calculer la TVA à 18 %, passer d’un prix HT à TTC et retrouver le HT à partir du TTC, avec des exemples en F CFA et un tableau prêt à l’emploi.',
  category: 'factures',
  keywords: [
    'calcul TVA 18 %',
    'TVA Sénégal',
    'calcul HT TTC',
    'prix hors taxe',
    'formule TVA',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'TTC = HT × 1,18 ; HT = TTC ÷ 1,18 ; TVA = TTC − HT.',
    'Pour retrouver la TVA dans un prix TTC : TVA = TTC × 18 ÷ 118.',
    'Ne calculez jamais 18 % d’un prix TTC pour trouver la TVA : le résultat est faux.',
    'Le taux normal est de 18 % au Sénégal ; vérifiez le taux et votre régime fiscal avec votre comptable.',
  ],
  body: `
La **TVA** (taxe sur la valeur ajoutée) est un impôt payé par le client final et collecté par l’entreprise qui vend. Au Sénégal, le **taux normal est de 18 %**, et plusieurs pays voisins de l’UEMOA appliquent le même taux. Pour vos devis et vos factures, trois formules suffisent.

> Les taux et les règles changent selon le pays, le produit et le régime fiscal de l’entreprise. Les petites entreprises soumises à un régime simplifié, comme la contribution globale unique (CGU) au Sénégal, ne facturent en principe pas de TVA. Vérifiez votre situation auprès de votre comptable ou de l’administration fiscale.

## Les trois formules à retenir

> Prix TTC = prix HT × 1,18

> Prix HT = prix TTC ÷ 1,18

> TVA = prix TTC − prix HT = prix HT × 0,18 = prix TTC × 18 ÷ 118

**HT** veut dire hors taxes ; **TTC** veut dire toutes taxes comprises.

## Exemple 1 : du HT au TTC

Vous vendez un article à 10 000 F HT.

- TVA = 10 000 × 0,18 = **1 800 F**
- TTC = 10 000 + 1 800 = **11 800 F**

## Exemple 2 : du TTC au HT

Votre prix affiché en boutique est de 5 900 F TTC.

- HT = 5 900 ÷ 1,18 = **5 000 F**
- TVA = 5 900 − 5 000 = **900 F**

## L’erreur la plus fréquente

Beaucoup calculent la TVA en prenant 18 % du prix TTC. Avec 5 900 F TTC, cela donne 1 062 F : c’est **faux**, la bonne TVA est de 900 F. Le pourcentage de 18 % s’applique au prix **hors taxes**, jamais au prix TTC.

## Tableau prêt à l’emploi

| Prix HT | TVA 18 % | Prix TTC |
| --- | --- | --- |
| 1 000 F | 180 F | 1 180 F |
| 2 500 F | 450 F | 2 950 F |
| 5 000 F | 900 F | 5 900 F |
| 10 000 F | 1 800 F | 11 800 F |
| 25 000 F | 4 500 F | 29 500 F |
| 50 000 F | 9 000 F | 59 000 F |
| 100 000 F | 18 000 F | 118 000 F |

## Et les arrondis ?

Le franc CFA n’a pas de centimes en pratique. Quand une division ne tombe pas juste, arrondissez au franc près. Exemple : 5 000 F TTC ÷ 1,18 = 4 237,29 F, soit **4 237 F HT** et **763 F de TVA**. Sur une facture de plusieurs lignes, l’important est que **total HT + TVA = total TTC** exactement : un bon logiciel calcule la TVA sur le total de chaque taux pour éviter les écarts d’arrondi.

## Prix affichés : HT ou TTC ?

En boutique, le client particulier paie le prix affiché : affichez donc des prix **TTC**. Pour un client entreprise, la facture (et le [devis](/blog/faire-un-devis) qui la précède) doit montrer le HT, la TVA et le TTC. Pour votre marge, raisonnez en HT : la TVA que vous collectez n’est pas à vous, vous la reversez. Voir [calculer sa marge](/blog/calculer-marge-benefice).

## Plusieurs taux sur une même facture

Si une facture contient des produits à des taux différents (par exemple un produit exonéré et un produit à 18 %), le total de TVA doit être **détaillé par taux**. C’est l’une des mentions à vérifier : voir [les mentions d’une facture au Sénégal](/blog/mentions-obligatoires-facture-senegal).

## La TVA dans Nagaw Business

Dans Nagaw Business, les prix des produits sont saisis **TTC**, comme ils sont affichés en boutique, avec leur taxe (les taux se règlent dans Paramètres). Les factures et devis calculent le total HT, la TVA **par taux** et le TTC, avec la même méthode de calcul que la caisse, pour que les totaux tombent toujours juste.
`,
  faq: [
    {
      question: 'Comment calculer la TVA à 18 % ?',
      answer:
        'TVA = prix HT × 0,18. Si vous partez d’un prix TTC : TVA = prix TTC × 18 ÷ 118. Par exemple, 11 800 F TTC contiennent 1 800 F de TVA.',
    },
    {
      question: 'Comment passer d’un prix TTC à un prix HT ?',
      answer:
        'Divisez le prix TTC par 1,18. Par exemple, 5 900 F TTC ÷ 1,18 = 5 000 F HT.',
    },
    {
      question: 'Quel est le taux de TVA au Sénégal ?',
      answer:
        'Le taux normal est de 18 %. Certains produits et services sont exonérés ou soumis à un autre taux, et certaines petites entreprises ne facturent pas de TVA : vérifiez votre situation avec votre comptable.',
    },
  ],
  related: [
    'mentions-obligatoires-facture-senegal',
    'faire-un-devis',
    'calculer-marge-benefice',
  ],
};
