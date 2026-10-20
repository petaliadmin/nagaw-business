# Stratégie de tests

> **État** : en place depuis la Phase 1 pour les tests unitaires et d'intégration. Les tests end-to-end (Playwright) arrivent avec la Phase 2.

## Niveaux

| Niveau                | Outil (proposé)                                                                                                | Portée                                                                                                           | Base de données                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Unitaire              | Vitest                                                                                                         | Règles métier pures : transitions de statut, moteur de politiques, seuils, hash d'action, quotas, validation zod | aucune                                                                                     |
| Intégration API       | Vitest + Supertest                                                                                             | Endpoints NestJS de bout en bout : guards, isolation multi-tenant, idempotence, webhooks                         | Postgres réel (Supabase CLI local ou conteneur Postgres en CI), réinitialisé par migration |
| Fournisseurs externes | Faux adaptateurs (`EmailProvider`, puis `LlmProvider` quand l'IA sera réactivée) **uniquement dans les tests** | Scénarios d'échec, timeouts, sorties malveillantes du modèle                                                     | —                                                                                          |
| End-to-end            | Playwright (Chromium préinstallé)                                                                              | Parcours de recette § 14                                                                                         | Supabase local                                                                             |
| Sécurité              | Tests d'intégration dédiés + scan de secrets (gitleaks) + `pnpm audit`                                         | Accès inter-organisations, élévation de rôle, contournement d'approbation, clés dans le bundle                   | —                                                                                          |

## Règles

- Les tests d'isolation multi-tenant sont **obligatoires** pour chaque nouvel endpoint : un utilisateur de l'organisation B doit obtenir 404 sur chaque ressource de A, en lecture comme en écriture.
- On ne mocke pas le code testé. On ne mocke que les frontières externes : fournisseurs IA, e-mail, paiement.
- Un correctif de bug s'accompagne d'un test qui échoue avant le correctif.
- Aucun test n'est désactivé pour faire passer la CI.

## Commandes

```
pnpm lint
pnpm typecheck
pnpm test            # unitaires
pnpm test:integration
pnpm test:e2e         # à partir de la Phase 2
pnpm build
```

## Correspondance des parcours E2E

| #   | Parcours                             | Phase de livraison  |
| --- | ------------------------------------ | ------------------- |
| 1   | Inscription et connexion             | 2–3                 |
| 2   | Création d'une organisation          | 2–4                 |
| 3   | Invitation d'un collaborateur        | 4                   |
| 4   | Création d'un agent                  | 5                   |
| 5   | Définition d'une responsabilité      | 6                   |
| 6   | Lancement d'une tâche                | 7                   |
| 7   | Consultation du résultat             | 7                   |
| 8   | Soumission d'une action à validation | 8                   |
| 9   | Approbation / refus                  | 8                   |
| 10  | Consultation de l'audit              | 8                   |
| 11  | Isolation inter-organisations        | 2 puis chaque phase |
| 12  | Erreur d'intégration                 | 9                   |
