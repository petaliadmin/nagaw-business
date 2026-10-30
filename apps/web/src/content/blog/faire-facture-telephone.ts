import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'faire-facture-telephone',
  title: 'Faire une facture sur téléphone et l’envoyer sur WhatsApp',
  seoTitle: 'Faire une facture sur téléphone en PDF : le guide',
  description:
    'Comment faire une facture propre depuis votre téléphone, avec logo, cachet et numéro automatique, puis l’envoyer en PDF sur WhatsApp, en quelques étapes.',
  category: 'factures',
  keywords: [
    'faire une facture sur téléphone',
    'application de facturation',
    'application facture Android',
    'facture PDF WhatsApp',
    'logiciel de facturation gratuit',
    'créer une facture en ligne',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Une bonne application de facturation calcule les totaux et numérote les factures à votre place.',
    'Préparez une fois vos informations : nom, adresse, identifiants, logo, cachet.',
    'Vérifiez le brouillon avant d’émettre : après, la facture ne se modifie plus.',
    'Évitez Word et les photos de cahier : ils ne garantissent ni la numérotation ni les calculs.',
  ],
  body: `
Pour **faire une facture sur téléphone**, le plus sûr est une application de facturation : vous choisissez le client, ajoutez les articles, et elle calcule les totaux, donne un numéro unique et produit un PDF à envoyer sur WhatsApp. Une facture écrite à la main ou faite dans Word peut convenir au début, mais elle expose aux erreurs de calcul, aux numéros en double et aux documents qui ne font pas sérieux.

## Pourquoi éviter Word et le carnet de factures

| Méthode | Problème principal |
| --- | --- |
| Carnet à la main | Pas de copie sur le téléphone, calculs à refaire |
| Word ou Excel | Numéro à gérer soi-même, risque de modifier une facture émise |
| Photo d’un papier | Peu professionnel, difficile à relire |
| Application de facturation | Demande une mise en place de quelques minutes |

Le point le plus sensible est la numérotation : les factures doivent se suivre sans trou. Un humain se trompe, surtout avec plusieurs vendeurs.

## Préparer sa facture une fois pour toutes

Avant la première facture, renseignez les informations qui reviendront partout :

1. **Votre identité** : nom commercial, raison sociale, adresse, téléphone, e-mail.
2. **Vos identifiants** : NINEA et RCCM au Sénégal, ou leurs équivalents dans votre pays.
3. **Votre image** : logo, couleur, cachet et signature.
4. **Vos conditions** : délai de paiement, durée de validité des devis, phrase de fin.

Vérifiez [les mentions obligatoires d’une facture](/blog/mentions-obligatoires-facture-senegal) une seule fois, soigneusement.

## Faire la facture, étape par étape

1. **Choisissez le client**, ou créez-le avec son nom, son adresse et son téléphone.
2. **Ajoutez les lignes** : un article du catalogue, ou une ligne libre pour une prestation.
3. **Vérifiez les quantités, les prix et la taxe**. Pour la TVA, voir [le calcul à 18 %](/blog/calcul-tva-18-ht-ttc).
4. **Enregistrez le brouillon** et relisez-le calmement.
5. **Émettez la facture** : elle reçoit son numéro et ne se modifie plus.
6. **Envoyez le PDF** sur WhatsApp ou par e-mail.
7. **Notez les paiements** quand l’argent arrive.

## Brouillon ou facture émise : le bon réflexe

Le brouillon n’a pas de numéro, il se corrige à volonté. La facture émise, elle, est définitive : une erreur se corrige par un [avoir](/blog/facture-avoir). Prenez l’habitude de relire le nom du client et le total avant d’émettre.

## Facture, reçu ou ticket : lequel donner ?

- **Le ticket** suffit pour une vente au comptoir à un particulier.
- **La facture** est nécessaire pour une entreprise, une administration, ou un client qui la demande.
- **Le devis** précède la vente, voir [comment faire un devis](/blog/faire-un-devis).

## Ce qu’il faut regarder dans une application

Vérifiez qu’elle fonctionne bien sur un téléphone Android simple, qu’elle numérote toute seule, qu’elle affiche vos identifiants et votre logo, qu’elle gère les taxes et les paiements en plusieurs fois, et que vos données restent accessibles depuis un autre appareil. Vérifiez aussi ce que comprend une offre gratuite : limites de documents, publicité ou nom du logiciel sur vos factures.

## Dans Nagaw Business

Nagaw Business numérote les factures sur le serveur, sans trou, même avec plusieurs vendeurs. Elle calcule les taxes et le total, produit un PDF avec votre logo, votre couleur, et votre cachet et votre signature sur les factures émises. Le PDF se lit directement dans l’application, et se partage depuis votre téléphone. Une facture peut naître d’une vente ou d’un devis accepté, sans ressaisie. Il faut une connexion internet pour les préparer.

Pour voir l’ensemble, lisez [comment choisir un logiciel de gestion de boutique](/blog/logiciel-gestion-boutique).
`,
  faq: [
    {
      question: 'Comment faire une facture avec son téléphone ?',
      answer:
        'Avec une application de facturation : choisissez le client, ajoutez les articles, vérifiez le total, émettez la facture puis envoyez le PDF sur WhatsApp ou par e-mail.',
    },
    {
      question: 'Quelle application pour faire des factures au Sénégal ?',
      answer:
        'Choisissez une application en français, en F CFA, qui gère la TVA à 18 %, affiche vos identifiants, numérote automatiquement et produit un PDF.',
    },
    {
      question: 'Peut-on envoyer une facture sur WhatsApp ?',
      answer:
        'Oui, en PDF. C’est pratique, à condition que la facture contienne ses mentions obligatoires et que vous en gardiez une copie.',
    },
    {
      question: 'Peut-on modifier une facture après l’avoir envoyée ?',
      answer:
        'Non, une facture émise ne se modifie pas. On la corrige avec un avoir, puis on établit une nouvelle facture si besoin.',
    },
  ],
  related: [
    'mentions-obligatoires-facture-senegal',
    'facture-avoir',
    'faire-un-devis',
    'application-caisse-telephone',
  ],
};
