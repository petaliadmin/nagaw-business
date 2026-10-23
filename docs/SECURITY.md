# Sécurité

> **État** : les contrôles de la Phase 2 sont **implémentés et testés** (voir la section ci-dessous). Les autres restent prévus.

## Principes

1. **Authentification côté serveur** : le JWT Supabase est vérifié par l'API à chaque requête (signature JWKS, `exp`, `aud`).
2. **Autorisation à chaque opération** : guards tenant et permission, plus filtre `organization_id` imposé au niveau repository. Masquer un bouton dans l'interface n'est jamais un contrôle d'accès.
3. **Aucune confiance dans le client** : `organization_id`, rôle, montant et prix sont toujours revérifiés côté serveur.
4. **Aucune confiance dans le modèle IA** : sa sortie est validée (zod), puis soumise au moteur de politiques, qui s'exécute en dehors du modèle.
5. **Secrets côté serveur uniquement** : la clé `service_role`, les clés IA et la clé maître de chiffrement ne sont jamais dans `NEXT_PUBLIC_*`. La CI vérifie le bundle.
6. **Moindre privilège** : RLS activée, aucun accès direct `anon`/`authenticated` aux tables métier, rôle Postgres dédié à l'API.
7. **Traçabilité** : chaque action sensible écrit un `audit_logs` immuable dans la même transaction.

## Menaces principales et contrôles prévus

| Menace                               | Contrôle                                                                                                | Phase |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----- |
| IDOR / accès inter-organisations     | TenantGuard, repositories scopés, RLS, tests d'isolation                                                | 2     |
| Élévation de rôle                    | Changements de rôle limités (un admin ne peut pas promouvoir en owner), dernier owner protégé, audit    | 4     |
| Vol de jeton d'invitation            | Jeton aléatoire de 256 bits, stocké hashé, expiration, usage unique, liaison à l'e-mail invité          | 4     |
| Prompt injection via contenu externe | Contenu externe balisé comme non fiable, politiques hors modèle, approbation pour les actions sensibles | 7–9   |
| Contournement d'approbation          | Hash canonique de l'action, contrôle au moment de l'exécution, expiration                               | 8     |
| Fuite de credentials d'intégration   | AES-256-GCM, jamais renvoyés, logs masqués (redaction pino)                                             | 9     |
| Fichiers dangereux                   | Liste blanche MIME + vérification de signature, taille max, URLs signées courtes                        | 10    |
| Rejeu de webhooks                    | Signature vérifiée, `UNIQUE(provider, event_id)`                                                        | 12    |
| Abus / brute force                   | Throttling sur auth, invitations, déclenchement de tâches                                               | 2–7   |
| Explosion des coûts IA               | Quotas par organisation, `max_steps` et `max_tokens` par exécution                                      | 7     |
| Admin plateforme trop puissant       | Pas d'accès au contenu métier, actions auditées                                                         | 13    |

## Contrôles implémentés (Phase 2)

| Contrôle                                                                                                                                       | Où                                                   | Preuve (test)                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Vérification JWT : signature JWKS, émetteur, audience, expiration, utilisateurs anonymes et rôle `service_role` refusés                        | `apps/api/src/auth/jwt-verifier.ts`                  | `jwt-verifier.spec.ts` (clés ES256 réelles, jeton falsifié)                                                          |
| Authentification par défaut sur toutes les routes (`@Public` explicite)                                                                        | `AuthGuard` global                                   | `organizations.integration-spec.ts` › authentication                                                                 |
| Organisation active vérifiée en base (membre actif, organisation active) ; 404 identique pour un étranger et pour une organisation inexistante | `TenantGuard`                                        | isolation et rôles, 29 tests d'intégration ; un test de mutation (filtre d'appartenance retiré) fait échouer 7 tests |
| Permissions par rôle côté serveur                                                                                                              | `packages/shared/src/permissions.ts` + `TenantGuard` | role-based permissions                                                                                               |
| Validation stricte des entrées (`.strict()`), y compris contre l'affectation de champs serveur                                                 | `ZodValidationPipe`                                  | validates input server-side                                                                                          |
| Aucun accès `anon`/`authenticated` au schéma `app`, aucun `DELETE` pour l'API, audit en ajout seul                                             | migration                                            | `database-security.integration-spec.ts`                                                                              |
| Audit écrit dans la même transaction que la modification                                                                                       | `AuditService.record(trx, …)`                        | records organization.created / exact changes                                                                         |
| Redirections après authentification limitées aux chemins internes (_open redirect_)                                                            | `apps/web/src/lib/auth/redirect.ts`                  | `auth.test.ts`, e2e callback                                                                                         |
| Réponse neutre à la demande de réinitialisation (pas d'énumération des comptes)                                                                | `requestPasswordReset`                               | —                                                                                                                    |
| Logs HTTP en liste blanche (identifiant, méthode, chemin) : ni en-têtes ni paramètres de requête, donc ni jetons ni cookies                    | `apps/api/src/common/logging.ts`                     | `logging.spec.ts`                                                                                                    |
| Aucune clé privilégiée côté web : seule la clé publishable est utilisée                                                                        | `apps/web/src/lib/env.ts`                            | revue                                                                                                                |

## Contrôles implémentés (Phase 4)

| Contrôle                                                                                                                | Où                                                    | Preuve (test)                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| Jeton d'invitation de 256 bits, stocké uniquement sous forme de hash SHA-256, renvoyé une seule fois, absent de l'audit | `apps/api/src/members/invitation-token.ts`, migration | `invitation-token.spec.ts`, `members.integration-spec.ts`       |
| Invitation à usage unique, expirante (durée configurable en base), annulable, liée à l'adresse invitée                  | `InvitationsService`                                  | accepting invitations                                           |
| Une invitation ne donne jamais le rôle `owner`                                                                          | `createInvitationSchema`, contrainte SQL              | refuses duplicates, existing members and the owner role         |
| Changements de rôle : personne ne modifie sa propre appartenance, seul un `owner` touche un `owner` ou nomme un `owner` | `memberChangeRefusal` (shared) + `MembersService`     | `members.spec.ts`, protects owners from admins                  |
| Au moins un `owner` actif par organisation, garanti par un trigger qui verrouille l'organisation                        | migration Phase 4                                     | keeps at least one active owner, even outside the API           |
| Désactivation d'un membre : accès coupé immédiatement (`TenantGuard`, `/me`)                                            | `TenantGuard`                                         | lets an admin disable and reactivate a member                   |
| Isolation : invitations et membres d'une autre organisation répondent 404, en lecture comme en écriture                 | `InvitationsService`, `MembersService`                | isolation between organizations                                 |
| Nombre d'invitations en attente plafonné par organisation (`max_pending_invitations`)                                   | `InvitationsService`                                  | uses the lifetime and the limit configured for the organization |

## Contrôles implémentés (Phase 5)

| Contrôle                                                                                                       | Où                                    | Preuve (test)                                                                       |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| Agents et versions toujours lus dans l'organisation de l'appelant ; 404 pour un agent d'une autre organisation | `AgentsService.findAgent`             | `agents.integration-spec.ts` › isolation (test de mutation : échoue sans le filtre) |
| Une version ne peut appartenir qu'à un agent de la même organisation (clé étrangère composite)                 | migration Phase 5                     | cannot attach a version to an agent of another organization                         |
| Versions immuables, même pour le propriétaire des tables                                                       | trigger `reject_append_only_mutation` | appends a version for each configuration change                                     |
| Création et configuration réservées à `owner`/`admin` ; lecture et test pour tous les membres                  | permissions `agents.*`                | lets members read but not create or change agents                                   |
| Outils non disponibles et limites au-delà des plafonds refusés à l'enregistrement                              | `AgentsService.assertSavable`         | refuses tools that are not available yet ; applies the caps                         |
| Aucun champ serveur (statut, organisation, modèle) accepté à la création                                       | schémas `.strict()`                   | validates input and refuses server-owned fields                                     |

## Contrôles implémentés (Phase 6)

| Contrôle                                                                                   | Où                               | Preuve (test)                                                                         |
| ------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------- |
| Responsabilités toujours lues dans l'organisation de l'appelant ; 404 sinon                | `ResponsibilitiesService.select` | `responsibilities.integration-spec.ts` › isolation (mutation : échoue sans le filtre) |
| Une responsabilité ne peut être confiée qu'à un agent de la même organisation, même en SQL | clé étrangère composite          | cannot link a responsibility to another organization’s agent, even in SQL             |
| La personne à prévenir doit être un membre actif de l'organisation                         | `assertEscalation`               | checks the agent, the escalation contact and the caps                                 |
| Aucune planification ni champ serveur (statut, organisation) accepté                       | schémas `.strict()`              | validates the period, refuses schedules and server-owned fields                       |

## Risques encore ouverts

- **Limitation de débit** : absente côté API. Supabase Auth limite déjà ses propres routes ; un mécanisme pour l'API (Vercel Firewall ou compteur Postgres) reste à mettre en place.
- **Envoi d'e-mails** : le SMTP par défaut de Supabase est très limité. Un SMTP dédié est requis avant toute ouverture aux utilisateurs.
- **TLS vers Postgres** : `DATABASE_SSL=require` chiffre la connexion sans vérifier le certificat. `verify-full` avec le certificat CA Supabase est recommandé.
