import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'application-caisse-telephone',
  title:
    'Application de caisse sur téléphone : encaisser sans caisse enregistreuse',
  seoTitle: 'Application de caisse sur téléphone Android : le guide',
  description:
    'Transformer son téléphone en caisse : ce qu’une application de caisse doit faire, comment l’installer, imprimer un ticket et encaisser en Mobile Money.',
  category: 'ventes',
  keywords: [
    'application de caisse',
    'application caisse téléphone',
    'logiciel de caisse gratuit',
    'caisse enregistreuse sur Android',
    'caisse mobile boutique',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Une application de caisse transforme un téléphone Android en caisse enregistreuse : panier, total, monnaie à rendre, ticket.',
    'Elle doit gérer tous les moyens de paiement de la boutique : espèces, Mobile Money, carte, crédit, et plusieurs à la fois.',
    'Le ticket peut partir sur WhatsApp ou s’imprimer sur une petite imprimante de caisse 58 mm.',
    'Vérifiez qu’elle continue de vendre quand le réseau coupe.',
  ],
  body: `
Une **application de caisse** sur téléphone fait le travail d’une caisse enregistreuse : vous choisissez les produits, elle calcule le total et la monnaie à rendre, enregistre le paiement et produit un ticket. La différence, c’est que vous n’achetez pas de matériel : le téléphone que vous avez déjà suffit.

## Pourquoi utiliser son téléphone comme caisse ?

Une caisse enregistreuse classique coûte cher, se répare mal et ne dit rien de votre stock ni de vos bénéfices. Un téléphone, lui, est toujours dans votre poche. Avec une bonne application, chaque vente met à jour le stock, la caisse et vos statistiques en même temps. Et si vous avez un vendeur, il peut encaisser sur son propre téléphone pendant que vous suivez les ventes du vôtre.

## Ce qu’une bonne application de caisse doit faire

### Encaisser vite

Au comptoir, chaque seconde compte. Cherchez :

- de **grandes tuiles** de produits, avec le prix lisible ;
- une recherche par nom ou par code-barres ;
- un panier où l’on change la quantité avec + et − ;
- le **total en grand**, impossible à rater ;
- le calcul de la **monnaie à rendre** quand le client paie en espèces.

### Accepter tous les moyens de paiement

Un client paie en espèces, un autre par Wave, un troisième à crédit, un quatrième moitié espèces, moitié Orange Money. L’application doit enregistrer **chaque moyen de paiement** et, pour le Mobile Money, l’opérateur et le numéro de transaction. C’est ce qui permet ensuite de retrouver le bon solde dans chaque caisse.

### Gérer les remises sans perdre la main

Une remise accordée au client doit être visible sur le ticket et, si vous avez des vendeurs, **plafonnée** : sinon, la remise devient une fuite d’argent.

### Produire un ticket

Le client veut une preuve. Deux solutions simples :

1. **Envoyer le ticket sur WhatsApp**, au numéro du client : rien à imprimer, et le client le retrouve facilement.
2. **L’imprimer** sur une petite imprimante de caisse de 58 mm, branchée au téléphone ou à l’ordinateur.

### Continuer sans réseau

Si la caisse s’arrête quand la connexion coupe, le client attend, puis repart. Une application de caisse sérieuse garde les ventes sur le téléphone et les envoie au retour du réseau. Lisez [comment vendre sans internet](/blog/vendre-sans-internet) pour savoir quoi tester.

## Faut-il télécharger une application ?

Pas forcément. Certaines applications s’ouvrent dans le navigateur du téléphone (Chrome, par exemple) et peuvent être **ajoutées à l’écran d’accueil** : elles s’ouvrent alors comme une application téléchargée, sans passer par un magasin d’applications et sans prendre de place. C’est le cas de Nagaw Business.

## Comment démarrer en 15 minutes

1. Créez votre compte et le nom de votre boutique.
2. Ajoutez vos produits : nom, prix de vente, prix d’achat et stock actuel. Commencez par ceux que vous vendez le plus.
3. Ajoutez l’application à l’écran d’accueil du téléphone.
4. Faites une vente d’essai, puis annulez-la pour voir comment ça marche.
5. Encaissez vos vrais clients.

## Les erreurs à éviter

| Erreur | Conséquence | Bonne pratique |
| --- | --- | --- |
| Ne pas saisir le prix d’achat | Impossible de connaître la marge | Le noter dès l’ajout du produit |
| Encaisser sur le cahier quand ça presse | Stock et caisse faux | Tout passer par l’application |
| Partager un seul compte avec les vendeurs | On ne sait pas qui a vendu | Un compte par personne |
| Ne jamais clôturer la caisse | Les manques passent inaperçus | Clôturer chaque soir |

## Et après la vente ?

Une application de caisse ne sert pas qu’à encaisser. Le soir, elle vous donne le total par moyen de paiement, la liste des tickets et ce qui reste à récupérer chez les clients à crédit. Pour compter votre argent, lisez notre guide de [la clôture de caisse](/blog/cloture-de-caisse). Pour comprendre ce que vous gagnez, voyez [le calcul de la marge](/blog/calculer-marge-benefice).

Dans Nagaw Business, l’écran **Vendre** suit ces principes : grandes tuiles, total en grand, monnaie à rendre, paiement en espèces, Mobile Money, carte, crédit ou plusieurs moyens, ticket sur WhatsApp ou à l’imprimante, et une caisse qui s’ouvre même sans connexion.
`,
  faq: [
    {
      question: 'Peut-on utiliser un téléphone comme caisse enregistreuse ?',
      answer:
        'Oui. Une application de caisse calcule le total, la monnaie à rendre, enregistre le paiement et produit un ticket. Elle met aussi à jour le stock et les chiffres de la boutique, ce que ne fait pas une caisse classique.',
    },
    {
      question: 'Comment imprimer un ticket de caisse depuis un téléphone ?',
      answer:
        'Avec une petite imprimante de caisse de 58 mm reliée au téléphone ou à l’ordinateur. Sans imprimante, le ticket peut être envoyé au client sur WhatsApp.',
    },
    {
      question: 'Une application de caisse marche-t-elle sans internet ?',
      answer:
        'Pas toutes. Vérifiez que la caisse s’ouvre en mode avion et que les ventes sont envoyées toutes seules au retour du réseau. Nagaw Business garde les ventes sur le téléphone tant que la connexion est coupée.',
    },
  ],
  related: [
    'vendre-sans-internet',
    'logiciel-gestion-boutique',
    'cloture-de-caisse',
  ],
};
