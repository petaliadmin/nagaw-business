import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'gerer-vendeurs-boutique',
  title: 'Gérer ses vendeurs : confiance, règles claires et contrôle discret',
  seoTitle: 'Gérer les vendeurs de sa boutique : règles et contrôle',
  description:
    'Rôles, comptes personnels, remises plafonnées, annulations avec motif, clôture de caisse : comment faire confiance à vos vendeurs tout en gardant la main.',
  category: 'gestion',
  keywords: [
    'gérer ses vendeurs',
    'gestion des employés boutique',
    'contrôler ses vendeurs',
    'gérer une boutique à distance',
    'rôles utilisateurs logiciel de caisse',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Donnez à chaque vendeur son propre compte : on sait toujours qui a vendu, annulé ou modifié quoi.',
    'Un vendeur encaisse ; l’argent, les chiffres et les factures restent au propriétaire et aux gérants.',
    'Fixez des règles écrites : remise maximale, crédit autorisé, annulation par un responsable.',
    'La clôture de caisse quotidienne et l’historique sont des contrôles discrets qui protègent aussi les vendeurs honnêtes.',
  ],
  body: `
Embaucher un vendeur permet d’ouvrir plus longtemps, de servir plus de clients et de souffler un peu. Mais beaucoup de commerçants hésitent : comment savoir ce qui se passe quand on n’est pas là ? La réponse n’est pas la méfiance permanente, ce sont des **règles claires** et des **contrôles discrets** qui protègent la boutique, et aussi le vendeur honnête.

## Un compte par personne, jamais de compte partagé

C’est la règle de base. Si tout le monde encaisse avec le même compte, impossible de savoir qui a fait une vente, une remise ou une annulation. Avec un compte par personne :

- chaque ticket porte le nom du vendeur ;
- les ventes de chacun se comparent ;
- un écart de caisse se rattache à une équipe ou une journée ;
- un vendeur qui part est simplement retiré, sans changer de mot de passe pour tous.

## Des rôles adaptés

| Rôle | Ce qu’il fait | Ses limites |
| --- | --- | --- |
| Propriétaire | Tout, y compris le choix de l’offre | — |
| Gérant | Gère le stock, l’argent, les factures, annule les ventes | Ne change pas l’offre |
| Vendeur | Encaisse, voit ses propres ventes | Ne voit ni l’argent des caisses, ni les statistiques, ni les factures |
| Lecteur (le comptable) | Consulte les chiffres et la comptabilité | Ne modifie rien |

Un vendeur n’a pas besoin de voir le bénéfice du mois ni le solde Wave de la boutique pour bien faire son travail.

## Les règles à écrire noir sur blanc

Affichez-les ou donnez-les par écrit le premier jour :

1. **Toute vente passe par la caisse**, même quand ça presse.
2. **Remise maximale** : par exemple 5 %. Au-delà, il faut l’accord du responsable.
3. **Crédit** : à qui le vendeur peut faire crédit, et jusqu’à quel montant. Voir [gérer le crédit des clients](/blog/credit-clients-boutique).
4. **Annulation** : une vente ne se supprime jamais ; elle s’annule par un responsable, avec un motif.
5. **Argent de la caisse** : aucune dépense sans reçu, aucun « prêt » pris dans le tiroir.
6. **Clôture** : chaque soir, le vendeur compte devant le responsable, ou envoie le résultat.

## Les contrôles discrets

### La clôture de caisse

C’est le contrôle le plus efficace. Un manque ponctuel peut être une erreur de monnaie ; un manque qui revient avec la même personne demande une discussion. Voir [la clôture de caisse](/blog/cloture-de-caisse).

### L’historique

Un bon logiciel garde la trace de **qui a fait quoi, et quand** : ventes, annulations, remises, modifications de prix, mouvements de stock. Il n’est pas nécessaire de le lire tous les jours ; savoir qu’il existe suffit souvent à décourager les tentations.

### L’inventaire des petits articles de valeur

Chargeurs, écouteurs, parfums, cartes de recharge : comptez-les chaque semaine. Voir [faire un inventaire](/blog/faire-un-inventaire).

### Les ventes par vendeur

Comparez les ventes, les remises et les annulations de chaque vendeur. Une personne qui annule beaucoup plus que les autres mérite une question.

## Former un vendeur en une journée

- **Matin** : montrer l’écran de vente, faire trois ventes d’essai et les annuler.
- **Midi** : le laisser encaisser, vous à côté.
- **Après-midi** : les cas particuliers (paiement Mobile Money, crédit, client qui rend un article).
- **Soir** : faire la clôture ensemble.

## Suivre la boutique à distance

Avec un logiciel en ligne, vous voyez depuis votre téléphone les ventes du jour, l’argent des caisses et le stock, même quand vous êtes au marché ou chez le fournisseur. Ce n’est pas de la surveillance : c’est ce qui vous permet de **déléguer sans inquiétude**.

## Les vendeurs dans Nagaw Business

Dans Nagaw Business, vous invitez vos vendeurs par e-mail, chacun avec son compte et son rôle (propriétaire, gérant, vendeur, lecteur). Un vendeur encaisse et ne voit que ses propres ventes ; l’argent, les statistiques et les factures lui sont masqués. Les **remises des vendeurs sont plafonnées** (au-delà, c’est un gérant qui encaisse), une vente s’annule par un gérant avec un motif, et l’**historique** garde chaque action. Un téléphone perdu peut être retiré à distance dans Paramètres.

Voir aussi [comment éviter les vols et les pertes](/blog/eviter-vols-pertes-boutique).
`,
  faq: [
    {
      question: 'Comment contrôler ses vendeurs sans les fliquer ?',
      answer:
        'Un compte par personne, des règles écrites (remise maximale, crédit, annulations), une clôture de caisse chaque soir et un historique des actions. Ces contrôles protègent aussi les vendeurs honnêtes.',
    },
    {
      question:
        'Un vendeur doit-il voir le chiffre d’affaires de la boutique ?',
      answer:
        'Ce n’est pas nécessaire. Il doit voir ses propres ventes ; l’argent des caisses, la marge et les statistiques peuvent rester réservés au propriétaire et aux gérants.',
    },
    {
      question: 'Comment gérer sa boutique à distance ?',
      answer:
        'Avec un logiciel en ligne qui montre depuis votre téléphone les ventes du jour, l’argent de chaque caisse et le stock, et un rôle limité pour chaque vendeur.',
    },
  ],
  related: [
    'eviter-vols-pertes-boutique',
    'cloture-de-caisse',
    'logiciel-gestion-boutique',
  ],
};
