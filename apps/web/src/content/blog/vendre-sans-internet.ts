import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'vendre-sans-internet',
  title: 'Caisse hors ligne : comment continuer à vendre sans internet',
  seoTitle: 'Caisse hors ligne : vendre sans internet dans sa boutique',
  description:
    'Coupure de réseau, plus de forfait : comment une caisse hors ligne garde vos ventes sur le téléphone et les envoie ensuite. Ce qu’il faut tester avant de choisir.',
  category: 'ventes',
  keywords: [
    'caisse hors ligne',
    'logiciel de caisse sans internet',
    'vendre sans connexion',
    'application de vente hors ligne',
    'coupure internet boutique',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Une caisse hors ligne s’ouvre sans réseau, enregistre les ventes sur le téléphone et les envoie toute seule quand la connexion revient.',
    'Chaque vente doit avoir son propre numéro de ticket, donné par le téléphone, pour ne jamais être comptée deux fois.',
    'Testez-la en mode avion avant de l’adopter : ouverture, vente, ticket, puis retour du réseau.',
    'Envoyez les ventes en attente avant de clôturer la caisse le soir.',
  ],
  body: `
Une **caisse hors ligne** est une caisse qui continue de fonctionner quand internet coupe. Les ventes sont gardées sur le téléphone, avec leur ticket, puis envoyées automatiquement au serveur dès que le réseau revient. Pour une boutique où la connexion est instable ou le forfait parfois épuisé, c’est la différence entre un logiciel qu’on garde et un logiciel qu’on abandonne.

## Pourquoi la plupart des logiciels de caisse bloquent sans internet

Beaucoup d’applications de vente sont de simples pages web : chaque clic envoie une demande au serveur et attend la réponse. Sans réseau, rien ne s’affiche. Le vendeur reprend alors son cahier, et les ventes notées à la main ne rentrent jamais dans le stock ni dans les chiffres.

Une vraie caisse hors ligne fonctionne autrement : le catalogue, les prix et les clients sont **copiés sur le téléphone**. La vente s’enregistre d’abord sur le téléphone, puis part au serveur quand c’est possible. Pour le reste de l’écran de vente, voir [ce qu’une application de caisse doit faire](/blog/application-caisse-telephone).

## Comment fonctionne une caisse hors ligne

1. **Avant la coupure**, l’application garde une copie du catalogue (produits, prix, stock) et des clients.
2. **Pendant la coupure**, vous vendez normalement. Chaque vente reçoit un numéro de ticket donné par le téléphone, par exemple « B-000012 ».
3. **Le ticket** peut être imprimé ou partagé sur WhatsApp dès que le client se reconnecte de son côté.
4. **Au retour du réseau**, les ventes sont envoyées dans l’ordre, sans rien faire.
5. **Le serveur revérifie** chaque vente : prix, stock, crédit du client. Ce qui pose problème est signalé, jamais perdu en silence.

## Les pièges d’une mauvaise caisse hors ligne

| Problème | Ce qui se passe | Ce qu’il faut exiger |
| --- | --- | --- |
| Vente envoyée deux fois | Le chiffre d’affaires et le stock sont faux | Chaque vente a un identifiant unique, le serveur ignore les doublons |
| Prix changé pendant la coupure | Le client a payé l’ancien prix | La vente garde le prix payé et est marquée « à vérifier » |
| Téléphone perdu avec des ventes | Ventes perdues | Un avertissement avant la déconnexion s’il reste des ventes non envoyées |
| Vente refusée par le serveur | Personne ne le sait | La liste des opérations refusées, avec leur motif |

## Comment tester une caisse hors ligne en cinq minutes

1. Ouvrez la caisse avec le réseau, puis passez le téléphone **en mode avion**.
2. Fermez complètement l’application et rouvrez-la : la caisse doit s’afficher.
3. Faites une vente et regardez le ticket.
4. Réactivez le réseau : la vente doit partir toute seule et apparaître dans la liste des ventes du jour.
5. Vérifiez que le stock du produit a baissé une seule fois.

Si l’une de ces étapes échoue, l’outil n’est pas fait pour une boutique où le réseau coupe.

## Ce qui reste en ligne

Une caisse hors ligne ne rend pas toute l’application hors ligne. Dans la plupart des outils, ajouter un produit, saisir une entrée de stock ou préparer une facture demande une connexion : ces opérations touchent plusieurs données à la fois et doivent être vérifiées tout de suite. L’important est que **la vente**, elle, ne s’arrête jamais.

## Bonnes pratiques au quotidien

- Ouvrez la caisse au moins une fois par jour avec le réseau, pour rafraîchir les prix et le stock.
- Si vous changez un prix, faites-le quand les téléphones des vendeurs sont connectés.
- **Envoyez les ventes en attente avant de clôturer la caisse** : sinon, elles apparaîtront comme un écart le lendemain. Voir [la clôture de caisse](/blog/cloture-de-caisse).
- Ne vous déconnectez pas d’un téléphone qui a encore des ventes non envoyées.

## Dans Nagaw Business

La caisse de Nagaw Business s’ouvre même sans connexion. Chaque vente est gardée sur le téléphone avec un ticket numéroté, puis envoyée automatiquement à l’ouverture, au retour du réseau et toutes les 30 secondes. Un bandeau indique combien de ventes attendent d’être envoyées, et une vente dont le prix a changé entre-temps est marquée « Prix à vérifier ». Les autres écrans (stock, factures, chiffres) demandent une connexion.

Pour choisir l’ensemble de votre outil, lisez aussi [comment choisir un logiciel de gestion de boutique](/blog/logiciel-gestion-boutique).
`,
  faq: [
    {
      question: 'Peut-on vendre sans connexion internet avec une application ?',
      answer:
        'Oui, si l’application a une vraie caisse hors ligne : elle garde le catalogue sur le téléphone, enregistre les ventes sans réseau et les envoie au retour de la connexion.',
    },
    {
      question: 'Que deviennent les ventes faites hors ligne ?',
      answer:
        'Elles restent sur le téléphone avec leur numéro de ticket, puis sont envoyées au serveur dans l’ordre dès que le réseau revient. Le serveur les revérifie et ignore les doublons.',
    },
    {
      question: 'Le stock est-il juste après une coupure ?',
      answer:
        'Oui, une fois les ventes envoyées. Pendant la coupure, le téléphone affiche le stock de son dernier rafraîchissement : deux vendeurs peuvent donc vendre le même dernier article sans le savoir.',
    },
  ],
  related: [
    'application-caisse-telephone',
    'cloture-de-caisse',
    'logiciel-gestion-boutique',
  ],
};
