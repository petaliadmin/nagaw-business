import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'tresorerie-petit-commerce',
  title:
    'Trésorerie d’un petit commerce : savoir où est son argent, chaque jour',
  seoTitle: 'Gestion de trésorerie d’un petit commerce : guide simple',
  description:
    'Pourquoi une boutique qui vend bien peut manquer d’argent, et comment suivre sa trésorerie : caisses, créances, stock, dépenses et prélèvements du gérant.',
  category: 'argent',
  keywords: [
    'gestion de trésorerie',
    'trésorerie petit commerce',
    'manque de trésorerie boutique',
    'suivi des dépenses commerce',
    'plan de trésorerie simple',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'La trésorerie, c’est l’argent disponible tout de suite, dans toutes les caisses de la boutique.',
    'Une boutique peut faire des bénéfices et manquer d’argent : l’argent est bloqué dans le stock ou chez les clients à crédit.',
    'Suivez quatre chiffres : l’argent des caisses, les créances, la valeur du stock et les dépenses à venir.',
    'Séparez l’argent de la boutique et l’argent du foyer, et notez chaque prélèvement.',
  ],
  body: `
La **trésorerie** d’une boutique, c’est l’argent dont elle dispose tout de suite : les espèces du tiroir, le solde Wave, Orange Money, Free Money et le compte en banque. Ce n’est pas la même chose que le bénéfice. Une boutique peut être rentable sur le papier et ne pas avoir de quoi payer son fournisseur demain.

## Bénéfice et trésorerie : pourquoi ce n’est pas pareil

Imaginons une boutique qui gagne bien sa vie sur le mois. Pourtant, la caisse est vide. Où est passé l’argent ? En général, à trois endroits :

1. **Dans le stock** : vous avez acheté plus de marchandise que vous n’en avez vendu.
2. **Chez les clients** : une partie des ventes a été faite à crédit et n’est pas encore remboursée.
3. **Dans le foyer** : de l’argent a été pris dans la caisse pour des dépenses personnelles, sans être noté.

C’est pour cela qu’il faut suivre la trésorerie à part. Pour le calcul du bénéfice, voir [calculer sa marge et son bénéfice](/blog/calculer-marge-benefice).

## Les quatre chiffres à suivre

| Chiffre | Ce qu’il contient | Question qu’il pose |
| --- | --- | --- |
| Argent des caisses | Espèces, Mobile Money, banque | Combien puis-je dépenser aujourd’hui ? |
| Créances | Crédit des clients, factures à encaisser | Combien doit revenir ? |
| Valeur du stock | Stock × prix d’achat | Combien ai-je immobilisé en marchandise ? |
| Dépenses à venir | Loyer, fournisseur, salaires | Combien dois-je payer bientôt ? |

Si les dépenses à venir dépassent l’argent des caisses plus les créances qui vont vraiment rentrer, vous allez manquer d’argent. Mieux vaut le savoir deux semaines à l’avance que le jour du loyer.

## Noter toutes les dépenses

Une dépense non notée fausse à la fois le bénéfice et la clôture de caisse. Notez chaque sortie d’argent avec :

- ce que c’est (transport, électricité, sacs, crédit téléphone…) ;
- le montant ;
- la **caisse** d’où sort l’argent ;
- la date ;
- si possible, une **photo du reçu**.

Classez les dépenses dans quelques catégories fixes : vous verrez vite où part l’argent. Le comptable vous remerciera : voir [le SYSCOHADA expliqué aux commerçants](/blog/syscohada-commercant).

## Se payer sans vider la boutique

Le commerçant se paie souvent en prenant dans la caisse au jour le jour. Le problème n’est pas de se payer, c’est de ne pas savoir combien. Deux solutions simples :

- fixer un **montant par semaine ou par mois** et le retirer en une fois ;
- noter chaque prélèvement, comme une sortie de caisse.

## Un plan de trésorerie sur une feuille

Pas besoin de tableur compliqué. Sur une feuille, pour les quatre semaines à venir :

| Semaine | Entrées prévues | Sorties prévues | Solde prévu |
| --- | --- | --- | --- |
| Semaine 1 | Ventes habituelles + remboursements attendus | Fournisseur, transport | … |
| Semaine 2 | Ventes habituelles | Électricité | … |
| Semaine 3 | Ventes habituelles | Fournisseur | … |
| Semaine 4 | Ventes + paie des clients à crédit | Loyer, salaires | … |

Partez de l’argent des caisses d’aujourd’hui et ajoutez semaine après semaine. Une semaine négative vous dit qu’il faut décaler un achat, relancer les clients à crédit ou réduire une commande.

## Améliorer sa trésorerie

- **Relancer les crédits** dès l’échéance : voir [gérer le crédit des clients](/blog/credit-clients-boutique).
- **Acheter moins, plus souvent**, surtout les produits qui tournent lentement.
- **Écouler le stock dormant** : voir [quoi racheter, quoi arrêter](/blog/reapprovisionnement-stock-dormant).
- Négocier un **délai de paiement** avec les fournisseurs fidèles.
- Garder une **réserve** pour les imprévus.

## La trésorerie dans Nagaw Business

L’écran **Trésorerie** de Nagaw Business montre le total de l’argent de la boutique, les entrées et sorties du jour, le solde de chaque caisse et les **créances** (crédit des clients et factures à encaisser). Les soldes sont calculés à partir des ventes, des dépenses et des déplacements d’argent, jamais saisis à la main. Les dépenses se saisissent avec leur catégorie, leur caisse et la photo du reçu. Les achats de marchandise se notent en dépense « Achat de marchandises ».
`,
  faq: [
    {
      question: 'Qu’est-ce que la trésorerie d’une boutique ?',
      answer:
        'C’est l’argent disponible tout de suite : espèces, Mobile Money et banque. Elle est différente du bénéfice, car l’argent gagné peut être bloqué dans le stock ou chez les clients à crédit.',
    },
    {
      question:
        'Pourquoi ma boutique manque d’argent alors qu’elle vend bien ?',
      answer:
        'Le plus souvent, l’argent est immobilisé dans un stock trop gros, prêté aux clients à crédit, ou pris dans la caisse sans être noté.',
    },
    {
      question: 'Comment faire un plan de trésorerie simple ?',
      answer:
        'Partez de l’argent des caisses aujourd’hui, puis pour chaque semaine à venir ajoutez les entrées prévues et retirez les sorties prévues. Une semaine négative annonce un manque d’argent.',
    },
  ],
  related: [
    'calculer-marge-benefice',
    'credit-clients-boutique',
    'suivre-wave-orange-money',
  ],
};
