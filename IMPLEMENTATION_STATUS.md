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
- **Statut** : livrée sur la branche de travail, **en attente de validation**. Migration appliquée sur Supabase le 2026-10-23 (version `20261023214116`, avec l'autorisation du propriétaire).
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
- **Prochaine action recommandée** : tester la prévisualisation et valider la Phase 7.

## Repositionnement en application de gestion de boutique (2026-10-24)

- **Demande du propriétaire** : application SaaS moderne, mobile first, responsive ordinateur, hors ligne, de gestion de boutique (produits et stock, ventes, statistiques et trésorerie, comptabilité, factures et devis), jolie, colorée, accessible et facile pour les personnes peu à l'aise avec le numérique.
- **Statut** : **validé** par le propriétaire le 2026-10-24 (ADR-019 à ADR-022 acceptés). Documentation seulement ; la mise en œuvre commence en Phase 8.
- **Documents mis à jour** : `docs/PRODUCT_SPEC.md` (vision, personas, modules), `docs/DESIGN.md` (nouveau : palette aux contrastes calculés, typographie, accessibilité), `docs/DECISIONS.md` (ADR-019 repositionnement, ADR-020 hors ligne, ADR-021 design, tous proposés), `docs/ROADMAP.md` (phases 8 à 18), `docs/DATA_MODEL.md` (tables boutique proposées), `docs/ARCHITECTURE.md` (PWA, synchronisation, permissions boutique), `docs/SECURITY.md`, `docs/TESTING.md`, `docs/OPERATIONS.md`, `README.md`, `CLAUDE.md`.
- **Décisions du propriétaire (2026-10-24)** : Responsabilités et Tâches retirées (en Phase 8, tables conservées) ; comptabilité au MVP limitée au système minimal de trésorerie ; impression de tickets Bluetooth au MVP (ADR-022, proposé) ; police Nunito.
- **Imprimantes** : compatibilité visée avec les modèles les plus répandus, en priorité les petites imprimantes portables 58 mm (ADR-022).

## Phase 8 — Design system, application installable (PWA), retrait de Responsabilités et Tâches

- **Objectif** : donner à l'application son visage de boutique (coloré, accessible, mobile d'abord), la rendre installable et utilisable sans réseau au niveau de la coquille, et retirer les modules hors périmètre (ADR-019 à ADR-021, validés le 2026-10-24).
- **Statut** : livrée sur la branche `claude/phase-8-design-pwa`, **en attente de validation**. Aucune migration : les tables `responsibilities`, `tasks` et `task_notes` restent en base, inutilisées, sans suppression de données.
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

## Phases 9 à 18

Non commencées. Les anciennes phases 8 (approbations), 9 (outils), 10 (documents) et 11 (notifications, planification) sont remplacées par les phases boutique de `docs/ROADMAP.md`.
