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
      "code": "MEMBER_NOT_FOUND",
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

| Méthode | Chemin                                                   | Auth     | Permission (organisation active) | Description                                                                                                                                                                                                                                            |
| ------- | -------------------------------------------------------- | -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET     | `/api/v1/health`                                         | publique | —                                | Vivacité de l'API                                                                                                                                                                                                                                      |
| GET     | `/api/v1/health/ready`                                   | publique | —                                | Base de données joignable et clés de signature Supabase publiées ; 503 `NOT_READY` sinon, avec le détail                                                                                                                                               |
| GET     | `/api/v1/me`                                             | JWT      | —                                | Profil et organisations actives de l'utilisateur, avec son rôle                                                                                                                                                                                        |
| POST    | `/api/v1/organizations`                                  | JWT      | —                                | Crée une organisation ; le créateur en devient `owner` ; audité                                                                                                                                                                                        |
| GET     | `/api/v1/organizations/current`                          | JWT      | `organization.read`              | Organisation active                                                                                                                                                                                                                                    |
| PATCH   | `/api/v1/organizations/current`                          | JWT      | `organization.update`            | Modifie le nom, le fuseau horaire, la devise et la durée de validité des invitations ; audité avec le détail des changements                                                                                                                           |
| GET     | `/api/v1/organizations/current/members`                  | JWT      | `members.read`                   | Membres de l'organisation                                                                                                                                                                                                                              |
| PATCH   | `/api/v1/organizations/current/members/:userId`          | JWT      | `members.manage`                 | Change le rôle et/ou le statut (`active`, `disabled`) d'un membre ; audité. Personne ne modifie sa propre appartenance ; seul un `owner` modifie un `owner` ou nomme un `owner`                                                                        |
| GET     | `/api/v1/organizations/current/invitations`              | JWT      | `members.invite`                 | Invitations en attente (y compris expirées non remplacées)                                                                                                                                                                                             |
| POST    | `/api/v1/organizations/current/invitations`              | JWT      | `members.invite`                 | Crée une invitation (`admin`, `member` ou `viewer`) ; renvoie le jeton **une seule fois** ; audité                                                                                                                                                     |
| POST    | `/api/v1/organizations/current/invitations/:id/revoke`   | JWT      | `members.invite`                 | Annule une invitation en attente ; audité                                                                                                                                                                                                              |
| POST    | `/api/v1/invitations/preview`                            | JWT      | — (jeton dans le corps)          | Organisation, rôle et statut de l'invitation, et indique si l'adresse de l'utilisateur est celle invitée                                                                                                                                               |
| POST    | `/api/v1/invitations/accept`                             | JWT      | — (jeton dans le corps)          | Rejoint l'organisation si l'invitation est valide et destinée à l'adresse de l'utilisateur ; audité                                                                                                                                                    |
| GET     | `/api/v1/tax-rates`                                      | JWT      | `catalog.read`                   | Taxes de la boutique, actives d'abord                                                                                                                                                                                                                  |
| POST    | `/api/v1/tax-rates`                                      | JWT      | `catalog.manage`                 | Ajoute une taxe (`name`, `rateBasisPoints` : 1800 = 18 %) ; plafond `max_tax_rates` ; audité                                                                                                                                                           |
| PATCH   | `/api/v1/tax-rates/:id`                                  | JWT      | `catalog.manage`                 | Renomme, change le taux, archive ou réactive ; audité avec le détail                                                                                                                                                                                   |
| GET     | `/api/v1/product-categories`                             | JWT      | `catalog.read`                   | Catégories, avec le nombre de produits actifs                                                                                                                                                                                                          |
| POST    | `/api/v1/product-categories`                             | JWT      | `catalog.manage`                 | Ajoute une catégorie (`name`, `color`) ; plafond `max_product_categories` ; audité                                                                                                                                                                     |
| PATCH   | `/api/v1/product-categories/:id`                         | JWT      | `catalog.manage`                 | Renomme, change la couleur, archive ou réactive ; audité                                                                                                                                                                                               |
| GET     | `/api/v1/suppliers`                                      | JWT      | `catalog.read`                   | Fournisseurs                                                                                                                                                                                                                                           |
| POST    | `/api/v1/suppliers`                                      | JWT      | `catalog.manage`                 | Ajoute un fournisseur (`name`, `phone`, `notes`) ; plafond `max_suppliers` ; audité                                                                                                                                                                    |
| PATCH   | `/api/v1/suppliers/:id`                                  | JWT      | `catalog.manage`                 | Modifie, archive ou réactive ; audité                                                                                                                                                                                                                  |
| GET     | `/api/v1/products?q=&categoryId=&stock=low\|out&status=` | JWT      | `catalog.read`                   | Produits (500 au plus, par nom) avec leur stock calculé ; `q` cherche dans le nom ou le code-barres exact                                                                                                                                              |
| POST    | `/api/v1/products`                                       | JWT      | `catalog.manage`                 | Crée un produit, avec un stock de départ facultatif (mouvement `initial`) ; `clientOperationId` obligatoire : un renvoi répond **200** avec le même produit ; plafond `max_products` ; audité                                                          |
| GET     | `/api/v1/products/:id`                                   | JWT      | `catalog.read`                   | Produit, avec catégorie, taxe, stock et niveau de stock                                                                                                                                                                                                |
| PATCH   | `/api/v1/products/:id`                                   | JWT      | `catalog.manage`                 | Modifie, archive ou réactive ; `version` obligatoire (409 `VERSION_CONFLICT` si dépassée) ; audité avec le détail                                                                                                                                      |
| GET     | `/api/v1/products/:id/photo`                             | JWT      | `catalog.read`                   | Photo (octets, `ETag`)                                                                                                                                                                                                                                 |
| PUT     | `/api/v1/products/:id/photo`                             | JWT      | `catalog.manage`                 | Corps brut `image/webp`, `image/jpeg` ou `image/png`, 512 Ko au plus ; type vérifié par signature ; audité                                                                                                                                             |
| DELETE  | `/api/v1/products/:id/photo`                             | JWT      | `catalog.manage`                 | Retire la photo ; audité                                                                                                                                                                                                                               |
| GET     | `/api/v1/products/:id/movements`                         | JWT      | `catalog.read`                   | Les 100 derniers mouvements du stock                                                                                                                                                                                                                   |
| POST    | `/api/v1/products/:id/movements`                         | JWT      | `stock.move`                     | Entrée (`purchase` : quantité, coût, fournisseur), perte (`loss` : quantité, raison) ou inventaire (`inventory` : quantité comptée) ; `clientOperationId` : un renvoi répond **200** sans doublon ; renvoie le mouvement et le produit à jour ; audité |
| GET     | `/api/v1/stock/summary`                                  | JWT      | `catalog.read`                   | Produits suivis, épuisés, bientôt épuisés, valeur du stock au prix d'achat, 10 alertes                                                                                                                                                                 |
| GET     | `/api/v1/audit-logs?limit=&cursor=`                      | JWT      | `audit.read`                     | Journal d'audit, du plus récent au plus ancien, pagination par curseur                                                                                                                                                                                 |

Les endpoints Responsabilités et Tâches ont été retirés en Phase 8 (ADR-019) ; leurs tables restent en base, inutilisées.

Les contrats (schémas zod et types) sont dans `packages/shared`. Chaque réponse porte un en-tête `X-Request-Id`, repris du client s'il est bien formé (`[\w-]{1,64}`), généré sinon.

## Codes d'erreur

| Code                          | HTTP    | Signification                                                                                                        |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`             | 401     | Jeton absent, invalide ou expiré                                                                                     |
| `AUTH_NOT_CONFIGURED`         | 503     | `SUPABASE_URL` absent                                                                                                |
| `ORGANIZATION_HEADER_INVALID` | 400     | `X-Organization-Id` absent ou mal formé                                                                              |
| `ORGANIZATION_NOT_FOUND`      | 404     | Organisation inexistante, suspendue, ou dont l'appelant n'est pas membre actif (réponse identique dans tous les cas) |
| `PERMISSION_DENIED`           | 403     | Membre, mais son rôle n'a pas la permission (ou, pour une tâche, n'en est pas la personne en charge)                 |
| `VALIDATION_FAILED`           | 400     | Corps ou paramètres invalides ; `details` liste `path` et `message`                                                  |
| `PROFILE_MISSING`             | 404/409 | Profil utilisateur absent                                                                                            |
| `DATABASE_NOT_CONFIGURED`     | 503     | `DATABASE_URL` absent                                                                                                |
| `MEMBER_NOT_FOUND`            | 404     | Membre absent de l'organisation active (y compris membre d'une autre organisation)                                   |
| `SELF_CHANGE_FORBIDDEN`       | 403     | Modification de sa propre appartenance                                                                               |
| `OWNER_PROTECTED`             | 403     | Un non-propriétaire tente de modifier un propriétaire                                                                |
| `OWNER_PROMOTION_FORBIDDEN`   | 403     | Un non-propriétaire tente de nommer un propriétaire                                                                  |
| `LAST_OWNER`                  | 409     | L'organisation resterait sans propriétaire actif (garde-fou en base)                                                 |
| `ALREADY_MEMBER`              | 409     | L'adresse invitée est déjà membre (active ou désactivée : réactiver plutôt qu'inviter)                               |
| `INVITATION_PENDING`          | 409     | Une invitation est déjà en attente pour cette adresse                                                                |
| `INVITATION_LIMIT_REACHED`    | 409     | Nombre maximal d'invitations en attente atteint (`max_pending_invitations`)                                          |
| `INVITATION_NOT_FOUND`        | 404     | Jeton inconnu, ou invitation d'une autre organisation                                                                |
| `INVITATION_NOT_PENDING`      | 409     | Annulation d'une invitation qui n'est plus en attente                                                                |
| `INVITATION_ALREADY_USED`     | 409     | Invitation déjà acceptée                                                                                             |
| `INVITATION_REVOKED`          | 410     | Invitation annulée                                                                                                   |
| `INVITATION_EXPIRED`          | 410     | Invitation expirée                                                                                                   |
| `INVITATION_EMAIL_MISMATCH`   | 403     | L'utilisateur connecté n'a pas l'adresse invitée                                                                     |
| `INVALID_STATUS_TRANSITION`   | 409     | Changement de statut non autorisé par le cycle de vie                                                                |
| `NAME_TAKEN`                  | 409     | Un élément actif de la boutique porte déjà ce nom (taxe, catégorie, fournisseur, produit)                            |
| `BARCODE_TAKEN`               | 409     | Un produit actif de la boutique porte déjà ce code-barres                                                            |
| `CATALOG_LIMIT_REACHED`       | 409     | Plafond de la boutique atteint (`max_products`, `max_product_categories`, `max_suppliers`, `max_tax_rates`)          |
| `TAX_RATE_NOT_FOUND`          | 404     | Taxe absente de la boutique active                                                                                   |
| `CATEGORY_NOT_FOUND`          | 404     | Catégorie absente de la boutique active                                                                              |
| `SUPPLIER_NOT_FOUND`          | 404     | Fournisseur absent de la boutique active                                                                             |
| `PRODUCT_NOT_FOUND`           | 404     | Produit absent de la boutique active (y compris celui d'une autre boutique)                                          |
| `PHOTO_NOT_FOUND`             | 404     | Le produit n'a pas de photo                                                                                          |
| `PHOTO_TOO_LARGE`             | 413     | Photo de plus de 512 Ko                                                                                              |
| `VERSION_CONFLICT`            | 409     | Le produit a été modifié depuis sa lecture                                                                           |
| `STOCK_INSUFFICIENT`          | 409     | Perte supérieure au stock                                                                                            |
| `STOCK_NOT_TRACKED`           | 409     | Mouvement sur un produit dont le stock n'est pas suivi                                                               |
| `PRODUCT_ARCHIVED`            | 409     | Mouvement sur un produit archivé                                                                                     |
| `OPERATION_ID_REUSED`         | 409     | Identifiant d'opération déjà utilisé pour un autre produit                                                           |
| `INTERNAL_ERROR`              | 500     | Erreur inattendue (détails uniquement dans les logs)                                                                 |
