import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'seuil-de-rentabilite',
  title: 'Seuil de rentabilité : combien vendre pour ne plus perdre',
  seoTitle: 'Seuil de rentabilité : calcul simple pour une boutique',
  description:
    'Combien vendre chaque mois pour couvrir vos charges ? Le calcul du seuil de rentabilité d’une boutique, expliqué simplement avec un exemple en F CFA.',
  category: 'argent',
  keywords: [
    'seuil de rentabilité',
    'calcul seuil de rentabilité',
    'point mort boutique',
    'charges fixes et variables',
    'chiffre d’affaires minimum',
    'rentabilité petit commerce',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Le seuil de rentabilité est le montant de ventes à partir duquel l’activité couvre toutes ses charges.',
    'La formule : charges fixes du mois divisées par le taux de marge.',
    'Une boutique avec 400 000 F de charges fixes et 25 % de marge doit vendre 1 600 000 F par mois, dans cet exemple.',
    'Pour le baisser : réduire les charges fixes, ou mieux vendre ce qui rapporte le plus.',
  ],
  body: `
Le **seuil de rentabilité** est le montant de ventes à partir duquel votre activité couvre toutes ses charges : en dessous, vous perdez de l’argent, au-dessus, vous en gagnez. La formule est simple : **charges fixes du mois ÷ taux de marge**. C’est le chiffre le plus utile pour un commerçant, parce qu’il donne un objectif clair : combien vendre par mois et par jour.

## Charges fixes et charges variables

Il faut d’abord séparer vos charges en deux familles.

| Charges fixes | Charges variables |
| --- | --- |
| Elles sont là même sans aucune vente | Elles dépendent des ventes |
| Loyer, salaires, électricité de base | Prix d’achat des marchandises |
| Forfait téléphone, gardien, abonnement | Sacs, commissions, transport par commande |

Le salaire du patron doit figurer dans les charges fixes. S’il n’y est pas, votre boutique peut sembler rentable alors que vous travaillez gratuitement.

## Le calcul en trois étapes

1. **Additionnez vos charges fixes du mois**, par exemple 400 000 F.
2. **Calculez votre taux de marge** : si vous achetez un article 750 F et le vendez 1 000 F, vous gardez 250 F sur 1 000 F, soit 25 %. Voir [comment calculer sa marge](/blog/calculer-marge-benefice).
3. **Divisez** : 400 000 F ÷ 25 % = **1 600 000 F de ventes par mois**.

Dans cet exemple, la boutique doit vendre 1 600 000 F par mois pour tomber à zéro : ni perte, ni bénéfice.

## Traduire le seuil en objectif du jour

Un chiffre mensuel reste abstrait. Divisez-le par vos jours d’ouverture : avec 26 jours par mois, 1 600 000 F font environ **61 500 F par jour**. Chaque soir, vous savez si la journée a rapporté ou coûté. C’est plus parlant que n’importe quel tableau.

| Charges fixes | Marge | Seuil par mois | Par jour (26 jours) |
| --- | --- | --- | --- |
| 200 000 F | 25 % | 800 000 F | 30 770 F |
| 400 000 F | 25 % | 1 600 000 F | 61 540 F |
| 400 000 F | 40 % | 1 000 000 F | 38 460 F |

Ces chiffres sont des exemples. La dernière ligne montre pourquoi la marge compte autant : avec 40 % au lieu de 25 %, l’objectif baisse de 600 000 F par mois.

## Pour une entreprise de services

Le calcul fonctionne aussi. Votre marge est ce qui reste après les frais directs : transport, fournitures, sous-traitance. Si vous vendez à l’heure, divisez ensuite le seuil par votre tarif : vous obtenez le nombre d’heures à facturer chaque mois. Voir [gérer une entreprise de services](/blog/gestion-entreprise-services).

## Comment baisser son seuil

- **Négocier les charges fixes** : un loyer ou un abonnement pèse tous les mois, même les mois creux.
- **Améliorer la marge** : mieux acheter, mieux [fixer ses prix](/blog/fixer-prix-de-vente), mettre en avant ce qui rapporte le plus.
- **Vendre davantage aux clients existants**, ce qui coûte moins cher qu’en trouver de nouveaux. Voir [fidéliser ses clients](/blog/fideliser-clients-boutique).

## Les erreurs fréquentes

- Oublier le salaire du patron ou les remboursements de prêt.
- Calculer une seule fois et ne jamais refaire le calcul, alors que les charges changent.
- Confondre le chiffre d’affaires et l’argent qui reste en caisse.

Atteindre le seuil ne suffit pas toujours : vous pouvez être rentable et manquer d’argent si vos clients paient tard. Voir [le fonds de roulement](/blog/fonds-de-roulement-boutique).

## Dans Nagaw Business

L’Accueil affiche le chiffre d’affaires, la marge brute, les dépenses et un bénéfice estimé pour la période choisie, comparés à la période d’avant. Vous y lisez le taux de marge réel de votre boutique et le total des dépenses, sans rien calculer. Le seuil lui-même n’est pas affiché : il se déduit de ces chiffres en quelques secondes.
`,
  faq: [
    {
      question: 'Comment calculer le seuil de rentabilité ?',
      answer:
        'Divisez vos charges fixes du mois par votre taux de marge. Avec 400 000 F de charges fixes et 25 % de marge, le seuil est de 1 600 000 F de ventes par mois.',
    },
    {
      question:
        'Quelle est la différence entre seuil de rentabilité et point mort ?',
      answer:
        'Le seuil est un montant de ventes. Le point mort est le moment de l’année ou du mois où ce montant est atteint.',
    },
    {
      question: 'Le salaire du patron compte-t-il dans le calcul ?',
      answer:
        'Oui. Sinon, le seuil est trop bas et vous pouvez croire la boutique rentable alors qu’elle ne vous paie pas.',
    },
    {
      question: 'À quelle fréquence le recalculer ?',
      answer:
        'Tous les trois à six mois, et à chaque changement important : loyer, salaire, nouveau local ou baisse de marge.',
    },
  ],
  related: [
    'calculer-marge-benefice',
    'fixer-prix-de-vente',
    'fonds-de-roulement-boutique',
    'tresorerie-petit-commerce',
  ],
};
