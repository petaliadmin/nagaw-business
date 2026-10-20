# Décisions techniques (ADR)

Chaque décision a un statut : **Proposée**, **Acceptée**, **Remplacée**. Les décisions de la Phase 0 sont des choix par défaut réversibles. Elles doivent être acceptées par le propriétaire avant la Phase 1.

---

## ADR-001 — Monorepo pnpm workspaces

- **Statut** : Proposée (Phase 0)
- **Contexte** : le dépôt est vide. Le frontend, l'API, le worker et les contrats partagés doivent évoluer ensemble.
- **Décision** : utiliser un monorepo **pnpm workspaces** avec `apps/web`, `apps/api` (API et worker, deux points d'entrée), `packages/shared` et `supabase/`. Pas de Turborepo au départ. Des scripts pnpm récursifs suffisent ; un outil de build incrémental ne sera ajouté que si les temps de CI le justifient.
- **Conséquences** : une seule PR peut modifier un contrat d'API et ses deux consommateurs.

## ADR-002 — Frontend Next.js (App Router) + Tailwind

- **Statut** : Proposée
- **Décision** : utiliser Next.js (dernière version stable compatible), React, TypeScript `strict` et Tailwind CSS, avec des composants accessibles de type **shadcn/ui** (Radix), copiés dans le dépôt et non pris comme dépendance opaque. La validation des formulaires repose sur **react-hook-form + zod**, avec des schémas partagés via `packages/shared`.
- **Règle** : le frontend n'utilise Supabase que pour l'**authentification** (clé `anon` publique). Toutes les données métier passent par l'API.

## ADR-003 — API NestJS versionnée `/api/v1`

- **Statut** : Proposée
- **Décision** : NestJS, modules par domaine, DTO validés côté serveur (zod via un pipe partagé, ou class-validator si l'outillage Swagger l'impose : à trancher en Phase 1), OpenAPI/Swagger, filtre d'exceptions global, logs JSON structurés (pino), limitation de débit (`@nestjs/throttler`).

## ADR-004 — Supabase : Postgres + Auth + Storage, migrations SQL versionnées

- **Statut** : Proposée
- **Décision** : les migrations SQL dans `supabase/migrations` (Supabase CLI) constituent la **seule source de vérité** du schéma. L'API accède à Postgres via une connexion directe et un query builder typé (**Kysely**, avec types générés depuis la base). Aucun ORM ne génère ses propres migrations.
- **Alternatives écartées** : Prisma et Drizzle, dont les migrations entreraient en concurrence avec celles de Supabase ; `supabase-js` côté serveur, qui ne gère pas les transactions.

## ADR-005 — Isolation multi-tenant : contrôle applicatif + RLS en défense en profondeur

- **Statut** : Proposée
- **Décision** :
  1. L'API vérifie le JWT Supabase (JWKS) à chaque requête.
  2. L'organisation active est transmise par en-tête (`X-Organization-Id`). L'API **vérifie l'appartenance** (`organization_memberships`) et charge le rôle. Un `organization_id` venant du client n'est jamais utilisé sans cette vérification.
  3. Chaque requête métier est filtrée par `organization_id` via un repository de base qui l'impose.
  4. La RLS est activée sur toutes les tables métier. Les rôles `anon` et `authenticated` n'ont **aucun accès direct** aux tables métier, ce qui couvre le cas d'une clé `anon` utilisée en dehors du frontend. L'API utilise un rôle Postgres dédié.
  5. Des tests d'intégration démontrent qu'une organisation A ne peut ni lire ni modifier les ressources de B, endpoint par endpoint.

## ADR-006 — Traitement asynchrone via file Postgres (pg-boss)

- **Statut** : Proposée
- **Décision** : utiliser **pg-boss** (file de tâches sur Postgres) pour les exécutions d'agents, les planifications, les envois de notifications et les reprises. Le worker est un processus séparé, issu du même code que l'API.
- **Raison** : pas d'infrastructure supplémentaire (Redis) pour le MVP, transactions dans la même base, planification cron intégrée.
- **Réévaluation** : si le débit de tâches dépasse ce que Postgres supporte confortablement.

## ADR-007 — Couche IA indépendante du fournisseur

- **Statut** : Proposée
- **Décision** : une interface `LlmProvider` (messages, outils, sortie structurée, timeouts, comptage de jetons) avec un adaptateur par fournisseur. Le premier adaptateur est Anthropic. Le modèle est choisi par agent parmi une liste autorisée côté serveur.
- **Règles** : les sorties du modèle ne sont pas fiables. Chaque appel d'outil passe par le **moteur de politiques** (ADR-008) puis par la validation zod des paramètres avant toute exécution.

## ADR-008 — Moteur de politiques et approbations liées à l'empreinte de l'action

- **Statut** : Proposée
- **Décision** : chaque outil déclare une catégorie d'action. L'organisation et l'agent associent à chaque outil une politique : `read_only`, `prepare_only`, `auto_within_limits`, `approval_required` ou `forbidden`, avec des conditions (par exemple un seuil de montant) **stockées en base**, jamais codées en dur. Une approbation référence un **hash canonique** de l'outil et de ses paramètres significatifs. Si les paramètres changent, le hash ne correspond plus et l'approbation est invalide.

## ADR-009 — Chiffrement applicatif des credentials d'intégration

- **Statut** : Proposée
- **Décision** : les jetons et clés d'intégration sont chiffrés (AES-256-GCM) par l'API avec une clé maître hors base (variable d'environnement, rotation documentée). Ils ne sont jamais renvoyés au frontend et sont masqués dans les logs. Supabase Vault reste une alternative à évaluer en Phase 9.

## ADR-010 — Hébergement

- **Statut** : Proposée
- **Décision** : le frontend est hébergé sur **Vercel**. L'API et le worker sont livrés comme image Docker unique sur un hébergeur de conteneurs (Render ou Fly.io, à confirmer). Trois environnements sont prévus : local (Supabase CLI + Docker), préproduction et production, chacun avec son propre projet Supabase.
