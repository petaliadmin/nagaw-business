# État d'implémentation

Ce fichier reflète **l'état réel du code**. Il est mis à jour à la fin de chaque phase.

## Phase 0 — Audit du dépôt et plan d'exécution

- **Statut** : **validée** par le propriétaire le 2026-10-20, avec les ajustements suivants : IA reportée, API sur Vercel, interface en français uniquement.
- **Constat** : le dépôt était vide. Les livrables sont dans `docs/AUDIT_PHASE_0.md` et les ADR dans `docs/DECISIONS.md`.

## Phase 1 — Socle technique

- **Objectif** : disposer d'un projet stable, outillé et vérifiable automatiquement.
- **Statut** : **validée** par le propriétaire le 2026-10-20.
- **Fonctionnalités terminées** :
  - monorepo pnpm : `apps/web`, `apps/api`, `packages/shared` ;
  - API NestJS 12 :
    - préfixe `/api/v1` ;
    - configuration validée par zod au démarrage, qui échoue immédiatement si elle est invalide ;
    - logs JSON pino avec identifiant de requête et masquage de `Authorization` et des cookies ;
    - filtre d'erreurs global au format documenté, sans fuite de détails internes ;
    - en-têtes de sécurité (helmet) et CORS limité à une liste d'origines ;
    - Swagger sur `/api/v1/docs`, hors production ;
    - `GET /api/v1/health` ;
  - web Next.js 16 : page d'accueil en français, qui annonce honnêtement que la plateforme est en construction et affiche l'état **réel** de l'API ;
  - contrats partagés (`@nagaw/shared`) : schémas zod de l'enveloppe d'erreur et de la réponse de santé ;
  - CI GitHub Actions : format, lint, types, tests unitaires et d'intégration, build et scan de secrets (gitleaks) ;
  - projets Vercel `nagaw-web` et `nagaw-api` créés et reliés au dépôt.
- **Tests exécutés** :

  | Commande                | Résultat                                 |
  | ----------------------- | ---------------------------------------- |
  | `pnpm format:check`     | OK                                       |
  | `pnpm lint`             | OK                                       |
  | `pnpm typecheck`        | OK                                       |
  | `pnpm test`             | 15 tests OK (shared 2, api 7, web 6)     |
  | `pnpm test:integration` | 5 tests OK (pipeline HTTP réel de l'API) |
  | `pnpm build`            | OK                                       |

  Tests manuels : API démarrée, `health` → 200, route inconnue → 404 au format documenté, Swagger → 200. Page web rendue avec l'API démarrée (« API opérationnelle ») puis arrêtée (« API indisponible »).

  La CI GitHub Actions ne s'exécutera qu'à l'ouverture d'une PR ou sur `main`.

- **Problèmes connus** :
  - Node local 22.22.0 : `@nestjs/schematics` déclare `^22.22.3`. Ce n'est qu'un avertissement, la CI et Vercel utilisant Node 24.
  - La branche par défaut GitHub reste `claude/beautiful-cerf-cbbkzm` tant que le propriétaire n'a pas sélectionné `main` (réglage GitHub non accessible par les connecteurs).
- **Déploiements Vercel vérifiés (2026-10-20)** :
  - `GET https://nagaw-api-petalia.vercel.app/api/v1/health` répond 200, avec les en-têtes helmet, `X-Request-Id` et une exécution dans la région `cdg1` ;
  - la page `https://nagaw-web-petalia.vercel.app/` affiche « API opérationnelle — version dev, environnement production » ;
  - trois défauts, visibles uniquement sur Vercel, ont été corrigés :
    1. import de `helmet` sous le vérificateur TypeScript de Vercel (`interopDefault`, testé) ;
    2. _top-level await_ dans `main.ts`, qui bloquait la fonction NestJS ;
    3. réponse HTML d'une protection d'accès qui faisait planter la page (test de régression ajouté).
- **Infrastructure** :
  - projet Supabase `nagaw-business` (`zvswytzuukogmdqyhufn`, `eu-west-3`) créé, après mise en pause de `petalia-soil-api` à la demande du propriétaire ;
  - production de l'API publique, préversions protégées ;
  - branche `main` créée.
- **Configuration encore nécessaire** : définir `main` comme branche par défaut sur GitHub (puis comme _Production Branch_ dans les deux projets Vercel si besoin) et protéger `main`.
- **Prochaine action recommandée** : Phase 2 (base de données, Auth, multi-tenant). Le projet Supabase est prêt.

## Phase 2 — Base de données, authentification et multi-tenant

- **Objectif** : un utilisateur authentifié n'accède qu'aux ressources autorisées.
- **Statut** : **validée** par le propriétaire le 2026-10-23, après vérification de bout en bout en production.
- **Fonctionnalités terminées** :
  - Migration `20261020194209_tenancy_foundation`, **appliquée** au projet Supabase `nagaw-business` (analyse de sécurité Supabase : 0 alerte) :
    - schéma privé `app` : `user_profiles`, synchronisé depuis `auth.users` par trigger ; `organizations` ; `organization_memberships` ; `audit_logs`, en ajout seul ;
    - rôle `nagaw_api` aux droits minimaux, RLS, aucun accès `anon`/`authenticated`.
  - API :
    - vérification des JWT Supabase par JWKS ;
    - `AuthGuard` global et `TenantGuard` (appartenance vérifiée en base, 404 pour les étrangers, 403 pour un rôle insuffisant) ;
    - rôles `owner`, `admin`, `member`, `viewer` et permissions partagées ;
    - endpoints `GET /me`, `POST /organizations`, `GET|PATCH /organizations/current`, `GET /organizations/current/members`, `GET /audit-logs`, `GET /health/ready` (base et clés de signature) ;
    - audit transactionnel.
  - Web :
    - inscription, connexion, déconnexion, mot de passe oublié et réinitialisation (Server Actions, validation côté serveur, messages en français) ;
    - callback PKCE protégé contre les redirections externes, page « lien invalide » ;
    - espace connecté : création d'une première organisation et liste des organisations avec le rôle.
  - CI : service Postgres 17, tests end-to-end Playwright.
- **Tests exécutés** :

  | Commande                       | Résultat                                                            |
  | ------------------------------ | ------------------------------------------------------------------- |
  | `pnpm test`                    | 48 tests OK (shared 8, api 21, web 19)                              |
  | `pnpm test:integration`        | 29 tests OK sur un vrai Postgres 16 construit depuis les migrations |
  | `pnpm test:e2e`                | 12 tests OK (6 scénarios × bureau et mobile)                        |
  | lint, typecheck, build, format | OK                                                                  |

  Test de mutation : retirer le filtre d'appartenance du `TenantGuard` fait échouer 7 tests d'isolation.

- **Vérifié en production** (2026-10-20) :
  - pages d'authentification servies ;
  - `GET /api/v1/health/ready` répond **200** avec `{ "status": "ready", "database": "ok", "auth": "ok" }` : l'API se connecte à Postgres avec le rôle `nagaw_api` via le pooler, et le projet publie des clés asymétriques.
- **Parcours réel vérifié en production** (2026-10-20, par le propriétaire et contrôlé en base) :
  - inscription, puis confirmation de l'adresse e-mail ;
  - connexion par mot de passe : session ouverte ;
  - création de l'organisation via l'API : le créateur en est `owner` actif ;
  - entrée `organization.created` dans le journal d'audit, avec l'acteur et l'identifiant de requête.
- **Incident constaté puis corrigé** : un lien de confirmation ouvert dans un autre navigateur confirme bien l'adresse, mais ne peut pas ouvrir de session (cookie PKCE absent). La page affichait alors « lien invalide ». Le callback journalise désormais la raison de l'échec, et la page invite à se connecter (commit `2d32acc`).
- **Problèmes connus** : pas de limitation de débit côté API ; SMTP Supabase par défaut ; TLS Postgres non vérifié (`require`).
- **Correctif après fusion** : les logs HTTP enregistraient tous les en-têtes, y compris le jeton OIDC Vercel (`x-vercel-oidc-token`) et la signature du proxy. Ils ne gardent plus que l'identifiant, la méthode et le chemin (liste blanche testée dans `apps/api/src/common/logging.spec.ts`).
- **Reste à faire, phases suivantes** : navigation et tableau de bord (Phase 3, livrée) ; invitations et gestion des membres (Phase 4).

## Phase 3 — Interface générale et navigation

- **Objectif** : un cadre applicatif navigable, sans lien mort ni donnée fictive.
- **Statut** : **validée** par le propriétaire le 2026-10-23, après test de la prévisualisation ; fusionnée dans `main` et déployée en production avec son autorisation.
- **Fonctionnalités terminées** :
  - mise en page connectée (`/espace`) :
    - barre latérale sur ordinateur ;
    - barre supérieure et menu sur mobile (dialogue accessible, fermeture par Échap, gestion du focus, fermeture à la navigation) ;
    - lien d'évitement « Aller au contenu » ;
  - navigation limitée aux pages existantes (Vue d'ensemble, Équipe, Journal d'audit, Paramètres), avec `aria-current` sur la page courante ;
  - sélecteur d'organisation active :
    - préférence enregistrée dans un cookie `httpOnly` ;
    - organisation revérifiée contre la liste renvoyée par l'API à chaque rendu (un cookie forgé retombe sur une organisation de l'utilisateur), l'API restant l'autorité ;
    - création d'une organisation supplémentaire possible ;
  - vue d'ensemble alimentée uniquement par des données réelles :
    - membres actifs, rôle, fuseau horaire et devise, 5 dernières entrées d'audit avec leur auteur ;
    - modules à venir annoncés sans lien ;
  - Équipe : tableau des membres (rôle, statut, date d'arrivée dans le fuseau de l'organisation) ;
  - Journal d'audit : pagination par curseur ; accès refusé proprement aux rôles sans `audit.read` ;
  - Paramètres :
    - formulaire organisation (nom, fuseau IANA, devise) réservé à `owner`/`admin`, affiché en lecture seule pour les autres rôles ;
    - section profil ;
    - la vue est rafraîchie après l'enregistrement ;
  - états de chargement (Suspense), d'erreur (`error.tsx`, API indisponible) et d'absence d'organisation (création guidée) ;
  - composants réutilisables : `PageHeader`, `Card`/`Stat`, `EmptyState`, `Alert`, `Badge`, `Table` (défilement horizontal sur petit écran), `ButtonLink`, `PageFallback`.
- **Défauts trouvés et corrigés pendant la phase** :
  1. `loadWorkspace` lisait l'heure courante pendant le pré-rendu partiel, ce qui faisait échouer les pages : le rendu à la requête est désormais explicite (`connection()`) ;
  2. React ajoute aux formulaires des champs cachés `$ACTION_*`, que les schémas stricts rejetaient, ce qui empêchait d'enregistrer les paramètres : `parseForm` les ignore désormais, avec un test de régression ; les champs inconnus envoyés par l'utilisateur restent refusés.
- **Tests exécutés** :

  | Commande                       | Résultat                                                               |
  | ------------------------------ | ---------------------------------------------------------------------- |
  | `pnpm test`                    | 62 tests OK (shared 8, api 23, web 31)                                 |
  | `pnpm test:integration`        | 29 tests OK                                                            |
  | Playwright                     | 33 tests OK, 1 ignoré volontairement (test du menu mobile, sur bureau) |
  | lint, typecheck, build, format | OK                                                                     |

  Les tests end-to-end de l'espace connecté tournent sur ordinateur et sur mobile, contre un faux Supabase Auth et une fausse API (`apps/web/e2e/support/fake-backend.mjs`) qui émettent de vrais jetons ES256. Le code applicatif ne contient aucun contournement d'authentification. Ils couvrent :

  - la redirection sans session ;
  - les données réelles de la vue d'ensemble ;
  - la navigation complète ;
  - la pagination du journal ;
  - la modification des paramètres par le propriétaire et la validation du formulaire ;
  - le changement d'organisation avec les permissions associées ;
  - le cookie d'organisation forgé ;
  - l'utilisateur sans organisation ;
  - l'erreur d'API affichée ;
  - le menu mobile au clavier ;
  - l'absence de débordement horizontal.

- **Limites** :
  - pas de thème sombre spécifique au-delà des préférences système ;
  - la sélection du fuseau horaire est une liste IANA brute (environ 400 entrées).
- **Suite** : Phase 4 autorisée par le propriétaire le 2026-10-23.

## Phase 4 — Organisations, équipe et permissions

- **Objectif** : inviter des collaborateurs, gérer les rôles et désactiver des membres, avec les mêmes garanties d'isolation et d'audit que la Phase 2.
- **Statut** : **validée** par le propriétaire le 2026-10-23, après test de la prévisualisation. Migration appliquée sur Supabase le 2026-10-23 (version `20261023191420`, avec l'autorisation du propriétaire) ; prévisualisation configurée pour appeler l'API de la même branche. Rien n'est en production.
- **Fonctionnalités terminées** :
  - migration `20261023191420_members_invitations.sql` :
    - table `organization_invitations` (jeton stocké en SHA-256, une seule invitation en attente par adresse) ;
    - seuils configurables en base : `invitation_ttl_hours` (défaut 168 h) et `max_pending_invitations` (défaut 50) ;
    - trigger garantissant au moins un propriétaire actif par organisation ;
  - API :
    - création, liste et annulation d'invitations (`members.invite`) ;
    - aperçu et acceptation par l'invité, liée à son adresse e-mail, à usage unique, avec expiration ;
    - changement de rôle, désactivation et réactivation d'un membre (`members.manage`) ;
    - règles partagées (`memberChangeRefusal`) : personne ne modifie sa propre appartenance, seul un propriétaire modifie un propriétaire ou en nomme un ;
    - chaque action est auditée dans la même transaction (`invitation.created`, `invitation.revoked`, `invitation.accepted`, `member.role_changed`, `member.disabled`, `member.reactivated`) ;
  - web :
    - page Équipe : actions par membre pour les propriétaires et administrateurs, formulaire d'invitation, liste des invitations en attente avec annulation ;
    - lien d'invitation affiché une seule fois, avec un bouton de copie ;
    - page `/invitation` : invité non connecté renvoyé vers la connexion ou l'inscription puis ramené au lien, adresse différente signalée, acceptation puis ouverture de l'organisation ;
    - paramètre « Durée de validité des invitations » ;
    - libellés français des nouvelles actions dans le journal.
- **Décision à valider** : ADR-015. Aucun fournisseur d'e-mail n'est configuré : l'administrateur transmet lui-même le lien, et l'interface l'indique.
- **Défauts trouvés et corrigés pendant la phase** :
  1. Sur mobile, les libellés masqués (`sr-only`) des tableaux étaient positionnés par rapport à la page et l'élargissaient. Le test de débordement ne le voyait pas, car il comparait à `innerWidth`, qui grandit avec le contenu sur mobile. Le tableau est maintenant un conteneur positionné, et les deux tests comparent à `clientWidth`.
  2. Les invitations en attente s'affichent en liste plutôt qu'en tableau à six colonnes, plus lisible sur mobile.
- **Tests exécutés** :

  | Commande                       | Résultat                                                                                                                       |
  | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
  | `pnpm test`                    | 76 tests OK (shared 17, api 25, web 34)                                                                                        |
  | `pnpm test:integration`        | 45 tests OK, dont 16 nouveaux (invitations, membres, isolation, privilèges de toutes les tables `app`)                         |
  | Playwright                     | 49 tests OK, 1 ignoré volontairement (test du menu mobile, sur bureau)                                                         |
  | Tests de mutation              | Filtre d'organisation retiré dans l'annulation d'invitation et dans la modification de membre : les tests d'isolation échouent |
  | lint, typecheck, build, format | OK                                                                                                                             |

- **Limites** :
  - pas d'envoi d'e-mail (ADR-015) ;
  - pas de transfert de propriété en une seule action : un propriétaire en nomme un autre, qui peut ensuite le rétrograder ;
  - toujours pas de limitation de débit côté API.
- **Suite** : fusion dans `main` avec la Phase 5, autorisée le 2026-10-23. ADR-015 (invitations par lien) est conservée telle quelle pour l'instant, sur décision du propriétaire.

## Phase 5 — Agents numériques (retirée)

- **Retrait (ADR-017, décision du propriétaire du 2026-10-23)** : l'application est 100 % manuelle, sans agent. La section Agents (API, interface, règles partagées, tests) a été **supprimée du code**. Les tables `agents` et `agent_versions` restent en base, inutilisées : aucune donnée n'est supprimée et la migration fusionnée n'est pas modifiée. L'historique ci-dessous décrit ce qui avait été livré.

- **Objectif** : créer et administrer des agents dont la configuration est persistée, versionnée, validée et réellement exploitable par le futur moteur (Phase 7).
- **Statut** : **validée** par le propriétaire le 2026-10-23 ; fusion dans `main` avec la Phase 4 autorisée. Migration appliquée sur Supabase le 2026-10-23 (version `20261023193645`, avec l'autorisation du propriétaire). ADR-016 validée.
- **Fonctionnalités terminées** :
  - migration `20261023193645_agents.sql` :
    - `agents` (identité, domaine, statut) et `agent_versions` (configuration immuable, ajout seul) ;
    - clés étrangères composites : une version appartient à un agent de la même organisation, et la version actuelle est une version de l'agent ;
    - plafonds configurables en base sur `organizations` : `max_agents` (10), `agent_max_steps` (20), `agent_max_duration_seconds` (300) ;
  - API : liste, création, lecture, modification de l'identité, nouvelle version de configuration, historique, changement de statut, test contrôlé, plafonds ;
  - règles partagées (`packages/shared/src/agents.ts`) : cycle de vie, vérifications de préparation, consignes assemblées, registre d'outils ;
  - web : page Agents (liste, archivés à la demande, usage du plafond), création, fiche agent (résumé, statut, test contrôlé, configuration, identité, historique des versions dépliable), statistique « Agents actifs » sur la vue d'ensemble, lien « Agents » dans la navigation ;
  - modèle d'IA affiché « non configuré » partout ; `email.send` affiché « bientôt disponible » et refusé par l'API.
- **Décision** : ADR-016, validée par le propriétaire le 2026-10-23.
- **Tests exécutés** :

  | Commande                       | Résultat                                                                                                       |
  | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
  | `pnpm test`                    | 86 tests OK (shared 26, api 25, web 35)                                                                        |
  | `pnpm test:integration`        | 61 tests OK, dont 16 nouveaux sur les agents (cycle de vie, versions, plafonds, isolation inter-organisations) |
  | Playwright                     | 61 tests OK, 1 ignoré volontairement (test du menu mobile, sur bureau)                                         |
  | Test de mutation               | Filtre d'organisation retiré dans la recherche d'agent : le test d'isolation échoue                            |
  | lint, typecheck, build, format | OK                                                                                                             |

- **Limites** :
  - aucun agent n'exécute encore de tâche : le moteur arrive en Phase 7, les outils réels en Phase 9, le modèle d'IA est reporté ;
  - les plafonds ne sont modifiables que par SQL (quotas par offre en Phase 12).
- **Prochaine action recommandée** : Phase 6 (responsabilités), autorisée par le propriétaire le 2026-10-23.

## Phase 6 — Responsabilités

- **Objectif** : définir des délégations durables confiées à un **membre de l'équipe**, identifiables, configurables, activables et historisées.
- **Statut** : **validée** par le propriétaire le 2026-10-23. Migration `20261023210320` appliquée sur Supabase le 2026-10-23 ; migration `20261023211917` appliquée le 2026-10-23 avec l'autorisation du propriétaire.
- **Décisions du propriétaire en cours de phase (ADR-017)** : l'application reste **100 % manuelle**, sans automatisation, sans IA et sans agent. La planification a été retirée, puis les agents : une responsabilité est confiée à une personne et ne se déclenche qu'à la main.
- **Fonctionnalités terminées** :
  - migration `20261023210320_responsibilities.sql` : objectif, périmètre, règles métier, critères de réussite, limite de tâches par jour, personne à prévenir, période facultative, statut ; plafonds configurables en base `max_responsibilities` (50) et `responsibility_max_runs_per_day` (24) ;
  - migration `20261023211917_responsibility_assignee.sql` (non destructive) : colonne `assignee_user_id` avec clé étrangère composite vers les appartenances de la même organisation ; responsabilités existantes confiées à leur auteur ; `agent_id` devient facultatif et obsolète ;
  - API : liste (filtrable par personne responsable), création, lecture, modification, changement de statut, historique (entrées d'audit), plafonds ;
  - création et activation possibles seulement avec un membre actif comme responsable ; activation exigeant aussi un objectif, des critères de réussite, une limite sous le plafond et une période non terminée ; une responsabilité active ne peut pas devenir incomplète ;
  - web : page Responsabilités (liste « Confiée à … », archivées à la demande), création (responsable présélectionnable par `?responsable=`), fiche (résumé, statut, modification, historique lisible), statistique « Responsabilités actives », entrée de navigation ; plus aucune mention d'agent ni d'IA dans l'interface.
- **Défaut trouvé et corrigé pendant la phase** : le formulaire de modification se réinitialisait après l'enregistrement (clé liée à la date de mise à jour), ce qui effaçait le message de confirmation.
- **Tests exécutés** :

  | Commande                       | Résultat                                                                                      |
  | ------------------------------ | --------------------------------------------------------------------------------------------- |
  | `pnpm test`                    | 83 tests OK (shared 23, api 25, web 35)                                                       |
  | `pnpm test:integration`        | 57 tests OK, dont ceux des responsabilités (isolation inter-organisations, clé étrangère SQL) |
  | Playwright                     | 65 tests OK, 1 ignoré volontairement (test du menu mobile, sur bureau)                        |
  | Test de mutation               | Filtre d'organisation retiré dans la lecture des responsabilités : le test d'isolation échoue |
  | lint, typecheck, build, format | OK                                                                                            |

- **Limites** : rien n'est exécuté (ADR-017) ; les plafonds ne sont modifiables que par SQL ; la production affiche encore la section Agents jusqu'à la prochaine fusion dans `main`.
- **Prochaine action recommandée** : fusion dans `main` (sur autorisation explicite), puis plan détaillé de la Phase 7 (**suivi manuel des tâches**) à valider avant de coder.

## Phase 7 — Suivi manuel des tâches

- **Objectif** : suivre le travail concret de l'équipe ; une personne lance chaque tâche, la renseigne et la clôt, sans aucune automatisation (ADR-017).
- **Statut** : **validée** par le propriétaire le 2026-10-23 et fusionnée dans `main` (PR #6). Migration appliquée sur Supabase le 2026-10-23 (version `20261023214116`, avec l'autorisation du propriétaire).
- **Choix appliqués** (recommandations, faute de réponse explicite sur ces deux points) : les tâches ponctuelles, sans responsabilité, sont autorisées ; un membre peut lancer lui-même une tâche pour lui, sur une responsabilité qui lui est confiée. Décision : ADR-018.
- **Fonctionnalités terminées** :
  - migration `20261023214116_tasks.sql` :
    - `tasks` : responsabilité facultative, titre, description, personne en charge, échéance, statut, résultat, compte rendu, motif de blocage, dates de démarrage et de clôture ;
    - clés étrangères composites vers la responsabilité et l'appartenance de la même organisation ; contraintes SQL sur la clôture (résultat et compte rendu) et le blocage (motif) ;
    - `task_notes` : journal de la tâche, en ajout seul (trigger) ;
    - plafond configurable en base `max_open_tasks` (500) ;
  - API : liste filtrable (personne, responsabilité, statut, ouvertes ou clôturées), compteurs, lancement, lecture, modification, changement de statut, notes, historique ;
  - règles : responsabilité active et dans sa période, limite de tâches par jour de la responsabilité (fuseau de l'organisation), droits du membre limités à ses propres tâches, tâche clôturée non modifiable ;
  - web :
    - page **Tâches** (« Mes tâches » / « Toute l'équipe », « À traiter » / « Clôturées », badge « En retard »), entrée de navigation ;
    - page **Lancer une tâche** (responsabilité présélectionnable par `?responsabilite=`) ;
    - fiche tâche : résumé, avancement (Démarrer, Signaler un blocage, Reprendre, Terminer avec résultat et compte rendu, Annuler avec confirmation), notes, modification (propriétaires et administrateurs), historique ;
    - section « Tâches » sur la fiche d'une responsabilité (tâches lancées aujourd'hui / limite, bouton « Lancer une tâche ») ;
    - vue d'ensemble : mes tâches à traiter, en cours, bloquées, en retard ; la carte « Prochainement » est retirée.
- **Tests exécutés** :

  | Commande                       | Résultat                                                                                     |
  | ------------------------------ | -------------------------------------------------------------------------------------------- |
  | `pnpm test`                    | 92 tests OK (shared 32, api 25, web 35)                                                      |
  | `pnpm test:integration`        | 73 tests OK, dont 16 nouveaux sur les tâches (droits, limites, cycle de vie, isolation, SQL) |
  | Playwright                     | 75 tests OK, 1 ignoré volontairement (test du menu mobile, sur bureau)                       |
  | Test de mutation               | Filtre d'organisation retiré dans la lecture des tâches : le test d'isolation échoue         |
  | lint, typecheck, build, format | OK                                                                                           |

- **Limites** :
  - aucune notification : la personne à prévenir est affichée, pas avertie (pas de fournisseur d'e-mail, ADR-015) ;
  - la liste affiche 200 tâches au plus, sans pagination ;
  - les plafonds ne sont modifiables que par SQL.
- **Suite** : module retiré en Phase 8 avec le repositionnement boutique (ADR-019) ; tables conservées, inutilisées.

## Repositionnement en application de gestion de boutique (2026-10-24)

- **Demande du propriétaire** : application SaaS moderne, mobile first, responsive ordinateur, hors ligne, de gestion de boutique (produits et stock, ventes, statistiques et trésorerie, comptabilité, factures et devis), jolie, colorée, accessible et facile pour les personnes peu à l'aise avec le numérique.
- **Statut** : **validé** par le propriétaire le 2026-10-24 (ADR-019 à ADR-022 acceptés). Documentation seulement ; la mise en œuvre commence en Phase 8.
- **Documents mis à jour** : `docs/PRODUCT_SPEC.md` (vision, personas, modules), `docs/DESIGN.md` (nouveau : palette aux contrastes calculés, typographie, accessibilité), `docs/DECISIONS.md` (ADR-019 repositionnement, ADR-020 hors ligne, ADR-021 design, tous proposés), `docs/ROADMAP.md` (phases 8 à 18), `docs/DATA_MODEL.md` (tables boutique proposées), `docs/ARCHITECTURE.md` (PWA, synchronisation, permissions boutique), `docs/SECURITY.md`, `docs/TESTING.md`, `docs/OPERATIONS.md`, `README.md`, `CLAUDE.md`.
- **Décisions du propriétaire (2026-10-24)** : Responsabilités et Tâches retirées (en Phase 8, tables conservées) ; comptabilité au MVP limitée au système minimal de trésorerie ; impression de tickets Bluetooth au MVP (ADR-022, proposé) ; police Nunito.
- **Imprimantes** : compatibilité visée avec les modèles les plus répandus, en priorité les petites imprimantes portables 58 mm (ADR-022).

## Phase 8 — Design system, application installable (PWA), retrait de Responsabilités et Tâches

- **Objectif** : donner à l'application son visage de boutique (coloré, accessible, mobile d'abord), la rendre installable et utilisable sans réseau au niveau de la coquille, et retirer les modules hors périmètre (ADR-019 à ADR-021, validés le 2026-10-24).
- **Statut** : **validée** par le propriétaire le 2026-10-24 (fusionnée sur `main`, PR #7). Aucune migration : les tables `responsibilities`, `tasks` et `task_notes` restent en base, inutilisées, sans suppression de données.
- **Fonctionnalités terminées** :
  - retrait de Responsabilités et Tâches : pages web, endpoints et modules de l'API, contrats et permissions partagés, types Kysely, faux backend et tests correspondants. Les libellés des anciennes entrées du journal restent lisibles ;
  - jetons de design (`apps/web/src/app/globals.css`) : palette de `DESIGN.md` (vive, foncée, claire, encre par module), mode sombre aux contrastes vérifiés, focus visible de 3 px, mouvements réduits respectés ; aucune couleur en dur dans les composants ;
  - police **Nunito** (`next/font`), texte de 16 px minimum (18 px sur mobile), chiffres tabulaires ;
  - composants repris : boutons et champs de 48 px, alertes avec icône, badges, cartes avec pictogramme, états vides, tableaux défilables au clavier ; icônes Lucide (`lucide-react`) toujours accompagnées d'un libellé ;
  - navigation : barre latérale violette sur tablette et ordinateur ; sur téléphone, barre en bas (Accueil, Équipe, Historique) et panneau « Plus » (Paramètres, choix de la boutique, création d'une boutique, compte, déconnexion), fermable au clavier ;
  - vocabulaire boutique : « boutique » au lieu d'« organisation », rôles affichés Propriétaire, Gérant, Vendeur, Lecteur, « Historique » pour le journal d'audit ; route `/espace/nouvelle-boutique` ;
  - page d'accueil publique : présente le produit et annonce honnêtement les modules à venir comme « Bientôt disponible » ;
  - PWA : manifeste (`/manifest.webmanifest`), icônes 192, 512 (dont masquable), Apple et SVG générées par `apps/web/scripts/generate-icons.mjs`, service worker `/sw.js` (ADR-020, mise en œuvre), page `/hors-ligne`, bandeau « Pas de connexion internet », `experimental.useOffline`.
- **Tests exécutés** :

  | Commande                       | Résultat                                                                                                                                                                                               |
  | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `pnpm test`                    | 84 tests OK (shared 17, api 25, web 42, dont 6 nouveaux sur le service worker exécuté dans un bac à sable)                                                                                             |
  | `pnpm test:integration`        | 45 tests OK (les 28 tests de Responsabilités et Tâches sont retirés avec ces modules)                                                                                                                  |
  | Playwright                     | 65 tests OK, 1 ignoré volontairement (test réservé au mobile, sur ordinateur) : navigation mobile et ordinateur, hors ligne, manifeste, accessibilité axe-core, cibles de 48 px, pages retirées en 404 |
  | lint, typecheck, build, format | OK                                                                                                                                                                                                     |

- **Limites** :
  - hors ligne, seules les pages déjà affichées restent visibles ; une page non chargée affiche « Pas de connexion ». Les données hors ligne (catalogue, ventes) arrivent en Phase 11 ;
  - la page hors ligne est mise en cache à l'installation du service worker, donc après une première visite en ligne ;
  - l'installation sur iPhone passe par « Partager → Sur l'écran d'accueil » : aucune invite d'installation n'est encore affichée dans l'application ;
  - le mode sombre suit le réglage du téléphone ; il n'est pas réglable dans l'application.
- **Point d'attention (environnement local)** : un fichier `apps/web/.env.local` pointant vers un vrai projet Supabase est apparu pendant la phase. `next build` fige les variables `NEXT_PUBLIC_*` : un build fait avec ce fichier ne convient pas aux tests end-to-end, qui supposent un build sans configuration (comme en CI). Lors d'un premier lancement, des inscriptions de test (`awa@example.sn`) ont ainsi été envoyées à ce projet, jusqu'à sa limite d'envoi d'e-mails. Les tests ont ensuite été lancés sur un build fait sans ce fichier, mis de côté puis restauré à l'identique.
- **Prochaine action recommandée** : tester la prévisualisation sur un téléphone (installation, mode avion), valider la Phase 8, puis lancer la Phase 9 (produits et stock).

## Phase 9 — Produits et stock

- **Objectif** : tenir le catalogue de la boutique et savoir à tout moment ce qui reste, sans jamais écraser le stock (ADR-023).
- **Statut** : **validée** par le propriétaire le 2026-10-24 (ADR-023 acceptée), fusionnée sur `main` (PR #8). Migration `20261024150000_catalog_stock.sql` appliquée sur Supabase par le propriétaire le 2026-10-24.
- **Fonctionnalités terminées** :
  - migration : taxes, catégories, fournisseurs, produits, photos, journal des mouvements en ajout seul ; clés étrangères composites (même boutique) ; noms et codes-barres uniques parmi les actifs ; plafonds configurables en base ; RLS et droits minimaux de `nagaw_api` ;
  - contrats partagés : montants en unités mineures (`money.ts` : lecture de « 12 500 », affichage `12 500 F CFA`), quantités à 3 décimales, unités, niveaux de stock, schémas de validation ; permissions `catalog.read`, `catalog.manage`, `stock.move` ;
  - API : 19 endpoints (taxes, catégories, fournisseurs, produits, photo, mouvements, résumé du stock) ; créations et mouvements idempotents (`clientOperationId`), verrou de version sur les produits, perte supérieure au stock refusée, inventaire avec écart, photo vérifiée par signature ;
  - web :
    - **Produits** dans la barre du bas (Historique passe dans « Plus ») : recherche par nom ou code-barres, filtres par stock et par catégorie, cartes avec photo ou initiale colorée, prix en grand ;
    - **Ajouter / modifier un produit** : nom, prix, unité, catégorie, photo prise ou choisie (réduite sur le téléphone), stock de départ, seuil d'alerte ; prix d'achat, taxe et code-barres repliés dans « Plus de détails » ;
    - **fiche produit** : ce qui reste en grand, « J'ai reçu de la marchandise », « Perte, casse ou produit abîmé », « J'ai compté ce qui reste (inventaire) », mouvements, gain par unité, archivage et remise en vente ;
    - catégories, fournisseurs (appel en un geste), produits archivés ; taxes dans Paramètres ;
    - accueil : carte **Stock** (épuisés, bientôt épuisés, valeur du stock, produits à racheter) ;
    - pages « Introuvable » en français ;
  - correction transversale : un formulaire **ne s'efface plus** quand le serveur signale une erreur (`ActionForm`), y compris connexion, inscription, invitation et paramètres ; les champs répétés sur une page ont des identifiants uniques.
- **Tests exécutés** :

  | Commande                       | Résultat                                                                                                                   |
  | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
  | `pnpm test`                    | 103 tests OK (shared 32, api 25, web 46)                                                                                   |
  | `pnpm test:integration`        | 71 tests OK, dont 26 nouveaux sur le catalogue et le stock (droits, plafonds, idempotence, version, photo, isolation, SQL) |
  | Playwright                     | 81 tests OK, 1 ignoré volontairement (test réservé au mobile, sur ordinateur)                                              |
  | Test de mutation               | Filtre de boutique retiré dans la lecture des produits : 2 tests d'isolation échouent                                      |
  | lint, typecheck, build, format | OK                                                                                                                         |

- **Limites** :
  - pas encore de lecture du code-barres par la caméra : il se tape ou se recherche ;
  - la fiche affiche les 100 derniers mouvements, la liste 500 produits au plus, sans pagination ;
  - une photo retirée reste stockée (masquée) jusqu'à la photo suivante (ADR-023) ;
  - un produit dont la page est introuvable s'affiche en « Introuvable » avec un code HTTP 200 (rendu en streaming) ;
  - catalogue et stock nécessitent encore le réseau : le hors ligne arrive en Phase 11.
- **Prochaine action recommandée** : Phase 10 (ventes).

## Phase 10 — Ventes

- **Objectif** : encaisser vite et sans erreur au comptoir, suivre les ventes du jour et ce que doivent les clients (ADR-024).
- **Statut** : **validée** par le propriétaire le 2026-10-24 (ADR-024 acceptée). Migration `20261024190000_sales.sql` appliquée sur Supabase par le propriétaire le 2026-10-24. Impression Bluetooth reportée à la mise à disposition d'une imprimante réelle (décision du propriétaire).
- **Fonctionnalités terminées** :
  - migration : clients, ventes, lignes, paiements, remboursements, lien entre mouvement de stock et vente ; une vente ne peut qu'être annulée (trigger) ; remise maximale des vendeurs, plafond de clients et numéro de ticket en base ;
  - contrats partagés : calcul des totaux (taxes incluses, remise répartie) et règles de paiement utilisés à l'identique par l'appareil et le serveur ; permissions `sales.*` et `customers.*` ;
  - API : 10 endpoints (ventes, résumé du jour, annulation, clients, remboursements) ; prix relus dans le catalogue, totaux recalculés, remise plafonnée, crédit dans le plafond du client, ventes et remboursements idempotents ;
  - web :
    - **Vendre** dans la barre du bas : grandes tuiles produits, panier (− / + / quantité), remise, total en grand ; paiement en espèces avec « À rendre », Mobile Money (opérateur, n° de transaction), carte, crédit, ou plusieurs moyens ; client choisi ou créé sur place ;
    - **ticket** : affichage, impression au format 58 mm par l'imprimante du système, envoi sur WhatsApp (au numéro du client s'il est connu), annulation par un gérant avec motif ;
    - **Ventes** : jour choisi (aujourd'hui, hier, une date), total par moyen de paiement, liste des tickets ; un vendeur ne voit que les siennes ;
    - **Clients** : recherche, « Ils me doivent » avec le total à récupérer, fiche avec solde, remboursement, historique, modification ;
    - accueil : carte **Aujourd'hui** (ventes, montant, bouton Vendre) ;
    - nouvelle variante de bouton « vente » (vert) aux contrastes conformes.
- **Tests exécutés** :

  | Commande                       | Résultat                                                                                                                                               |
  | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `pnpm test`                    | 118 tests OK (shared 42, api 28, web 48)                                                                                                               |
  | `pnpm test:integration`        | 84 tests OK, dont 13 nouveaux (prix serveur, remise, paiements, crédit, annulation, visibilité, isolation, garanties SQL)                              |
  | Playwright                     | 143 tests OK, 5 ignorés volontairement (scénarios couverts une seule fois, tests réservés au mobile) ; accessibilité et débordement : un test par page |
  | Test de mutation               | Filtre de boutique retiré dans la lecture d'une vente : le test d'isolation échoue                                                                     |
  | lint, typecheck, build, format | OK                                                                                                                                                     |

- **Limites** :
  - **impression Bluetooth directe non livrée** (ADR-022) : il faut au moins une imprimante réelle pour la développer et la vérifier ; en attendant, impression système et partage WhatsApp ;
  - pas de retour partiel : une vente s'annule en entier ;
  - pas encore de caisses ni de clôture de caisse (Phase 13) ;
  - la caisse a besoin du réseau : le hors ligne arrive en Phase 11 ;
  - sur un poste chargé, les tests end-to-end parcourant plusieurs pages dépassaient 30 s : ils sont découpés par page ou ont un délai explicite.
- **Prochaine action recommandée** : Phase 11 (hors ligne et synchronisation).

## Phase 11 — Vendre sans connexion

- **Objectif** : qu'un vendeur ne soit jamais bloqué par le réseau (ADR-020, ADR-025).
- **Statut** : **validée** par le propriétaire le 2026-10-24 (ADR-025 acceptée). Migration `20261024210000_offline_devices.sql` appliquée sur Supabase par le propriétaire le 2026-10-24.
- **Fonctionnalités terminées** :
  - migration : appareils de vente (préfixe de ticket, retrait), colonnes d'appareil des ventes (`device_ticket`, `price_review`, `synced_at`), ancienneté maximale et plafond d'appareils en base ;
  - API : appareils (enregistrement, liste, retrait) et `POST /sync` (lots ordonnés, idempotents, refus motivés, vente au prix payé marquée « Prix à vérifier » si le catalogue diffère) ; le cœur d'enregistrement d'une vente est commun aux ventes en ligne et aux ventes d'appareil ;
  - web :
    - **caisse `/caisse`** : page statique gardée par le service worker, qui s'ouvre sans réseau ; catalogue, clients et appareil dans IndexedDB ; chaque vente est enregistrée sur le téléphone avec un ticket `B-000012`, puis envoyée aussitôt si possible ;
    - ticket du téléphone imprimable et partageable sur WhatsApp, même hors ligne ; client créé hors ligne, envoyé avant sa vente ;
    - **bandeau** : « 2 ventes gardées sur ce téléphone », « 1 vente en attente d'envoi… », « Une opération refusée — Voir pourquoi » ; envoi automatique à l'ouverture, au retour du réseau et toutes les 30 s ;
    - opérations refusées listées dans la caisse avec leur motif ;
    - **déconnexion** : efface les données du téléphone, avec un avertissement s'il reste des ventes non envoyées ;
    - **Paramètres** : appareils de vente, dernier envoi, retrait d'un appareil perdu ;
    - ventes : numéro d'appareil sur les tickets, badge « Prix à vérifier » ; page « Pas de connexion » avec « Ouvrir la caisse ».
- **Tests exécutés** :

  | Commande                       | Résultat                                                                                                                                                                               |
  | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `pnpm test`                    | 123 tests OK (shared 46, api 28, web 49)                                                                                                                                               |
  | `pnpm test:integration`        | 92 tests OK, dont 8 nouveaux sur la synchronisation (doublons, refus motivés, prix, ancienneté, appareils, client créé hors ligne, règles des vendeurs)                                |
  | Playwright                     | 150 tests OK, 6 ignorés volontairement ; vente hors ligne de bout en bout sur ordinateur et mobile (coupure, rechargement sans réseau, envoi automatique, effacement à la déconnexion) |
  | lint, typecheck, build, format | OK                                                                                                                                                                                     |

- **Limites** :
  - seule la caisse fonctionne hors ligne : entrées et pertes de stock, fiches et listes demandent le réseau ;
  - une session expirée doit être renouvelée pour envoyer (les ventes attendent sans risque sur le téléphone) ;
  - le stock affiché par la caisse hors ligne est celui du dernier rafraîchissement.
- **Prochaine action recommandée** : Phase 12 (factures et devis).

## Phase 12 — Factures et devis

- **Objectif** : remettre aux clients des devis et des factures propres, numérotés sans trou, impossibles à réécrire une fois émis (ADR-026).
- **Statut** : **validée** par le propriétaire le 2026-10-25 (ADR-026 acceptée). Migration `20261025090000_invoices_quotes.sql` appliquée sur Supabase par le propriétaire le 2026-10-25.
- **Fonctionnalités terminées** :
  - migration : identité légale de la boutique (raison sociale, adresse, téléphone, e-mail, NINEA, RCCM, mention de bas de page), délai de paiement et validité des devis en base ; e-mail, adresse et NINEA des clients ; compteurs de numérotation ; devis ; factures et avoirs (trigger : une facture émise ne change plus, sauf son annulation) ; paiements de factures en ajout seul ; RLS et droits minimaux de `nagaw_api` ;
  - contrats partagés : lignes de document, `computeDocumentTotals` (HT, TVA par taux, TTC, sur le calcul de la caisse), schémas de devis, factures, paiements et annulation, `formatDocumentNumber` ; permissions `documents.read` et `documents.manage` ;
  - API : 17 endpoints (devis, factures, facture d'un devis ou d'une vente, émission, paiements, avoir, PDF, identité de la boutique) ; numéros `D-`, `F-`, `A-AAAA-NNNN` attribués sous verrou ; créations et paiements idempotents ; **PDF A4** généré par l'API (`pdf-lib`) avec identité de la boutique, client, HT / TVA / TTC, paiements et reste à payer ;
  - web :
    - **Factures** dans le menu (masqué pour les vendeurs) : onglets Factures / Devis, badges « À payer », « Payée en partie », « Payée », « En retard », « Annulée », « Expiré », reste à encaisser ;
    - **éditeur** de facture ou de devis : client, lignes du catalogue (prix et TVA repris) ou libres (services), quantité, unité, prix TTC, TVA, remise, date, remarque, totaux en direct ; les saisies restent en cas d'erreur ;
    - **fiche facture** : brouillon modifiable puis « Émettre la facture », paiements (espèces, Mobile Money, carte, virement, chèque), annulation par un avoir, « Ouvrir le PDF », « Envoyer le PDF » (feuille de partage du téléphone : WhatsApp, e-mail) ;
    - **fiche devis** : envoyé, accepté, refusé, « Faire la facture de ce devis » ;
    - **vente** : « Faire une facture » pour une vente payée en caisse (client choisi si la vente n'en a pas), marquée payée à l'émission ;
    - **client** : e-mail, adresse et NINEA ; « Faire une facture » et « Faire un devis » depuis sa fiche ;
    - **Paramètres** : carte « Factures et devis » (identité légale, délai de paiement, validité des devis, mention de bas de page).
- **Tests exécutés** :

  | Commande                       | Résultat                                                                             |
  | ------------------------------ | ------------------------------------------------------------------------------------ |
  | `pnpm test`                    | **UNIT**                                                                             |
  | `pnpm test:integration`        | **INTEGRATION**                                                                      |
  | Playwright                     | **E2E**                                                                              |
  | Test de mutation               | Filtre de boutique retiré dans la lecture d'une facture : le test d'isolation échoue |
  | lint, typecheck, build, format | OK                                                                                   |

- **Limites** :
  - pas de logo sur le PDF ; police standard (les caractères hors alphabet latin s'impriment « ? ») ;
  - pas d'envoi d'e-mail par le serveur : le PDF se partage depuis le téléphone ; sur un ordinateur sans partage de fichiers, le PDF s'ouvre pour être enregistré ;
  - avoir uniquement total, pas d'avoir partiel ni de facture d'acompte ; une facture payée doit être remboursée hors application avant d'être annulée ;
  - factures et devis demandent le réseau (pas de création hors ligne) ;
  - les paiements de factures n'alimentent pas encore la trésorerie (Phase 13) ; ceux recopiés d'une vente sont marqués pour ne pas être comptés deux fois.
- **Prochaine action recommandée** : Phase 13 (statistiques et trésorerie).

## Phase 13 — Statistiques et trésorerie

- **Objectif** : savoir combien la boutique gagne et où est son argent, sans double saisie (ADR-027).
- **Statut** : livrée sur la branche `claude/phase-13-tresorerie`, **en attente de validation** du propriétaire. La migration `20261025130000_treasury.sql` doit être appliquée sur Supabase avant la fusion.
- **Fonctionnalités terminées** :
  - migration : caisses (Caisse, Wave, Orange Money, Free Money, autre Mobile Money, Banque) créées pour chaque boutique, catégories de dépenses avec leur compte SYSCOHADA, dépenses (annulation seulement, par trigger), transferts et clôtures en ajout seul, prix d'achat figé sur chaque ligne de vente, plafond de catégories en base ; RLS et droits minimaux de `nagaw_api` ;
  - contrats partagés : caisse d'un paiement (`accountOfPayment`), périodes (un an au plus), dépenses, transferts, clôtures, statistiques ; permissions `stats.read`, `treasury.read`, `treasury.manage` ;
  - API : 15 endpoints ; soldes **calculés** à partir des paiements des ventes, des remboursements, des paiements de factures, des dépenses, des transferts et des écarts de clôture ; montant attendu d'une clôture calculé par le serveur ; journée clôturée figée ; statistiques par période avec marge sur les lignes dont le coût est connu ; comparaison entre boutiques ;
  - web :
    - **Statistiques** (menu, masqué pour les vendeurs) : période (aujourd'hui, hier, 7 jours, ce mois, mois dernier, dates au choix), chiffre d'affaires, ventes, panier moyen, marge brute (et la part qu'elle couvre), dépenses, taxes ; graphique des ventes par jour (par mois au-delà de deux mois) avec ses chiffres en tableau ; moyens de paiement ; produits les plus vendus et ceux qui ne se vendent pas ; « Vos boutiques » pour qui en a plusieurs ;
    - **Trésorerie** : total, entrées et sorties du jour, caisses et leur solde (les caisses vides sont repliées), créances (crédit des clients, factures à encaisser), « Déplacer de l'argent » ;
    - **fiche d'une caisse** : relevé de la période (solde au début et à la fin, entrées et sorties), clôtures, nom et argent de départ ;
    - **Clôturer la caisse** : entré, sorti, ce qui devrait y avoir ; la personne saisit ce qu'elle a compté et voit tout de suite « Il manque… » ou « Le compte est juste » ;
    - **Dépenses** : saisie (quoi, montant, catégorie, caisse, date), liste de la période avec total, annulation avec motif, catégories (ajout, rangement) ;
    - accueil : carte **Trésorerie** (total des caisses, ce qu'on vous doit).
- **Tests exécutés** :

  | Commande                       | Résultat                                                                            |
  | ------------------------------ | ----------------------------------------------------------------------------------- |
  | `pnpm test`                    | **UNIT**                                                                            |
  | `pnpm test:integration`        | **INTEGRATION**                                                                     |
  | Playwright                     | **E2E**                                                                             |
  | Test de mutation               | Filtre de boutique retiré dans la lecture d'une caisse : le test d'isolation échoue |
  | lint, typecheck, build, format | OK                                                                                  |

- **Limites** :
  - une vente faite hors ligne et envoyée après la clôture de son jour ressort en écart à la clôture suivante : la page conseille d'envoyer les ventes avant de clôturer ;
  - une seule caisse espèces par boutique ; achats de marchandises (entrées de stock) non reliés à la trésorerie : les saisir en dépense « Achat de marchandises » ;
  - les ventes d'avant cette phase n'ont pas de prix d'achat figé : elles sont hors marge ;
  - pas de justificatif photo des dépenses (Phase 14) ; dépenses et clôtures en ligne uniquement ;
  - soldes et statistiques calculés à chaque lecture : à remplacer par des agrégats si une boutique accumule un très grand nombre d'opérations.
- **Prochaine action recommandée** : appliquer la migration sur Supabase, essayer une clôture de caisse et une dépense, valider la Phase 13 et l'ADR-027, puis Phase 14 (comptabilité).

## Phases 14 à 18

Non commencées. Les anciennes phases 8 (approbations), 9 (outils), 10 (documents) et 11 (notifications, planification) sont remplacées par les phases boutique de `docs/ROADMAP.md`.
