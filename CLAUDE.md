# Instructions permanentes pour Claude Code — Nagaw Business

## Méthode

- Développement **par phases** (voir `docs/ROADMAP.md`). Ne pas commencer une phase sans validation explicite du propriétaire.
- Avant de modifier : lire le code concerné, `IMPLEMENTATION_STATUS.md` et les ADR de `docs/DECISIONS.md`.
- Après chaque phase : mettre à jour `IMPLEMENTATION_STATUS.md` et les documents concernés, puis produire le rapport de fin de phase (sections A à I du prompt maître).
- Toute décision technique structurante fait l'objet d'un ADR dans `docs/DECISIONS.md`.

## Règles non négociables

- Pas de page vide, de bouton sans action, de TODO à la place d'une fonctionnalité, ni de données fictives présentées comme réelles.
- Ne jamais déclarer opérationnelle une intégration non vérifiée.
- Pas de `catch` vide : chaque erreur est traitée ou propagée avec contexte.
- Autorisation vérifiée côté serveur sur chaque opération. Ne jamais utiliser un `organization_id` venant du client sans vérifier l'appartenance.
- Tout nouvel endpoint métier est accompagné d'un test d'isolation inter-organisations.
- Secrets uniquement côté serveur, jamais dans `NEXT_PUBLIC_*`, jamais dans Git, jamais en clair dans les logs.
- Seuils et politiques d'action configurables en base, jamais codés en dur.
- Les migrations SQL de `supabase/migrations` sont la seule source de vérité du schéma. Ne jamais modifier une migration déjà fusionnée : en créer une nouvelle.
- Ne jamais désactiver un test pour obtenir une CI verte.
- Pas de push sur `main`, pas de fusion de PR, pas de déploiement en production sans autorisation explicite.

## Commandes

Elles seront définies en Phase 1 (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`).
