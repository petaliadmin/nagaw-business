# Nagaw Business

> « Gérer sa boutique aussi simplement qu'on compte sa caisse, même sans connexion. »

Application SaaS de **gestion de boutique**, mobile first, utilisable sur ordinateur et **hors connexion** : produits et stock, ventes, statistiques et trésorerie, comptabilité (SYSCOHADA), factures et devis. Interface colorée, accessible et pensée pour les personnes peu à l'aise avec le numérique. Aucune IA ni automatisation (ADR-017). Repositionnement du 2026-10-24 : ADR-019 à ADR-021, proposés.

## État du projet

**Socle livré** : comptes, boutiques (organisations) multi-tenant, équipe et rôles, historique (journal d'audit), design coloré et accessible, application installable avec page hors ligne (Phase 8), **produits et stock** (Phase 9), **ventes et clients** (Phase 10), **caisse hors ligne** (Phase 11), **factures et devis** (Phase 12), **statistiques et trésorerie** (Phase 13), **comptabilité** (système minimal de trésorerie SYSCOHADA, Phase 14), **offres et quotas** (Phase 15, sans paiement en ligne), **administration de la plateforme** (Phase 16). Voir [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) et [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Documentation

| Document                                       | Contenu                                         |
| ---------------------------------------------- | ----------------------------------------------- |
| [docs/AUDIT_PHASE_0.md](docs/AUDIT_PHASE_0.md) | Audit initial, risques, MVP, questions ouvertes |
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md)   | Vision, personas, modules                       |
| [docs/DESIGN.md](docs/DESIGN.md)               | Design, palette, accessibilité                  |
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

Next.js 16 · NestJS 12 · TypeScript 6 · pnpm workspaces · Tailwind 4 · zod · pino · Vitest · GitHub Actions · Vercel. Supabase (Postgres, Auth) · Kysely · jose · Playwright.

## Structure

```
apps/web         Next.js (App Router), interface en français
apps/api         API NestJS, préfixe /api/v1
packages/shared  contrats partagés (schémas zod, rôles, permissions)
supabase/        migrations SQL (source de vérité du schéma)
docs/            documentation
```

## Démarrage local

Prérequis : Node.js 24 (`.nvmrc`) et pnpm 10.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # lu au démarrage de l'API ; sans lui, pas de base
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
pnpm test:integration   # tests d'intégration de l'API (Postgres requis, voir docs/TESTING.md)
pnpm build
pnpm test:e2e           # Playwright
```
