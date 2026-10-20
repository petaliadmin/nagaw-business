# État d'implémentation

Ce fichier reflète **l'état réel du code**. Il est mis à jour à la fin de chaque phase.

## Phase 0 — Audit du dépôt et plan d'exécution

- **Statut** : **validée** par le propriétaire le 2026-10-20, avec les ajustements suivants : IA reportée, API sur Vercel, interface en français uniquement.
- **Constat** : le dépôt était vide. Les livrables sont dans `docs/AUDIT_PHASE_0.md` et les ADR dans `docs/DECISIONS.md`.

## Phase 1 — Socle technique

- **Objectif** : disposer d'un projet stable, outillé et vérifiable automatiquement.
- **Statut** : livrée, **en attente de validation**.
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
  - **projet Supabase non créé** : l'organisation `petaliadmin` a atteint la limite de 2 projets gratuits actifs ;
  - Vercel Authentication protège les URL `*.vercel.app` : l'appel serveur du web vers l'API recevra une réponse 401 tant que ce point n'est pas réglé (voir `docs/DEPLOYMENT.md`) ;
  - la branche de production Vercel est la branche par défaut GitHub, aujourd'hui `claude/beautiful-cerf-cbbkzm` ;
  - Node local 22.22.0 : `@nestjs/schematics` déclare `^22.22.3`. Ce n'est qu'un avertissement, la CI et Vercel utilisant Node 24.
- **Configuration encore nécessaire** : choix pour Supabase (voir le rapport), création et protection de `main`, choix de la protection de l'API.
- **Déploiements Vercel (2026-10-20)** :
  - `nagaw-web` : build READY, page servie en 200 (vérifié via l'outil de fetch Vercel). Le bloc « État des services » plantait côté serveur, car l'API protégée renvoyait une page HTML : bug corrigé et couvert par un test de régression.
  - `nagaw-api` : build READY après correctif. Le vérificateur TypeScript de Vercel résout l'import par défaut de `helmet` différemment ; le problème a été reproduit localement et corrigé par `interopDefault`. **Réponse en exécution non vérifiée** : les appels via l'outil de fetch Vercel ont expiré, aucune invocation n'apparaît dans les logs, et l'URL est protégée par Vercel Authentication.
- **Critères d'acceptation restants** : vérifier que `GET https://nagaw-api-petalia.vercel.app/api/v1/health` répond 200 une fois la protection de l'API réglée.
- **Prochaine action recommandée** : Phase 2 (base de données, Auth, multi-tenant), une fois le projet Supabase disponible.

## Phases 2 à 15

Non commencées.
