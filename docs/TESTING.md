# Stratégie de tests

> **État** : tests unitaires (Vitest), tests d'intégration de l'API sur un vrai Postgres, et tests end-to-end Playwright (bureau et mobile) en place.

## Base de données des tests d'intégration

`apps/api/test/support/global-setup.ts` crée une base jetable à partir des **vraies migrations** (`supabase/migrations`), précédées d'un substitut minimal du schéma `auth` de Supabase (`test/support/supabase-stub.sql`). Les tests se connectent avec le rôle `nagaw_api`, avec les mêmes droits qu'en production.

- En local : un Postgres 16+ accessible via `TEST_DATABASE_ADMIN_URL` (par défaut `postgres://postgres@127.0.0.1:54329/postgres`).
- En CI : service `postgres:17`.

Les jetons sont signés par une vraie paire de clés ES256 locale, qui remplace le JWKS du projet.

## Tests end-to-end (Playwright)

Ils tournent sur le build de production, servi par deux serveurs (`apps/web/playwright.config.ts`) :

| Serveur   | Configuration                                                                 | Projets                          | Couvre                                                                                            |
| --------- | ----------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------- |
| port 3100 | ni Supabase ni API                                                            | `chromium`, `mobile`             | pages publiques, validation côté serveur, états « non configuré », redirections externes refusées |
| port 3101 | faux Supabase Auth et fausse API (`e2e/support/fake-backend.mjs`, port 54400) | `app-desktop`, puis `app-mobile` | espace connecté complet, sur ordinateur et sur mobile                                             |

Les fichiers de l'espace connecté (`e2e/app/workspace.spec.ts`, `e2e/app/team.spec.ts`, `e2e/app/agents.spec.ts`, `e2e/app/responsibilities.spec.ts`) partagent ce faux backend et le réinitialisent : Playwright tourne donc avec un seul worker (`workers: 1`), pour qu'aucun fichier ne voie les modifications d'un autre.

Le contrôle de débordement horizontal compare `scrollWidth` à `clientWidth` (et non à `innerWidth`, qui grandit avec le contenu sur mobile et masquait le problème).

Le faux backend remplace uniquement les deux frontières externes : il publie un JWKS et émet de **vrais jetons ES256**, que le web vérifie exactement comme en production. Il applique aussi les mêmes règles d'appartenance que le `TenantGuard`. Le code applicatif ne contient **aucun contournement** d'authentification.

Le parcours réel (e-mail de confirmation compris) dépend d'un vrai projet Supabase et d'une boîte e-mail. Il a été vérifié manuellement en production le 2026-10-20.

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
pnpm test:e2e        # build + Playwright (PLAYWRIGHT_CHROMIUM_PATH pour un Chromium préinstallé)
pnpm build
```

## Correspondance des parcours E2E

| #   | Parcours                             | Phase de livraison  |
| --- | ------------------------------------ | ------------------- |
| 1   | Inscription et connexion             | 2–3                 |
| 2   | Création d'une organisation          | 2–4                 |
| 3   | Invitation d'un collaborateur        | 4 (livré)           |
| 4   | Création d'un agent                  | 5 (livré)           |
| 5   | Définition d'une responsabilité      | 6 (livré)           |
| 6   | Lancement d'une tâche                | 7                   |
| 7   | Consultation du résultat             | 7                   |
| 8   | Soumission d'une action à validation | 8                   |
| 9   | Approbation / refus                  | 8                   |
| 10  | Consultation de l'audit              | 8                   |
| 11  | Isolation inter-organisations        | 2 puis chaque phase |
| 12  | Erreur d'intégration                 | 9                   |
