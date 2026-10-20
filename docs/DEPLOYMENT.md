# Déploiement

> **État** : rien n'est déployé. Aucune configuration de déploiement n'existe. Cible proposée : ADR-010.

## Environnements prévus

| Environnement | Frontend | API + worker | Base | Mise en place |
|---|---|---|---|---|
| Local | `pnpm dev` | `pnpm dev` | Supabase CLI (Docker) | Phase 1–2 |
| Préproduction | Vercel (preview / branche `staging`) | Conteneur (Render ou Fly.io) | Projet Supabase dédié | Phase 2 |
| Production | Vercel | Conteneur | Projet Supabase dédié | Phase 15, **sur autorisation explicite** |

## Variables d'environnement (prévisionnel)

| Variable | Côté | Secret |
|---|---|:-:|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` | web | non |
| `SUPABASE_URL`, `SUPABASE_JWKS_URL` | api | non |
| `DATABASE_URL` | api / worker | **oui** |
| `CREDENTIALS_ENCRYPTION_KEY` | api / worker | **oui** |
| `ANTHROPIC_API_KEY` (et autres fournisseurs) | worker | **oui** |
| `EMAIL_PROVIDER_API_KEY` | api / worker | **oui** |

Un fichier `.env.example` sans valeurs réelles sera ajouté en Phase 1.

## Migrations

Elles seront appliquées via `supabase db push` depuis la CI, sur la préproduction d'abord, puis sur la production après validation. Toute migration doit être rétrocompatible avec la version précédente de l'API (déploiement en deux temps).
