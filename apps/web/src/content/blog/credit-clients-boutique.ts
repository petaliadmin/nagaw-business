import type { Article } from '@/lib/blog/types';

export const article: Article = {
  slug: 'credit-clients-boutique',
  title: 'Vendre à crédit sans perdre d’argent : gérer les dettes des clients',
  seoTitle: 'Crédit clients en boutique : suivre qui vous doit',
  description:
    'Plafond par client, trace de chaque achat, relance polie, remboursements : comment gérer le crédit des clients de votre boutique sans vous mettre en difficulté.',
  category: 'ventes',
  keywords: [
    'crédit client boutique',
    'gestion des dettes clients',
    'cahier de crédit',
    'vente à crédit',
    'relance client impayé',
  ],
  published: '2026-10-26',
  updated: '2026-10-26',
  summary: [
    'Le crédit fidélise, mais chaque franc prêté est un franc qui ne sert plus à racheter de la marchandise.',
    'Fixez un plafond de crédit par client et refusez d’aller au-delà.',
    'Notez chaque achat à crédit et chaque remboursement, avec la date, pour pouvoir montrer le détail au client.',
    'Regardez chaque semaine le total que vos clients vous doivent, et relancez tôt.',
  ],
  body: `
Vendre à crédit fait partie de la vie d’une boutique de quartier : un client fidèle paie à la fin du mois, un autre au retour de sa paie. Bien géré, le **crédit client** fidélise. Mal géré, il vide la caisse : l’argent prêté ne sert plus à racheter de la marchandise, et une partie ne revient jamais.

## Le vrai coût du crédit

Quand un client vous doit 20 000 F CFA, ce n’est pas seulement 20 000 F qui manquent. C’est aussi :

- de la marchandise que vous ne pouvez pas racheter ;
- du temps passé à relancer ;
- un risque de perte si le client disparaît ;
- parfois une relation abîmée.

Le crédit n’est donc pas gratuit pour la boutique. Il doit être **limité et suivi**.

## Les cinq règles d’un crédit bien géré

### 1. Choisir à qui faire crédit

Réservez le crédit aux clients que vous connaissez, qui achètent régulièrement et qui ont déjà remboursé. Un nouveau client paie comptant, au moins les premières fois.

### 2. Fixer un plafond par client

Le plafond est le montant maximum qu’un client peut vous devoir. Au-delà, il doit rembourser avant d’acheter de nouveau à crédit. Annoncez-le clairement : « Je peux vous faire crédit jusqu’à 15 000 F. » Un plafond évite les discussions gênantes au comptoir.

### 3. Tout noter, tout de suite

Chaque achat à crédit doit être noté avec la date, les produits et le montant. Chaque remboursement aussi. C’est ce qui vous permet de montrer au client le détail de sa dette s’il la conteste.

### 4. Fixer une date de remboursement

« À la fin du mois », « le 5 », « à la paie » : une date claire évite les crédits qui traînent. Notez-la avec la vente.

### 5. Relancer tôt et poliment

Plus une dette est ancienne, moins elle a de chances d’être payée. Relancez dès le lendemain de la date prévue, sans attendre plusieurs semaines.

## Le cahier de crédit ou une application ?

| Besoin | Cahier de crédit | Application |
| --- | --- | --- |
| Total que doit un client | À recalculer | Affiché sur sa fiche |
| Total que vous doivent tous les clients | Rarement connu | Toujours à jour |
| Plafond respecté | Selon la mémoire | Vérifié à chaque vente |
| Détail à montrer au client | Pages à retrouver | Historique de ses achats et paiements |
| Remboursement partiel | Ratures | Enregistré avec la date |

## Comment relancer un client sans le perdre

- Choisissez le bon moment : en privé, pas devant la file d’attente.
- Restez factuel : « Vous me devez 12 500 F depuis le 30. »
- Proposez une solution : un remboursement en deux fois, par Wave ou Orange Money (voir [suivre Wave et Orange Money](/blog/suivre-wave-orange-money)).
- Un message WhatsApp courtois fonctionne souvent mieux qu’une remarque au comptoir.
- Tant que la dette n’est pas réglée, ne remettez pas de nouveau crédit.

Exemple de message : « Bonjour, petit rappel : il reste 12 500 F à régler sur vos achats du mois. Vous pouvez payer à la boutique ou par Wave. Merci et bonne journée. »

## Le crédit dans vos chiffres

Une vente à crédit compte dans votre **chiffre d’affaires** le jour de la vente, mais l’argent n’est pas dans la caisse. C’est une **créance**. Si vos ventes montent mais que votre caisse reste vide, regardez le total des créances. Voir [gérer la trésorerie d’un petit commerce](/blog/tresorerie-petit-commerce).

## Le crédit client dans Nagaw Business

À la caisse de Nagaw Business, « crédit » est un moyen de paiement comme les autres, possible seul ou avec un acompte. Le serveur vérifie que la vente reste **dans le plafond du client**. L’écran « Ils me doivent » liste les clients qui doivent de l’argent avec le total à récupérer ; la fiche d’un client montre son solde, son historique et permet d’enregistrer un remboursement. La trésorerie affiche les créances à côté de l’argent des caisses.

Pour commencer à tout suivre, voir [comment passer du cahier à une application](/blog/remplacer-cahier-de-ventes).
`,
  faq: [
    {
      question: 'Comment gérer le crédit des clients dans une boutique ?',
      answer:
        'Réservez-le aux clients connus, fixez un plafond par client, notez chaque achat et chaque remboursement avec la date, fixez une date de paiement et relancez tôt.',
    },
    {
      question: 'Comment relancer un client qui ne paie pas ?',
      answer:
        'En privé et poliment, avec le montant exact et la date de la dette, en proposant une solution (paiement en deux fois, Mobile Money). Ne lui accordez pas de nouveau crédit tant que la dette n’est pas réglée.',
    },
    {
      question: 'Une vente à crédit compte-t-elle dans le chiffre d’affaires ?',
      answer:
        'Oui, le jour de la vente. Mais l’argent n’est pas encore dans la caisse : c’est une créance, à suivre à part dans la trésorerie.',
    },
  ],
  related: [
    'tresorerie-petit-commerce',
    'remplacer-cahier-de-ventes',
    'cloture-de-caisse',
  ],
};
