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
- **Statut** : **validée** par le propriétaire le 2026-10-25 (ADR-027 acceptée). Migration `20261025130000_treasury.sql` appliquée sur Supabase par le propriétaire le 2026-10-25.
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
- **Prochaine action recommandée** : Phase 14 (comptabilité).

## Phase 14 — Comptabilité (système minimal de trésorerie SYSCOHADA)

- **Objectif** : que le comptable retrouve un journal des recettes et dépenses et un état de fin d'exercice conformes au SYSCOHADA révisé, sans aucune saisie de plus pour le commerçant (ADR-028).
- **Statut** : **validée** par le propriétaire le 2026-10-25 (ADR-028 acceptée). Migration `20261025150000_accounting.sql` appliquée sur Supabase par le propriétaire le 2026-10-25.
- **Fonctionnalités terminées** :
  - migration : numéro de pièce des dépenses (`DEP-AAAA-NNNN`, rattrapage des dépenses existantes), justificatifs photo (une par dépense, jamais supprimée) ;
  - contrats partagés : comptes SYSCOHADA du système minimal (70, 585, 658, 758 ; 571, 55, 521), classement d'un mouvement (`accountOfMovement`), journal, état de fin d'exercice ; permission `accounting.read` ;
  - API : 6 endpoints (journal, état, exports CSV, envoi et lecture du justificatif) ; journal **calculé** à partir des mouvements de trésorerie, état cohérent par construction (variation de la trésorerie = résultat) ; numérotation des pièces partagée avec les factures ;
  - web :
    - **Comptabilité** (menu, masqué pour les vendeurs) : **Journal** de la période (date, pièce, libellé, compte, caisse, recette ou dépense, totaux) et **État de fin d'exercice** (année en cours provisoire, deux années précédentes) : recettes et dépenses par compte, résultat, trésorerie au début et à la fin, créances, stock au prix d'achat ;
    - **exports CSV** du journal et de l'état, prêts pour un tableur en français ;
    - **Dépenses** : numéro de pièce affiché, photo du justificatif (prise ou choisie, réduite sur le téléphone), « Voir le justificatif ».
- **Tests exécutés** :

  | Commande                       | Résultat                                                                                 |
  | ------------------------------ | ---------------------------------------------------------------------------------------- |
  | `pnpm test`                    | **UNIT**                                                                                 |
  | `pnpm test:integration`        | **INTEGRATION**                                                                          |
  | Playwright                     | **E2E**                                                                                  |
  | Test de mutation               | Filtre de boutique retiré dans la lecture d'un justificatif : le test d'isolation échoue |
  | Migration                      | Rattrapage des numéros vérifié sur une base jetable (dépenses sur deux années)           |
  | lint, typecheck, build, format | OK                                                                                       |

- **Limites** :
  - comptabilité de trésorerie uniquement : pas de partie double, de dettes fournisseurs, d'achats à crédit ni d'immobilisations ;
  - l'exercice ne se clôture pas encore définitivement : une dépense peut être saisie sur l'année précédente tant que ses caisses ne sont pas clôturées à cette date ;
  - stock de fin d'exercice estimé au prix d'achat **actuel** des produits ;
  - export PDF non livré (CSV seulement).
- **Prochaine action recommandée** : faire relire un export par le comptable ; Phase 15 (abonnements et quotas, sans prestataire de paiement tant que le propriétaire ne l’a pas choisi).

## Phase 15 — Offres et quotas (sans paiement en ligne)

- **Objectif** : donner à chaque boutique une offre et appliquer ses limites, sans prestataire de paiement tant que le propriétaire ne l'a pas choisi (ADR-029).
- **Statut** : **validée** par le propriétaire le 2026-10-25 (ADR-029 acceptée). Migration `20261025170000_plans.sql` appliquée sur Supabase par le propriétaire le 2026-10-25. Pas de prestataire de paiement pour l’instant (décision du propriétaire).
- **Fonctionnalités terminées** :
  - migration : offres (Gratuit, Essentiel 5 000 F, Pro 15 000 F, grille choisie par le propriétaire), abonnement par boutique (Gratuit à la création, Pro pour les boutiques existantes), limites de l'offre recopiées dans les plafonds de la boutique par trigger, nouveau plafond de personnes, demandes de changement d'offre jamais supprimées ;
  - contrats partagés : offres, abonnement, demande ; permissions `subscription.read` et `subscription.manage` ;
  - API : 4 endpoints (offres, abonnement, demande, annulation) ; plafond de personnes vérifié à l'invitation, à l'acceptation et à la réactivation ; messages de limite qui renvoient vers « Abonnement » ;
  - web : page **Abonnement** (menu, propriétaire et gérants) : offre actuelle, jauges d'utilisation (produits, personnes, téléphones), comparaison des offres, « Demander cette offre » pour le propriétaire, demande en cours et annulation.
- **Tests exécutés** :

  | Commande                       | Résultat                                                                                                       |
  | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
  | `pnpm test`                    | **UNIT**                                                                                                       |
  | `pnpm test:integration`        | **INTEGRATION**                                                                                                |
  | Playwright                     | **E2E**                                                                                                        |
  | Migration                      | Boutique existante passée en Pro avec ses limites, nouvelle boutique en Gratuit : vérifié sur une base jetable |
  | lint, typecheck, build, format | OK                                                                                                             |

- **Limites** :
  - **pas de paiement en ligne** : une demande de changement d'offre est traitée à la main par la plateforme (mise à jour de `subscriptions`) jusqu'au choix du prestataire et à l'administration de la plateforme (Phase 16) ;
  - pas de facturation de l'abonnement, d'essai gratuit ni d'offre annuelle ;
  - une boutique existante qui avait plus de 10 téléphones de caisse les garde mais ne peut plus en ajouter.
- **Prochaine action recommandée** : Phase 16 (administration de la plateforme, dont le traitement des demandes de changement d’offre).

## Phase 16 — Administration de la plateforme et observabilité

- **Objectif** : traiter les demandes d'offre, voir la santé de la plateforme et agir sur une boutique, sans jamais lire son contenu (ADR-030).
- **Statut** : **validée** par le propriétaire le 2026-10-25 (ADR-030 acceptée). Migration `20261025190000_platform_admin.sql` appliquée sur Supabase par le propriétaire le 2026-10-25 ; le premier administrateur s’ajoute en SQL (`insert into app.platform_admins …`).
- **Fonctionnalités terminées** :
  - migration : administrateurs de la plateforme et seuils des alertes en base, suspension datée et motivée d'une boutique, demandes d'offre refusables, lots et refus de synchronisation enregistrés (ajout seul) ;
  - API : 10 endpoints `/admin/*` derrière une garde relue en base ; tableau de bord, boutiques, fiche, changement d'offre, suspension et réactivation, demandes (acceptation, refus), synchronisation ; `/me` indique si la personne administre la plateforme ; la synchronisation enregistre chaque lot et chaque refus ;
  - web : espace **Administration** (`/admin`, lien réservé aux administrateurs) : tableau de bord avec alertes, boutiques (recherche, fiche, offre, suspension), demandes d'offre (accepter, refuser), synchronisation (envois par jour, motifs de refus, téléphones silencieux) ;
  - historique des boutiques : actions de la plateforme affichées « Nagaw (plateforme) » ; **toutes les actions** des phases 9 à 16 ont maintenant un libellé en français (elles s'affichaient avec leur clé technique), vérifié par un test.
- **Tests exécutés** :

  | Commande                       | Résultat                                                    |
  | ------------------------------ | ----------------------------------------------------------- |
  | `pnpm test`                    | **UNIT**                                                    |
  | `pnpm test:integration`        | **INTEGRATION**                                             |
  | Playwright                     | **E2E**                                                     |
  | Test de mutation               | Garde d'administration neutralisée : le test d'accès échoue |
  | lint, typecheck, build, format | OK                                                          |

- **Limites** :
  - les alertes s'affichent dans le tableau de bord ; aucun envoi (e-mail, SMS, WhatsApp) tant qu'un prestataire n'est pas choisi ;
  - les administrateurs s'ajoutent et se retirent en SQL ;
  - une boutique suspendue disparaît de la liste de ses membres, sans message qui l'explique dans leur espace ;
  - métriques HTTP (erreurs, latence par route) : celles de Vercel, pas dans l'application.
- **Prochaine action recommandée** : Phase 17 (sécurité, tests, stabilisation).

## Phase 17 — Sécurité, tests, stabilisation

- **Objectif** : vérifier automatiquement chaque règle de sécurité avant le pilote, pour qu'aucune phase future ne puisse la casser sans que la CI le voie (ADR-031).
- **Statut** : **validée** par le propriétaire le 2026-10-25 (ADR-031 acceptée). Aucune migration.
- **Fonctionnalités terminées** :
  - **inventaire des routes de l'API** : un test énumère les **ROUTES** routes et vérifie 401 sans session, 404 pour un non-membre sur toute route de boutique, 403 pour l'administration ; exceptions listées une à une ;
  - **aucun secret dans le navigateur** : build CI avec des valeurs leurres, puis recherche des leurres et des formes de clés privilégiées (`service_role`, clé secrète Supabase, URL Postgres) dans le JavaScript client et les pages pré-rendues ; exception gitleaks limitée aux leurres ;
  - **dépendances** : 2 vulnérabilités « high » corrigées (`body-parser`, `multer`, dépendances de NestJS) ; audit en CI ;
  - **en-têtes de sécurité** sur toutes les pages du site (cadre interdit, `nosniff`, HSTS, référent, caméra seule autorisée, `base-uri`, `form-action`, `object-src`) ;
  - **performance** : budget de poids des pages clés vérifié en end-to-end ; mesure sur téléphone simulé lent (processeur ÷ 4, « Fast 3G ») : caisse utilisable en 4,2 s au premier chargement, 1,1 s ensuite ;
  - **robustesse** : sous forte charge, des connexions à la base dépassaient leur délai et répondaient 500 (découvert par des tests d'intégration instables) ; une base injoignable répond désormais **503 « réessayez »** (`DATABASE_UNAVAILABLE`), que la caisse hors ligne reporte ; délai de connexion réglable (`DATABASE_CONNECT_TIMEOUT_MS`, 5 s par défaut) ;
  - **exploitation** : `docs/OPERATIONS.md` réécrit (ce qui est en place, procédures : administrateurs, téléphone perdu ou volé, suspension, changement d'offre, rotation d'un secret, dépendance vulnérable).
- **Tests exécutés** :

  | Commande                       | Résultat                                                                                                                |
  | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
  | `pnpm test`                    | **UNIT**                                                                                                                |
  | `pnpm test:integration`        | **INTEGRATION**                                                                                                         |
  | Playwright                     | **E2E**                                                                                                                 |
  | `pnpm check:bundle`            | Aucun secret dans 625 fichiers servis (build avec leurres) ; contrôle négatif : leurre et jeton `service_role` détectés |
  | `pnpm audit`                   | Aucune vulnérabilité connue                                                                                             |
  | Tests de mutation              | Permission retirée d'une route : l'inventaire échoue                                                                    |
  | lint, typecheck, build, format | OK                                                                                                                      |

- **Limites** :
  - pas encore de CSP sur les scripts (Next.js demanderait des nonces) ;
  - pas de limitation de débit dans l'application (API sans état sur Vercel) ;
  - performance mesurée sur téléphone simulé, pas encore sur un appareil réel d'entrée de gamme (à faire pendant le pilote).
- **Prochaine action recommandée** : Phase 18 (déploiement et pilote).

## Phase 18 — Déploiement et pilote

- **Objectif** : préparer le pilote avec des boutiques réelles : faire remonter chaque difficulté, vérifier chaque déploiement, donner un plan et un protocole de test (ADR-032).
- **Statut** : outillage **validé** par le propriétaire le 2026-10-25 (ADR-032 acceptée) ; migration `20261025210000_feedback.sql` appliquée sur Supabase, fusion dans `main` (PR #17). **Le pilote lui-même reste à mener** (boutiques, sauvegardes, séances avec des commerçants : voir `docs/PILOT.md`).
- **Fonctionnalités terminées** :
  - **« Donner mon avis »** dans le menu de toute personne d'une boutique : problème, idée ou question, avec la page d'où elle écrit ; ses messages et les réponses de l'équipe ; **Administration → Avis** pour lire, répondre et clore ; messages jamais modifiés ni supprimés ;
  - **test de fumée de la production** (`pnpm smoke`), en lecture seule : 10 vérifications, toutes réussies sur la production le 2026-10-25 ; workflow GitHub `smoke.yml` déclenché par le statut « Vercel – nagaw-web » réussi sur `main` (vérifié le 2026-10-25 : lancé seul au premier déploiement de production après la fusion, 10 vérifications réussies) ;
  - **`docs/PILOT.md`** : organisation proposée, préparatifs du propriétaire (sauvegardes, restauration testée, parcours complet sur vrais téléphones), accueil d'une boutique, suivi quotidien, protocole de test utilisateur avec grille d'observation, critères de réussite, état de chaque critère d'acceptation du MVP.
  - **tableau de bord** (`/espace`, demande du propriétaire du 2026-10-25) : les six chiffres clés en premier (chiffre d'affaires, nombre de ventes, panier moyen, marge brute, dépenses, bénéfice estimé), chacun dans une couleur foncée de module et comparé à la période d'avant ; période au choix (ce mois par défaut) ; ventes du jour, chiffre d'affaires par jour, produits qui rapportent le plus et qui ne se vendent pas, moyens de paiement, trésorerie, état du stock ; bouton flottant « Vendre » ; un vendeur ne voit ni l'argent ni les statistiques. Aucun nouvel endpoint : `/stats/summary`, `/stock/summary`, `/treasury` ;
- **Tests exécutés** :

  | Commande                       | Résultat                  |
  | ------------------------------ | ------------------------- |
  | `pnpm test`                    | **UNIT**                  |
  | `pnpm test:integration`        | **INTEGRATION**           |
  | Playwright                     | **E2E**                   |
  | `pnpm smoke` (production)      | 10 vérifications réussies |
  | lint, typecheck, build, format | OK                        |

- **Limites** :
  - l'équipe n'est pas prévenue d'un nouvel avis (aucun prestataire d'envoi) : consulter **Administration → Avis** chaque jour ;
  - le parcours complet du MVP sur le **backend réel** se fait à la main (étape 5 des préparatifs), les tests de bout en bout automatisés tournant contre un faux backend ;
  - sauvegardes et restauration dépendent du plan Supabase (à activer par le propriétaire).
- **Prochaine action recommandée** : suivre les préparatifs de `docs/PILOT.md` (sauvegardes, restauration testée, parcours complet sur vrais téléphones) avant d'accueillir la première boutique. Les anciennes phases 8 (approbations), 9 (outils), 10 (documents) et 11 (notifications, planification) sont remplacées par les phases boutique de `docs/ROADMAP.md`.

## Après la Phase 18 — Limites de produits des offres

- **Objectif** : appliquer la nouvelle grille du propriétaire (2026-10-26, ADR-033) : Gratuit 3 produits, Essentiel 10, Pro sans limite.
- **Statut** : livré sur la branche `claude/offres-limites-produits`, **en attente de validation**. La migration `20261026090000_plan_product_limits.sql` doit être appliquée sur Supabase avant la fusion.
- **Fonctionnalités terminées** : plafond vide (`null`) pour « sans limite », dans l'offre et dans la boutique ; « Produits sans limite » dans « Abonnement » et l'administration ; pas d'alerte de quota sans plafond ; produits existants gardés.
- **Tests** : intégration (grille, refus du 4ᵉ produit en Gratuit, 11 produits en Pro), bout en bout (page « Abonnement »).

## Après la Phase 18 — Référencement et guides

- **Objectif** : rendre le site trouvable sur Google et cité par les assistants IA (demande du propriétaire du 2026-10-26, ADR-035).
- **Statut** : livré sur la branche `claude/seo-blog`, **en attente de validation**. Aucune migration.
- **Fonctionnalités terminées** :
  - **20 guides** sous `/blog` (gestion, ventes et caisse, stock, argent, factures et comptabilité, par type de boutique), chacun avec « En bref », sommaire, tableaux, questions fréquentes, liens vers les guides voisins et appel à créer sa boutique ; index par thème ; section « Guides » et lien dans le menu de l'accueil ;
  - **SEO technique** : `metadataBase`, canoniques, Open Graph, images de partage générées, `robots.txt`, `sitemap.xml`, prévisualisations non indexables, guides servis sans passer par le proxy Supabase ;
  - **GEO** : `llms.txt`, robots des assistants IA admis sur les pages publiques, données structurées JSON-LD (organisation, site, application et ses offres, FAQ, articles, fil d'Ariane), question « Qu'est-ce que Nagaw Business ? » sur l'accueil.
- **Tests** : unitaires (analyse du Markdown, cohérence des 20 articles : liens internes, slugs, longueurs, structure ; politique d'indexation, échappement du JSON-LD) ; bout en bout sur ordinateur et mobile (accueil → guides, liste, article, 404, robots, plan du site, `llms.txt`, axe sur `/blog` et un article).
- **Limites** :
  - le contenu fiscal et comptable (mentions de facture, TVA, SYSCOHADA) est général et le dit : à faire relire par un comptable avant une large diffusion ;
  - l'image de partage utilise la police par défaut de `next/og`, pas Nunito ;
  - le référencement réel dépend aussi d'actions hors du code : déclarer le site et le plan du site dans Google Search Console et Bing Webmaster Tools, choisir un nom de domaine définitif (`SITE_URL`).

## Après la Phase 18 — Audit d'accessibilité (WCAG 2.2 AA)

- **Objectif** : corriger les défauts trouvés par l'audit d'accessibilité du 2026-10-26 (relecture du code et contrastes de tous les jetons ; pas encore de test avec TalkBack ou NVDA).
- **Statut** : livré sur la branche `claude/accessibilite-audit`, **en attente de validation**. Aucune migration, aucun endpoint.
- **Corrections** :
  - **caisse** : les tuiles produit n'ont plus d'`aria-label` qui masquait la rupture, le stock restant et la quantité déjà dans le panier ; chaque ajout ou retrait est annoncé (« Riz ajouté. 3 dans le panier. ») par une zone `role="status"` toujours présente ; le focus suit les étapes (titre « Panier » après « Encaisser », recherche au retour, confirmation après la vente, titre « Vendre » après « Nouvelle vente ») ; message sous une quantité ou une remise refusée ; libellés visibles pour le paiement en plusieurs fois ; « À rendre » annoncé de façon fiable, le total n'est plus relu à chaque touche ; marge basse pour que « Encaisser » ne cache plus la dernière rangée (2.4.3, 3.3.1, 3.3.2, 4.1.2, 4.1.3) ;
  - **menu « Plus »** : `<dialog>` natif modal, le focus ne peut plus en sortir (2.4.3) ;
  - **choix de la boutique** : le bouton « Ouvrir » l'applique, choisir dans la liste ne recharge plus la page (3.2.2) ; _remplacé le 2026-10-26 à la demande du propriétaire : le choix de la boutique quitte le menu pour Paramètres → « Mes boutiques » (la barre latérale affiche seulement le nom de la boutique ouverte) ; la boutique choisie s'ouvre aussitôt, ce qu'annonce une phrase liée à la liste (3.2.2) ; le bouton ne reste que sans JavaScript_ ;
  - **focus visible** : anneau blanc sur les fonds colorés (bande verte de l'accueil, boutons sur tuiles foncées, liste de la barre latérale) ; `scroll-padding` pour qu'un élément ne passe plus sous les barres fixes (2.4.7, 2.4.11) ;
  - **formulaires** : après une réponse en erreur, le focus va au premier champ en erreur (`ActionForm`) ; textes d'exemple à 7,5:1 (1.4.3).
- **Tests** : bout en bout (annonce et nom accessible des tuiles, focus après « Encaisser », Tab qui reste dans le menu « Plus », bouton « Ouvrir ») ; suite complète Playwright, unitaires, intégration, lint, typecheck et build réussis.
- **Limites** : un test avec un lecteur d'écran réel sur un Android d'entrée de gamme reste à faire (parcours de vente complet), ainsi qu'un zoom à 200 % sur la caisse et les factures.

## Après la Phase 18 — Notifications, accès des vendeurs et contrôle du stock à la vente

- **Objectif** : demande du propriétaire du 2026-10-26 ; choix faits le même jour (voir ADR-036, acceptée).
- **Statut** : **validé** par le propriétaire le 2026-10-26, fusion dans `main` autorisée. La migration `20261026120000_notifications_seller_access.sql` doit être appliquée sur Supabase avant la fusion. Notifications push et tâche planifiée **non vérifiées en déploiement** : elles demandent `VAPID_*` et `CRON_SECRET` sur Vercel (voir `docs/DEPLOYMENT.md`).
- **Fonctionnalités terminées** :
  - **caisse** : « Stock insuffisant » sous la ligne qui dépasse le stock connu du téléphone ; « Corriger le stock » (quantité comptée, raison) ; sinon « Vendre quand même » ; le stock du téléphone suit les ventes et corrections pas encore envoyées ; correction envoyée avant la vente (`stock_correction`), refusée au-delà du plafond de la boutique pour un vendeur ;
  - **API** : vente toujours acceptée, marquée « Stock à vérifier » (`stockReview`) si elle dépasse le stock du serveur ; corrections en mouvement `adjustment`, auditées ; badges « Stock à vérifier » dans les ventes ;
  - **vendeurs** : entrées de marchandise sur la fiche produit, lecture des factures et devis, préparation et suivi des devis, carte « Mes ventes » (aujourd'hui, 7 jours, panier moyen, meilleurs produits) sur le tableau de bord ;
  - **notifications** : cloche avec le nombre de non lues (barre latérale et en-tête mobile), page `/espace/notifications` (marquer lu, ouvrir la page concernée, plus anciennes), page « Ce que je reçois » (sujets selon le rôle, téléphone ou non, activation du push sur ce téléphone) ; seuils dans Paramètres → « Alertes et stock » ;
  - **événements notifiés** : stock bas et épuisé (au franchissement), vente à vérifier (prix ou stock), correction de stock et entrée de marchandise faites par un vendeur, opérations refusées à l'envoi, client proche de son plafond, ventes, factures et dépenses du jour (regroupées) ; chaque jour : résumé du soir, produits bientôt épuisés, crédits en retard ;
  - **service worker** : affichage des messages push, ouverture de la page concernée (pages de l'application seulement).
- **Tests exécutés** :

  | Commande                                    | Résultat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
  | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `pnpm lint`, `pnpm typecheck`, `pnpm build` | OK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
  | `pnpm test`                                 | OK (shared 67, api 49 dont 15 règles de notification, web 135 dont stock local, liens sûrs, push du service worker)                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
  | `pnpm test:integration`                     | 167 tests OK sur Postgres construit depuis les migrations, dont 17 nouveaux (`notifications.integration-spec.ts`) : vente au-delà du stock, franchissement du seuil une seule fois, correction du vendeur (rejeu, plafond, interdiction, audit), entrée de marchandise, regroupement, lecture limitée à ses propres notifications, préférences dans les droits du rôle, seuils réservés aux gérants, chiffres du vendeur, journée préparée une seule fois, tâche planifiée fermée sans secret, navigateurs push, isolation entre boutiques, garde de la table en base |
  | `pnpm format:check`                         | fichiers modifiés conformes ; sur ce poste Windows (`core.autocrlf=true`), la vérification globale signale aussi des fichiers non touchés, à cause des fins de ligne CRLF du dossier de travail (l'index est en LF)                                                                                                                                                                                                                                                                                                                                                   |
  | Playwright                                  | nouveaux scénarios écrits (`e2e/app/notifications.spec.ts`), **non validés localement** : sur ce poste, le premier test de chaque fichier échoue aussi sur `main` (la caisse ou la session ne se chargent pas au premier passage) ; à vérifier en CI                                                                                                                                                                                                                                                                                                                  |

- **Tests modifiés** (règles changées par la décision du propriétaire, pas désactivées) : un vendeur peut enregistrer une entrée de marchandise (`catalog`), lire les factures (`documents`, `permissions`, onglets de navigation).
- **Problèmes connus** : un push interrompu en cours d'envoi n'est pas renvoyé ; sur iPhone, le push exige l'application installée ; les notifications ne sont pas purgées ; en développement (`next dev`), le service worker n'est pas enregistré, le réglage du push reste donc sur « Vérification… ».
- **Actions du propriétaire avant la mise en production** : appliquer la migration ; générer les clés VAPID et créer `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` et `CRON_SECRET` sur le projet `nagaw-api` ; tester sur un vrai téléphone Android l'activation du push et la réception d'une alerte de stock.

## Après la Phase 18 — Proposer l'installation de l'application

- **Objectif** : demande du propriétaire du 2026-10-26 : proposer l'installation quand l'application n'est pas installée, puis un bouton dans le menu si la proposition est fermée sans installer.
- **Statut** : livré sur la branche `claude/installer-app`, en attente de fusion. Aucune migration, aucun endpoint.
- **Fonctionnement** :
  - dans l'espace connecté, une boîte de dialogue « Installer Nagaw Business » s'ouvre une fois quand le navigateur peut installer l'application (Chrome, Edge : événement `beforeinstallprompt`, capturé dès le chargement de la page) ; « Installer » ouvre l'installation du navigateur ;
  - sur iPhone et iPad (Safari, qui n'a pas d'installation automatique), la boîte montre les deux gestes : « Partager », puis « Sur l'écran d'accueil » ;
  - fermée sans installer (« Plus tard », Échap, ou refus dans la fenêtre du navigateur), elle ne revient plus (choix gardé sur le téléphone) et un bouton « Installer l'application » apparaît dans le menu (barre latérale sur ordinateur, menu « Plus » sur téléphone) ;
  - rien n'est proposé quand l'application est ouverte depuis l'écran d'accueil ou vient d'être installée.
- **Tests** : unitaires (détection installée, installation proposée, iPhone Safari, autres navigateurs iOS) ; lint, typecheck, build.
- **Limites** : après un refus dans la fenêtre du navigateur, Chrome ne repropose l'installation qu'au chargement d'une page suivante (le bouton revient alors) ; non vérifié sur un vrai téléphone.

## Après la Phase 18 — La caisse s'ouvre dans toutes les circonstances (ADR-037)

- **Statut** : livré sur la branche `claude/caisse-toujours-ouverte`, en attente de fusion. Aucune migration.
- **Changements** : un nouveau téléphone n'est plus refusé quand l'offre est à son nombre d'appareils (dépassement inscrit dans l'historique) ; la caisse s'ouvre avec la copie du téléphone quelle que soit l'erreur du serveur ; sans copie, nouvel essai automatique toutes les 15 s et au retour du réseau.
- **Tests** : intégration (abonnements : un téléphone au-delà de l'offre est accepté) ; lint, typecheck, unitaires, build.

## Après la Phase 18 — Unités de vente et prix négocié (ADR-038), étape 1

- **Objectif** : demande du propriétaire du 2026-10-28 : vendre un article dans plusieurs unités (sac et kilo, pièce de tissu et mètre) et garder le prix réellement payé après négociation.
- **Statut** : étape 1 (base, contrats, API, tests) livrée sur la branche `claude/multi-unites-prix-negocie`, en attente de validation. Étapes 2 (écrans) et 3 (entrées, inventaire, factures et statistiques) à valider.
- **Migration** : `20261028090000_product_units.sql` : table `product_units` (facteur immuable par trigger), colonnes d'unité et de prix négocié de `sale_lines` (`base_quantity` calculée), `max_product_units` et `seller_can_sell_below_cost` sur `organizations`, `max_discount_basis_points` sur `organization_memberships`, `organizations.seller_max_discount_basis_points` n'est plus lue (gardée pour que l'API en production continue de fonctionner une fois la migration appliquée ; à supprimer par une migration ultérieure). La migration est uniquement additive.
- **API** :
  - `POST /products/:id/units`, `PATCH /products/:id/units/:unitId` ; les produits renvoient leurs unités actives ; la recherche par code-barres trouve aussi celui d'une unité ;
  - une ligne de vente (en ligne et hors ligne) accepte `productUnitId` et `agreedTotal` ; le stock sort dans l'unité de stock ; le coût de la ligne est celui de l'unité ;
  - limite de réduction par personne (vide = sans limite), réglable par `PATCH /organizations/current/members/:userId` ; vente sous le prix d'achat refusée aux vendeurs sauf réglage, signalée aux gérants ;
  - statistiques et chiffres du vendeur comptés dans l'unité de stock ; facture d'une vente avec les négociations dans la remise.
- **Web** : le ticket et le détail d'une vente affichent l'unité de vente (« 2 × sac de 50 kg ») et « Prix convenu avec le client, au lieu de … » ; la caisse envoie les nouveaux champs (unité de stock, sans négociation) et le stock local tient compte du facteur. Aucun écran de saisie dans cette étape.
- **Tests exécutés** :

  | Commande                                    | Résultat                                                                                                                                                                                                                                                                                                                        |
  | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `pnpm lint`, `pnpm typecheck`, `pnpm build` | OK                                                                                                                                                                                                                                                                                                                              |
  | `pnpm test`                                 | OK (shared 75 dont 8 nouveaux : montant convenu, remise répartie, vente pour un montant, mesure de la réduction, conversion d'unité, facteur immuable ; api 49 ; web 139)                                                                                                                                                       |
  | `pnpm test:integration`                     | 177 tests OK, dont 10 nouveaux (`product-units.integration-spec.ts`) : création et rejeu, nom, code-barres partagé, nombres entiers, plafond, facteur immuable (API et base), isolation entre boutiques, sortie de stock convertie, coût de l'unité, prix convenu, facture, limite par vendeur, vente à perte, vente hors ligne |
  | `pnpm format:check`                         | fichiers modifiés conformes ; la vérification globale signale les fichiers non touchés en CRLF sur ce poste (`core.autocrlf=true`)                                                                                                                                                                                              |

- **Tests modifiés** (règle changée par la décision du propriétaire, pas désactivés) : la limite de remise de 10 % des vendeurs devient une limite par personne, vide par défaut (`sales`, `sync`).
- **Actions du propriétaire** : valider l'étape 1 ; appliquer la migration en production à la fusion. Effet immédiat : les vendeurs n'ont plus la limite de 10 % de remise, mais ne peuvent plus vendre sous le prix d'achat.

## Après la Phase 18 — Unités configurables et règles de négociation (ADR-038), étape 2

- **Objectif** : demande du propriétaire du 2026-10-28 : « unités configurables et règles de négociation configurables ; à la vente on peut choisir des sous-multiples, multiples ou autres unités logiques ». Choix : conversions automatiques et modèles de la boutique, prix calculé modifiable, règles par vendeur, écrans compris.
- **Statut** : livrée sur la branche `claude/multi-unites-prix-negocie` avec l'étape 1, en attente de validation. La migration de l'étape 1, non fusionnée, a été complétée (pas de seconde migration).
- **Base** : `unit_templates` (plafond `max_unit_templates`) ; `product_units.sale_price` facultatif (prix calculé) ; `sale_lines.price_basis` ; le coût d'une ligne est gardé par unité de stock (× `base_quantity` dans la marge).
- **API** : conversions standard sur une ligne de vente (`conversion` : `g`, `kg`, `cl`, `ml`, `litre`, `cm`), en ligne et hors ligne ; `GET/POST/PATCH /unit-templates` ; `sellerCanSellBelowCost` dans `/notifications/settings` ; la liste des boutiques d'une personne (`/me`) donne sa propre limite de réduction ; facture d'une ligne au prix calculé reprise dans l'unité de stock.
- **Web** :
  - **caisse** : un produit qui a plusieurs unités ouvre le choix de l'unité (« kg », « g », « Sac de 50 kg ») ; une ligne par produit et par unité ; « Changer le prix » sur chaque ligne (montant convenu, « Servir pour ce montant » qui calcule la quantité, « Remettre le prix affiché ») ; prix barré et réduction totale affichés ; la limite de la personne et la règle du prix d'achat sont vérifiées avant la vente, avec le motif ; le stock demandé est additionné sur toutes les unités d'un produit ; le ticket local garde l'unité et le prix convenu ;
  - **fiche produit** : section « Unités de vente » (unité de stock, conversions automatiques, unités du produit avec prix fixe ou calculé), ajout depuis un modèle, changement de prix, retrait ;
  - **Produits → Unités** : conversions automatiques et modèles de la boutique (ajout, retrait) ;
  - **Équipe** : colonne et champ « Baisse de prix maximale (%) », vide = sans limite ;
  - **Paramètres** : « Les vendeurs peuvent vendre sous le prix d'achat ».
- **Tests exécutés** :

  | Commande                                    | Résultat                                                                                                                                                                                                                                                                                        |
  | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `pnpm lint`, `pnpm typecheck`, `pnpm build` | OK                                                                                                                                                                                                                                                                                              |
  | `pnpm test`                                 | OK (shared 78 : unités proposées, prix fixe ou calculé, une unité par ligne, description d'une ligne ; api 49 ; web 143 : panier multi-unités, quantité pour un montant, limite du vendeur, prix d'achat, stock local en grammes)                                                               |
  | `pnpm test:integration`                     | 181 tests OK, dont 14 dans `product-units.integration-spec.ts` : en plus de l'étape 1, vente en grammes et sa facture, unité au prix calculé puis fixé, modèles (rejeu, nom, entiers, plafond, droits, isolation entre boutiques, retrait), réglage du prix d'achat, limite lue par la personne |
  | Playwright                                  | **non exécuté** : sur ce poste, Windows refuse le port 54400 au faux serveur (`EACCES`) ; les parcours de caisse sont à vérifier en CI                                                                                                                                                          |

- **Tests retirés** : `shortagesOf` (stock local) n'est plus utilisé ; le calcul du stock demandé sur toutes les unités d'un produit (`wantedStock`) le remplace et est testé.
- **Limites** : entrées et inventaire toujours saisis dans l'unité de stock ; devis et factures saisis à la main sans unité de vente (étape 3).

## Après la Phase 18 — Un seul administrateur de la plateforme (ADR-039)

- **Objectif** : demande du propriétaire du 2026-10-29 : un « super admin unique » pour l'administration de la plateforme (l'espace `/admin` existe depuis la Phase 16, ADR-030).
- **Statut** : livrée sur la branche `claude/super-admin-unique`, en attente de validation. La migration n'est **pas encore appliquée** sur Supabase.
- **Base** : migration `20261029090000_single_platform_admin.sql`, index unique `platform_admins_single` : au plus un administrateur, même en SQL. Elle ne nomme aucun compte et ne contient aucun mot de passe.
- **Production (fait le 2026-10-29, à la demande du propriétaire)** : le compte existant `senghor.pape912@hotmail.com` a reçu le mot de passe choisi par le propriétaire (API d'administration de Supabase Auth, e-mail confirmé) et a été ajouté à `app.platform_admins`, seule ligne de la table. Ce compte est aussi propriétaire de la boutique « Habib comptoir », ce qui s'écarte de ADR-030 (« un administrateur n'est membre d'aucune boutique ») : rien ne l'interdit techniquement, à trancher par le propriétaire.
- **Tests** : l'administrateur des tests d'intégration est créé une fois par la mise en place commune (`platformAdmin()`), partagé par `admin` et `feedback` ; nouveau test « keeps a single platform administrator, even in SQL ».
- **Procédure** : `docs/OPERATIONS.md`, « Changer l'administrateur de la plateforme ».

## Après la Phase 18 — Le super administrateur prend la main (ADR-040), étape 1

- **Objectif** : demande du propriétaire du 2026-10-29 : « le super admin peut prendre le contrôle de tous les comptes ». Choix : entrer dans une boutique, se connecter à la place d'un utilisateur, gérer les comptes ; droits du propriétaire ; inscrit dans l'historique, sans limite de durée.
- **Statut** : étape 1 (entrer dans une boutique) livrée sur la branche `claude/super-admin-unique`, en attente de validation ; migration **non appliquée** sur Supabase. Étapes 2 (gérer les comptes) et 3 (se connecter à la place d'un utilisateur) à faire.
- **Base** : migration `20261029100000_platform_shop_access.sql` : table `platform_shop_accesses` (l'API ne peut que fermer un accès) ; trigger `audit_logs_mark_platform_actor`.
- **API** : `POST /admin/shops/:id/access` (motif) et `/access/close` ; `TenantGuard` accepte l'administrateur qui a un accès ouvert, avec le rôle propriétaire ; `/me` liste ces boutiques après les siennes, avec `platformAccess: true` ; la fiche d'une boutique donne l'accès ouvert (`access`).
- **Web** : carte « Entrer dans la boutique » sur la fiche d'administration (motif, puis l'espace de la boutique s'ouvre) ; dans la boutique, bandeau « Vous êtes dans … en tant que Nagaw (plateforme) » avec « Quitter la boutique » ; libellés de l'historique.
- **Tests exécutés** :

  | Commande                                    | Résultat                                                                                                                                                                                                                                                                           |
  | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `pnpm lint`, `pnpm typecheck`, `pnpm build` | OK                                                                                                                                                                                                                                                                                 |
  | `pnpm test`                                 | OK (shared 78, api 49, web 144)                                                                                                                                                                                                                                                    |
  | `pnpm test:integration`                     | 183 tests OK, dont « enters a shop with a reason… » : refus à un non-administrateur, motif obligatoire, double ouverture, droits du propriétaire dans la seule boutique ouverte (l'autre reste en 404), équipe inchangée, action signée « plateforme », sortie, boutique suspendue |
  | `pnpm format:check`                         | échoue sur ce poste Windows pour tout le dépôt (fins de ligne CRLF de l'extraction) ; les fichiers modifiés sont conformes                                                                                                                                                         |
  | Playwright                                  | **non exécuté** sur ce poste (port refusé par Windows, voir plus haut)                                                                                                                                                                                                             |

- **Limites (étape 1)** : seul l'historique est vérifié pour afficher « Nagaw (plateforme) » ; les autres écrans qui nomment un auteur d'après l'équipe de la boutique ne connaissent pas l'administrateur (non vérifié écran par écran) ; l'accès n'expire pas seul (choix du propriétaire).

## Après la Phase 18 — Tableau de bord, finances et statistiques de la plateforme (ADR-041)

- **Objectif** : demande du propriétaire du 2026-10-29 : « améliorer la présentation de l'administration, ajouter des graphiques statistiques, les finances ».
- **Statut** : livré sur la branche `claude/super-admin-unique`, en attente de validation. Migration `20261029120000_admin_finances_indexes.sql` (deux index, sans changement de données) **non appliquée** sur Supabase : les pages fonctionnent sans elle, elle n'accélère que les calculs.
- **API** : `GET /admin/finances` (revenu mensuel attendu, par offre, demandes en attente, 12 mois reconstitués d'après l'historique des offres et des suspensions, montées et descentes d'offre) ; `GET /admin/activity` (ventes de toutes les boutiques sur 30 jours, boutiques qui vendent, créations par mois, cinq boutiques qui vendent le plus).
- **Web** :
  - **présentation** : barre latérale sombre avec la page en cours marquée (boutons qui passent à la ligne sur téléphone), lien « Mon espace » et déconnexion regroupés ;
  - **tableau de bord** : alertes en tête (ou « Aucune alerte »), quatre chiffres clés (revenu mensuel prévu et son évolution, boutiques payantes, boutiques qui vendent, ventes sur 30 jours), graphique des ventes par jour, répartition des offres, croissance par mois, boutiques qui vendent le plus, comptes et synchronisation ;
  - **Finances** (nouvelle page) : bandeau « montants attendus, pas encaissés », chiffres clés (revenu mensuel, sur un an, par boutique payante, part de boutiques payantes), revenu prévu sur 12 mois, revenu par offre, demandes en attente, détail par offre, changements d'offre par mois ;
  - **Synchronisation** : chiffres clés et graphique empilé acceptées / refusées à la place du long tableau (le tableau reste sous le graphique) ;
  - composant `ColumnChart` (une série ou plusieurs empilées, une seule échelle, légende, survol, tableau des chiffres) et `ShareBar` ; jetons `--chart-1` à `--chart-3` vérifiés en clair et en sombre.
- **Tests exécutés** :

  | Commande                                    | Résultat                                                                                                                                                                                                                            |
  | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `pnpm lint`, `pnpm typecheck`, `pnpm build` | OK                                                                                                                                                                                                                                  |
  | `pnpm test`                                 | OK (shared 78, api 49, web 147 dont les libellés de jours et de mois)                                                                                                                                                               |
  | `pnpm test:integration`                     | 184 tests OK, deux fois de suite, dont « expects revenue from the offers, month by month from the history » : une boutique ancienne gratuite, puis Essentiel, suspendue un mois, puis Pro, reconstituée mois par mois au franc près |
  | Rendu visuel                                | **non vérifié** : l'extension de navigateur n'était pas connectée ; à regarder sur 360 px et sur ordinateur                                                                                                                         |
  | Playwright                                  | **non exécuté** sur ce poste (port refusé par Windows)                                                                                                                                                                              |

- **Correction de tests** : « approves a request… » et « rejects a request… » comptaient toutes les demandes d'offre de la base, y compris celles d'autres fichiers de tests lancés en même temps ; ils ne regardent plus que celles de leur boutique (mêmes vérifications).
- **Limites** : montants aux prix d'aujourd'hui ; aucun paiement suivi ; jours et mois en UTC ; montants d'activité dans la devise du plus grand nombre de boutiques seulement.

## Après la Phase 18 — Caisse en ligne uniquement, pour l'instant (ADR-042)

- **Objectif** : correctif demandé par le propriétaire le 2026-10-29 : un client bien connecté à internet n'arrivait pas à enregistrer ses ventes, la caisse le croyait hors ligne. Consigne : désactiver pour l'instant la caisse hors ligne, toutes les ventes enregistrées sur internet.
- **Causes trouvées** :
  - toute erreur du serveur autre que 401, 403 ou 404 lors de l'envoi des opérations (400, 409, 500, délai) était prise pour une absence de réseau : la vente restait « en attente » sans explication, et un lot refusé bloquait les suivants ;
  - un échec de l'enregistrement du téléphone comme appareil affichait l'écran « ouvrez la caisse une première fois avec internet ».
- **Web** :
  - `POST /caisse/vente` (relaie `POST /api/v1/sales`) et `POST /caisse/client` (relaie `POST /api/v1/customers`), avec la session de l'utilisateur ;
  - la caisse attend la réponse du serveur : vente enregistrée, puis ticket du serveur ; sinon le message dit « pas de connexion internet : rien n'est enregistré » ou le refus du serveur. Le même panier renvoyé garde son identifiant d'opération (pas de doublon) ;
  - ouverture avec des données fraîches seulement ; sans réseau, écran « pas de connexion » qui réessaie tout seul ; l'appareil n'est plus nécessaire pour vendre (seulement pour les corrections de stock, envoyées à l'instant) ;
  - les opérations gardées par une version précédente partent toujours à l'ouverture ;
  - textes corrigés : page « Pas de connexion », fenêtre d'installation, `llms.txt`. Le ticket local (`local-ticket.tsx`) est supprimé.
- **Tests** : `e2e/app/offline.spec.ts` décrit le nouveau comportement (vente refusée sans réseau puis enregistrée une seule fois au renvoi, caisse qui ne s'ouvre pas sans réseau). Les tests de ventes gardées sur le téléphone sont retirés avec la fonction.

  | Commande                                    | Résultat                                                    |
  | ------------------------------------------- | ----------------------------------------------------------- |
  | `pnpm lint`, `pnpm typecheck`, `pnpm build` | OK                                                          |
  | `pnpm test`                                 | OK (shared 78, api 49, web 147)                             |
  | `pnpm test:integration`                     | 184 tests OK                                                |
  | Playwright                                  | exécuté par la CI (connexion de test en échec sur ce poste) |

- **Limites** : sans internet, on ne vend plus avec l'application. Les textes du site public (accueil, référencement, image de partage) annoncent encore une caisse qui marche sans internet : à décider par le propriétaire.

## Après la Phase 18 — Correctif : les ventes échouaient avec une erreur interne (ADR-043)

- **Signalement** du propriétaire, le 2026-10-29 : « la validation de vente ne passe pas : le serveur a refusé : Une erreur interne est survenue ».
- **Cause** : la production avait la première version de la migration `20261028090000_product_units`. Le fichier avait été complété ensuite, sans être réappliqué. La colonne `sale_lines.price_basis`, écrite par chaque vente, manquait : aucune vente n'est enregistrée depuis le 2026-10-27 (dernière vente n° 14). C'était aussi la vraie cause du bug précédent, où la caisse croyait le client hors ligne.
- **Correctif** : nouvelle migration `20261029200000_product_units_catch_up.sql`, sans modification du code. Elle est protégée instruction par instruction et ajoute :
  - `sale_lines.price_basis` ;
  - la nouvelle règle `sale_lines_unit_check` ;
  - `product_units.sale_price` rendu facultatif ;
  - la table `unit_templates` avec ses index, son déclencheur, ses droits et sa politique ;
  - `organizations.max_unit_templates`.
- **Vérifications** :
  - appliquée deux fois sur une base complète : rien ne change ;
  - appliquée deux fois sur une base remise dans l'état de la production : état final attendu ;
  - comparaison du schéma de la production avec celui des migrations : colonnes, contraintes, index, déclencheurs, politiques et droits. Écarts restants : ceux que la migration corrige, plus `seller_max_discount_basis_points`, absente en production et inutilisée ;
  - corps des fonctions : tous différents. Probablement des fins de ligne, mais **non vérifié**, la lecture de la production a été refusée.
- **À faire par le propriétaire** : appliquer la migration (`supabase db push`). Les ventes repassent dès qu'elle est appliquée, sans redéploiement.

## Refonte mobile et identité de la boutique (ADR-044)

- **Demandes** du propriétaire du 2026-10-30.
- **Livré sur la branche `claude/refont-fix`, non fusionné, non déployé** :
  - « Vendre » flottant sur Accueil et Ventes ;
  - chiffres et textes qui restent dans leur cadre, avec un audit automatique de 18 écrans à 360 px ;
  - sensation d'application installée (voir ADR-044) ;
  - filtres du stock dans un panneau ;
  - filtre « Toutes » dans Ventes ;
  - pagination des ventes, produits, clients, factures, devis, dépenses et boutiques (administration) ;
  - logo de la boutique sur les PDF, les pages de document et le ticket ;
  - couleur des documents sur les PDF et le ticket ;
  - nouvelle présentation des PDF ;
  - nom complet et téléphone à la création de la boutique.
- **À faire par le propriétaire avant le déploiement** : appliquer `20261030090000_organization_logos`, puis déployer.
- **Non vérifié** : rendu sur un vrai téléphone (Android, iOS) : animations, geste de fermeture des panneaux, barre système, raccourcis de l'icône. Les tests tournent dans Chromium en émulation Pixel 7.
- **Non fait** : l'application reste une PWA : pas de publication sur les magasins d'applications (décision du propriétaire).
- **Tests exécutés** (2026-10-30, build dans les conditions de la CI) : format, lint, types, unitaires (288), intégration (191) et build verts ; e2e ordinateur 146 réussis ; e2e téléphone 142 réussis, 1 échec de délai sur la création d'une taxe, sans lien avec ce lot et réussi au nouveau passage, ainsi que les 2 tests qui le suivaient.

## Services dans le catalogue (ADR-045)

- **Demande** du propriétaire du 2026-10-30. Sur la branche `claude/refont-fix`, non fusionné, non déployé.
- **Livré** : nature « produit » ou « service », unités prestation, forfait, heure et jour, formulaire adapté, filtre « Type », menu « Produits et services ».
- **À faire par le propriétaire avant le déploiement** : appliquer `20261030100000_product_kind`.
- **Comptabilité** : ventes réparties entre 701 et 706 (ADR-046).
- **Non fait** : reprise automatique des produits existants sans stock.
- **Tests exécutés** (2026-10-30) : format, lint, types, unitaires (291), intégration (194) et build verts ; e2e publics 36 réussis ; e2e ordinateur et téléphone : aucun échec hors de `products.spec`, qui passe ensuite à 18 sur 18 sur les deux après correction de ses sélecteurs.

## Ce que vend la boutique (ADR-047)

- **Livré** sur la branche `claude/refont-fix`, non fusionné, non déployé : choix « Des produits », « Des services » ou « Les deux » à la création et dans Paramètres ; menu, listes, formulaire, Accueil, statistiques et caisse adaptés.
- **À faire par le propriétaire avant le déploiement** : appliquer `20261030110000_shop_offer` puis `20261030120000_shop_offer_default`.
- **Tests exécutés** sur la version finale (2026-10-30, build dans les conditions de la CI) : format, lint, types, unitaires (296), intégration (202) et build verts ; e2e publics 36, ordinateur 148 et téléphone 147 réussis. Des gels de 30 s ont touché l'analyse d'accessibilité sur des pages différentes d'une passe à l'autre, sur une machine chargée, sans se reproduire à la dernière passe : à surveiller en CI.

## Menu Factures / Devis (ADR-048)

- **Livré** sur la branche `claude/menu-factures-devis` : entrée de menu, pages Résumé, Factures, Devis et Nouveau, endpoint `GET /documents/stats` avec test d'isolation. Corrige aussi le bouton « Retour » d'une fiche de devis, qui menait à une page inexistante.
- **Visionneuse de PDF** (ADR-049) : aperçu des factures et devis dans l'application, avec pdf.js.
- **Retour global** (ADR-050) : un seul bouton pour toute l'application, ordinateur, téléphone et administration.
- **Changer de boutique** (ADR-051) : depuis le nom de la boutique, en un toucher.
- **Cachet et signature** (ADR-052) : dans Paramètres, imprimés sur les factures émises. Migration `20261030130000_shop_marks` à appliquer avant de déployer.

## Blog : 20 articles de plus

- **Livré** sur la branche `claude/blog-20-articles` : 40 articles au total, dont les métiers de services, les factures et les chiffres du commerçant. Aucun seuil, taux ou coût officiel n'y figure : les sources trouvées se contredisent, et ces articles renvoient aux services compétents.
