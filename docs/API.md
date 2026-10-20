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

| Méthode | Chemin           | Auth   | Description                                       | Contrat                                  |
| ------- | ---------------- | ------ | ------------------------------------------------- | ---------------------------------------- |
| GET     | `/api/v1/health` | aucune | Vivacité de l'API (version, environnement, heure) | `healthResponseSchema` (`@nagaw/shared`) |

Chaque réponse porte un en-tête `X-Request-Id`. Il reprend celui envoyé par le client s'il est bien formé (`[\w-]{1,64}`), et il est généré sinon.
