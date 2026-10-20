# État d'implémentation

Ce fichier reflète **l'état réel du code**. Il est mis à jour à la fin de chaque phase.

## Phase 0 — Audit du dépôt et plan d'exécution

- **Statut** : **validée** par le propriétaire le 2026-10-20, avec les ajustements suivants : IA reportée, API sur Vercel, interface en français uniquement.
- **Constat** : le dépôt était vide. Les livrables sont dans `docs/AUDIT_PHASE_0.md` et les ADR dans `docs/DECISIONS.md`.

## Phase 1 — Socle technique

- **Objectif** : disposer d'un projet stable, outillé et vérifiable automatiquement.
- **Statut** : **validée** par le propriétaire le 2026-10-20.
- **Fonctionnalités terminées** :
  - monorepo pnpm : `apps/web`, `apps/api`, `packages/shared` ;
  - API NestJS 12 :
    - préfixe `/api/v1` ;
    - configuration validée par zod au démarrage, qui échoue immédiatement si elle est invalide ;
    - logs JSON pino avec identifiant de requête et masquage de `Authorization` et des cookies ;
    - filtre d'erreurs global au format documenté, sans fuite de détails internes ;
    - en-têtes de sécurité (helmet) et CORS limité à une liste d'origines ;
    - Swagger sur `/api/v1/docs`, hors production ;
    - `GET /api/v1/health` ;
  - web Next.js 16 : page d'accueil en français, qui annonce honnêtement que la plateforme est en construction et affiche l'état **réel** de l'API ;
  - contrats partagés (`@nagaw/shared`) : schémas zod de l'enveloppe d'erreur et de la réponse de santé ;
  - CI GitHub Actions : format, lint, types, tests unitaires et d'intégration, build et scan de secrets (gitleaks) ;
  - projets Vercel `nagaw-web` et `nagaw-api` créés et reliés au dépôt.
- **Tests exécutés** :

  | Commande                | Résultat                                 |
  | ----------------------- | ---------------------------------------- |
  | `pnpm format:check`     | OK                                       |
  | `pnpm lint`             | OK                                       |
  | `pnpm typecheck`        | OK                                       |
  | `pnpm test`             | 15 tests OK (shared 2, api 7, web 6)     |
  | `pnpm test:integration` | 5 tests OK (pipeline HTTP réel de l'API) |
  | `pnpm build`            | OK                                       |

  Tests manuels : API démarrée, `health` → 200, route inconnue → 404 au format documenté, Swagger → 200. Page web rendue avec l'API démarrée (« API opérationnelle ») puis arrêtée (« API indisponible »).

  La CI GitHub Actions ne s'exécutera qu'à l'ouverture d'une PR ou sur `main`.

- **Problèmes connus** :
  - Node local 22.22.0 : `@nestjs/schematics` déclare `^22.22.3`. Ce n'est qu'un avertissement, la CI et Vercel utilisant Node 24.
  - La branche par défaut GitHub reste `claude/beautiful-cerf-cbbkzm` tant que le propriétaire n'a pas sélectionné `main` (réglage GitHub non accessible par les connecteurs).
- **Déploiements Vercel vérifiés (2026-10-20)** :
  - `GET https://nagaw-api-petalia.vercel.app/api/v1/health` répond 200, avec les en-têtes helmet, `X-Request-Id` et une exécution dans la région `cdg1` ;
  - la page `https://nagaw-web-petalia.vercel.app/` affiche « API opérationnelle — version dev, environnement production » ;
  - trois défauts, visibles uniquement sur Vercel, ont été corrigés :
    1. import de `helmet` sous le vérificateur TypeScript de Vercel (`interopDefault`, testé) ;
    2. _top-level await_ dans `main.ts`, qui bloquait la fonction NestJS ;
    3. réponse HTML d'une protection d'accès qui faisait planter la page (test de régression ajouté).
- **Infrastructure** :
  - projet Supabase `nagaw-business` (`zvswytzuukogmdqyhufn`, `eu-west-3`) créé, après mise en pause de `petalia-soil-api` à la demande du propriétaire ;
  - production de l'API publique, préversions protégées ;
  - branche `main` créée.
- **Configuration encore nécessaire** : définir `main` comme branche par défaut sur GitHub (puis comme _Production Branch_ dans les deux projets Vercel si besoin) et protéger `main`.
- **Prochaine action recommandée** : Phase 2 (base de données, Auth, multi-tenant). Le projet Supabase est prêt.

## Phase 2 — Base de données, authentification et multi-tenant

- **Objectif** : un utilisateur authentifié n'accède qu'aux ressources autorisées.
- **Statut** : code livré et testé. **En attente des actions manuelles** (`docs/DEPLOYMENT.md` § Actions manuelles) pour vérifier le parcours réel en production, puis de la validation du propriétaire.
- **Fonctionnalités terminées** :
  - Migration `20261020194209_tenancy_foundation`, **appliquée** au projet Supabase `nagaw-business` (analyse de sécurité Supabase : 0 alerte) :
    - schéma privé `app` : `user_profiles`, synchronisé depuis `auth.users` par trigger ; `organizations` ; `organization_memberships` ; `audit_logs`, en ajout seul ;
    - rôle `nagaw_api` aux droits minimaux, RLS, aucun accès `anon`/`authenticated`.
  - API :
    - vérification des JWT Supabase par JWKS ;
    - `AuthGuard` global et `TenantGuard` (appartenance vérifiée en base, 404 pour les étrangers, 403 pour un rôle insuffisant) ;
    - rôles `owner`, `admin`, `member`, `viewer` et permissions partagées ;
    - endpoints `GET /me`, `POST /organizations`, `GET|PATCH /organizations/current`, `GET /organizations/current/members`, `GET /audit-logs`, `GET /health/ready` (base et clés de signature) ;
    - audit transactionnel.
  - Web :
    - inscription, connexion, déconnexion, mot de passe oublié et réinitialisation (Server Actions, validation côté serveur, messages en français) ;
    - callback PKCE protégé contre les redirections externes, page « lien invalide » ;
    - espace connecté : création d'une première organisation et liste des organisations avec le rôle.
  - CI : service Postgres 17, tests end-to-end Playwright.
- **Tests exécutés** :

  | Commande                       | Résultat                                                            |
  | ------------------------------ | ------------------------------------------------------------------- |
  | `pnpm test`                    | 48 tests OK (shared 8, api 21, web 19)                              |
  | `pnpm test:integration`        | 29 tests OK sur un vrai Postgres 16 construit depuis les migrations |
  | `pnpm test:e2e`                | 12 tests OK (6 scénarios × bureau et mobile)                        |
  | lint, typecheck, build, format | OK                                                                  |

  Test de mutation : retirer le filtre d'appartenance du `TenantGuard` fait échouer 7 tests d'isolation.

- **Non vérifié** :
  - le parcours réel Supabase (e-mail de confirmation, connexion, appel de l'API avec un vrai jeton), qui dépend des actions manuelles 1 à 4 ;
  - le format des clés de signature du projet (HS256 _legacy_ ou asymétrique), qui se lira sur `/health/ready` après déploiement.
- **Problèmes connus** : pas de limitation de débit côté API ; SMTP Supabase par défaut ; TLS Postgres non vérifié (`require`).
- **Reste à faire, phases suivantes** : invitations et gestion des membres (Phase 4) ; navigation et tableau de bord (Phase 3).

## Phases 3 à 15

Non commencées.
