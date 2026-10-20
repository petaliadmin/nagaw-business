# API

> **État** : aucun endpoint n'existe. Ce document fixe les **conventions** qui s'appliqueront dès la Phase 1. Les endpoints seront listés ici au fur et à mesure de leur livraison, et la documentation OpenAPI générée sera servie par l'API sur `/api/v1/docs` (hors production publique).

## Conventions

- Préfixe : `/api/v1`.
- Authentification : `Authorization: Bearer <JWT Supabase>`.
- Organisation active : en-tête `X-Organization-Id`, appartenance vérifiée côté serveur.
- Format d'erreur unique :
  ```json
  { "error": { "code": "AGENT_NOT_FOUND", "message": "…", "requestId": "…", "details": [] } }
  ```
- Une ressource d'une autre organisation renvoie `404`, jamais `403`.
- Pagination par curseur : `?limit=25&cursor=…`, réponse `{ "data": [...], "nextCursor": "…" | null }`.
- Les opérations qui créent des exécutions acceptent l'en-tête `Idempotency-Key`.
- Les dates sont au format ISO 8601 en UTC.

## Endpoints livrés

Aucun.
