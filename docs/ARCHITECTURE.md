# Architecture technique

> **État** : architecture **cible proposée** (Phase 0). Aucun code n'existe encore. Les choix sont justifiés dans [`DECISIONS.md`](./DECISIONS.md).

## 1. Vue d'ensemble

```
┌─────────────────────┐      HTTPS + JWT        ┌──────────────────────────┐
│  apps/web (Next.js) │ ──────────────────────► │  apps/api (NestJS)       │
│  Vercel             │   /api/v1/*             │  REST, guards, policies  │
│                     │                         │                          │
│  Supabase Auth      │                         │  enqueue ──┐             │
│  (clé anon only)    │                         └────────────┼─────────────┘
└─────────┬───────────┘                                      │
          │ auth                                             ▼
          ▼                                     ┌──────────────────────────┐
┌─────────────────────────────────────────┐     │  worker (même code,      │
│  Supabase                               │◄────│  autre point d'entrée)   │
│  • Auth (JWT, JWKS)                     │     │  pg-boss: exécutions,    │
│  • Postgres (données + file pg-boss)    │     │  planifications, envois  │
│  • Storage (documents, Phase 10)        │     └───────────┬──────────────┘
└─────────────────────────────────────────┘                 │
                                                            ▼
                                          Fournisseurs IA · E-mail · Intégrations
```

## 2. Structure du dépôt (cible)

```
apps/
  web/                 Next.js App Router
    app/(auth)/        connexion, inscription, reset
    app/(app)/         espace métier (layout sidebar)
    app/(admin)/       espace d'administration plateforme (séparé)
    components/ui/     design system (shadcn/ui)
    lib/api/           client API typé
  api/
    src/main.ts        point d'entrée HTTP
    src/worker.ts      point d'entrée worker
    src/common/        auth guard, tenant context, filtres d'erreurs, logs
    src/modules/       organizations, members, invitations, agents,
                       responsibilities, tasks, approvals, policies,
                       integrations, notifications, usage, audit, admin
    src/engine/        moteur d'exécution, registre d'outils, LLM providers
packages/
  shared/              schémas zod, enums de statuts, contrats d'API
supabase/
  migrations/          SQL versionné (source de vérité)
  seed.sql             données de développement local uniquement
docs/
.github/workflows/
```

## 3. Cycle d'une requête métier

1. Le frontend envoie le JWT Supabase (`Authorization: Bearer`) et `X-Organization-Id`.
2. `AuthGuard` vérifie la signature (JWKS), l'expiration et l'audience, puis charge `userId`.
3. `TenantGuard` vérifie l'appartenance active à l'organisation et charge le rôle. Il répond 404 (et non 403) si l'appartenance n'existe pas, pour ne pas révéler l'existence de l'organisation.
4. `PermissionGuard` vérifie la permission requise par le handler (`@RequirePermission('agents.write')`).
5. Le service exécute la logique via des repositories qui imposent le filtre `organization_id`.
6. Les actions sensibles écrivent une entrée `audit_logs` **dans la même transaction**.

## 4. Moteur d'exécution des agents (Phase 7)

```
déclencheur (manuel | planifié | événement)
  → création task (idempotency_key unique) → enqueue pg-boss
  → worker: verrou task, statut running
  → boucle bornée (max_steps, max_tokens, timeout):
       LLM ─► proposition d'appel d'outil
            ─► validation zod des paramètres
            ─► PolicyEngine.evaluate(org, agent, tool, params)
                 forbidden          → étape refusée, renvoyée au modèle
                 read_only/prepare  → exécution en lecture / brouillon
                 auto_within_limits → exécution si conditions OK sinon approval
                 approval_required  → approval(action_hash) ; task = awaiting_approval
            ─► task_step + task_events + usage_records
  → succeeded | failed | cancelled ; notification
```

Les contenus externes (e-mails, documents) sont injectés dans le contexte comme **données balisées non fiables**. Ils ne peuvent jamais modifier les politiques, qui sont évaluées hors du modèle.

## 5. Rôles et permissions (proposition initiale)

| Permission                                | owner | admin |    member    | viewer |
| ----------------------------------------- | :---: | :---: | :----------: | :----: |
| Lire les données de l'organisation        |   ✔   |   ✔   |      ✔       |   ✔    |
| Gérer agents et responsabilités           |   ✔   |   ✔   |      ✔       |        |
| Lancer / annuler des tâches               |   ✔   |   ✔   |      ✔       |        |
| Approuver des actions                     |   ✔   |   ✔   | configurable |        |
| Gérer intégrations et politiques          |   ✔   |   ✔   |              |        |
| Gérer membres et invitations              |   ✔   |   ✔   |              |        |
| Abonnement, suppression de l'organisation |   ✔   |       |              |        |

L'administration plateforme utilise une table séparée (`platform_admins`) et des endpoints `/api/v1/admin/*`. Elle ne donne **pas** accès au contenu métier des organisations.
