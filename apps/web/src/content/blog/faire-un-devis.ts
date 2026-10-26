import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'faire-un-devis',
  title: 'Faire un devis professionnel qui se transforme en vente',
  seoTitle: 'Comment faire un devis professionnel : modèle et conseils',
  description:
    'Ce qu’un devis doit contenir, comment fixer sa durée de validité, le relancer et le transformer en facture sans tout ressaisir. Modèle et conseils pour boutiques.',
  category: 'factures',
  keywords: [
    'faire un devis',
    'modèle de devis',
    'devis gratuit en ligne',
    'transformer un devis en facture',
    'pro forma',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Un devis est une proposition de prix écrite, envoyée avant la vente, souvent demandée par les entreprises et les administrations.',
    'Il contient les mêmes informations qu’une facture (identités, lignes, TVA, totaux) plus une durée de validité.',
    'Envoyez-le vite, en PDF, et relancez-le avant la fin de sa validité.',
    'Une fois accepté, il devient une facture sans ressaisie.',
  ],
  body: `
Un **devis** est une proposition de prix écrite que vous envoyez à un client avant la vente. Les entreprises, les écoles, les ONG et les administrations en demandent presque toujours avant de commander, souvent pour comparer plusieurs fournisseurs. Le client parle parfois de **facture pro forma** : dans la pratique d’une boutique, c’est le même usage.

Un devis clair et rapide fait souvent la différence avec la boutique d’à côté.

## Ce qu’un devis doit contenir

| Zone | Contenu |
| --- | --- |
| Vendeur | Nom de la boutique, adresse, téléphone, NINEA, RCCM |
| Client | Nom ou raison sociale, adresse, NINEA pour une entreprise |
| Références | Le mot « Devis », un numéro, la date |
| Validité | Jusqu’à quelle date le prix est garanti |
| Lignes | Désignation précise, quantité, unité, prix unitaire, TVA, remise |
| Totaux | Total HT, TVA, total TTC |
| Conditions | Délai de livraison, conditions de paiement, acompte éventuel |

Les mentions sont proches de celles d’une facture : voir [les mentions d’une facture au Sénégal](/blog/mentions-obligatoires-facture-senegal).

## Fixer la durée de validité

Vos prix d’achat bougent : un devis ne peut pas vous engager indéfiniment. Indiquez une **date limite**, par exemple 15 ou 30 jours. Pour les produits dont le prix change souvent (électronique, matériaux de construction), une durée courte vous protège.

## Les conseils pour qu’un devis soit accepté

1. **Répondez vite.** Le premier devis reçu a souvent un avantage, surtout s’il est complet.
2. **Soyez précis.** « Ordinateur portable » ne suffit pas : indiquez la marque, le modèle et les caractéristiques. Le client compare des devis, il doit pouvoir comparer le vôtre.
3. **Montrez les totaux clairement**, HT et TTC. Un acheteur d’entreprise raisonne souvent hors taxes.
4. **Indiquez le délai de livraison** et ce qui est inclus (installation, transport).
5. **Envoyez un PDF propre**, pas une photo d’une page de cahier.
6. **Relancez** quelques jours avant la fin de validité : « Le devis D-2026-0012 est valable jusqu’au 15, souhaitez-vous confirmer ? »

## Exemple de devis

Voici un exemple fictif de devis pour une école qui équipe sa salle informatique, avec des prix hors taxes et une TVA à 18 % :

| Désignation | Quantité | Prix unitaire HT | Total HT |
| --- | --- | --- | --- |
| Souris USB filaire | 10 | 2 500 F | 25 000 F |
| Clavier AZERTY USB | 10 | 4 000 F | 40 000 F |
| Multiprise 5 prises avec interrupteur | 4 | 3 500 F | 14 000 F |
| **Total HT** | | | **79 000 F** |
| TVA 18 % | | | 14 220 F |
| **Total TTC** | | | **93 220 F** |

Sous le tableau : « Devis valable 15 jours. Livraison sous 3 jours après acceptation. Paiement à la livraison. » En quelques lignes, l’acheteur sait exactement ce qu’il achète, combien et quand.

## Du devis à la facture

Quand le client accepte, ne ressaisissez pas tout : la facture doit reprendre **exactement** les lignes du devis. Ressaisir, c’est risquer une erreur de prix ou de quantité, et un client qui refuse la facture. Si le client demande un changement, modifiez d’abord le devis ou faites-en un nouveau.

Si le client verse un **acompte**, notez-le comme un paiement sur la facture : le reste à payer se calcule tout seul.

## Les erreurs à éviter

- Oublier la TVA, ou l’appliquer deux fois sur des prix déjà TTC : voir [le calcul de la TVA](/blog/calcul-tva-18-ht-ttc).
- Promettre un stock que vous n’avez pas : vérifiez avant d’envoyer.
- Accorder une remise sur le devis puis l’oublier sur la facture.
- Ne pas garder de trace des devis envoyés : vous ne pourrez pas relancer.

## Les devis dans Nagaw Business

Dans Nagaw Business, un devis se prépare depuis le téléphone ou l’ordinateur : client, lignes du catalogue (prix et TVA repris) ou lignes libres pour les services, quantité, unité, remise, et totaux calculés en direct. Il reçoit un numéro D- suivi de l’année, se partage en PDF sur WhatsApp ou par e-mail, et se **transforme en facture** en reprenant ses lignes. Les paiements, dont l’acompte, s’enregistrent sur la facture, avec le reste à payer.

Pour vos prix de vente, pensez à vérifier votre marge : voir [calculer sa marge](/blog/calculer-marge-benefice).
`,
  faq: [
    {
      question: 'Que doit contenir un devis ?',
      answer:
        'L’identité du vendeur et du client, un numéro, une date, une durée de validité, les lignes détaillées (désignation, quantité, prix, TVA, remise), les totaux HT et TTC et les conditions de livraison et de paiement.',
    },
    {
      question: 'Un devis est-il obligatoire ?',
      answer:
        'Pas pour une vente au comptoir, mais les entreprises et les administrations en demandent presque toujours avant de commander, pour comparer les fournisseurs et engager la dépense.',
    },
    {
      question: 'Comment transformer un devis en facture ?',
      answer:
        'En reprenant exactement les lignes du devis accepté dans une facture. Un logiciel le fait sans ressaisie, ce qui évite les erreurs de prix ou de quantité.',
    },
  ],
  related: [
    'mentions-obligatoires-facture-senegal',
    'calcul-tva-18-ht-ttc',
    'calculer-marge-benefice',
  ],
};
