import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'gestion-entreprise-services',
  title: 'Gérer une entreprise de services sans stock : le guide simple',
  seoTitle: 'Gérer une entreprise de services : devis, factures',
  description:
    'Prestataire, consultant, artisan, nettoyage : comment suivre devis, factures, paiements et dépenses quand on vend son temps et non des marchandises.',
  category: 'metiers',
  keywords: [
    'gestion entreprise de services',
    'logiciel de facturation prestataire',
    'application prestataire de services',
    'gestion petite entreprise de services',
    'facturer une prestation',
    'facturation artisan Sénégal',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Une entreprise de services vend du temps et un savoir-faire : son risque n’est pas le stock, mais les impayés et le temps non facturé.',
    'Son circuit tient en trois étapes : devis accepté, facture émise, paiement suivi.',
    'Vendez à la prestation, au forfait, à l’heure ou au jour, selon ce que le client comprend le mieux.',
    'Suivez le bénéfice réel : recettes moins dépenses, y compris votre propre rémunération.',
  ],
  body: `
Pour bien **gérer une entreprise de services**, il faut suivre un circuit simple : un devis accepté, une facture émise, un paiement encaissé. Un plombier, une société de nettoyage, un consultant, un photographe ou une agence ne gèrent pas de stock. Leur argent se perd ailleurs : du travail fait et jamais facturé, des factures payées en retard, et des dépenses oubliées.

## Ce qui change quand on vend du service

| | Commerce | Service |
| --- | --- | --- |
| Ce qui est vendu | Des marchandises | Du temps, un savoir-faire |
| Risque principal | Le stock | Les impayés et le temps non facturé |
| Document clé | Le ticket | Le devis et la facture |
| Coût principal | L’achat des marchandises | Les salaires et le temps |

La conséquence est simple : l’outil d’une entreprise de services doit être centré sur les **documents et les paiements**, pas sur l’inventaire.

## Choisir comment vendre : prestation, forfait, heure ou jour

- **À la prestation** : un prix pour un travail défini, comme une coupe, une visite technique ou un nettoyage de bureau.
- **Au forfait** : un prix global pour un projet, qui vous protège si vous êtes efficace et vous expose si le projet s’étend.
- **À l’heure ou au jour** : adapté au conseil ou à la maintenance, à condition de noter les heures réelles.

Pour un forfait, écrivez précisément ce qui est inclus et ce qui ne l’est pas. La plupart des pertes viennent d’un travail en plus, fait gratuitement parce que rien n’était écrit.

## Le circuit : du devis au paiement

1. **Devis** : ce qui sera fait, le prix, la durée de validité. Voir [comment faire un devis](/blog/faire-un-devis).
2. **Accord du client** : gardez une trace, même un message WhatsApp.
3. **Acompte** pour un travail long : il couvre vos premiers frais.
4. **Facture** à la livraison ou par étapes, avec ses [mentions obligatoires](/blog/mentions-obligatoires-facture-senegal).
5. **Relance** à l’échéance, sans attendre. Voir [comment relancer une facture impayée](/blog/relancer-facture-impayee).

## Savoir si votre activité gagne vraiment de l’argent

Dans le service, on confond facilement l’argent reçu et le bénéfice. Une facture de 500 000 F ne rapporte pas 500 000 F : retirez le transport, le matériel, les salaires, et votre propre temps. Calculez combien vous devez facturer chaque mois pour couvrir vos charges, avec la méthode du [seuil de rentabilité](/blog/seuil-de-rentabilite). Séparez aussi l’argent de l’entreprise de votre poche, voir [séparer son argent personnel](/blog/separer-argent-perso-boutique).

## Les erreurs fréquentes des prestataires

- Commencer sans devis parce que « on se connaît ».
- Facturer en fin de mois tout ce qui a été fait, en oubliant la moitié.
- Laisser passer les échéances par peur de déranger.
- Ne pas compter les déplacements et les petites fournitures.

## Organiser son mois en quelques habitudes

Réservez un moment fixe chaque semaine pour votre administration : envoyer les devis en attente, facturer ce qui est terminé, vérifier ce qui a été payé et noter les dépenses. Trente minutes régulières valent mieux qu’une journée perdue en fin de mois, quand les détails ont déjà été oubliés.

## Dans Nagaw Business

Choisissez « Des services » à la création de votre boutique ou dans Paramètres : l’application cache ce qui concerne le stock et les fournisseurs. Vos prestations se mettent au catalogue, à la prestation, au forfait, à l’heure ou au jour. Vous faites un devis, vous le transformez en facture sans ressaisie, vous enregistrez les paiements en plusieurs fois, et le Résumé montre ce qui est facturé, encaissé et en retard. Vos factures portent votre logo, votre couleur, votre cachet et votre signature. Les heures passées ne sont pas chronométrées : notez-les sur le devis ou la facture.
`,
  faq: [
    {
      question: 'Quel logiciel pour une entreprise de services ?',
      answer:
        'Il faut surtout des devis, des factures numérotées, un suivi des paiements et des dépenses. Un outil de boutique convient s’il permet de vendre des services sans stock.',
    },
    {
      question: 'Comment facturer une prestation de service ?',
      answer:
        'Décrivez la prestation, indiquez la quantité ou le forfait, le prix, la date et vos informations d’entreprise, puis attribuez un numéro unique à la facture.',
    },
    {
      question: 'Faut-il demander un acompte pour une prestation ?',
      answer:
        'C’est conseillé pour un travail long ou avec des frais à avancer. Écrivez le montant dans le devis, puis indiquez-le comme payé sur la facture.',
    },
    {
      question: 'Forfait ou tarif horaire : que choisir ?',
      answer:
        'Le forfait convient à un travail bien défini, le tarif horaire à un travail dont la durée est incertaine. Dans les deux cas, écrivez ce qui est inclus.',
    },
  ],
  related: [
    'faire-un-devis',
    'relancer-facture-impayee',
    'seuil-de-rentabilite',
    'faire-facture-telephone',
  ],
};
