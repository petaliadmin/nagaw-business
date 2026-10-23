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

| Méthode | Chemin                                                    | Auth     | Permission (organisation active) | Description                                                                                                                                                                                                                 |
| ------- | --------------------------------------------------------- | -------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/api/v1/health`                                          | publique | —                                | Vivacité de l'API                                                                                                                                                                                                           |
| GET     | `/api/v1/health/ready`                                    | publique | —                                | Base de données joignable et clés de signature Supabase publiées ; 503 `NOT_READY` sinon, avec le détail                                                                                                                    |
| GET     | `/api/v1/me`                                              | JWT      | —                                | Profil et organisations actives de l'utilisateur, avec son rôle                                                                                                                                                             |
| POST    | `/api/v1/organizations`                                   | JWT      | —                                | Crée une organisation ; le créateur en devient `owner` ; audité                                                                                                                                                             |
| GET     | `/api/v1/organizations/current`                           | JWT      | `organization.read`              | Organisation active                                                                                                                                                                                                         |
| PATCH   | `/api/v1/organizations/current`                           | JWT      | `organization.update`            | Modifie le nom, le fuseau horaire, la devise et la durée de validité des invitations ; audité avec le détail des changements                                                                                                |
| GET     | `/api/v1/organizations/current/members`                   | JWT      | `members.read`                   | Membres de l'organisation                                                                                                                                                                                                   |
| PATCH   | `/api/v1/organizations/current/members/:userId`           | JWT      | `members.manage`                 | Change le rôle et/ou le statut (`active`, `disabled`) d'un membre ; audité. Personne ne modifie sa propre appartenance ; seul un `owner` modifie un `owner` ou nomme un `owner`                                             |
| GET     | `/api/v1/organizations/current/invitations`               | JWT      | `members.invite`                 | Invitations en attente (y compris expirées non remplacées)                                                                                                                                                                  |
| POST    | `/api/v1/organizations/current/invitations`               | JWT      | `members.invite`                 | Crée une invitation (`admin`, `member` ou `viewer`) ; renvoie le jeton **une seule fois** ; audité                                                                                                                          |
| POST    | `/api/v1/organizations/current/invitations/:id/revoke`    | JWT      | `members.invite`                 | Annule une invitation en attente ; audité                                                                                                                                                                                   |
| POST    | `/api/v1/invitations/preview`                             | JWT      | — (jeton dans le corps)          | Organisation, rôle et statut de l'invitation, et indique si l'adresse de l'utilisateur est celle invitée                                                                                                                    |
| POST    | `/api/v1/invitations/accept`                              | JWT      | — (jeton dans le corps)          | Rejoint l'organisation si l'invitation est valide et destinée à l'adresse de l'utilisateur ; audité                                                                                                                         |
| GET     | `/api/v1/responsibilities?assigneeUserId=&archives=true`  | JWT      | `responsibilities.read`          | Responsabilités de l'organisation, filtrables par personne responsable (archivées exclues par défaut)                                                                                                                       |
| GET     | `/api/v1/responsibilities/limits`                         | JWT      | `responsibilities.read`          | Plafonds de l'organisation : nombre de responsabilités, tâches par jour                                                                                                                                                     |
| POST    | `/api/v1/responsibilities`                                | JWT      | `responsibilities.manage`        | Crée une responsabilité en brouillon, confiée à un membre actif de l'organisation ; audité                                                                                                                                  |
| GET     | `/api/v1/responsibilities/:id`                            | JWT      | `responsibilities.read`          | Responsabilité, avec la personne responsable et la personne à prévenir                                                                                                                                                      |
| PUT     | `/api/v1/responsibilities/:id`                            | JWT      | `responsibilities.manage`        | Remplace les champs modifiables ; audité avec le détail des changements                                                                                                                                                     |
| POST    | `/api/v1/responsibilities/:id/status`                     | JWT      | `responsibilities.manage`        | Brouillon → active ↔ suspendue → archivée ; l'activation exige un responsable actif, un objectif et des critères ; audité                                                                                                   |
| GET     | `/api/v1/responsibilities/:id/history`                    | JWT      | `responsibilities.read`          | Historique des changements (entrées d'audit de la responsabilité)                                                                                                                                                           |
| GET     | `/api/v1/tasks?assigneeUserId=&responsibilityId=&status=` | JWT      | `tasks.read`                     | Tâches de l'organisation (200 au plus, les plus récentes d'abord) ; `status` : un statut, `open` ou `closed`                                                                                                                |
| GET     | `/api/v1/tasks/summary`                                   | JWT      | `tasks.read`                     | Compteurs : à faire, en cours, bloquées, en retard (fuseau de l'organisation), tâches ouvertes de l'appelant                                                                                                                |
| POST    | `/api/v1/tasks`                                           | JWT      | `tasks.work`                     | Lance une tâche, ponctuelle ou sur une responsabilité active dans sa période ; un membre ne lance que pour lui-même, sur ses responsabilités ; limite quotidienne de la responsabilité et plafond `max_open_tasks` ; audité |
| GET     | `/api/v1/tasks/:id`                                       | JWT      | `tasks.read`                     | Tâche, avec la personne en charge, la responsabilité et la personne à prévenir                                                                                                                                              |
| PUT     | `/api/v1/tasks/:id`                                       | JWT      | `tasks.manage`                   | Remplace titre, description, personne en charge et échéance d'une tâche ouverte ; audité avec le détail des changements                                                                                                     |
| POST    | `/api/v1/tasks/:id/status`                                | JWT      | `tasks.work`                     | À faire → en cours ↔ bloquée (motif requis) → terminée (résultat et compte rendu requis) ou annulée ; réservé à la personne en charge et aux gestionnaires ; audité                                                         |
| GET     | `/api/v1/tasks/:id/notes`                                 | JWT      | `tasks.read`                     | Notes de la tâche, des plus récentes aux plus anciennes                                                                                                                                                                     |
| POST    | `/api/v1/tasks/:id/notes`                                 | JWT      | `tasks.work`                     | Ajoute une note (ajout seul) à une tâche ouverte ; réservé à la personne en charge et aux gestionnaires ; audité                                                                                                            |
| GET     | `/api/v1/tasks/:id/history`                               | JWT      | `tasks.read`                     | Historique (entrées d'audit de la tâche)                                                                                                                                                                                    |
| GET     | `/api/v1/audit-logs?limit=&cursor=`                       | JWT      | `audit.read`                     | Journal d'audit, du plus récent au plus ancien, pagination par curseur                                                                                                                                                      |

Les contrats (schémas zod et types) sont dans `packages/shared`. Chaque réponse porte un en-tête `X-Request-Id`, repris du client s'il est bien formé (`[\w-]{1,64}`), généré sinon.

## Codes d'erreur

| Code                           | HTTP    | Signification                                                                                                        |
| ------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`              | 401     | Jeton absent, invalide ou expiré                                                                                     |
| `AUTH_NOT_CONFIGURED`          | 503     | `SUPABASE_URL` absent                                                                                                |
| `ORGANIZATION_HEADER_INVALID`  | 400     | `X-Organization-Id` absent ou mal formé                                                                              |
| `ORGANIZATION_NOT_FOUND`       | 404     | Organisation inexistante, suspendue, ou dont l'appelant n'est pas membre actif (réponse identique dans tous les cas) |
| `PERMISSION_DENIED`            | 403     | Membre, mais son rôle n'a pas la permission (ou, pour une tâche, n'en est pas la personne en charge)                 |
| `VALIDATION_FAILED`            | 400     | Corps ou paramètres invalides ; `details` liste `path` et `message`                                                  |
| `PROFILE_MISSING`              | 404/409 | Profil utilisateur absent                                                                                            |
| `DATABASE_NOT_CONFIGURED`      | 503     | `DATABASE_URL` absent                                                                                                |
| `MEMBER_NOT_FOUND`             | 404     | Membre absent de l'organisation active (y compris membre d'une autre organisation)                                   |
| `SELF_CHANGE_FORBIDDEN`        | 403     | Modification de sa propre appartenance                                                                               |
| `OWNER_PROTECTED`              | 403     | Un non-propriétaire tente de modifier un propriétaire                                                                |
| `OWNER_PROMOTION_FORBIDDEN`    | 403     | Un non-propriétaire tente de nommer un propriétaire                                                                  |
| `LAST_OWNER`                   | 409     | L'organisation resterait sans propriétaire actif (garde-fou en base)                                                 |
| `ALREADY_MEMBER`               | 409     | L'adresse invitée est déjà membre (active ou désactivée : réactiver plutôt qu'inviter)                               |
| `INVITATION_PENDING`           | 409     | Une invitation est déjà en attente pour cette adresse                                                                |
| `INVITATION_LIMIT_REACHED`     | 409     | Nombre maximal d'invitations en attente atteint (`max_pending_invitations`)                                          |
| `INVITATION_NOT_FOUND`         | 404     | Jeton inconnu, ou invitation d'une autre organisation                                                                |
| `INVITATION_NOT_PENDING`       | 409     | Annulation d'une invitation qui n'est plus en attente                                                                |
| `INVITATION_ALREADY_USED`      | 409     | Invitation déjà acceptée                                                                                             |
| `INVITATION_REVOKED`           | 410     | Invitation annulée                                                                                                   |
| `INVITATION_EXPIRED`           | 410     | Invitation expirée                                                                                                   |
| `INVITATION_EMAIL_MISMATCH`    | 403     | L'utilisateur connecté n'a pas l'adresse invitée                                                                     |
| `INVALID_STATUS_TRANSITION`    | 409     | Changement de statut non autorisé par le cycle de vie                                                                |
| `RESPONSIBILITY_NOT_FOUND`     | 404     | Responsabilité absente de l'organisation active (y compris celle d'une autre organisation)                           |
| `RESPONSIBILITY_LIMIT_REACHED` | 409     | Plafond de responsabilités de l'organisation atteint (`max_responsibilities`)                                        |
| `RESPONSIBILITY_ARCHIVED`      | 409     | Modification d'une responsabilité archivée                                                                           |
| `RESPONSIBILITY_NOT_READY`     | 409     | Activation (ou modification d'une responsabilité active) impossible ; `details` liste les blocages                   |
| `TASK_NOT_FOUND`               | 404     | Tâche absente de l'organisation active (y compris celle d'une autre organisation)                                    |
| `TASK_CLOSED`                  | 409     | Modification ou note sur une tâche terminée ou annulée                                                               |
| `TASK_DAILY_LIMIT_REACHED`     | 409     | Limite de tâches par jour de la responsabilité atteinte (fuseau de l'organisation)                                   |
| `TASK_LIMIT_REACHED`           | 409     | Plafond de tâches ouvertes de l'organisation atteint (`max_open_tasks`)                                              |
| `RESPONSIBILITY_NOT_ACTIVE`    | 409     | Tâche lancée sur une responsabilité qui n'est pas active                                                             |
| `RESPONSIBILITY_OUT_OF_PERIOD` | 409     | Tâche lancée hors de la période de la responsabilité                                                                 |
| `INTERNAL_ERROR`               | 500     | Erreur inattendue (détails uniquement dans les logs)                                                                 |
