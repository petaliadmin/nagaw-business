import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'gestion-atelier-couture',
  title: 'Gérer un atelier de couture : commandes, avances et factures',
  seoTitle: 'Gestion atelier de couture : commandes et avances',
  description:
    'Couturier ou tailleur : comment suivre les commandes, les avances, le reste à payer et le tissu, pour ne plus perdre d’argent à la période des fêtes.',
  category: 'metiers',
  keywords: [
    'gestion atelier de couture',
    'application pour couturier',
    'logiciel tailleur',
    'suivi commandes couture',
    'avance client couture',
    'devis couture',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Un atelier vend du travail à venir : il doit suivre ce qui est promis, l’avance reçue et ce qui reste à payer.',
    'Écrivez chaque commande dans un devis clair : modèle, prix, date, avance.',
    'À la livraison, une facture montre ce qui a été payé et ce qui reste.',
    'Avant les fêtes, limitez les commandes à ce que l’atelier peut vraiment livrer.',
  ],
  body: `
Pour bien **gérer un atelier de couture**, il faut suivre chaque commande depuis la prise de mesures jusqu’au dernier paiement : ce qui est promis, pour quand, à quel prix, et combien le client a déjà versé. Un tailleur ne vend pas un article posé sur une étagère, il vend un travail à venir. L’erreur la plus coûteuse est d’oublier ce qu’on a reçu ou promis.

## Ce qui coûte le plus cher à un atelier

Trois problèmes reviennent à chaque période de fête, Korité, Tabaski, Noël ou mariages :

- **Des avances mal notées** : le client affirme avoir versé plus que ce que vous retrouvez.
- **Trop de commandes acceptées** : les retards abîment la réputation de l’atelier.
- **Des tenues finies jamais retirées** : le travail est fait, mais le reste n’est jamais payé.

Tout cela vient du même manque : une trace écrite, consultable et partagée avec le client.

## Écrire chaque commande dans un devis

Avant de couper, faites un [devis](/blog/faire-un-devis) simple, même pour un client habitué. Il doit contenir :

1. Le modèle et le tissu, fourni par le client ou par l’atelier.
2. Le prix de la main-d’œuvre, séparé du prix du tissu.
3. La date de livraison promise.
4. Le montant de l’avance demandée.

Envoyez ce devis sur WhatsApp. Le client ne peut plus dire que le prix était différent, et vous ne pouvez plus l’oublier. C’est aussi une protection pour lui.

## Demander une avance, et la noter

Une avance couvre le tissu et bloque la place dans l’atelier. Beaucoup de couturiers demandent une part du prix à la commande, par exemple la moitié, et le reste au retrait. Fixez votre règle et appliquez-la à tout le monde : c’est plus facile qu’une discussion à chaque client.

| Commande d’exemple | Montant |
| --- | --- |
| Prix total du boubou | 30 000 F |
| Avance à la commande | 15 000 F |
| Reste à payer au retrait | 15 000 F |

Ne livrez pas sans que le reste soit réglé ou clairement noté en crédit. Pour tenir vos règles, voir [comment gérer le crédit client](/blog/credit-clients-boutique).

## Calculer le vrai prix d’une tenue

Le prix doit couvrir plus que le fil et le tissu : le temps du tailleur, celui des apprentis, l’électricité, le loyer et l’entretien des machines. Comptez les heures réelles sur quelques modèles : vous découvrirez souvent qu’un modèle compliqué rapporte moins qu’un modèle simple. La méthode est détaillée dans [comment fixer son prix de vente](/blog/fixer-prix-de-vente).

## Préparer la période des fêtes

Les semaines avant la fête font une grande part du chiffre de l’année, et aussi la plupart des retards. Quelques règles simples aident :

- Fixez une date limite de commande, et tenez-la.
- Comptez ce que l’atelier produit vraiment par semaine, sans imaginer le meilleur cas.
- Achetez le tissu et le fil à l’avance, en vous appuyant sur les avances reçues.
- Gardez de l’argent pour les charges qui arrivent après la fête, souvent des semaines creuses. Voir [le fonds de roulement](/blog/fonds-de-roulement-boutique).

## Dans Nagaw Business

Indiquez que votre atelier vend des services, et ajoutez vos modèles au catalogue, au forfait ou à la prestation. Vous préparez un devis numéroté, envoyé au client en PDF avec votre logo, puis vous le transformez en facture sans rien ressaisir quand il est accepté. Une facture peut être payée en plusieurs fois : l’application montre ce qui a été payé et le reste à payer, et le Résumé indique les factures en retard. Le suivi de l’avancement de la couture et les mesures des clients ne sont pas gérés : gardez-les dans votre carnet.

Pour vos documents, voir aussi [comment faire une facture sur téléphone](/blog/faire-facture-telephone).
`,
  faq: [
    {
      question: 'Comment gérer les avances dans un atelier de couture ?',
      answer:
        'Notez chaque avance dès sa réception, sur un devis ou une facture au nom du client, avec le reste à payer. Le client reçoit la même information par WhatsApp.',
    },
    {
      question: 'Quel pourcentage d’avance demander à un client de couture ?',
      answer:
        'Il n’y a pas de règle unique. Beaucoup d’ateliers demandent une part suffisante pour couvrir le tissu et la fourniture, souvent autour de la moitié, et l’appliquent à tous.',
    },
    {
      question: 'Que faire d’une tenue jamais retirée ?',
      answer:
        'Prévoyez la règle dès le devis, avec un délai de retrait. L’avance couvre alors une partie du travail déjà fait, et un message de rappel suffit souvent.',
    },
    {
      question: 'Faut-il une facture pour un client particulier ?',
      answer:
        'Un ticket suffit souvent, mais une facture rassure un client pour une grosse commande et devient nécessaire pour une entreprise ou une administration.',
    },
  ],
  related: [
    'gestion-entreprise-services',
    'faire-un-devis',
    'fixer-prix-de-vente',
    'relancer-facture-impayee',
  ],
};
