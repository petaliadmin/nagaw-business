import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'facture-proforma-devis',
  title: 'Facture pro forma, devis ou facture : quelle différence ?',
  seoTitle: 'Facture pro forma : différence avec le devis et la facture',
  description:
    'À quoi sert une facture pro forma, en quoi elle diffère d’un devis et d’une facture, et lequel envoyer à votre client. Réponse simple avec un tableau.',
  category: 'factures',
  keywords: [
    'facture pro forma',
    'facture proforma définition',
    'différence devis et facture',
    'différence facture proforma et devis',
    'modèle facture proforma',
    'proforma Afrique',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Une facture pro forma est un document provisoire, envoyé avant la vente, qui annonce ce qui sera facturé. Elle ne remplace pas une vraie facture.',
    'Un devis est une proposition de prix qui, une fois acceptée, engage le vendeur et le client.',
    'Seule la facture définitive constate la vente et demande le paiement.',
    'Dans le doute, faites un devis clair : le mot pro forma sert surtout quand un client ou une administration le demande.',
  ],
  body: `
Une **facture pro forma** est un document provisoire, envoyé avant la vente, qui montre au client ce qu’il paierait. Elle ressemble à une facture, mais elle n’en est pas une : elle ne constate aucune vente et ne se comptabilise pas. Un devis propose un prix, une facture constate une vente, et la pro forma sert entre les deux, le plus souvent pour obtenir un accord ou un financement.

## Les trois documents en un coup d’œil

| | Devis | Facture pro forma | Facture |
| --- | --- | --- | --- |
| Quand | Avant la vente | Avant la vente | Après la vente |
| But | Proposer un prix | Annoncer une facture à venir | Constater la vente, demander le paiement |
| Numérotation légale | Propre aux devis | Non | Oui, sans trou |
| Comptabilisée | Non | Non | Oui |
| Modifiable | Tant qu’elle n’est pas acceptée | Oui | Non, on passe par un [avoir](/blog/facture-avoir) |

## À quoi sert une facture pro forma

On vous en demandera surtout dans quatre cas :

- **Un achat d’une entreprise ou d’une administration**, qui a besoin d’un document pour lancer sa commande interne.
- **Une demande de financement** auprès d’une banque, d’une microfinance ou d’un programme d’appui.
- **Une importation**, pour la banque ou les formalités.
- **Un client qui compare**, ou qui doit faire valider une dépense par sa hiérarchie.

Dans ces situations, le mot « pro forma » rassure celui qui reçoit le document, car c’est celui que son service connaît.

## Ce qu’il faut y écrire

Reprenez ce qui figurera sur la facture finale, en ajoutant clairement la mention **« Facture pro forma »** :

1. Vos informations : nom, adresse, téléphone, identifiants d’entreprise.
2. Le nom du client et la date.
3. Le détail des articles ou prestations, avec prix et taxes.
4. La durée de validité de l’offre et les conditions de paiement.

Cette mention est essentielle : sans elle, le document peut être pris pour une vraie facture. Elle ne doit pas porter de numéro de votre série de factures, qui doit rester continue. Voir [les mentions obligatoires d’une facture](/blog/mentions-obligatoires-facture-senegal).

## Devis ou pro forma : que choisir ?

Pour une petite entreprise, le **devis** suffit presque toujours. Il engage mieux : une fois accepté, il vaut accord sur le prix et se transforme en facture. La pro forma est utile quand on vous la réclame sous ce nom précis. Demandez au client ce que son service attend : un devis accepté remplit souvent le même rôle. Pour rédiger un bon devis, lisez [comment faire un devis](/blog/faire-un-devis).

## Les erreurs à éviter

- **Encaisser sur une pro forma** sans faire ensuite une vraie facture.
- **Oublier le mot pro forma**, ce qui peut créer une confusion avec une facture.
- **Compter une pro forma dans votre chiffre d’affaires** : aucune vente n’a eu lieu.
- **Laisser un prix sans date de validité**, alors que vos coûts peuvent bouger.

La valeur exacte de ces documents dépend du droit de chaque pays et de ce qui a été convenu. Pour un marché important ou une administration, faites valider le document attendu par votre comptable.

## Exemple d’utilisation

Une entreprise vous demande une pro forma pour 20 chaises. Vous l’envoyez, son responsable valide la dépense, puis son service passe commande. Vous livrez et vous établissez alors la vraie facture, avec son numéro : c’est elle qui compte dans vos ventes et que le client paiera.

## Dans Nagaw Business

Nagaw Business fait des devis et des factures, pas de pro forma sous ce nom. Un devis numéroté, avec sa durée de validité, votre logo et votre couleur, s’envoie en PDF et devient une facture sans ressaisie quand le client l’accepte. Pour vos premiers documents, voir [comment faire une facture sur téléphone](/blog/faire-facture-telephone).
`,
  faq: [
    {
      question: 'Une facture pro forma a-t-elle une valeur légale ?',
      answer:
        'Elle ne constate pas de vente et ne se comptabilise pas. C’est un document d’information. Sa portée exacte dépend du droit local et de ce qui a été convenu avec le client.',
    },
    {
      question: 'Quelle est la différence entre un devis et une pro forma ?',
      answer:
        'Le devis est une proposition de prix qui peut engager une fois acceptée. La pro forma annonce une facture à venir et sert surtout à des démarches du client.',
    },
    {
      question: 'Peut-on être payé sur une facture pro forma ?',
      answer:
        'Un client peut verser un acompte à partir d’elle, mais il faut ensuite établir une vraie facture numérotée qui constate la vente et le paiement.',
    },
    {
      question: 'La pro forma doit-elle être numérotée ?',
      answer:
        'Pas dans la série des factures, qui doit rester continue. Une référence à part permet de la retrouver facilement.',
    },
  ],
  related: [
    'faire-un-devis',
    'mentions-obligatoires-facture-senegal',
    'facture-avoir',
    'faire-facture-telephone',
  ],
};
