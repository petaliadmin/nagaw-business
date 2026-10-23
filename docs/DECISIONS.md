# Décisions techniques (ADR)

Chaque décision a un statut : **Proposée**, **Acceptée**, **Remplacée**, **Reportée**. Les ADR 001 à 010 ont été validés le 2026-10-20, avec les ajustements suivants du propriétaire : IA reportée (Q2), API hébergée sur Vercel (Q6), interface en français uniquement (Q7).

---

## ADR-001 — Monorepo pnpm workspaces

- **Statut** : Acceptée
- **Contexte** : le dépôt est vide. Le frontend, l'API, le worker et les contrats partagés doivent évoluer ensemble.
- **Décision** : utiliser un monorepo **pnpm workspaces** avec `apps/web`, `apps/api`, `packages/shared` et `supabase/`. Pas de Turborepo au départ. Des scripts pnpm récursifs suffisent ; un outil de build incrémental ne sera ajouté que si les temps de CI le justifient.
- **Conséquences** : une seule PR peut modifier un contrat d'API et ses deux consommateurs.

## ADR-002 — Frontend Next.js (App Router) + Tailwind

- **Statut** : Acceptée
- **Décision** : utiliser Next.js (dernière version stable compatible), React, TypeScript `strict` et Tailwind CSS, avec des composants accessibles de type **shadcn/ui** (Radix), copiés dans le dépôt et non pris comme dépendance opaque. La validation des formulaires repose sur **react-hook-form + zod**, avec des schémas partagés via `packages/shared`.
- **Règle** : le frontend n'utilise Supabase que pour l'**authentification** (clé `anon` publique). Toutes les données métier passent par l'API.

## ADR-003 — API NestJS versionnée `/api/v1`

- **Statut** : Acceptée
- **Décision** : NestJS, modules par domaine, DTO validés côté serveur (zod via un pipe partagé, décision confirmée en Phase 2 lors du premier endpoint avec corps de requête), OpenAPI/Swagger, filtre d'exceptions global, logs JSON structurés (pino). Limitation de débit : sur Vercel, chaque instance a sa propre mémoire, donc un compteur en mémoire est inefficace. Le stockage des compteurs (Postgres ou Vercel Firewall) sera choisi en Phase 2.

## ADR-004 — Supabase : Postgres + Auth + Storage, migrations SQL versionnées

- **Statut** : Acceptée
- **Décision** : les migrations SQL dans `supabase/migrations` (Supabase CLI) constituent la **seule source de vérité** du schéma. L'API accède à Postgres via une connexion directe et un query builder typé (**Kysely**, avec types générés depuis la base). Aucun ORM ne génère ses propres migrations.
- **Alternatives écartées** : Prisma et Drizzle, dont les migrations entreraient en concurrence avec celles de Supabase ; `supabase-js` côté serveur, qui ne gère pas les transactions.

## ADR-005 — Isolation multi-tenant : contrôle applicatif + RLS en défense en profondeur

- **Statut** : Acceptée
- **Décision** :
  1. L'API vérifie le JWT Supabase (JWKS) à chaque requête.
  2. L'organisation active est transmise par en-tête (`X-Organization-Id`). L'API **vérifie l'appartenance** (`organization_memberships`) et charge le rôle. Un `organization_id` venant du client n'est jamais utilisé sans cette vérification.
  3. Chaque requête métier est filtrée par `organization_id` via un repository de base qui l'impose.
  4. La RLS est activée sur toutes les tables métier. Les rôles `anon` et `authenticated` n'ont **aucun accès direct** aux tables métier, ce qui couvre le cas d'une clé `anon` utilisée en dehors du frontend. L'API utilise un rôle Postgres dédié.
  5. Des tests d'intégration démontrent qu'une organisation A ne peut ni lire ni modifier les ressources de B, endpoint par endpoint.

## ADR-006 — Traitement asynchrone compatible Vercel

- **Statut** : Acceptée (révisée le 2026-10-20 suite au choix de Vercel pour l'API)
- **Contexte** : Vercel n'exécute pas de processus permanent. Un worker pg-boss en écoute continue n'y est donc pas possible.
- **Décision** : la file de tâches est une **table Postgres** (`jobs`), consommée par `SELECT … FOR UPDATE SKIP LOCKED`. Un endpoint interne de l'API traite un lot borné par la durée maximale d'une fonction. Il est déclenché :
  1. immédiatement après la mise en file (appel asynchrone non bloquant) ;
  2. par **Vercel Cron**, en filet de sécurité et pour les planifications. Il est protégé par `CRON_SECRET`.
- **Contraintes** : chaque job doit être idempotent et découpable en étapes courtes. Une étape longue est reprise au cycle suivant.
- **À vérifier en Phase 7** : la fréquence minimale de Vercel Cron selon le plan de l'équipe (le plan Hobby est limité à une exécution quotidienne). L'alternative est Vercel Queues.

## ADR-007 — Couche IA indépendante du fournisseur

- **Statut** : **Reportée** (décision du propriétaire, 2026-10-20)
- **Décision** : aucun fournisseur IA n'est intégré pour l'instant. Les phases Agents (5) et Moteur (7) livrent la configuration, le moteur d'exécution, les politiques et les approbations, sans appel à un modèle. Les capacités IA sont affichées comme **non configurées**, et non comme disponibles.
- **Quand l'IA sera réactivée** : une interface `LlmProvider` (messages, outils, sortie structurée, timeouts, comptage de jetons) avec un adaptateur par fournisseur. Les sorties du modèle restent non fiables : chaque appel d'outil passe par le moteur de politiques (ADR-008), puis par la validation des paramètres.

## ADR-008 — Moteur de politiques et approbations liées à l'empreinte de l'action

- **Statut** : Acceptée
- **Décision** : chaque outil déclare une catégorie d'action. L'organisation et l'agent associent à chaque outil une politique : `read_only`, `prepare_only`, `auto_within_limits`, `approval_required` ou `forbidden`, avec des conditions (par exemple un seuil de montant) **stockées en base**, jamais codées en dur. Une approbation référence un **hash canonique** de l'outil et de ses paramètres significatifs. Si les paramètres changent, le hash ne correspond plus et l'approbation est invalide.

## ADR-009 — Chiffrement applicatif des credentials d'intégration

- **Statut** : Acceptée
- **Décision** : les jetons et clés d'intégration sont chiffrés (AES-256-GCM) par l'API avec une clé maître hors base (variable d'environnement, rotation documentée). Ils ne sont jamais renvoyés au frontend et sont masqués dans les logs. Supabase Vault reste une alternative à évaluer en Phase 9.

## ADR-010 — Hébergement entièrement sur Vercel

- **Statut** : Acceptée (Q6, 2026-10-20)
- **Décision** : deux projets Vercel dans l'équipe `Petalia`, reliés au dépôt GitHub :
  - `nagaw-web` (racine `apps/web`, framework Next.js) ;
  - `nagaw-api` (racine `apps/api`, framework NestJS, une fonction unique).
    Leurs fonctions s'exécutent dans la région `cdg1` (Paris), proche de la base Supabase `eu-west-3`. Trois environnements sont prévus : local, préproduction (déploiements _preview_) et production, chacun avec son propre projet Supabase.
- **Conséquences** : le traitement asynchrone suit ADR-006 révisé. Les connexions Postgres passent par le pooler Supabase (mode transaction), car les fonctions serverless ouvrent de nombreuses connexions courtes.

## ADR-011 — Versions d'outillage

- **Statut** : Acceptée (Phase 1)
- **Décision** :
  - TypeScript 6.0, car TypeScript 7 est publié mais encore incompatible avec le CLI NestJS 12, qui exige `~6.0` ;
  - Node.js 24 en CI et sur Vercel (`.nvmrc`) ;
  - Next.js 16.4 avec Cache Components ;
  - NestJS 12 en modules ESM ;
  - Vitest pour tous les paquets ;
  - oxlint pour l'API, ESLint pour le web, Prettier pour le formatage.

## ADR-012 — Interface en français uniquement

- **Statut** : Acceptée (Q7, 2026-10-20)
- **Décision** : pas de bibliothèque i18n. Les textes sont écrits directement en français. Les dates et montants passent par `Intl` avec la locale `fr`, dans le fuseau de l'organisation. Un passage à l'i18n reste possible plus tard, mais ne sera pas préparé à l'avance.

## ADR-013 — Schéma privé `app` et rôle Postgres dédié `nagaw_api`

- **Statut** : Acceptée (Phase 2)
- **Décision** :
  - les tables métier sont dans le schéma `app`, non exposé par l'API Data de Supabase ;
  - l'API se connecte avec le rôle `nagaw_api`, qui dispose de `SELECT`, `INSERT` et `UPDATE` sur les tables utiles, de `SELECT` et `INSERT` seulement sur `audit_logs`, et d'aucun `DELETE` ;
  - `anon` et `authenticated` n'ont aucun droit sur le schéma ;
  - la RLS est activée partout, avec des politiques ouvertes uniquement à `nagaw_api` ;
  - `audit_logs` est protégé contre `UPDATE`, `DELETE` et `TRUNCATE` par des triggers, y compris pour le propriétaire des tables.
- **Conséquence** : la clé publishable de Supabase, présente dans le navigateur, ne donne accès à aucune donnée métier, même en cas de bug de l'API.
- **Mot de passe du rôle** : il est défini par le propriétaire, hors de Git (voir `docs/DEPLOYMENT.md`).

## ADR-014 — Authentification : Supabase Auth, jetons asymétriques vérifiés par l'API

- **Statut** : Acceptée (Phase 2)
- **Décision** :
  - le web utilise `@supabase/ssr` : session dans des cookies, rafraîchie par `proxy.ts`, et formulaires traités par des Server Actions qui valident les champs côté serveur ;
  - les liens d'e-mail (confirmation, réinitialisation du mot de passe) utilisent le flux PKCE et aboutissent sur `/auth/callback`, qui n'accepte que des redirections internes ;
  - l'API vérifie chaque jeton avec le JWKS du projet : signature ES256/RS256, émetteur, audience `authenticated`, expiration, rejet des utilisateurs anonymes ;
  - un projet encore signé avec le secret HS256 _legacy_ n'est pas pris en charge : `/health/ready` le détecte (`auth: "no_signing_keys"`).

## ADR-015 — Invitations par lien, sans fournisseur d'e-mail pour l'instant

- **Statut** : Acceptée pour l'instant (Phase 4, 2026-10-23), à revoir lors du choix d'un fournisseur d'e-mail
- **Contexte** : la roadmap prévoyait d'envoyer les invitations par e-mail. Aucun fournisseur d'e-mail transactionnel n'a encore été choisi ni configuré, et une intégration non vérifiée ne doit pas être présentée comme opérationnelle.
- **Décision** :
  - l'API crée l'invitation et renvoie le jeton **une seule fois** ; le web affiche le lien `/invitation?jeton=…` à l'administrateur, qui le transmet lui-même ;
  - l'interface indique explicitement que l'envoi automatique par e-mail n'est pas configuré ;
  - le jeton fait 256 bits ; seul son hash SHA-256 est stocké ; il expire selon `organizations.invitation_ttl_hours`, sert une seule fois et n'est accepté que par l'utilisateur dont l'adresse de profil est l'adresse invitée ;
  - le jeton circule dans le corps des requêtes vers l'API (jamais dans son URL, donc jamais dans ses logs) ; la page d'invitation n'envoie pas de `Referer`.
- **Suite** : quand le propriétaire aura choisi un fournisseur (par exemple Resend ou Brevo), l'API enverra le même lien par e-mail. L'affichage du lien restera disponible en secours.

## ADR-016 — Agents : configuration versionnée, test contrôlé déterministe, registre d'outils en code

- **Statut** : Proposée (Phase 5), à valider par le propriétaire
- **Décision** :
  - l'identité d'un agent (nom, domaine, statut) est modifiable ; tout ce qui pilote son comportement est dans des **versions immuables** (`agent_versions`, ajout seul) : chaque modification crée une version, l'historique n'est jamais réécrit ;
  - le cycle de vie est brouillon → actif ↔ suspendu → archivé ; l'archivage est définitif ; l'activation (et toute nouvelle version d'un agent actif) exige une configuration complète ;
  - le « test contrôlé » est **déterministe** : vérifications de la configuration et consignes assemblées, sans appel de modèle ni action (ADR-007) ;
  - les outils sont déclarés dans un registre en code (`packages/shared/src/agents.ts`) ; un outil n'est autorisable que lorsqu'il est implémenté et testé (`available: true`). `email.send` est annoncé, non disponible (Phase 9) ;
  - les plafonds (nombre d'agents, étapes et durée par exécution) sont des colonnes de `organizations`, non modifiables par l'organisation elle-même (préparation des quotas de la Phase 12).
- **Conséquence** : aucune configuration de modèle n'existe tant qu'un fournisseur n'est pas choisi ; les colonnes `provider`/`model` seront ajoutées à ce moment.
