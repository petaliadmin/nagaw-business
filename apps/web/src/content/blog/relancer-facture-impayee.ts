import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'relancer-facture-impayee',
  title: 'Relancer une facture impayée sans perdre son client',
  seoTitle: 'Relancer une facture impayée : modèles de messages',
  description:
    'Quand relancer, que dire, et comment rester poli mais ferme : le calendrier de relance et trois modèles de messages WhatsApp prêts à copier.',
  category: 'factures',
  keywords: [
    'relancer une facture impayée',
    'message de relance facture',
    'relance client impayé',
    'modèle relance paiement WhatsApp',
    'recouvrement facture',
    'client qui ne paie pas',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Relancez tôt : plus une facture vieillit, moins elle a de chances d’être payée.',
    'Suivez un calendrier fixe : un rappel avant l’échéance, puis des relances de plus en plus fermes.',
    'Restez factuel : numéro de facture, montant, date. Pas de reproche.',
    'Avant une relance ferme, vérifiez que votre facture est juste et que le client l’a bien reçue.',
  ],
  body: `
Pour **relancer une facture impayée**, envoyez un message court et factuel juste après l’échéance, avec le numéro de la facture, le montant et une date de paiement à confirmer, puis suivez un calendrier fixe. La plupart des retards ne viennent pas d’une mauvaise volonté, mais d’un oubli ou d’une facture perdue. Une relance polie et rapide suffit souvent. Ce qui coûte cher, c’est d’attendre par gêne.

## Pourquoi il faut relancer tôt

Une facture de 90 jours se paie bien moins facilement qu’une facture de 10 jours. Le client a d’autres urgences, le responsable a changé, et la facture a été oubliée. Pendant ce temps, c’est vous qui financez son activité avec votre [trésorerie](/blog/tresorerie-petit-commerce).

Une relance n’est pas une agression : c’est un acte normal de gestion. Les entreprises sérieuses y sont habituées.

## Le calendrier de relance

| Moment | Action | Ton |
| --- | --- | --- |
| 3 jours avant l’échéance | Petit rappel | Amical |
| 3 jours après | Première relance | Courtois |
| 15 jours après | Appel téléphonique | Direct |
| 30 jours après | Relance écrite ferme | Ferme |
| 45 jours et plus | Mise en demeure, pause des livraisons | Formel |

Adaptez-le à votre client, mais gardez le principe : **des dates fixes, pas des décisions d’humeur.**

## Trois messages prêts à envoyer

**Rappel avant échéance :**

> Bonjour M. Diop, petit rappel : votre facture F-0042 de 94 400 F arrive à échéance le 15. Merci de nous dire si tout est bon de votre côté. Bonne journée.

**Première relance :**

> Bonjour M. Diop, sauf erreur de notre part, la facture F-0042 de 94 400 F, échue le 15, n’est pas encore réglée. Pouvez-vous nous indiquer la date de paiement prévue ? Je vous la renvoie en pièce jointe.

**Relance ferme :**

> Bonjour M. Diop, malgré nos messages, la facture F-0042 de 94 400 F reste impayée depuis 30 jours. Merci de la régler avant le 30. Sans paiement à cette date, nous devrons suspendre les prochaines livraisons.

## Vérifier avant de relancer

Avant d’envoyer un message ferme, contrôlez trois points :

1. **La facture est juste** : montant, nom du client, [mentions](/blog/mentions-obligatoires-facture-senegal). Une erreur donne au client une raison de ne pas payer.
2. **Le paiement n’est pas déjà arrivé** : regardez votre Mobile Money et votre banque. Voir [suivre Wave et Orange Money](/blog/suivre-wave-orange-money).
3. **Vous parlez à la bonne personne** : dans une entreprise, c’est souvent le service comptable.

## Proposer une solution

Si le client a un vrai problème de trésorerie, proposez un paiement en plusieurs fois, avec des dates écrites. Il vaut mieux recevoir l’argent en trois fois que jamais. Pour éviter de revivre la situation, demandez un acompte aux prochaines commandes et fixez un plafond de [crédit client](/blog/credit-clients-boutique).

## Quand passer à autre chose

Après plusieurs relances sans réponse, envoyez une mise en demeure écrite et demandez conseil à un professionnel du droit, surtout si le montant est important. Pour une petite somme, calculez si la démarche vaut son coût. Dans tous les cas, cessez de livrer à crédit ce client.

## Dans Nagaw Business

Le Résumé de Factures / Devis montre le reste à encaisser, et signale les factures en retard avec leur montant. Une facture peut être partagée en PDF depuis le téléphone pour être renvoyée au client, et chaque paiement partiel est enregistré avec le reste à payer. Les relances ne sont pas envoyées automatiquement : c’est vous qui choisissez le moment et le ton.
`,
  faq: [
    {
      question: 'Quand relancer une facture impayée ?',
      answer:
        'Dès les premiers jours après l’échéance. Un rappel quelques jours avant la date limite évite déjà une bonne partie des retards.',
    },
    {
      question: 'Comment relancer un client par WhatsApp ?',
      answer:
        'Envoyez un message court avec le numéro de facture, le montant et la date d’échéance, joignez le PDF et demandez une date de paiement.',
    },
    {
      question: 'Que faire si le client ne répond pas ?',
      answer:
        'Appelez-le, écrivez au service comptable, puis envoyez une relance ferme avec une date limite. Si rien ne bouge, demandez conseil et suspendez les livraisons à crédit.',
    },
    {
      question: 'Peut-on refuser de livrer un client qui ne paie pas ?',
      answer:
        'Vous pouvez décider de ne plus vendre à crédit à ce client. Dites-le clairement, par écrit, et proposez un paiement à la commande.',
    },
  ],
  related: [
    'credit-clients-boutique',
    'tresorerie-petit-commerce',
    'gestion-entreprise-services',
    'facture-avoir',
  ],
};
