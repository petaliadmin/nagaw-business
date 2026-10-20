# API

> La documentation OpenAPI générée est servie sur `/api/v1/docs` (désactivée en production).

## Conventions

- Préfixe : `/api/v1`.
- Authentification : `Authorization: Bearer <JWT Supabase>`.
- Organisation active : en-tête `X-Organization-Id`, appartenance vérifiée côté serveur.
- Format d'erreur unique :
  ```json
  {
    "error": {
      "code": "AGENT_NOT_FOUND",
      "message": "…",
      "requestId": "…",
      "details": []
    }
  }
  ```
- Une ressource d'une autre organisation renvoie `404`, jamais `403`.
- Pagination par curseur : `?limit=25&cursor=…`, réponse `{ "data": [...], "nextCursor": "…" | null }`.
- Les opérations qui créent des exécutions acceptent l'en-tête `Idempotency-Key`.
- Les dates sont au format ISO 8601 en UTC.

## Endpoints livrés

| Méthode | Chemin                                  | Auth     | Permission (organisation active) | Description                                                                                              |
| ------- | --------------------------------------- | -------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET     | `/api/v1/health`                        | publique | —                                | Vivacité de l'API                                                                                        |
| GET     | `/api/v1/health/ready`                  | publique | —                                | Base de données joignable et clés de signature Supabase publiées ; 503 `NOT_READY` sinon, avec le détail |
| GET     | `/api/v1/me`                            | JWT      | —                                | Profil et organisations actives de l'utilisateur, avec son rôle                                          |
| POST    | `/api/v1/organizations`                 | JWT      | —                                | Crée une organisation ; le créateur en devient `owner` ; audité                                          |
| GET     | `/api/v1/organizations/current`         | JWT      | `organization.read`              | Organisation active                                                                                      |
| PATCH   | `/api/v1/organizations/current`         | JWT      | `organization.update`            | Modifie le nom, le fuseau horaire et la devise ; audité avec le détail des changements                   |
| GET     | `/api/v1/organizations/current/members` | JWT      | `members.read`                   | Membres de l'organisation                                                                                |
| GET     | `/api/v1/audit-logs?limit=&cursor=`     | JWT      | `audit.read`                     | Journal d'audit, du plus récent au plus ancien, pagination par curseur                                   |

Les contrats (schémas zod et types) sont dans `packages/shared`. Chaque réponse porte un en-tête `X-Request-Id`, repris du client s'il est bien formé (`[\w-]{1,64}`), généré sinon.

## Codes d'erreur

| Code                          | HTTP    | Signification                                                                                                        |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`             | 401     | Jeton absent, invalide ou expiré                                                                                     |
| `AUTH_NOT_CONFIGURED`         | 503     | `SUPABASE_URL` absent                                                                                                |
| `ORGANIZATION_HEADER_INVALID` | 400     | `X-Organization-Id` absent ou mal formé                                                                              |
| `ORGANIZATION_NOT_FOUND`      | 404     | Organisation inexistante, suspendue, ou dont l'appelant n'est pas membre actif (réponse identique dans tous les cas) |
| `PERMISSION_DENIED`           | 403     | Membre, mais son rôle n'a pas la permission                                                                          |
| `VALIDATION_FAILED`           | 400     | Corps ou paramètres invalides ; `details` liste `path` et `message`                                                  |
| `PROFILE_MISSING`             | 404/409 | Profil utilisateur absent                                                                                            |
| `DATABASE_NOT_CONFIGURED`     | 503     | `DATABASE_URL` absent                                                                                                |
| `INTERNAL_ERROR`              | 500     | Erreur inattendue (détails uniquement dans les logs)                                                                 |
