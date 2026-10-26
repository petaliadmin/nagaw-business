import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'suivre-wave-orange-money',
  title:
    'Wave, Orange Money, espèces : suivre l’argent de sa boutique caisse par caisse',
  seoTitle: 'Suivre ses paiements Wave et Orange Money en boutique',
  description:
    'Paiements Wave, Orange Money, Free Money et espèces mélangés ? La méthode pour tenir un solde par caisse, contrôler le Mobile Money et ne plus perdre d’argent.',
  category: 'argent',
  keywords: [
    'Wave commerçant',
    'Orange Money boutique',
    'suivi paiement Mobile Money',
    'gestion Mobile Money commerce',
    'caisse Wave Orange Money',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Traitez chaque moyen de paiement comme une caisse à part : espèces, Wave, Orange Money, Free Money, banque.',
    'À chaque vente payée en Mobile Money, notez l’opérateur et le numéro de transaction.',
    'Comparez chaque jour le solde calculé de chaque caisse au solde affiché par l’opérateur.',
    'Enregistrez les retraits, dépôts et frais comme des mouvements entre caisses ou des dépenses.',
  ],
  body: `
Dans beaucoup de boutiques, le **Mobile Money** représente une grande partie des encaissements : Wave, Orange Money, Free Money et d’autres. C’est pratique pour le client et sûr pour le commerçant, mais cela crée un problème : l’argent de la boutique est éparpillé entre le tiroir, plusieurs téléphones et parfois une banque. Sans méthode, on ne sait plus combien on a, ni si un paiement est vraiment arrivé.

## La règle : une caisse par moyen de paiement

Considérez chaque endroit où se trouve votre argent comme une **caisse** avec son propre solde :

| Caisse | Ce qui y entre | Ce qui en sort |
| --- | --- | --- |
| Espèces | Ventes et remboursements en espèces | Dépenses en espèces, dépôts |
| Wave | Ventes payées par Wave | Retraits, paiements fournisseurs |
| Orange Money | Ventes payées par Orange Money | Retraits, paiements, frais |
| Free Money | Ventes payées par Free Money | Retraits, paiements |
| Banque | Dépôts, virements de clients | Chèques, virements |

L’argent de la boutique, c’est la **somme de toutes les caisses**.

## À chaque vente en Mobile Money

1. Attendez la **confirmation du paiement** sur votre téléphone avant de remettre la marchandise. Un SMS ou une capture d’écran montrée par le client ne suffit pas : vérifiez dans votre propre application.
2. Notez l’**opérateur** (Wave, Orange Money…) et le **numéro de transaction**.
3. Si le client paie une partie en espèces et le reste par Mobile Money, enregistrez **les deux** moyens de paiement avec leur montant. Une bonne [application de caisse](/blog/application-caisse-telephone) le permet en une seule vente.

Le numéro de transaction vous permettra de retrouver un paiement contesté ou en double.

## Les déplacements d’argent

Retirer de l’argent Wave en espèces, déposer les espèces à la banque, payer un fournisseur par Orange Money : ce ne sont ni des ventes ni des dépenses, ce sont des **déplacements** d’une caisse à l’autre. S’ils ne sont pas notés, une caisse semble avoir trop et l’autre pas assez.

Les **frais** prélevés par l’opérateur (retrait, transfert, paiement) sont, eux, de vraies dépenses : notez-les comme telles.

## Le contrôle quotidien

Chaque soir :

1. Ouvrez l’application de chaque opérateur et notez le **solde réel**.
2. Comparez-le au **solde calculé** par votre logiciel.
3. En cas d’écart, cherchez la cause dans la liste ci-dessous.

- une vente Mobile Money notée en espèces (ou l’inverse) ;
- un retrait ou un dépôt non enregistré ;
- des frais non notés ;
- un paiement d’un client annoncé mais jamais reçu.

C’est le même principe que la [clôture de la caisse en espèces](/blog/cloture-de-caisse).

## Les arnaques fréquentes à surveiller

- **Le faux SMS de confirmation** : le client montre un message qui ressemble à une confirmation de paiement. Vérifiez toujours dans votre propre application.
- **« Je me suis trompé de montant, renvoyez-moi la différence »** : vérifiez la transaction reçue avant de renvoyer quoi que ce soit.
- **Le paiement « en cours »** : ne remettez pas la marchandise tant que l’argent n’est pas arrivé.

## Séparer l’argent personnel et l’argent de la boutique

Si vous recevez les paiements de la boutique sur votre numéro personnel, l’argent du commerce et celui de la famille se mélangent. Si possible, utilisez un **numéro ou un compte marchand dédié à la boutique**. Sinon, notez chaque retrait personnel comme une sortie de la caisse.

## Wave et Orange Money dans Nagaw Business

Nagaw Business crée pour chaque boutique des caisses **Caisse, Wave, Orange Money, Free Money, autre Mobile Money et Banque**. À la vente, le paiement Mobile Money se saisit avec l’opérateur et le numéro de transaction, et va dans la bonne caisse. Le solde de chaque caisse est **calculé** à partir des ventes, des remboursements, des dépenses et des déplacements d’argent (« Déplacer de l’argent »), et chaque caisse peut être clôturée.

Nagaw Business n’est **pas relié** à votre compte Wave ou Orange Money : il ne lit pas vos transactions. Il vous donne le solde attendu, que vous comparez à celui de l’application de l’opérateur.

Pour une vue d’ensemble, lisez [la trésorerie d’un petit commerce](/blog/tresorerie-petit-commerce).
`,
  faq: [
    {
      question:
        'Comment suivre les paiements Wave et Orange Money de sa boutique ?',
      answer:
        'Traitez chaque opérateur comme une caisse à part, notez l’opérateur et le numéro de transaction à chaque vente, enregistrez retraits et frais, et comparez chaque soir le solde calculé au solde de l’application de l’opérateur.',
    },
    {
      question: 'Comment éviter les arnaques au paiement Mobile Money ?',
      answer:
        'Vérifiez toujours l’arrivée de l’argent dans votre propre application avant de remettre la marchandise, et ne renvoyez jamais d’argent sur la foi d’un SMS montré par le client.',
    },
    {
      question: 'Un retrait Wave est-il une dépense ?',
      answer:
        'Non, c’est un déplacement d’argent de la caisse Wave vers la caisse en espèces. Seuls les frais de retrait sont une dépense.',
    },
  ],
  related: [
    'cloture-de-caisse',
    'tresorerie-petit-commerce',
    'application-caisse-telephone',
  ],
};
