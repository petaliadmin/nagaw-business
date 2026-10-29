# Architecture technique

> **État** : le socle (web, API, authentification, multi-tenant, audit) est **implémenté** (Phases 1 à 4), ainsi que la PWA (service worker, manifeste, page hors ligne, Phase 8). La base locale et la synchronisation (§ 4) viennent en Phase 11 (ADR-020). Les choix sont justifiés dans [`DECISIONS.md`](./DECISIONS.md).

## 1. Vue d'ensemble

```
┌───────────────────────────────────────┐   HTTPS + JWT    ┌──────────────────────────┐
│  apps/web (Next.js, PWA) — Vercel     │ ───────────────► │  apps/api (NestJS)       │
│                                       │   /api/v1/*      │  Vercel, fonction unique │
│  ┌─────────────────┐ ┌─────────────┐  │                  │  guards, règles métier,  │
│  │ Service worker  │ │ IndexedDB   │  │  POST /sync      │  synchronisation         │
│  │ (app hors ligne)│ │ catalogue,  │──┼────────────────► │  idempotente             │
│  └─────────────────┘ │ ventes en   │  │  (lots           └────────────┬─────────────┘
│                      │ attente     │  │   d'opérations)              │ rôle nagaw_api
│  Supabase Auth       └─────────────┘  │                              ▼
│  (clé publishable seule)              │            ┌─────────────────────────────────┐
└─────────┬─────────────────────────────┘            │  Supabase (eu-west-3)           │
          │ auth                                     │  • Auth (JWT, JWKS)             │
          └─────────────────────────────────────────►│  • Postgres, schéma privé `app` │
                                                     │  • Storage (photos, PDF)        │
                                                     └─────────────────────────────────┘
```

Aucun worker, aucune tâche planifiée (ADR-017) : la synchronisation est initiée par l'appareil quand le réseau revient.

## 2. Structure du dépôt (cible)

```
apps/
  web/                 Next.js App Router, PWA
    src/app/(auth)/    connexion, inscription, réinitialisation
    src/app/espace/    application boutique (navigation basse mobile, latérale ordinateur)
    src/components/ui/ design system (shadcn/ui, jetons de DESIGN.md)
    src/lib/api/       client API typé
    src/lib/pwa/       service worker (/sw.js) — Phase 8
    src/lib/offline/   base locale IndexedDB, file d'opérations, synchronisation — Phase 11
    src/app/caisse/    caisse hors ligne (page statique) et ses routes
  api/
    src/main.ts        point d'entrée HTTP
    src/common/        auth guard, tenant context, filtres d'erreurs, logs
    src/modules/       organizations, members, invitations, audit, products, stock,
                       customers, sales, payments, sync, quotes, invoices, cash,
                       expenses, statistics, accounting, admin
packages/
  shared/              schémas zod, statuts, permissions, calculs de montants partagés
supabase/
  migrations/          SQL versionné (source de vérité)
docs/
.github/workflows/
```

Les calculs de totaux (lignes, remises, taxes, arrondis) sont dans `packages/shared` pour donner le même résultat hors ligne et sur le serveur ; le serveur recalcule toujours et refuse un écart.

## 3. Cycle d'une requête métier

1. Le frontend envoie le JWT Supabase (`Authorization: Bearer`) et `X-Organization-Id`.
2. `AuthGuard` vérifie la signature (JWKS), l'expiration et l'audience, puis charge `userId`.
3. `TenantGuard` vérifie l'appartenance active à l'organisation et charge le rôle. Il répond 404 (et non 403) si l'appartenance n'existe pas, pour ne pas révéler l'existence de l'organisation.
4. `PermissionGuard` vérifie la permission requise par le handler (`@RequirePermission('sales.create')`).
5. Le service exécute la logique via des repositories qui imposent le filtre `organization_id`.
6. Les actions sensibles écrivent une entrée `audit_logs` **dans la même transaction**.

## 4. Hors ligne et synchronisation (ADR-020, ADR-025, implémenté en Phase 11)

```
appareil (hors ligne ou non)
  vente saisie → calcul des totaux (packages/shared)
             → opération { client_operation_id (UUID), type, données, occurred_at }
             → IndexedDB : vente visible immédiatement, stock local décrémenté
             → ticket numéroté avec le préfixe de l'appareil

retour du réseau (événement online, ouverture de l'application, bouton « Envoyer »)
  → session Supabase rafraîchie
  → POST /api/v1/sync  { deviceId, operations[] } (lots bornés)
  → API, pour chaque opération, dans une transaction :
       déjà connue (client_operation_id) → réponse identique, rien de nouveau
       règles vérifiées (rôle, produit, prix, remise, totaux recalculés)
         OK     → écriture (vente, lignes, paiements, mouvements de stock, audit)
         refus  → sync_rejections avec motif, renvoyé à l'appareil
  → réponse : opérations acceptées, refusées, et changements du catalogue depuis le dernier curseur
  → appareil : file purgée des opérations acceptées, refus affichés au gérant
```

- La caisse est la page statique `/caisse`, gardée par le service worker ; ses données viennent d'IndexedDB (`apps/web/src/lib/offline`), rafraîchies par `/caisse/donnees`. Les envois passent par `/caisse/synchroniser` et l'enregistrement de l'appareil par `/caisse/appareil` : des routes du web qui relaient la session de la personne vers l'API.
- Toute vente suit ce chemin, même en ligne (envoi immédiat).
- Le stock affiché hors ligne est une estimation locale ; la valeur de référence est celle du serveur, recalculée depuis les mouvements.
- Les lectures analytiques (statistiques, comptabilité) sont en ligne ; la dernière consultation reste lisible hors ligne, datée.
- Les factures sont numérotées uniquement par le serveur (`document_sequences`).

## 5. Rôles et permissions (proposition boutique)

| Permission                                         | Propriétaire (`owner`) | Gérant (`admin`) | Vendeur (`member`) | Lecteur (`viewer`) |
| -------------------------------------------------- | :--------------------: | :--------------: | :----------------: | :----------------: |
| Voir le catalogue et le stock                      |           ✔            |        ✔         |         ✔          |         ✔          |
| Enregistrer une vente, encaisser                   |           ✔            |        ✔         |         ✔          |                    |
| Remise au-delà du seuil configuré                  |           ✔            |        ✔         |                    |                    |
| Annuler une vente, rembourser                      |           ✔            |        ✔         |                    |                    |
| Gérer produits, prix, entrées de stock, inventaire |           ✔            |        ✔         |                    |                    |
| Devis et factures                                  |           ✔            |        ✔         |    configurable    |                    |
| Statistiques et trésorerie                         |           ✔            |        ✔         | ses ventes seules  |         ✔          |
| Dépenses, clôture de caisse                        |           ✔            |        ✔         |                    |                    |
| Comptabilité et exports                            |           ✔            |        ✔         |                    |         ✔          |
| Gérer l'équipe et les appareils                    |           ✔            |        ✔         |                    |                    |
| Abonnement, suppression de la boutique             |           ✔            |                  |                    |                    |

L'administration plateforme utilise une table séparée (`platform_admins`, un seul administrateur, ADR-039) et des endpoints `/api/v1/admin/*`, qui ne renvoient pas le contenu métier des boutiques. L'administrateur n'y accède qu'en **entrant dans une boutique** avec un motif (ADR-040) : il y a alors les droits du propriétaire, et ses actions sont inscrites dans l'historique de la boutique au nom de la plateforme.
