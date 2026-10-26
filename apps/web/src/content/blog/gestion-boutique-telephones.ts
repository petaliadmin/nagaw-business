import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'gestion-boutique-telephones',
  title: 'Gérer une boutique de téléphones et d’accessoires',
  seoTitle: 'Gestion d’une boutique de téléphones et accessoires',
  description:
    'Stock de téléphones, accessoires, garanties, ventes aux entreprises, marges faibles : les bonnes pratiques pour gérer une boutique de téléphonie et d’électronique.',
  category: 'metiers',
  keywords: [
    'gestion boutique de téléphones',
    'logiciel boutique téléphonie',
    'gestion magasin électronique',
    'stock accessoires téléphone',
    'vendre des téléphones',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Dans la téléphonie, chaque article coûte cher : un seul téléphone manquant efface la marge de plusieurs ventes.',
    'Comptez les téléphones chaque jour et les petits accessoires chaque semaine.',
    'Les accessoires rapportent souvent plus de marge que les téléphones : suivez la marge par produit.',
    'Notez l’IMEI de chaque téléphone vendu sur la facture ou le ticket, pour la garantie et en cas de litige.',
  ],
  body: `
Une boutique de **téléphones et d’accessoires** a un profil particulier : des articles chers et faciles à emporter, des prix qui changent vite, des marges serrées sur les téléphones et confortables sur les accessoires, et une clientèle qui mélange particuliers et entreprises. Sa gestion doit en tenir compte.

## Les particularités d’une boutique de téléphonie

| Caractéristique | Conséquence pour la gestion |
| --- | --- |
| Articles de forte valeur | Un vol ou une erreur coûte cher : stock compté souvent |
| Petits accessoires nombreux | Risque de démarque élevé |
| Prix d’achat qui changent vite | Prix de vente et marges à revoir souvent |
| Modèles qui se démodent | Stock dormant qui perd de la valeur |
| Garanties et retours | Traçabilité de chaque appareil vendu |
| Ventes aux entreprises | Devis et factures avec TVA |

## Organiser le catalogue

Créez **un produit par modèle et par variante** qui a un prix différent : « Samsung Galaxy A15 128 Go » et « Samsung Galaxy A15 256 Go » sont deux produits. Pour les accessoires, regroupez-les en catégories (chargeurs, câbles, écouteurs, coques, cartes mémoire) pour retrouver vite le bon article et analyser les ventes par famille.

Ajoutez une **photo** de chaque produit : au comptoir, le vendeur trouve le bon modèle d’un coup d’œil.

## Compter souvent, surtout ce qui est petit et cher

- **Téléphones** : à compter chaque jour à la fermeture, c’est rapide et cela évite les mauvaises surprises.
- **Accessoires de valeur** (écouteurs sans fil, montres, chargeurs rapides) : chaque semaine.
- **Petits accessoires** (coques, câbles) : chaque mois, en inventaire tournant.

Voir notre méthode pour [faire un inventaire](/blog/faire-un-inventaire) et [réduire les pertes](/blog/eviter-vols-pertes-boutique).

## Suivre la marge, produit par produit

Sur un téléphone, la marge est souvent faible en pourcentage. Sur une coque ou un câble, elle peut être bien plus élevée. Une boutique qui vend beaucoup de téléphones et peu d’accessoires peut avoir un gros chiffre d’affaires et un petit bénéfice.

Prenons un exemple fictif : un téléphone acheté 85 000 F et vendu 92 000 F rapporte 7 000 F ; un chargeur acheté 1 500 F et vendu 4 000 F rapporte 2 500 F. Trois chargeurs rapportent plus qu’un téléphone. **Proposez systématiquement l’accessoire** avec le téléphone : coque, protection d’écran, chargeur. Voir [calculer sa marge](/blog/calculer-marge-benefice).

## Garantie et traçabilité

Pour chaque téléphone vendu, gardez une trace de :

- l’**IMEI** (le numéro unique de l’appareil, affiché en tapant *#06#) ;
- la date de vente et le client ;
- la durée de garantie promise.

Notez l’IMEI sur la **facture** ou sur un registre des ventes. En cas de retour, vous saurez si l’appareil vient bien de votre boutique et s’il est encore garanti.

## Vendre aux entreprises

Les entreprises, écoles et administrations achètent des téléphones et des accessoires en lot. Elles demandent un **devis**, puis une **facture** avec TVA et leur NINEA. Soyez prêt à répondre vite : voir [faire un devis](/blog/faire-un-devis) et [les mentions d’une facture](/blog/mentions-obligatoires-facture-senegal).

## Gérer les prix qui bougent

Quand votre fournisseur change ses prix, mettez à jour le **prix d’achat** dans votre logiciel avant de recevoir la nouvelle marchandise, puis ajustez le prix de vente. Sinon, votre marge affichée est fausse. Un modèle qui ne se vend plus doit être écoulé tant qu’il a encore de la valeur : voir [le stock dormant](/blog/reapprovisionnement-stock-dormant).

## Avec Nagaw Business

Les captures de Nagaw Business montrent justement une boutique de démonstration d’électronique : produits avec photo et prix, alerte « bientôt épuisé » pour un modèle dont il reste deux pièces, factures avec TVA à 18 % pour un client entreprise. Le prix d’achat est figé à chaque vente, pour une marge juste, et les statistiques montrent ce qui rapporte le plus. La recherche par code-barres se fait en tapant le code (pas encore de lecture par la caméra).
`,
  faq: [
    {
      question: 'Comment gérer le stock d’une boutique de téléphones ?',
      answer:
        'Créez un produit par modèle et variante, comptez les téléphones chaque jour et les accessoires de valeur chaque semaine, et notez chaque entrée, vente et perte.',
    },
    {
      question:
        'Qu’est-ce qui rapporte le plus dans une boutique de téléphonie ?',
      answer:
        'Souvent les accessoires : leur marge en pourcentage est bien plus élevée que celle des téléphones. Suivez la marge par produit pour le vérifier dans votre boutique.',
    },
    {
      question: 'Pourquoi noter l’IMEI d’un téléphone vendu ?',
      answer:
        'Pour la garantie et les litiges : l’IMEI identifie l’appareil de façon unique et prouve qu’il a été vendu par votre boutique, à quelle date.',
    },
  ],
  related: [
    'eviter-vols-pertes-boutique',
    'calculer-marge-benefice',
    'faire-un-devis',
  ],
};
