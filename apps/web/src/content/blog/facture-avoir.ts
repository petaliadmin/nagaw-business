import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'facture-avoir',
  title: 'Facture d’avoir : comment corriger une facture déjà émise',
  seoTitle: 'Facture d’avoir : quand et comment la faire',
  description:
    'Erreur de prix, retour de marchandise, facture annulée : pourquoi on ne supprime jamais une facture émise, et comment faire un avoir propre, avec un exemple.',
  category: 'factures',
  keywords: [
    'facture d’avoir',
    'avoir sur facture',
    'annuler une facture',
    'corriger une facture émise',
    'note de crédit',
    'modèle avoir facture',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Une facture émise ne se modifie pas et ne se supprime pas : on la corrige avec un avoir.',
    'Un avoir est un document numéroté qui annule tout ou partie d’une facture et cite son numéro.',
    'On en fait un après une erreur, un retour de marchandise, une remise accordée après coup ou une annulation.',
    'Le numéro de la facture d’origine reste utilisé : la suite des numéros garde sa logique.',
  ],
  body: `
Une **facture d’avoir** est le document qui corrige une facture déjà émise, en annulant tout ou partie de son montant. Dès qu’une facture a un numéro, elle ne se modifie plus et ne se supprime plus : on en fait une autre, en sens inverse. C’est la règle qui garantit qu’un contrôleur ou un comptable peut suivre toute l’histoire d’une vente.

## Pourquoi on ne supprime jamais une facture

Une facture numérotée fait partie d’une suite sans trou : F-0041, F-0042, F-0043. Si la 42 disparaît, tout le monde se demande pourquoi. Effacer une facture, même par erreur, c’est créer un soupçon, et perdre la preuve de ce qui s’est passé.

L’avoir fait le contraire : il laisse la facture à sa place, et ajoute un second document qui explique la correction.

## Quand faire un avoir

| Situation | Type d’avoir |
| --- | --- |
| Erreur de prix ou de quantité | Partiel ou total, puis nouvelle facture |
| Client qui rend la marchandise | Partiel ou total |
| Remise accordée après la facture | Partiel |
| Vente annulée | Total |
| Facture adressée au mauvais client | Total, puis nouvelle facture |

Une simple faute sur un brouillon ne demande pas d’avoir : tant que la facture n’est pas émise, on la corrige librement.

## Ce que doit contenir un avoir

1. Le mot **« Avoir »** bien visible, avec son propre numéro.
2. La date du jour.
3. Vos informations et celles du client.
4. **Le numéro de la facture corrigée** : c’est la mention la plus importante.
5. Les articles concernés, le montant et les taxes.
6. Le motif de la correction.

Reprenez les [mentions obligatoires d’une facture](/blog/mentions-obligatoires-facture-senegal). Si la facture portait de la TVA, l’avoir la reprend aussi : voir [le calcul de la TVA à 18 %](/blog/calcul-tva-18-ht-ttc).

## Exemple d’un avoir partiel

Une facture F-0042 de 118 000 F TTC (100 000 F plus 18 000 F de TVA) comporte une erreur : le client a rendu pour 23 600 F de marchandises.

| Document | Hors taxe | TVA 18 % | TTC |
| --- | --- | --- | --- |
| Facture F-0042 | 100 000 F | 18 000 F | 118 000 F |
| Avoir A-0007 | -20 000 F | -3 600 F | -23 600 F |
| **Reste dû** | **80 000 F** | **14 400 F** | **94 400 F** |

Les chiffres sont un exemple. Le client ne doit plus que 94 400 F. S’il avait déjà tout payé, vous lui devez 23 600 F : rendez cet argent ou déduisez-le de sa prochaine commande, et notez-le.

## Les erreurs à éviter

- **Modifier la facture d’origine** dans un fichier Word et renvoyer le même numéro.
- **Faire un avoir sans citer la facture**, ce qui le rend incompréhensible un an plus tard.
- **Rendre de l’argent sans document**, ce qui crée un écart de caisse.
- **Oublier de remettre les articles en stock** après un retour. Voir [comment faire un inventaire](/blog/faire-un-inventaire).

Votre comptable reste la bonne personne pour les cas particuliers, notamment si l’exercice est déjà clos.

## Rembourser ou déduire ?

Après un avoir, deux choix s’offrent à vous si le client avait déjà payé : lui rendre l’argent, ou déduire le montant de sa prochaine commande. Dans les deux cas, écrivez le choix sur l’avoir et gardez une trace du remboursement dans votre caisse ou votre Mobile Money.

## Dans Nagaw Business

Une facture émise garde son numéro et ne se modifie plus. Pour l’annuler, vous indiquez le motif et Nagaw Business crée l’avoir numéroté qui cite la facture d’origine, tandis que le PDF affiche la mention d’annulation. L’annulation totale est celle que l’application gère : pour une correction partielle, annulez puis refaites une facture juste. Avant l’émission, un brouillon se modifie librement.
`,
  faq: [
    {
      question: 'Peut-on supprimer une facture ?',
      answer:
        'Non, une facture émise reste dans la suite des numéros. Pour la corriger ou l’annuler, on établit un avoir qui cite son numéro.',
    },
    {
      question: 'Quelle est la différence entre un avoir et un remboursement ?',
      answer:
        'L’avoir est le document qui réduit ce que le client doit. Le remboursement est le mouvement d’argent, qui peut suivre un avoir mais n’est pas obligatoire.',
    },
    {
      question: 'Un avoir doit-il être numéroté ?',
      answer:
        'Oui, il a sa propre numérotation, continue, et il cite le numéro de la facture qu’il corrige.',
    },
    {
      question: 'Faut-il un avoir pour une erreur sur un brouillon ?',
      answer:
        'Non. Tant que la facture n’est pas émise et n’a pas de numéro, elle se corrige directement.',
    },
  ],
  related: [
    'mentions-obligatoires-facture-senegal',
    'calcul-tva-18-ht-ttc',
    'faire-facture-telephone',
    'relancer-facture-impayee',
  ],
};
