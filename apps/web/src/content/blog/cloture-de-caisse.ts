import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'cloture-de-caisse',
  title: 'Clôture de caisse : compter son argent le soir et trouver les écarts',
  seoTitle: 'Clôture de caisse : méthode et écart de caisse expliqué',
  description:
    'Comment faire la clôture de caisse chaque soir, calculer ce qui devrait y avoir, comprendre un écart de caisse et éviter qu’il revienne. Méthode et exemple.',
  category: 'argent',
  keywords: [
    'clôture de caisse',
    'écart de caisse',
    'fond de caisse',
    'comptage de caisse',
    'arrêté de caisse',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Clôturer la caisse, c’est comparer l’argent compté à ce qui devrait y avoir d’après les ventes et les dépenses.',
    'Ce qui devrait y avoir = argent de départ + entrées en espèces − sorties en espèces.',
    'Un écart, même petit, doit être noté et expliqué ; un écart qui revient est un signal d’alarme.',
    'Clôturez chaque caisse séparément : espèces, Wave, Orange Money, banque.',
  ],
  body: `
La **clôture de caisse** est le moment, en fin de journée, où l’on compte l’argent réellement présent et où on le compare à ce qui devrait y être. La différence s’appelle l’**écart de caisse**. C’est le contrôle le plus simple et le plus efficace pour une boutique : il prend dix minutes et révèle aussitôt les erreurs de rendu de monnaie, les oublis de saisie et les vols.

## Le calcul de ce qui devrait y avoir

Pour la caisse en espèces :

> Ce qui devrait y avoir = argent de départ + ventes payées en espèces + remboursements de crédit en espèces − dépenses payées en espèces − argent retiré ou déplacé

L’**argent de départ** (on dit aussi **fond de caisse**) est la monnaie laissée dans le tiroir pour rendre la monnaie le matin. Il ne faut pas le compter comme une recette.

## Exemple de clôture

Voici un exemple fictif pour une journée :

| Ligne | Montant |
| --- | --- |
| Argent de départ | 10 000 F |
| Ventes en espèces | + 87 500 F |
| Remboursement d’un client en espèces | + 5 000 F |
| Dépense : transport de marchandise | − 3 000 F |
| Argent déposé sur le compte Wave | − 50 000 F |
| **Ce qui devrait y avoir** | **49 500 F** |
| Argent compté | 48 500 F |
| **Écart** | **− 1 000 F (il manque)** |

## Comment faire la clôture, étape par étape

1. **Arrêtez les ventes** ou notez l’heure de la clôture.
2. **Envoyez les ventes en attente** si vous utilisez une caisse hors ligne : sinon elles apparaîtront comme un écart le lendemain.
3. **Comptez** les billets par valeur, puis les pièces. Comptez deux fois si le montant est important.
4. **Comparez** au montant attendu.
5. **Notez l’écart**, même s’il est nul, avec la personne qui a compté.
6. **Rangez** l’argent : gardez le fond de caisse, mettez le reste en sécurité ou déposez-le.

## D’où vient un écart de caisse ?

| Écart | Causes fréquentes |
| --- | --- |
| Il manque de l’argent | Erreur de monnaie rendue, dépense payée mais non notée, vente notée en espèces mais payée par Wave, vol |
| Il y a trop d’argent | Vente encaissée mais non enregistrée, paiement Mobile Money noté en espèces, monnaie rendue en moins |

Un petit écart ponctuel arrive à tout le monde. Un écart **qui revient**, ou toujours avec le même vendeur, doit être regardé de près. Voir [éviter les vols et les pertes](/blog/eviter-vols-pertes-boutique).

## Clôturer aussi Wave, Orange Money et la banque

L’argent Mobile Money se contrôle de la même façon : le solde affiché par l’application de l’opérateur doit correspondre au solde calculé par votre logiciel. Un écart signale souvent un paiement enregistré avec le mauvais moyen de paiement. Notre article [suivre Wave et Orange Money](/blog/suivre-wave-orange-money) détaille ce contrôle.

## Les bonnes habitudes

- Clôturer **chaque jour**, à la même heure.
- Ne jamais mélanger l’argent personnel et l’argent de la boutique.
- Noter **toute** dépense payée avec l’argent de la caisse, même 500 F de crédit téléphonique.
- Faire compter le vendeur devant vous, au moins au début.
- Une journée clôturée ne se modifie plus : une correction se fait à part, avec une trace.

## La clôture dans Nagaw Business

Dans Nagaw Business, « Clôturer la caisse » affiche ce qui est entré, ce qui est sorti et **ce qui devrait y avoir**, calculé par le serveur à partir des ventes, des remboursements, des dépenses et des déplacements d’argent. Vous saisissez ce que vous avez compté et l’application dit tout de suite « Il manque… » ou « Le compte est juste ». Chaque caisse a sa clôture, et une journée clôturée est figée.

Pour voir l’argent de toute la boutique d’un coup d’œil, lisez [la trésorerie d’un petit commerce](/blog/tresorerie-petit-commerce).
`,
  faq: [
    {
      question: 'Comment faire une clôture de caisse ?',
      answer:
        'Calculez ce qui devrait y avoir (argent de départ + entrées en espèces − sorties en espèces), comptez l’argent réellement présent, comparez et notez l’écart avec la personne qui a compté.',
    },
    {
      question: 'Qu’est-ce qu’un écart de caisse ?',
      answer:
        'C’est la différence entre l’argent compté et l’argent attendu. Il vient d’une erreur de monnaie, d’une vente ou dépense non enregistrée, d’un mauvais moyen de paiement noté, ou d’un vol.',
    },
    {
      question: 'Qu’est-ce que le fond de caisse ?',
      answer:
        'C’est l’argent laissé dans le tiroir au début de la journée pour rendre la monnaie. Il ne compte pas dans les recettes du jour.',
    },
  ],
  related: [
    'suivre-wave-orange-money',
    'tresorerie-petit-commerce',
    'eviter-vols-pertes-boutique',
  ],
};
