import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'gestion-boutique-pret-a-porter',
  title: 'Gérer une boutique de vêtements : tailles, soldes et stock',
  seoTitle: 'Gérer une boutique de vêtements et prêt-à-porter',
  description:
    'Prêt-à-porter, chaussures, tissus : comment suivre les tailles et les couleurs, écouler les invendus et garder de la trésorerie pour la prochaine collection.',
  category: 'metiers',
  keywords: [
    'gestion boutique de vêtements',
    'logiciel boutique prêt-à-porter',
    'gérer un magasin de vêtements',
    'stock tailles couleurs',
    'vente de friperie gestion',
    'boutique de chaussures gestion',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'Dans le vêtement, le risque principal est l’invendu : une pièce qui reste est de l’argent bloqué.',
    'Suivez chaque taille et couleur qui compte comme un article à part, avec un nom clair.',
    'Fixez des dates de démarque avant que la saison se termine.',
    'Regardez ce qui se vend le mieux pour acheter moins, mais mieux, à la prochaine commande.',
  ],
  body: `
Pour bien **gérer une boutique de vêtements**, il faut surtout maîtriser l’invendu : acheter ce qui partira, suivre les tailles, et écouler ce qui reste avant que la saison passe. Une chemise qui dort sur un cintre n’est pas un stock, c’est de l’argent bloqué. Ce métier demande moins de lignes que l’alimentation, mais beaucoup plus de décisions.

## Pourquoi le vêtement est un commerce à risque

Dans l’alimentation, un article qui ne part pas se vend plus tard. Dans le vêtement, il passe de mode ou de saison. S’ajoutent des problèmes propres au métier :

- **Les tailles** : vous vendez tout le M, il reste le XXL.
- **Les essayages** : les pièces sont déplacées, abîmées, parfois volées.
- **Les retours et échanges** après la fête, qui rendent le stock approximatif.
- **Les arrivages groupés** de Dubaï, de Turquie ou de Chine, payés d’avance et longs à écouler.

## Suivre les tailles et les couleurs simplement

Pour une pièce importante, créez un article par variante, avec un nom clair et régulier :

| Article | Stock d’exemple |
| --- | --- |
| Robe wax bleue, taille M | 4 |
| Robe wax bleue, taille L | 2 |
| Robe wax rouge, taille M | 3 |

Choisissez toujours le même ordre : modèle, couleur, taille. Pour la friperie ou les petites pièces à prix unique, un seul article par catégorie suffit : « Chemise friperie 2 000 F ». Une photo par article aide beaucoup un vendeur qui cherche vite. Le guide complet est dans [la gestion de stock d’une boutique](/blog/gestion-de-stock-boutique).

## Fixer le prix et prévoir les soldes

Calculez votre prix en comptant le vrai coût d’achat : prix du fournisseur, transport, douane, frais d’envoi. Une pièce achetée 5 000 F peut vous revenir à 6 500 F une fois arrivée. Pour la méthode, voir [comment fixer son prix de vente](/blog/fixer-prix-de-vente).

Prévoyez dès le départ une marge qui permet de baisser le prix en fin de saison. Il vaut mieux vendre une pièce à prix réduit que la garder un an, car l’argent récupéré finance la collection suivante. Pour repérer ce qui dort, lisez [réapprovisionner sans surstocker](/blog/reapprovisionnement-stock-dormant).

## Gérer les échanges et les retours

Écrivez votre règle sur le ticket ou en magasin : délai, état de la pièce, échange ou avoir. Chaque retour doit être enregistré : sinon, la vente reste comptée et le stock ne remonte pas. Un inventaire régulier des pièces de valeur reste indispensable, voir [comment faire un inventaire](/blog/faire-un-inventaire).

## Préparer l’arrivage suivant avec vos chiffres

Avant de commander, regardez ce qui s’est vendu vite et ce qui reste. Le bon réflexe est d’acheter moins de modèles, en plus de quantité sur les tailles qui partent. Gardez aussi assez d’argent pour vivre jusqu’à la prochaine fête : voir [le fonds de roulement](/blog/fonds-de-roulement-boutique).

## Bien présenter pour moins solder

Une pièce bien présentée se vend plus vite et à meilleur prix. Changez régulièrement la vitrine, mettez les nouveautés à l’entrée et regroupez des tenues complètes, pour qu’une cliente venue pour une robe reparte aussi avec un sac ou des chaussures. Ces petites actions réduisent le stock à écouler en fin de saison.

## Dans Nagaw Business

Chaque article a son nom, sa photo, sa catégorie, son prix d’achat et son prix de vente. L’Accueil montre ce qui rapporte le plus et ce qui ne se vend pas sur la période choisie. Une vente peut être annulée avec son motif, ce qui remet les articles en stock. L’application n’a pas de gestion automatique des tailles et des couleurs : on crée un article par variante, comme décrit plus haut.
`,
  faq: [
    {
      question: 'Comment gérer les tailles dans une boutique de vêtements ?',
      answer:
        'Créez un article par taille et couleur pour les pièces importantes, avec un nom toujours construit de la même façon. Pour les petites pièces, un article par catégorie suffit.',
    },
    {
      question: 'Quelle marge dans le prêt-à-porter ?',
      answer:
        'Elle dépend du fournisseur et du quartier, mais elle doit couvrir le transport, les charges et les baisses de prix de fin de saison. Calculez à partir du coût réel une fois la pièce arrivée.',
    },
    {
      question: 'Que faire des vêtements invendus ?',
      answer:
        'Baissez le prix avant la fin de la saison, proposez des lots ou passez par WhatsApp. Récupérer de l’argent pour racheter vaut mieux qu’attendre.',
    },
    {
      question: 'Comment gérer une friperie ?',
      answer:
        'Regroupez les pièces par catégorie et par prix, suivez le coût de chaque balle et comparez-le à ce qu’elle a rapporté une fois vendue.',
    },
  ],
  related: [
    'gestion-de-stock-boutique',
    'fixer-prix-de-vente',
    'reapprovisionnement-stock-dormant',
    'vendre-sur-whatsapp',
  ],
};
