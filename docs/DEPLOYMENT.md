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

| Environnement | Web                                | API                                | Base                                                                                        |
| ------------- | ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Local         | `pnpm dev` (port 3000)             | `pnpm dev` (port 3001)             | Supabase CLI (Docker), Phase 2                                                              |
| Préproduction | Déploiements _preview_ `nagaw-web` | Déploiements _preview_ `nagaw-api` | Projet Supabase `nagaw-business` (unique pour l'instant)                                    |
| Production    | `nagaw-web` production             | `nagaw-api` production             | Projet Supabase dédié à créer avant le lancement (Phase 15), **sur autorisation explicite** |

## Variables d'environnement

| Variable                                                                                                                                | Projet                                      |        Secret        | Valeur configurée                                                                                                                                                                                                                                                                  | Phase   |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | :------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `API_URL`                                                                                                                               | web (serveur)                               |         non          | `https://nagaw-api-petalia.vercel.app`                                                                                                                                                                                                                                             | 1       |
| `APP_ENV`                                                                                                                               | api                                         |         non          | `production` / `preview`                                                                                                                                                                                                                                                           | 1       |
| `LOG_LEVEL`                                                                                                                             | api                                         |         non          | `info`                                                                                                                                                                                                                                                                             | 1       |
| `CORS_ORIGINS`                                                                                                                          | api                                         |         non          | `https://nagaw-web.vercel.app,https://nagaw-web-petalia.vercel.app`                                                                                                                                                                                                                | 1       |
| `APP_VERSION`                                                                                                                           | api                                         |         non          | non défini (`dev`)                                                                                                                                                                                                                                                                 | 1       |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                                                      | web                                         |         non          | configurées (URL du projet, clé `sb_publishable_…`)                                                                                                                                                                                                                                | 2       |
| `SITE_URL`                                                                                                                              | web (serveur)                               |         non          | ignorée en production : l'adresse est toujours `https://www.naagaw.com` (`PRODUCTION_SITE_URL`, sitemap, robots, llms.txt, liens d'e-mail et d'invitation) ; en local `http://localhost:3000` ; sur les prévisualisations, à défaut, l'URL de branche Vercel (`VERCEL_BRANCH_URL`) | 2 / 4   |
| `API_PROTECTION_BYPASS` (secret « Protection Bypass for Automation » du projet API)                                                     | web (serveur), prévisualisations uniquement |       **oui**        | — ; permet au web de prévisualisation d'appeler l'API de prévisualisation protégée par Vercel Authentication                                                                                                                                                                       | 4       |
| `SUPABASE_URL` (JWKS dérivé)                                                                                                            | api                                         |         non          | `https://zvswytzuukogmdqyhufn.supabase.co`                                                                                                                                                                                                                                         | 2       |
| `DATABASE_SSL`                                                                                                                          | api                                         |         non          | `require`                                                                                                                                                                                                                                                                          | 2       |
| `DATABASE_URL` (pooler, mode transaction, rôle `nagaw_api`)                                                                             | api                                         |       **oui**        | configurée (_Sensitive_), hôte `aws-1-eu-west-3.pooler.supabase.com:6543`                                                                                                                                                                                                          | 2       |
| `CRON_SECRET` (16 caractères au moins ; envoyé par Vercel Cron à `GET /api/v1/cron/daily`, déclaré dans `apps/api/vercel.json`)         | api                                         |       **oui**        | — (à créer)                                                                                                                                                                                                                                                                        | ADR-036 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (notifications push ; les trois ensemble ; `npx web-push generate-vapid-keys`) | api                                         | **oui** (clé privée) | — (à créer) ; sans elles, les notifications restent dans l'application                                                                                                                                                                                                             | ADR-036 |
| `CREDENTIALS_ENCRYPTION_KEY`                                                                                                            | api                                         |       **oui**        | —                                                                                                                                                                                                                                                                                  | 9       |
| `EMAIL_PROVIDER_API_KEY`                                                                                                                | api                                         |       **oui**        | — (aucun fournisseur choisi, voir ADR-015)                                                                                                                                                                                                                                         | 9       |

Les fichiers `apps/*/.env.example` listent les variables locales, sans valeurs secrètes. Les secrets se saisissent dans Vercel (type _Sensitive_) et ne sont jamais commités.

## Actions manuelles requises (Phase 2)

Elles ne peuvent pas être réalisées par les connecteurs, ou ne doivent pas l'être, car elles impliquent un secret ou un réglage du tableau de bord Supabase.

1. ~~Mot de passe du rôle API~~ : **fait le 2026-10-20** avec l'autorisation du propriétaire. Le mot de passe a été généré aléatoirement, appliqué par SQL, enregistré uniquement dans Vercel, puis la copie locale a été supprimée. Pour en changer : `alter role nagaw_api with login password '…'` dans _SQL Editor_, puis mettre à jour `DATABASE_URL` sur Vercel et redéployer.
2. ~~`DATABASE_URL` sur Vercel~~ : **fait**. Pooler en mode transaction, `postgresql://nagaw_api.zvswytzuukogmdqyhufn:<mot de passe>@aws-1-eu-west-3.pooler.supabase.com:6543/postgres`. Le projet est sur la grappe `aws-1` ; l'hôte `aws-0` renvoie « Tenant or user not found ». Vérification : `GET /api/v1/health/ready` répond `{"status":"ready","database":"ok","auth":"ok"}`.
3. ~~Clés de signature JWT asymétriques~~ : **déjà en place**. Le 2026-10-20, `GET /api/v1/health/ready` en production a répondu `auth: "ok"`, ce qui signifie que le JWKS du projet publie des clés.
4. **URL de redirection Auth** (reste à faire, aucun connecteur ne permet de modifier la configuration Auth). Dans Supabase, ouvrir _Authentication → URL Configuration_ :
   - _Site URL_ : `https://nagaw-web-petalia.vercel.app` ;
   - _Redirect URLs_ : `https://nagaw-web-petalia.vercel.app/auth/callback` et `http://localhost:3000/auth/callback`.
5. **Mot de passe minimal.** Dans _Authentication → Policies_ (ou _Providers → Email_), régler la longueur minimale à 8, comme dans le formulaire.
6. **SMTP.** Le service d'e-mail intégré à Supabase est fortement limité, et peut n'envoyer qu'aux membres de l'organisation Supabase. Configurer un SMTP dédié (_Authentication → SMTP Settings_) avant d'ouvrir l'inscription à de vrais utilisateurs.

## Migrations

La migration `20261020194209_tenancy_foundation` a été appliquée au projet `nagaw-business` le 2026-10-20 via le connecteur Supabase. La migration `20261023191420_members_invitations` (Phase 4, uniquement additive) a été appliquée le 2026-10-23, avec l'autorisation du propriétaire, avant la fusion, pour tester la prévisualisation. La migration `20261023193645_agents` (Phase 5, uniquement additive) a été appliquée le même jour, dans les mêmes conditions. Le nom du fichier reprend la version enregistrée par Supabase, pour garder l'historique aligné. Les suivantes seront appliquées via la Supabase CLI depuis la CI, sur la préproduction d'abord, puis sur la production après validation. Les migrations `20261024150000_catalog_stock` (Phase 9) et `20261024190000_sales` (Phase 10) ont été appliquées le 2026-10-24 par le propriétaire avec la Supabase CLI (`supabase db push`, via le pooler Supabase), avant la fusion ; `20261024210000_offline_devices` (Phase 11), `20261025090000_invoices_quotes` (Phase 12), `20261025130000_treasury` (Phase 13), `20261025150000_accounting` (Phase 14), `20261025170000_plans` (Phase 15) et `20261025190000_platform_admin` (Phase 16), le 2026-10-25, de la même façon. Toute migration doit rester rétrocompatible avec la version précédente de l'API (déploiement en deux temps).

## Prévisualisation de la branche de travail

Pour que le web de prévisualisation appelle l'API de prévisualisation de la même branche (et non l'API de production), deux variables sont définies sur `nagaw-web`, en cible _Preview_, limitées à la branche `claude/beautiful-cerf-cbbkzm` :

- `API_URL` = `https://nagaw-api-git-claude-beautiful-cerf-cbbkzm-petalia.vercel.app` ;
- `API_PROTECTION_BYPASS` (_Sensitive_) : secret « Protection Bypass for Automation » du projet `nagaw-api`, envoyé dans l'en-tête `x-vercel-protection-bypass` par le serveur web uniquement. La protection Vercel des prévisualisations de l'API reste active pour tout le reste.

Pour révoquer l'accès : _nagaw-api → Settings → Deployment Protection → Protection Bypass for Automation_, puis supprimer la variable.
