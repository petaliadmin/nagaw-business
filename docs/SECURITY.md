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

## Menaces propres à la boutique et au hors ligne (proposé, ADR-019, ADR-020)

| Menace                                                       | Contrôle prévu                                                                                                                                   | Phase |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| Prix, remise ou total falsifié dans une opération hors ligne | Le serveur recalcule les totaux avec `packages/shared`, vérifie le prix du catalogue et le seuil de remise du rôle ; écart → opération refusée   | 10–11 |
| Rejeu ou doublon de synchronisation                          | `UNIQUE (organization_id, client_operation_id)`, réponse identique pour une opération déjà reçue, test de rejeu                                  | 11    |
| Opération envoyée pour une autre boutique                    | Chaque lot est rattaché à l'organisation vérifiée par `TenantGuard` et à un appareil de cette organisation ; opération étrangère → refus         | 11    |
| Téléphone perdu, volé ou partagé                             | Révocation de l'appareil par le gérant (`devices.revoked_at`) ; base locale effacée à la déconnexion ; durée hors ligne maximale configurable    | 11    |
| Données sensibles stockées sur l'appareil                    | Base locale limitée au nécessaire pour vendre (catalogue, clients récents, opérations en attente) ; aucune donnée comptable ni d'équipe en cache | 11    |
| Vendeur qui annule ou supprime des ventes                    | Ventes et paiements en ajout seul ; annulation réservée au gérant, motif obligatoire, auditée                                                    | 10    |
| Facture modifiée après émission, trou de numérotation        | Trigger interdisant la modification d'une facture émise ; séquence verrouillée par boutique et par année ; correction par avoir                  | 12    |
| Écritures comptables déséquilibrées ou sur exercice clos     | Contrainte différée débit = crédit ; refus sur `fiscal_years.status = closed`                                                                    | 14    |
| Photos et justificatifs                                      | Liste blanche MIME + vérification de signature, taille maximale, compression côté appareil, URL signées courtes                                  | 9, 13 |

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

## Contrôles implémentés (Phase 8)

| Contrôle                                                                                                                                                                                    | Où                                              | Preuve (test)                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Le service worker ne met en cache aucune donnée d'utilisateur : ni pages, ni réponses d'API, ni Server Actions ; seulement la page hors ligne et les fichiers immuables de `/_next/static/` | `apps/web/src/lib/pwa/service-worker-source.ts` | `service-worker-source.test.ts` › never intercepts API calls, Server Actions or other origins |
| `/sw.js` servi sans cache et avec une politique de sécurité de contenu stricte ; caches des versions précédentes supprimés                                                                  | `next.config.ts`, route `/sw.js`                | `pwa.spec.ts`, drops the caches of previous versions                                          |
| Modules Responsabilités et Tâches retirés : leurs routes répondent 404 dans le web et l'API                                                                                                 | —                                               | `workspace.spec.ts` › withdrawn modules are gone                                              |

## Contrôles implémentés (Phase 9)

| Contrôle                                                                                                                               | Où                                                            | Preuve (test)                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Catalogue, photos, mouvements et résumé toujours lus dans la boutique de l'appelant ; 404 sinon, sur chaque endpoint                   | `ProductsService.select`, `ReferencesService`, `StockService` | `catalog.integration-spec.ts` › never shows or changes a product of another shop, keeps each shop’s lists to itself (mutation : échoue sans le filtre) |
| Catégorie, taxe, fournisseur et produit rattachés à la même boutique, même en SQL                                                      | clés étrangères composites                                    | never links a product to another shop’s category, even in SQL                                                                                          |
| Journal du stock en ajout seul, y compris pour le propriétaire des tables                                                              | triggers `stock_movements_no_*`                               | keeps the stock ledger append-only                                                                                                                     |
| Vendeurs et lecteurs : lecture seule du catalogue et du stock                                                                          | permissions partagées + `TenantGuard`                         | lets sellers read but not change…, lets only managers move stock                                                                                       |
| Photo : type vérifié par signature (pas par l'en-tête déclaré), 512 Ko au plus, servie seulement avec la session et la boutique active | `detectImageType`, route `/espace/produits/[id]/photo`        | checks the image signature… ; e2e : la photo passe par le relais                                                                                       |
| Renvoi d'une création ou d'un mouvement : aucun doublon                                                                                | `UNIQUE (organization_id, client_operation_id)`               | answers a replayed creation…, answers a replayed movement…                                                                                             |
| Recherche : les caractères spéciaux de `LIKE` sont cherchés littéralement                                                              | `likePattern`                                                 | searches by name or barcode…                                                                                                                           |

## Contrôles implémentés (Phase 6, module retiré en Phase 8)

| Contrôle                                                                             | Où                                                   | Preuve (test)                                                                                                                |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Responsabilités toujours lues dans l'organisation de l'appelant ; 404 sinon          | `ResponsibilitiesService.select`                     | `responsibilities.integration-spec.ts` › isolation (mutation : échoue sans le filtre)                                        |
| Une responsabilité n'est confiée qu'à un membre de la même organisation, même en SQL | clé étrangère composite                              | cannot entrust a responsibility to a non-member, even in SQL                                                                 |
| La personne responsable doit être un membre actif pour créer ou activer              | `assigneeStatus`, `responsibilityActivationBlockers` | checks the person in charge, the escalation contact and the caps ; blocks reactivation once the person in charge is disabled |
| La personne à prévenir doit être un membre actif de l'organisation                   | `assertEscalation`                                   | checks the person in charge, the escalation contact and the caps                                                             |
| Aucune planification ni champ serveur (statut, organisation) accepté                 | schémas `.strict()`                                  | validates the period, refuses schedules, agents and server-owned fields                                                      |

## Contrôles implémentés (Phase 7, module retiré en Phase 8)

| Contrôle                                                                                                                            | Où                                               | Preuve (test)                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Tâches, notes et historique toujours lus dans l'organisation de l'appelant ; 404 sinon                                              | `TasksService.select`                            | `tasks.integration-spec.ts` › isolation (mutation : échoue sans le filtre)             |
| Responsabilité, personne en charge et notes rattachées à la même organisation, même en SQL                                          | clés étrangères composites                       | keeps tasks and notes inside one organization, even in SQL                             |
| Un membre ne lance une tâche que pour lui-même, ponctuelle ou sur une responsabilité qui lui est confiée ; un lecteur ne lance rien | `canLaunchTask` (shared) + `TasksService.create` | lets a member launch tasks only for themself                                           |
| Seule la personne en charge (ou un propriétaire / administrateur) fait avancer ou annote une tâche                                  | `canWorkOnTask` (shared)                         | keeps other people’s tasks out of a member’s hands                                     |
| Limite quotidienne par responsabilité et plafond de tâches ouvertes, configurables en base, vérifiés sous verrou                    | `TasksService.create`                            | applies the daily limit ; checks the person in charge, the input and the open-task cap |
| Tâche clôturée non modifiable ; journal de notes en ajout seul                                                                      | `TasksService`, trigger                          | keeps a closed task closed ; keeps an append-only journal of notes                     |

## Risques encore ouverts

- **Limitation de débit** : absente côté API. Supabase Auth limite déjà ses propres routes ; un mécanisme pour l'API (Vercel Firewall ou compteur Postgres) reste à mettre en place.
- **Envoi d'e-mails** : le SMTP par défaut de Supabase est très limité. Un SMTP dédié est requis avant toute ouverture aux utilisateurs.
- **TLS vers Postgres** : `DATABASE_SSL=require` chiffre la connexion sans vérifier le certificat. `verify-full` avec le certificat CA Supabase est recommandé.
