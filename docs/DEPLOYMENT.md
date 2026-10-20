# Déploiement

Cible : ADR-010 (tout sur Vercel) et ADR-006 (traitement asynchrone compatible Vercel).

## Infrastructure configurée (2026-10-20)

| Ressource                        | Identifiant                                           | Configuration                                                       | État                         |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------- |
| Projet Vercel `nagaw-web`        | `prj_7KiARAv1hXQS9x01O8IH6HV5pIAN` (équipe `Petalia`) | racine `apps/web`, Next.js, Node 24, région `cdg1`                  | Créé, relié à GitHub         |
| Projet Vercel `nagaw-api`        | `prj_0lolA8mrzpJIs1I01ZApAchYhqhh` (équipe `Petalia`) | racine `apps/api`, NestJS, Node 24, région `cdg1`                   | Créé, relié à GitHub         |
| Projet Supabase `nagaw-business` | `zvswytzuukogmdqyhufn` (organisation `petaliadmin`)   | `eu-west-3` (Paris), URL `https://zvswytzuukogmdqyhufn.supabase.co` | Créé ; schéma vide (Phase 2) |

Domaines de production : `nagaw-web.vercel.app` / `nagaw-web-petalia.vercel.app` et `nagaw-api-petalia.vercel.app`.

Vercel ignore automatiquement le build d'un projet qu'un commit ne touche pas (monorepo) : un déploiement « CANCELED » peut donc être normal.

Commande de build des deux projets : `pnpm --filter @nagaw/shared build && pnpm build`. L'installation se fait depuis la racine du monorepo (`pnpm install --frozen-lockfile`).

**Protection** :

- `nagaw-api` : Vercel Authentication sur les **préversions uniquement**. La production est publique, car chaque route métier exigera un JWT dès la Phase 2.
- `nagaw-web` : Vercel Authentication sur toutes les URL `*.vercel.app` (réglage par défaut), jusqu'à l'ajout d'un domaine personnalisé ou une décision d'ouverture.

**Pièges Vercel rencontrés** :

- pas de _top-level await_ dans `apps/api/src/main.ts` ;
- Vercel revérifie les types de l'API avec sa propre résolution de modules : un import par défaut d'un paquet CommonJS doit passer par `interopDefault`.

**Branche de production** : Vercel déploie en production la branche par défaut du dépôt GitHub. Elle est actuellement `claude/beautiful-cerf-cbbkzm`, car le dépôt était vide (voir l'audit, § 6). Après la création de `main`, il faut la définir comme branche par défaut sur GitHub et comme _Production Branch_ dans les deux projets Vercel.

## Environnements

| Environnement | Web                                | API                                | Base                             |
| ------------- | ---------------------------------- | ---------------------------------- | -------------------------------- |
| Local         | `pnpm dev` (port 3000)             | `pnpm dev` (port 3001)             | Supabase CLI (Docker), Phase 2   |
| Préproduction | Déploiements _preview_ `nagaw-web` | Déploiements _preview_ `nagaw-api` | Projet Supabase `nagaw-business` | `zvswytzuukogmdqyhufn` (organisation `petaliadmin`) | `eu-west-3` (Paris), URL `https://zvswytzuukogmdqyhufn.supabase.co` | Créé ; schéma vide (Phase 2) |
| Production    | `nagaw-web` production             | `nagaw-api` production             | Projet Supabase `nagaw-business` | `zvswytzuukogmdqyhufn` (organisation `petaliadmin`) | `eu-west-3` (Paris), URL `https://zvswytzuukogmdqyhufn.supabase.co` | Créé ; schéma vide (Phase 2) |

## Variables d'environnement

| Variable                                                           | Projet        | Secret  | Valeur configurée                                                   | Phase |
| ------------------------------------------------------------------ | ------------- | :-----: | ------------------------------------------------------------------- | ----- |
| `API_URL`                                                          | web (serveur) |   non   | `https://nagaw-api-petalia.vercel.app`                              | 1     |
| `APP_ENV`                                                          | api           |   non   | `production` / `preview`                                            | 1     |
| `LOG_LEVEL`                                                        | api           |   non   | `info`                                                              | 1     |
| `CORS_ORIGINS`                                                     | api           |   non   | `https://nagaw-web.vercel.app,https://nagaw-web-petalia.vercel.app` | 1     |
| `APP_VERSION`                                                      | api           |   non   | non défini (`dev`)                                                  | 1     |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | web           |   non   | —                                                                   | 2     |
| `SUPABASE_URL` (JWKS dérivé)                                       | api           |   non   | —                                                                   | 2     |
| `DATABASE_URL` (pooler, mode transaction)                          | api           | **oui** | —                                                                   | 2     |
| `CRON_SECRET`                                                      | api           | **oui** | —                                                                   | 7     |
| `CREDENTIALS_ENCRYPTION_KEY`                                       | api           | **oui** | —                                                                   | 9     |
| `EMAIL_PROVIDER_API_KEY`                                           | api           | **oui** | —                                                                   | 4 / 9 |

Les fichiers `apps/*/.env.example` listent les variables locales, sans valeurs secrètes. Les secrets se saisissent dans Vercel (type _Sensitive_) et ne sont jamais commités.

## Migrations

Elles seront appliquées via la Supabase CLI depuis la CI, sur la préproduction d'abord, puis sur la production après validation. Toute migration doit rester rétrocompatible avec la version précédente de l'API (déploiement en deux temps).
