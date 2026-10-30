import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'gestion-garage-mecanique',
  title: 'Gérer un garage : pièces, main-d’œuvre, devis et factures',
  seoTitle: 'Gestion garage auto : pièces, devis et facture',
  description:
    'Mécanicien ou garagiste : comment suivre les pièces, séparer la main-d’œuvre, faire un devis accepté avant la réparation et être payé sans dispute.',
  category: 'metiers',
  keywords: [
    'gestion garage automobile',
    'logiciel garage auto',
    'facture mécanicien',
    'devis réparation voiture',
    'stock pièces détachées',
    'gérer un garage Afrique',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Un garage vend à la fois un service, la main-d’œuvre, et des produits, les pièces : il faut suivre les deux séparément.',
    'Faites accepter un devis avant la réparation : c’est ce qui évite les disputes au moment de payer.',
    'Suivez les pièces les plus utilisées, avec un seuil d’alerte, pour éviter d’immobiliser une voiture.',
    'Une entreprise cliente demande une facture en règle : préparez vos mentions une fois pour toutes.',
  ],
  body: `
Pour bien **gérer un garage**, il faut séparer deux choses sur chaque intervention : la **main-d’œuvre**, qui est un service sans stock, et les **pièces**, qui sont des produits à suivre. Le garage fait partie des métiers qui vendent les deux à la fois. Sans cette séparation, impossible de savoir si l’atelier gagne de l’argent sur son travail ou seulement sur les pièces.

## Ce qui fait perdre de l’argent à un garage

- **Des réparations faites sans accord écrit** : le client conteste la note à la sortie.
- **Des pièces achetées pour un client et jamais facturées** : le petit consommable oublié pèse lourd sur un mois.
- **Des voitures bloquées faute d’une pièce courante** : l’atelier s’arrête et le client s’impatiente.
- **Des clients flottes qui paient tard** : l’argent manque pour acheter les pièces suivantes.

## Faire accepter un devis avant de réparer

Le [devis](/blog/faire-un-devis) n’est pas une formalité : c’est votre protection. Après le diagnostic, écrivez ce qui sera fait, ligne par ligne, et envoyez-le au client avant de démonter.

| Ligne du devis d’exemple | Type | Montant |
| --- | --- | --- |
| Plaquettes de frein avant | Pièce | 25 000 F |
| Liquide de frein | Pièce | 5 000 F |
| Remplacement des plaquettes | Main-d’œuvre | 15 000 F |
| **Total** | | **45 000 F** |

Si une panne supplémentaire apparaît en cours de travail, appelez le client et ajustez le devis avant de continuer. La plupart des disputes viennent d’une surprise au moment de payer, pas du prix lui-même.

## Suivre les pièces sans tout compter

Un garage n’a pas besoin de suivre chaque vis. Concentrez-vous sur ce qui immobilise l’atelier : filtres, plaquettes, huiles, courroies, ampoules. Pour ces pièces, fixez un seuil d’alerte adapté au délai de votre fournisseur. La méthode est détaillée dans [le stock de sécurité](/blog/stock-de-securite). Une fois par trimestre, faites un [inventaire](/blog/faire-un-inventaire) des pièces de valeur.

Les pièces achetées spécialement pour une voiture doivent être notées sur son devis le jour même, sinon elles disparaissent de la note.

## Fixer un tarif de main-d’œuvre

Évitez de décider du prix au regard du client. Fixez un tarif horaire ou forfaitaire par type d’intervention : vidange, freins, embrayage. Il doit couvrir le salaire des mécaniciens, le local, l’outillage et le temps perdu. Pour la méthode, voir [comment fixer son prix de vente](/blog/fixer-prix-de-vente).

## Travailler avec les entreprises et les flottes

Une société, un taxi-sister ou une administration paie rarement sur place : elle veut une facture avec ses mentions et règle plus tard. Vérifiez vos informations une fois pour toutes, voir [les mentions obligatoires d’une facture](/blog/mentions-obligatoires-facture-senegal). Suivez ensuite les délais : une grosse facture en retard peut bloquer tout l’atelier. Pour réclamer son argent sans perdre le client, lisez [comment relancer une facture impayée](/blog/relancer-facture-impayee).

## Garder la trace de chaque intervention

Pour chaque voiture, notez l’immatriculation, le kilométrage et ce qui a été fait. Si le client revient avec une plainte, vous savez ce qui a été remplacé et quand. Cette trace protège le garage, et elle permet aussi de proposer le prochain entretien au bon moment.

## Dans Nagaw Business

Choisissez « Les deux » dans les paramètres : la main-d’œuvre s’ajoute au catalogue comme un service, à l’heure ou au forfait, et les pièces comme des produits avec leur stock et leur seuil d’alerte. Un devis accepté devient une facture sans ressaisie, avec votre logo, votre cachet et votre signature. Le paiement se fait en une ou plusieurs fois, et les recettes sont réparties entre marchandises et services dans la comptabilité. L’application ne suit pas le carnet d’entretien ni l’immatriculation des véhicules : notez-la dans le libellé ou les notes de la facture.
`,
  faq: [
    {
      question: 'Comment faire une facture de garage ?',
      answer:
        'Séparez les pièces et la main-d’œuvre, indiquez le client, la date, un numéro unique, les montants et, si vous en êtes redevable, la taxe. Ajoutez l’identification du véhicule dans les notes.',
    },
    {
      question: 'Faut-il faire un devis avant une réparation ?',
      answer:
        'C’est fortement conseillé : un devis accepté avant le démontage évite la plupart des disputes au moment de payer.',
    },
    {
      question: 'Quelles pièces garder en stock dans un garage ?',
      answer:
        'Celles qui sortent souvent et immobilisent l’atelier quand elles manquent, comme les filtres, plaquettes, huiles et ampoules, avec un seuil d’alerte adapté au délai du fournisseur.',
    },
    {
      question: 'Comment fixer le prix de la main-d’œuvre ?',
      answer:
        'Calculez un coût par heure qui couvre salaires, local et outillage, puis fixez un tarif horaire ou forfaitaire par type d’intervention, identique pour tous les clients.',
    },
  ],
  related: [
    'gestion-entreprise-services',
    'faire-un-devis',
    'stock-de-securite',
    'relancer-facture-impayee',
  ],
};
