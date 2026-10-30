import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'gestion-salon-coiffure',
  title: 'Gérer un salon de coiffure : prestations, produits et caisse',
  seoTitle: 'Gestion salon de coiffure : caisse, tarifs et produits',
  description:
    'Salon de coiffure ou de beauté : comment suivre vos prestations, vos produits, l’argent de la caisse et le travail de chaque coiffeuse, sans cahier.',
  category: 'metiers',
  keywords: [
    'gestion salon de coiffure',
    'logiciel salon de coiffure',
    'application salon de beauté',
    'caisse salon de coiffure',
    'gérer un salon de coiffure Dakar',
    'tarifs salon de coiffure',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Un salon de coiffure vend deux choses : des prestations, sans stock, et des produits, dont il faut suivre ce qui reste.',
    'Mettez chaque prestation dans un catalogue avec son prix : tresse, coupe, défrisage, manucure. Le prix ne se discute plus de mémoire.',
    'Comptez les produits utilisés pendant les prestations comme une dépense, et séparez-les de ceux que vous revendez.',
    'Enregistrez chaque client au moment où il paie : c’est ce qui rend la caisse du soir exacte.',
  ],
  body: `
Pour bien **gérer un salon de coiffure**, il faut suivre trois choses chaque jour : les prestations faites, les produits vendus ou utilisés, et l’argent reçu en espèces ou en Mobile Money. Un salon ne ressemble pas à une boutique : l’essentiel de ce qu’il vend ne se compte pas sur une étagère. Un bon outil doit donc gérer les **services** autant que les produits.

## Pourquoi un salon perd de l’argent sans le voir

Dans beaucoup de salons, tout passe par la mémoire ou par un cahier. Trois fuites reviennent souvent :

- **Des prix qui changent selon la personne** : la même tresse est facturée différemment selon qui encaisse.
- **Des clientes servies mais pas notées** : le soir, la caisse ne correspond à rien de vérifiable.
- **Des mèches et des produits qui disparaissent** : personne ne sait combien de paquets ont été utilisés.

Le problème n’est pas l’honnêteté de l’équipe. C’est l’absence d’un endroit unique où tout est écrit.

## Faire la liste de vos prestations

Commencez par un catalogue simple, avec un prix pour chaque prestation. Voici un exemple, à adapter à votre salon :

| Prestation | Facturée à | Prix d’exemple |
| --- | --- | --- |
| Coupe homme | La prestation | 3 000 F |
| Tresses simples | La prestation | 10 000 F |
| Défrisage | La prestation | 7 000 F |
| Manucure | La prestation | 4 000 F |
| Pose de mèches | Le forfait | 15 000 F |

Quand le travail varie vraiment, gardez un prix de base et ajustez-le au moment de l’encaissement, en notant que le prix a été convenu avec la cliente. Le patron voit ainsi les écarts sans avoir à surveiller.

## Séparer les produits revendus et les produits utilisés

C’est le point qui embrouille le plus de salons. Il y a deux types de produits :

1. **Les produits revendus** à la clientèle (shampoing, huile, crème) : ce sont des produits avec un stock, un prix d’achat et un prix de vente.
2. **Les produits consommés** pendant la prestation (mèches fournies, défrisant, vernis) : ce ne sont pas des ventes. Notez leur achat comme une dépense.

Si vous mélangez les deux, votre marge n’a plus de sens. Pour la calculer proprement, voir [comment calculer sa marge et son bénéfice](/blog/calculer-marge-benefice).

## Fixer le prix d’une prestation

Le prix d’une tresse ne se résume pas aux mèches. Comptez le temps de travail, les produits utilisés et une part du loyer et de l’électricité. La méthode est détaillée dans [comment fixer son prix de vente](/blog/fixer-prix-de-vente). Une prestation très demandée mais mal calculée peut remplir le salon sans rien rapporter.

## Le crédit et les rendez-vous manqués

Beaucoup de clientes habituées paient plus tard. Notez chaque crédit au nom de la cliente, jamais sur un bout de papier. Pour fixer des règles sans gêner personne, lisez [comment gérer le crédit client](/blog/credit-clients-boutique). Pour les grosses prestations (mariage, baptême), demander une avance évite de bloquer une journée pour rien.

## Dans Nagaw Business

Nagaw Business permet d’indiquer que vous vendez des services, des produits ou les deux. Une prestation s’ajoute au catalogue sans stock, à la prestation, au forfait, à l’heure ou au jour. À la caisse, vous l’ajoutez comme un article, vous encaissez en espèces, en Mobile Money ou à crédit, et le ticket s’envoie sur WhatsApp. Chaque vendeuse ne voit que ses propres ventes, et le propriétaire voit l’ensemble du salon. L’application ne gère pas encore la prise de rendez-vous.

Pour commencer simplement, lisez [comment remplacer le cahier de ventes](/blog/remplacer-cahier-de-ventes).
`,
  faq: [
    {
      question: 'Quel logiciel utiliser pour gérer un salon de coiffure ?',
      answer:
        'Il faut un outil qui gère des prestations sans stock, les produits revendus, les paiements en espèces et en Mobile Money, et les ventes de chaque coiffeuse, idéalement depuis un téléphone.',
    },
    {
      question: 'Comment suivre les mèches utilisées dans un salon ?',
      answer:
        'Si elles sont comprises dans le prix de la prestation, notez leur achat comme une dépense. Si la cliente les achète au salon, créez-les comme un produit avec son stock.',
    },
    {
      question: 'Comment éviter les écarts de caisse dans un salon ?',
      answer:
        'Enregistrez chaque cliente au moment du paiement, avec un prix fixé à l’avance, puis comparez le soir l’argent compté à ce qui a été enregistré.',
    },
    {
      question: 'Faut-il donner un ticket à une cliente de salon ?',
      answer:
        'Oui, c’est une bonne habitude : le ticket envoyé sur WhatsApp sert de preuve à la cliente et oblige à enregistrer chaque prestation.',
    },
  ],
  related: [
    'gestion-entreprise-services',
    'fixer-prix-de-vente',
    'cloture-de-caisse',
    'gerer-vendeurs-boutique',
  ],
};
