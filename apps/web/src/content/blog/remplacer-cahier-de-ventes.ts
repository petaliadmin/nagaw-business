import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'remplacer-cahier-de-ventes',
  title: 'Passer du cahier de ventes à une application : la méthode en 7 jours',
  seoTitle: 'Cahier de ventes : passer à une application en 7 jours',
  description:
    'Le cahier de ventes ne calcule rien et s’efface facilement. Voici une méthode simple, jour par jour, pour passer à une application de gestion sans rien perdre.',
  category: 'gestion',
  keywords: [
    'cahier de ventes',
    'cahier de caisse',
    'tenir un cahier de recettes',
    'digitaliser sa boutique',
    'gestion boutique sur téléphone',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Le cahier de ventes ne calcule ni le stock, ni la marge, ni l’argent par caisse, et une ligne corrigée ne laisse aucune trace.',
    'Passez à une application en sept jours : produits les plus vendus d’abord, puis crédit des clients, caisses, et enfin le reste du catalogue.',
    'Gardez le cahier en parallèle trois jours seulement, pour comparer, puis arrêtez-le.',
    'Clôturez la caisse chaque soir dès le premier jour.',
  ],
  body: `
Le **cahier de ventes** est l’outil de gestion le plus répandu dans les boutiques. Il est simple, ne tombe jamais en panne et ne demande pas de réseau. Mais il ne fait aucun calcul, il ne protège pas contre les erreurs et il ne dit pas ce que vous gagnez. Passer à une application ne demande pas de tout changer d’un coup : voici une méthode sur sept jours.

## Ce que le cahier ne peut pas faire

| Besoin | Avec le cahier | Avec une application |
| --- | --- | --- |
| Total du jour | Calcul à la main, le soir | Affiché en direct |
| Stock restant | Inventaire complet nécessaire | Mis à jour à chaque vente |
| Crédit des clients | Pages à relire | Liste « qui me doit combien » |
| Argent Wave, Orange Money | Mélangé avec les espèces | Un solde par caisse |
| Bénéfice | Rarement calculé | Marge et bénéfice estimés |
| Ligne corrigée | Aucune trace | Annulation avec motif, gardée dans l’historique |
| Suivi à distance | Impossible | Depuis votre téléphone |

## La méthode en 7 jours

### Jour 1 : vos 20 produits les plus vendus

N’essayez pas de saisir tout le catalogue. Prenez les **vingt produits qui partent le plus**, et pour chacun notez le nom, le prix de vente, le **prix d’achat** et ce qui reste vraiment en rayon. Compter maintenant vous évitera un stock faux dès le départ.

### Jour 2 : toutes les ventes de ces produits passent par l’application

Encaissez ces vingt produits avec l’application. Pour les autres, continuez le cahier. Le soir, comparez : le total de l’application doit correspondre à ce que vous avez encaissé pour ces produits.

### Jour 3 : le crédit des clients

Reprenez les pages de crédit du cahier. Pour chaque client qui vous doit de l’argent, créez sa fiche et enregistrez son solde. Désormais, toute vente à crédit passe par l’application. Voir [gérer le crédit des clients](/blog/credit-clients-boutique).

### Jour 4 : les caisses

Comptez l’argent du tiroir et notez le solde de vos comptes Wave, Orange Money ou banque. Entrez-les comme **argent de départ** de chaque caisse. Le soir, faites votre première [clôture de caisse](/blog/cloture-de-caisse).

### Jour 5 : le reste du catalogue

Ajoutez les produits restants, par rayon. Pour les produits de faible valeur vendus au détail, regroupez-les si besoin, mais gardez un prix d’achat juste.

### Jour 6 : les dépenses

Transport, électricité, loyer, achat de marchandises : notez chaque sortie d’argent dans l’application, avec la caisse d’où elle sort. C’est ce qui permet de calculer le bénéfice.

### Jour 7 : arrêtez le cahier

Si les clôtures de caisse des trois derniers jours sont justes, rangez le cahier. Gardez-le quelques mois pour les anciens crédits, mais n’y notez plus rien de nouveau.

## Comment embarquer vos vendeurs

- Donnez à chacun **son propre compte** : on saura qui a vendu quoi.
- Montrez-leur uniquement l’écran de vente le premier jour.
- Expliquez qu’une vente ne se supprime pas : elle s’annule avec un motif, par un responsable.
- Faites la clôture de caisse avec eux les premiers soirs.

Pour aller plus loin, lisez [comment gérer ses vendeurs](/blog/gerer-vendeurs-boutique).

## Les objections les plus fréquentes

**« Je n’ai pas le temps de tout saisir. »** C’est pour cela que la méthode commence par vingt produits. La saisie d’une vente dans une application prend quelques secondes : moins que d’écrire une ligne et de refaire les additions le soir.

**« Le réseau coupe souvent. »** Choisissez une application dont la caisse fonctionne hors ligne. Voir [vendre sans internet](/blog/vendre-sans-internet).

**« Mes clients n’ont pas de smartphone. »** Ce n’est pas un problème : le ticket peut être imprimé, et le client n’a rien à installer.

## Pour commencer

Nagaw Business a été pensé pour ce passage : de grands boutons, des mots du quotidien, une caisse qui s’ouvre sans réseau, le crédit des clients dans « Ils me doivent » et un solde par caisse. Chaque boutique commence avec l’offre gratuite, sans carte bancaire.
`,
  faq: [
    {
      question: 'Comment tenir un cahier de ventes correctement ?',
      answer:
        'Notez chaque vente avec la date, le produit, la quantité, le prix et le moyen de paiement, faites le total chaque soir et comparez-le à l’argent compté. Une application fait ces calculs à votre place et garde la trace de chaque correction.',
    },
    {
      question: 'Combien de temps faut-il pour passer à une application ?',
      answer:
        'Une semaine suffit avec une méthode progressive : les produits les plus vendus le premier jour, puis le crédit des clients, les caisses et le reste du catalogue.',
    },
    {
      question: 'Faut-il garder le cahier en parallèle ?',
      answer:
        'Quelques jours seulement, pour comparer les totaux. Au-delà, tenir deux registres crée des écarts et fait perdre du temps.',
    },
  ],
  related: [
    'logiciel-gestion-boutique',
    'credit-clients-boutique',
    'cloture-de-caisse',
  ],
};
