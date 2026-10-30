import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'impots-commercant-senegal',
  title: 'Impôts du commerçant au Sénégal : ce qu’il faut préparer',
  seoTitle: 'Impôts du commerçant au Sénégal : CGU, TVA, documents',
  description:
    'CGU, TVA, patente : comprendre les grandes notions, et surtout quels chiffres et documents garder pour préparer vos impôts sereinement au Sénégal.',
  category: 'factures',
  keywords: [
    'impôts commerçant Sénégal',
    'contribution globale unique',
    'CGU Sénégal',
    'TVA Sénégal',
    'impôts petit commerce',
    'DGID déclaration commerçant',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Votre régime dépend surtout de votre activité et de votre chiffre d’affaires : il se confirme auprès du centre des impôts.',
    'La Contribution globale unique est le régime simplifié des petites activités ; d’autres entreprises relèvent de la TVA et du régime réel.',
    'Les seuils et les taux changent avec les lois de finances : ne vous fiez pas à un chiffre lu sur internet.',
    'Votre vraie tâche est de garder des ventes, dépenses et factures propres toute l’année.',
  ],
  body: `
Les **impôts d’un commerçant au Sénégal** dépendent surtout de sa forme juridique, de son activité et de son chiffre d’affaires. Les petites activités peuvent relever de la **Contribution globale unique** (CGU), un régime simplifié, tandis que les entreprises plus importantes relèvent du régime réel, avec notamment la **TVA**. Cet article n’est pas un conseil fiscal : il explique les notions de base et ce que vous devez préparer. Les seuils et les taux évoluent : votre centre des services fiscaux ou un comptable vous donnera ceux qui s’appliquent.

## Les grandes notions à connaître

| Notion | Ce que c’est |
| --- | --- |
| DGID | Direction générale des impôts et des domaines, l’administration fiscale |
| NINEA | Votre numéro d’identification, demandé dans vos démarches |
| CGU | Contribution globale unique, un impôt simplifié pour de petites activités |
| TVA | Taxe de 18 % facturée au client et reversée, pour ceux qui y sont soumis |
| Régime réel | Déclarations plus complètes, fondées sur une comptabilité |

Le taux normal de TVA au Sénégal est de 18 %. Pour le calcul, voir [la TVA à 18 %](/blog/calcul-tva-18-ht-ttc).

## Pourquoi nous ne donnons pas de seuils ici

On trouve sur internet beaucoup de chiffres sur les seuils et les taux de la CGU, et ils se contredisent. Ils varient aussi entre commerce et services, et les lois de finances peuvent les modifier chaque année. Un mauvais chiffre peut vous coûter cher.

Pour connaître votre situation, adressez-vous au **centre des services fiscaux** de votre zone, consultez le site de la DGID, ou demandez à un comptable ou à un centre de gestion agréé. Posez-leur ces questions :

1. Quel est mon régime, compte tenu de mon activité et de mon chiffre d’affaires ?
2. Suis-je soumis à la TVA ?
3. Quelles sont mes échéances de l’année ?
4. Quels documents dois-je conserver, et combien de temps ?

## Ce que vous devez préparer toute l’année

Quel que soit votre régime, le travail est le même : savoir ce que vous avez vendu, dépensé et encaissé.

- **Le chiffre d’affaires** par mois et par an : le premier chiffre qu’on vous demandera.
- **Les factures de vos ventes**, numérotées, avec leurs [mentions obligatoires](/blog/mentions-obligatoires-facture-senegal).
- **Les factures d’achat et les reçus** de vos dépenses : gardez-les, en papier ou en photo.
- **Les relevés** de banque et de Mobile Money. Voir [suivre Wave et Orange Money](/blog/suivre-wave-orange-money).
- **Un état du stock** en fin d’année. Voir [comment faire un inventaire](/blog/faire-un-inventaire).

## La comptabilité du petit commerçant

Les petites entités peuvent tenir un système simplifié dans le cadre du SYSCOHADA, avec un journal des recettes et des dépenses. Voir [le SYSCOHADA expliqué au commerçant](/blog/syscohada-commercant). Un journal tenu chaque jour vaut mieux que trois mois de retard rattrapés dans l’urgence.

## Les bonnes habitudes

- Séparez [votre argent personnel](/blog/separer-argent-perso-boutique) de celui de l’activité.
- Mettez de côté chaque mois de quoi payer vos impôts.
- Notez vos échéances dans votre téléphone.
- Répondez aux courriers de l’administration sans attendre.
- Demandez conseil avant une grosse décision, comme un changement de forme juridique.

## Dans Nagaw Business

Nagaw Business tient un journal des recettes et des dépenses et produit un état de fin d’exercice, exportables en CSV pour votre comptable, avec les ventes réparties entre marchandises et services. Les factures sont numérotées sans trou et les dépenses peuvent garder la photo de leur reçu. L’application ne fait pas vos déclarations et ne calcule pas votre impôt : elle prépare les chiffres propres dont vous aurez besoin.
`,
  faq: [
    {
      question: 'Qu’est-ce que la CGU au Sénégal ?',
      answer:
        'La Contribution globale unique est un impôt simplifié destiné à de petites activités. Les conditions et le montant se vérifient auprès de la DGID ou d’un comptable.',
    },
    {
      question: 'Quel est le taux de TVA au Sénégal ?',
      answer:
        'Le taux normal est de 18 %. Tout commerçant n’est pas forcément soumis à la TVA : cela dépend de son régime, à confirmer auprès des impôts.',
    },
    {
      question: 'Quels documents garder pour les impôts ?',
      answer:
        'Vos factures de vente, vos factures d’achat et reçus, vos relevés de banque et de Mobile Money, et un état du stock en fin d’année.',
    },
    {
      question: 'Où se renseigner sur ses impôts au Sénégal ?',
      answer:
        'Auprès du centre des services fiscaux de votre zone, sur le site de la DGID, ou chez un comptable ou un centre de gestion agréé.',
    },
  ],
  related: [
    'syscohada-commercant',
    'calcul-tva-18-ht-ttc',
    'mentions-obligatoires-facture-senegal',
    'ouvrir-boutique-senegal',
  ],
};
