# Nagaw Business

> « Nagaw fournit des collaborateurs numériques autonomes, auxquels le dirigeant peut déléguer des responsabilités. »

Plateforme SaaS multi-entreprises pour centraliser les informations d'une entreprise, piloter ses activités et déléguer des responsabilités à des agents numériques supervisés.

## État du projet

**Phase 1 (socle technique) livrée. Aucun module métier n'est encore disponible.** Voir [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md).

## Documentation

| Document                                       | Contenu                                         |
| ---------------------------------------------- | ----------------------------------------------- |
| [docs/AUDIT_PHASE_0.md](docs/AUDIT_PHASE_0.md) | Audit initial, risques, MVP, questions ouvertes |
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md)   | Vision et concepts                              |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)   | Architecture cible                              |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md)       | Modèle de données                               |
| [docs/API.md](docs/API.md)                     | Conventions d'API                               |
| [docs/SECURITY.md](docs/SECURITY.md)           | Sécurité et permissions                         |
| [docs/TESTING.md](docs/TESTING.md)             | Stratégie de tests                              |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)       | Environnements et variables                     |
| [docs/OPERATIONS.md](docs/OPERATIONS.md)       | Exploitation                                    |
| [docs/ROADMAP.md](docs/ROADMAP.md)             | Phases et progression                           |
| [docs/DECISIONS.md](docs/DECISIONS.md)         | Décisions techniques (ADR)                      |

## Stack

Next.js 16 · NestJS 12 · TypeScript 6 · pnpm workspaces · Tailwind 4 · zod · pino · Vitest · GitHub Actions · Vercel. Prévu : Supabase (Postgres, Auth, Storage) et Playwright.

## Structure

```
apps/web         Next.js (App Router), interface en français
apps/api         API NestJS, préfixe /api/v1
packages/shared  contrats partagés (schémas zod)
docs/            documentation
```

## Démarrage local

Prérequis : Node.js 24 (`.nvmrc`) et pnpm 10.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # facultatif : valeurs par défaut sûres
cp apps/web/.env.example apps/web/.env.local
pnpm dev        # web sur http://localhost:3000, API sur http://localhost:3001
```

- Santé de l'API : http://localhost:3001/api/v1/health
- Documentation OpenAPI : http://localhost:3001/api/v1/docs

## Vérifications

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test               # tests unitaires
pnpm test:integration   # tests d'intégration de l'API
pnpm build
```
