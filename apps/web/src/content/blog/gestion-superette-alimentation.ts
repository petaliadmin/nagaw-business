import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'gestion-superette-alimentation',
  title: 'Gérer une superette ou une boutique d’alimentation générale',
  seoTitle: 'Gérer une superette ou une alimentation générale',
  description:
    'Alimentation générale, superette, boutique de quartier : comment suivre des centaines d’articles, les dates, le crédit et les marges qui sont faibles.',
  category: 'metiers',
  keywords: [
    'gestion alimentation générale',
    'logiciel superette',
    'gérer une boutique de quartier',
    'caisse supermarché Afrique',
    'gestion épicerie',
    'marge alimentation générale',
  ],
  published: '2026-10-30',
  updated: '2026-10-30',
  summary: [
    'En alimentation, la marge par article est faible : c’est le volume, le stock et les pertes qui font le bénéfice.',
    'Commencez par les 50 articles qui font l’essentiel des ventes, puis ajoutez le reste peu à peu.',
    'Vendez au détail et au carton sans perdre le fil du stock, grâce à des unités de vente.',
    'Limitez le crédit de quartier : c’est souvent là que part toute la marge du mois.',
  ],
  body: `
Pour bien **gérer une alimentation générale**, il faut surveiller ce qui fait vraiment le bénéfice : le volume des ventes, les ruptures, les pertes et le crédit. La marge sur un paquet de sucre ou un bidon d’huile est faible : quelques oublis suffisent à l’effacer. Une superette ou une boutique de quartier se gère donc par la discipline des petits gestes, plus que par de gros coups.

## Les quatre fuites d’une alimentation générale

- **Les ruptures** sur les articles que tout le monde achète : le client part et revient moins.
- **Les produits périmés ou abîmés**, rarement notés.
- **Le crédit de quartier**, qui grossit sans bruit.
- **Les prix non mis à jour** quand le grossiste augmente : on vend à l’ancien prix sans le savoir.

Une seule de ces fuites peut annuler le bénéfice d’un mois. Pour les repérer, voir [comment éviter les vols et les pertes](/blog/eviter-vols-pertes-boutique).

## Commencer par les articles qui comptent

Inutile de saisir tout le magasin le premier jour : c’est ce qui fait abandonner. Commencez par les 50 articles qui sortent le plus : riz, huile, sucre, lait, savon, boissons. Ajoutez ensuite le reste au fil des ventes, à chaque fois qu’un article passe en caisse.

Regroupez les articles par catégorie : épicerie, boissons, hygiène, ménage. Un vendeur les retrouve plus vite et vos statistiques deviennent lisibles. Le détail est dans [le guide de la gestion de stock](/blog/gestion-de-stock-boutique).

## Vendre au détail et au carton

Une boutique vend souvent le même produit de plusieurs façons : à la pièce, au paquet, au carton ou au sac. Le stock doit rester juste dans tous les cas.

| Vente d’exemple | Sortie du stock |
| --- | --- |
| 1 carton de 24 boîtes | 24 boîtes |
| 1 sac de riz de 50 kg | 50 kg |
| 2 kg de riz au détail | 2 kg |

Sans cela, le stock devient faux dès la première semaine. Pour aller plus loin, lisez [vendre au détail et en gros](/blog/vente-detail-et-gros).

## Ne pas tomber en rupture sur l’essentiel

Pour les articles les plus demandés, fixez un seuil en dessous duquel vous rachetez. Il dépend de ce que vous vendez par jour et du délai du grossiste. La méthode est dans [le stock de sécurité](/blog/stock-de-securite). À l’inverse, repérez les articles qui ne se vendent pas : ils immobilisent l’argent dont vous avez besoin pour le reste. Voir [réapprovisionner sans surstocker](/blog/reapprovisionnement-stock-dormant).

## Tenir le crédit de quartier

Dans une boutique de quartier, refuser tout crédit est difficile. Mais le crédit sans limite est la première cause de manque d’argent. Fixez un plafond par client, notez chaque achat à son nom, et faites le point en fin de mois. La méthode est dans [gérer le crédit client](/blog/credit-clients-boutique).

## Organiser le magasin pour vendre plus

Placez les produits de base au fond ou sur les côtés : le client traverse alors le magasin et voit le reste. Gardez près de la caisse les petits achats d’impulsion, comme les bonbons, les piles ou les biscuits, qui rapportent souvent une meilleure marge. Un rayon propre et bien rempli se vend mieux qu’un rayon à moitié vide.

## Dans Nagaw Business

Nagaw Business garde le prix d’achat et le prix de vente de chaque article, avec un seuil d’alerte. Vous pouvez vendre au sac ou au carton pendant que le stock reste compté à la bonne unité. La caisse se fait depuis le téléphone, avec espèces, Mobile Money, carte ou crédit, et l’Accueil montre ce qui est épuisé, ce qui se vend le mieux et ce qui ne se vend pas. Chaque client a un plafond de crédit. La caisse demande pour l’instant une connexion internet.
`,
  faq: [
    {
      question: 'Quelle marge dans une alimentation générale ?',
      answer:
        'Elle varie beaucoup selon les articles et la ville. Les produits de base rapportent peu, les boissons, l’hygiène et les petits articles davantage. Calculez-la article par article plutôt qu’avec une moyenne.',
    },
    {
      question: 'Comment suivre le stock d’une superette ?',
      answer:
        'Enregistrez chaque vente et chaque arrivage, commencez par les articles les plus vendus, et vérifiez le stock réel par rayon, un peu chaque semaine.',
    },
    {
      question: 'Comment gérer les produits périmés ?',
      answer:
        'Vendez d’abord les arrivages les plus anciens, surveillez les dates en rayon, et notez les retraits comme une perte pour garder un stock juste.',
    },
    {
      question: 'Faut-il faire crédit dans une boutique de quartier ?',
      answer:
        'Souvent oui, mais avec un plafond par client, chaque achat noté à son nom et un point à date fixe, pour que le crédit ne mange pas la marge.',
    },
  ],
  related: [
    'gestion-de-stock-boutique',
    'vente-detail-et-gros',
    'stock-de-securite',
    'credit-clients-boutique',
  ],
};
