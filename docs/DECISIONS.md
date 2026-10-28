# Décisions techniques (ADR)

Chaque décision a un statut : **Proposée**, **Acceptée**, **Remplacée**, **Reportée**. Les ADR 001 à 010 ont été validés le 2026-10-20, avec les ajustements suivants du propriétaire : IA reportée (Q2), API hébergée sur Vercel (Q6), interface en français uniquement (Q7).

---

## ADR-001 — Monorepo pnpm workspaces

- **Statut** : Acceptée
- **Contexte** : le dépôt est vide. Le frontend, l'API, le worker et les contrats partagés doivent évoluer ensemble.
- **Décision** : utiliser un monorepo **pnpm workspaces** avec `apps/web`, `apps/api`, `packages/shared` et `supabase/`. Pas de Turborepo au départ. Des scripts pnpm récursifs suffisent ; un outil de build incrémental ne sera ajouté que si les temps de CI le justifient.
- **Conséquences** : une seule PR peut modifier un contrat d'API et ses deux consommateurs.

## ADR-002 — Frontend Next.js (App Router) + Tailwind

- **Statut** : Acceptée
- **Décision** : utiliser Next.js (dernière version stable compatible), React, TypeScript `strict` et Tailwind CSS, avec des composants accessibles de type **shadcn/ui** (Radix), copiés dans le dépôt et non pris comme dépendance opaque. La validation des formulaires repose sur **react-hook-form + zod**, avec des schémas partagés via `packages/shared`.
- **Règle** : le frontend n'utilise Supabase que pour l'**authentification** (clé `anon` publique). Toutes les données métier passent par l'API.

## ADR-003 — API NestJS versionnée `/api/v1`

- **Statut** : Acceptée
- **Décision** : NestJS, modules par domaine, DTO validés côté serveur (zod via un pipe partagé, décision confirmée en Phase 2 lors du premier endpoint avec corps de requête), OpenAPI/Swagger, filtre d'exceptions global, logs JSON structurés (pino). Limitation de débit : sur Vercel, chaque instance a sa propre mémoire, donc un compteur en mémoire est inefficace. Le stockage des compteurs (Postgres ou Vercel Firewall) sera choisi en Phase 2.

## ADR-004 — Supabase : Postgres + Auth + Storage, migrations SQL versionnées

- **Statut** : Acceptée
- **Décision** : les migrations SQL dans `supabase/migrations` (Supabase CLI) constituent la **seule source de vérité** du schéma. L'API accède à Postgres via une connexion directe et un query builder typé (**Kysely**, avec types générés depuis la base). Aucun ORM ne génère ses propres migrations.
- **Alternatives écartées** : Prisma et Drizzle, dont les migrations entreraient en concurrence avec celles de Supabase ; `supabase-js` côté serveur, qui ne gère pas les transactions.

## ADR-005 — Isolation multi-tenant : contrôle applicatif + RLS en défense en profondeur

- **Statut** : Acceptée
- **Décision** :
  1. L'API vérifie le JWT Supabase (JWKS) à chaque requête.
  2. L'organisation active est transmise par en-tête (`X-Organization-Id`). L'API **vérifie l'appartenance** (`organization_memberships`) et charge le rôle. Un `organization_id` venant du client n'est jamais utilisé sans cette vérification.
  3. Chaque requête métier est filtrée par `organization_id` via un repository de base qui l'impose.
  4. La RLS est activée sur toutes les tables métier. Les rôles `anon` et `authenticated` n'ont **aucun accès direct** aux tables métier, ce qui couvre le cas d'une clé `anon` utilisée en dehors du frontend. L'API utilise un rôle Postgres dédié.
  5. Des tests d'intégration démontrent qu'une organisation A ne peut ni lire ni modifier les ressources de B, endpoint par endpoint.

## ADR-006 — Traitement asynchrone compatible Vercel

- **Statut** : Acceptée (révisée le 2026-10-20 suite au choix de Vercel pour l'API)
- **Contexte** : Vercel n'exécute pas de processus permanent. Un worker pg-boss en écoute continue n'y est donc pas possible.
- **Décision** : la file de tâches est une **table Postgres** (`jobs`), consommée par `SELECT … FOR UPDATE SKIP LOCKED`. Un endpoint interne de l'API traite un lot borné par la durée maximale d'une fonction. Il est déclenché :
  1. immédiatement après la mise en file (appel asynchrone non bloquant) ;
  2. par **Vercel Cron**, en filet de sécurité et pour les planifications. Il est protégé par `CRON_SECRET`.
- **Contraintes** : chaque job doit être idempotent et découpable en étapes courtes. Une étape longue est reprise au cycle suivant.
- **À vérifier en Phase 7** : la fréquence minimale de Vercel Cron selon le plan de l'équipe (le plan Hobby est limité à une exécution quotidienne). L'alternative est Vercel Queues.

## ADR-007 — Couche IA indépendante du fournisseur

- **Statut** : **Reportée** (décision du propriétaire, 2026-10-20)
- **Décision** : aucun fournisseur IA n'est intégré pour l'instant. Les phases Agents (5) et Moteur (7) livrent la configuration, le moteur d'exécution, les politiques et les approbations, sans appel à un modèle. Les capacités IA sont affichées comme **non configurées**, et non comme disponibles.
- **Quand l'IA sera réactivée** : une interface `LlmProvider` (messages, outils, sortie structurée, timeouts, comptage de jetons) avec un adaptateur par fournisseur. Les sorties du modèle restent non fiables : chaque appel d'outil passe par le moteur de politiques (ADR-008), puis par la validation des paramètres.

## ADR-008 — Moteur de politiques et approbations liées à l'empreinte de l'action

- **Statut** : Acceptée
- **Décision** : chaque outil déclare une catégorie d'action. L'organisation et l'agent associent à chaque outil une politique : `read_only`, `prepare_only`, `auto_within_limits`, `approval_required` ou `forbidden`, avec des conditions (par exemple un seuil de montant) **stockées en base**, jamais codées en dur. Une approbation référence un **hash canonique** de l'outil et de ses paramètres significatifs. Si les paramètres changent, le hash ne correspond plus et l'approbation est invalide.

## ADR-009 — Chiffrement applicatif des credentials d'intégration

- **Statut** : Acceptée
- **Décision** : les jetons et clés d'intégration sont chiffrés (AES-256-GCM) par l'API avec une clé maître hors base (variable d'environnement, rotation documentée). Ils ne sont jamais renvoyés au frontend et sont masqués dans les logs. Supabase Vault reste une alternative à évaluer en Phase 9.

## ADR-010 — Hébergement entièrement sur Vercel

- **Statut** : Acceptée (Q6, 2026-10-20)
- **Décision** : deux projets Vercel dans l'équipe `Petalia`, reliés au dépôt GitHub :
  - `nagaw-web` (racine `apps/web`, framework Next.js) ;
  - `nagaw-api` (racine `apps/api`, framework NestJS, une fonction unique).
    Leurs fonctions s'exécutent dans la région `cdg1` (Paris), proche de la base Supabase `eu-west-3`. Trois environnements sont prévus : local, préproduction (déploiements _preview_) et production, chacun avec son propre projet Supabase.
- **Conséquences** : le traitement asynchrone suit ADR-006 révisé. Les connexions Postgres passent par le pooler Supabase (mode transaction), car les fonctions serverless ouvrent de nombreuses connexions courtes.

## ADR-011 — Versions d'outillage

- **Statut** : Acceptée (Phase 1)
- **Décision** :
  - TypeScript 6.0, car TypeScript 7 est publié mais encore incompatible avec le CLI NestJS 12, qui exige `~6.0` ;
  - Node.js 24 en CI et sur Vercel (`.nvmrc`) ;
  - Next.js 16.4 avec Cache Components ;
  - NestJS 12 en modules ESM ;
  - Vitest pour tous les paquets ;
  - oxlint pour l'API, ESLint pour le web, Prettier pour le formatage.

## ADR-012 — Interface en français uniquement

- **Statut** : Acceptée (Q7, 2026-10-20)
- **Décision** : pas de bibliothèque i18n. Les textes sont écrits directement en français. Les dates et montants passent par `Intl` avec la locale `fr`, dans le fuseau de l'organisation. Un passage à l'i18n reste possible plus tard, mais ne sera pas préparé à l'avance.

## ADR-013 — Schéma privé `app` et rôle Postgres dédié `nagaw_api`

- **Statut** : Acceptée (Phase 2)
- **Décision** :
  - les tables métier sont dans le schéma `app`, non exposé par l'API Data de Supabase ;
  - l'API se connecte avec le rôle `nagaw_api`, qui dispose de `SELECT`, `INSERT` et `UPDATE` sur les tables utiles, de `SELECT` et `INSERT` seulement sur `audit_logs`, et d'aucun `DELETE` ;
  - `anon` et `authenticated` n'ont aucun droit sur le schéma ;
  - la RLS est activée partout, avec des politiques ouvertes uniquement à `nagaw_api` ;
  - `audit_logs` est protégé contre `UPDATE`, `DELETE` et `TRUNCATE` par des triggers, y compris pour le propriétaire des tables.
- **Conséquence** : la clé publishable de Supabase, présente dans le navigateur, ne donne accès à aucune donnée métier, même en cas de bug de l'API.
- **Mot de passe du rôle** : il est défini par le propriétaire, hors de Git (voir `docs/DEPLOYMENT.md`).

## ADR-014 — Authentification : Supabase Auth, jetons asymétriques vérifiés par l'API

- **Statut** : Acceptée (Phase 2)
- **Décision** :
  - le web utilise `@supabase/ssr` : session dans des cookies, rafraîchie par `proxy.ts`, et formulaires traités par des Server Actions qui valident les champs côté serveur ;
  - les liens d'e-mail (confirmation, réinitialisation du mot de passe) utilisent le flux PKCE et aboutissent sur `/auth/callback`, qui n'accepte que des redirections internes ;
  - l'API vérifie chaque jeton avec le JWKS du projet : signature ES256/RS256, émetteur, audience `authenticated`, expiration, rejet des utilisateurs anonymes ;
  - un projet encore signé avec le secret HS256 _legacy_ n'est pas pris en charge : `/health/ready` le détecte (`auth: "no_signing_keys"`).

## ADR-015 — Invitations par lien, sans fournisseur d'e-mail pour l'instant

- **Statut** : Acceptée pour l'instant (Phase 4, 2026-10-23), à revoir lors du choix d'un fournisseur d'e-mail
- **Contexte** : la roadmap prévoyait d'envoyer les invitations par e-mail. Aucun fournisseur d'e-mail transactionnel n'a encore été choisi ni configuré, et une intégration non vérifiée ne doit pas être présentée comme opérationnelle.
- **Décision** :
  - l'API crée l'invitation et renvoie le jeton **une seule fois** ; le web affiche le lien `/invitation?jeton=…` à l'administrateur, qui le transmet lui-même ;
  - l'interface indique explicitement que l'envoi automatique par e-mail n'est pas configuré ;
  - le jeton fait 256 bits ; seul son hash SHA-256 est stocké ; il expire selon `organizations.invitation_ttl_hours`, sert une seule fois et n'est accepté que par l'utilisateur dont l'adresse de profil est l'adresse invitée ;
  - le jeton circule dans le corps des requêtes vers l'API (jamais dans son URL, donc jamais dans ses logs) ; la page d'invitation n'envoie pas de `Referer`.
- **Suite** : quand le propriétaire aura choisi un fournisseur (par exemple Resend ou Brevo), l'API enverra le même lien par e-mail. L'affichage du lien restera disponible en secours.

## ADR-016 — Agents : configuration versionnée, test contrôlé déterministe, registre d'outils en code

- **Statut** : **Remplacée par ADR-017** (les agents ont été retirés le 2026-10-23). Acceptée initialement en Phase 5.
- **Décision** :
  - l'identité d'un agent (nom, domaine, statut) est modifiable ; tout ce qui pilote son comportement est dans des **versions immuables** (`agent_versions`, ajout seul) : chaque modification crée une version, l'historique n'est jamais réécrit ;
  - le cycle de vie est brouillon → actif ↔ suspendu → archivé ; l'archivage est définitif ; l'activation (et toute nouvelle version d'un agent actif) exige une configuration complète ;
  - le « test contrôlé » est **déterministe** : vérifications de la configuration et consignes assemblées, sans appel de modèle ni action (ADR-007) ;
  - les outils sont déclarés dans un registre en code (`packages/shared/src/agents.ts`) ; un outil n'est autorisable que lorsqu'il est implémenté et testé (`available: true`). `email.send` est annoncé, non disponible (Phase 9) ;
  - les plafonds (nombre d'agents, étapes et durée par exécution) sont des colonnes de `organizations`, non modifiables par l'organisation elle-même (préparation des quotas de la Phase 12).
- **Conséquence** : aucune configuration de modèle n'existe tant qu'un fournisseur n'est pas choisi ; les colonnes `provider`/`model` seront ajoutées à ce moment.

## ADR-017 — Application 100 % manuelle pour l'instant

- **Statut** : Acceptée (décision du propriétaire, 2026-10-23) ; contexte produit remplacé par ADR-019 (proposée), principe « 100 % manuel » maintenu
- **Décision** : « pour l'instant l'application doit être 100 % manuelle : pas d'automatisation, ni agent IA ».
  - Aucune planification, aucun déclenchement automatique, aucune tâche de fond : une personne lance toujours le travail.
  - Aucun modèle d'IA n'est intégré ni appelé (complète ADR-007).
  - **Aucun agent** : la section Agents est retirée de l'application, de l'API et des contrats partagés (décision du propriétaire, 2026-10-23). Les responsabilités sont confiées à un membre de l'équipe (migration `20261023211917_responsibility_assignee`). Les tables `agents` et `agent_versions` sont conservées en base, inutilisées : aucune donnée n'est supprimée sans accord explicite.
- **Conséquences** :
  - Phase 6 : la planification prévue (fréquence, heure) est retirée ; une responsabilité se déclenche uniquement à la main.
  - Phase 7 redéfinie par le propriétaire : **suivi manuel des tâches** (une personne lance, renseigne et clôt chaque tâche) ; Phase 11 (tâches planifiées) reportée ; ADR-006 (traitement asynchrone) suspendue.
  - Phases 8 (approbations d'actions) et 9 (outils et intégrations) à redéfinir, faute d'actions automatiques.

## ADR-018 — Suivi manuel des tâches

- **Statut** : Acceptée le 2026-10-23 (Phase 7 validée par le propriétaire), puis remplacée par ADR-019 : le module Tâches est retiré sur décision du propriétaire (2026-10-24). Les tables restent en base, inutilisées.
- **Contexte** : la Phase 7 est redéfinie par ADR-017 : une personne lance, renseigne et clôt chaque tâche ; rien ne s'exécute automatiquement.
- **Décision** :
  - une tâche est ponctuelle ou rattachée à une responsabilité **active et dans sa période** ; elle est confiée à un membre actif (clé étrangère composite vers les appartenances) ;
  - cycle de vie : à faire → en cours ↔ bloquée → terminée ou annulée ; terminée et annulée sont définitives ; un blocage exige un motif, une clôture exige un résultat (atteint, partiel, non atteint) et un compte rendu ; ces règles sont aussi des contraintes SQL ;
  - droits (choix recommandés, appliqués faute de réponse explicite) : propriétaires et administrateurs lancent et modifient toutes les tâches ; un membre lance des tâches **pour lui-même**, ponctuelles ou sur les responsabilités qui lui sont confiées, et fait avancer les siennes ; un lecteur consulte ;
  - la limite « tâches par jour » d'une responsabilité compte les tâches lancées le jour même dans le fuseau de l'organisation ; le plafond `max_open_tasks` (défaut 500) borne les tâches ouvertes ; les deux sont vérifiés sous verrou de l'organisation ;
  - le journal d'une tâche est fait de **notes en ajout seul** (`task_notes`) ; les changements de statut et les modifications sont dans `audit_logs`. Les tables `task_steps` et `task_events`, prévues pour l'exécution automatique, ne sont pas créées ;
  - un blocage affiche la personne à prévenir définie sur la responsabilité ; **aucune notification n'est envoyée** (pas de fournisseur d'e-mail, ADR-015).

## ADR-019 — Repositionnement : application de gestion de boutique

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-24, questions tranchées : voir **Décisions du propriétaire**). Retrait de Responsabilités et Tâches fait en Phase 8.
- **Contexte** : le propriétaire redéfinit le produit : « une application SaaS moderne, mobile first, responsive desktop, hors ligne, de gestion de boutique », avec produits et stock, ventes, statistiques (chiffre d'affaires, trésorerie), comptabilité, factures et devis. Elle doit être jolie, colorée, accessible, et facile pour les personnes peu à l'aise avec le numérique.
- **Décision proposée** :
  - le socle livré est conservé tel quel : authentification (ADR-014), multi-tenant (ADR-005, ADR-013), équipe et invitations (ADR-015), journal d'audit. Une **organisation** devient une **boutique** dans l'interface ; le schéma garde le nom `organizations` ;
  - les rôles restent `owner`, `admin`, `member`, `viewer`, présentés comme propriétaire, gérant, vendeur et lecteur (comptable) ; les permissions boutique sont ajoutées dans `packages/shared/src/permissions.ts` ;
  - les modules **Responsabilités** et **Tâches** (Phases 6 et 7, ADR-018) sont **retirés** de la navigation, de l'API et des contrats partagés, comme les agents (ADR-017) ; leurs tables sont conservées, inutilisées : aucune donnée n'est supprimée sans accord explicite ;
  - ADR-017 reste en vigueur : pas d'IA, pas d'agent, pas de tâche planifiée. Un calcul déterministe déclenché par une saisie (stock, écriture comptable, numéro de facture) fait partie de l'opération et n'est pas une automatisation ;
  - les phases 8 (approbations), 9 (outils et intégrations), 10 (documents) et 11 (notifications, planification) sont **remplacées** par les phases boutique de `ROADMAP.md` ;
  - devise par défaut `XOF` (sans décimales, montants en `bigint`), comptabilité selon le SYSCOHADA révisé, en commençant par le système minimal de trésorerie ;
  - les paiements Mobile Money sont **saisis à la main** ; aucune intégration de paiement n'est présentée comme opérationnelle tant qu'elle n'est pas choisie et vérifiée.
- **Décisions du propriétaire (2026-10-24)** :
  1. Responsabilités et Tâches : **retirées** (en Phase 8) ;
  2. comptabilité au MVP : **système minimal de trésorerie** SYSCOHADA ; la partie double vient plus tard ;
  3. impression de tickets sur imprimante Bluetooth : **au MVP** (ADR-022) ;
  4. police : **Nunito** (ADR-021).

## ADR-020 — Mode hors ligne : PWA, base locale et synchronisation par opérations idempotentes

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-24). Socle livré en Phase 8 ; base locale, appareils et synchronisation livrés en Phase 11 (ADR-025).
- **Contexte** : la connexion est intermittente chez les commerçants visés. Un vendeur ne doit jamais être empêché d'encaisser. L'architecture actuelle (toutes les données passent par l'API, ADR-002) suppose une connexion permanente. Vercel n'héberge pas de processus permanent (ADR-010), ce qui n'est pas un obstacle : la synchronisation est initiée par l'appareil.
- **Décision proposée** :
  - le web devient une **PWA installable** (manifeste, service worker) : l'application s'ouvre sans réseau ; l'outil de service worker est choisi en Phase 8 après lecture du guide PWA de la version installée de Next.js ;
  - une **base locale IndexedDB** (bibliothèque type Dexie) contient, par boutique : le catalogue, les stocks connus, les clients, les ventes et opérations en attente ;
  - toute écriture hors ligne est une **opération** avec un identifiant UUID généré sur l'appareil, envoyée par lot à `POST /api/v1/sync` quand le réseau revient. L'identifiant sert de clé d'idempotence (`UNIQUE (organization_id, client_operation_id)`) : un renvoi ne crée jamais de doublon ;
  - **le serveur reste l'autorité** : il revérifie l'appartenance, le rôle et les règles métier de chaque opération (prix, remises autorisées, produit existant). Une opération refusée est renvoyée avec son motif et affichée sur l'appareil, jamais ignorée en silence ;
  - les ventes et mouvements de stock sont en **ajout seul** : ils ne créent pas de conflit. Le stock est la somme des mouvements ; deux ventes hors ligne du même dernier article donnent un stock négatif **signalé** au gérant, plutôt qu'une vente refusée après coup ;
  - les données modifiables (produit, client) portent un numéro de version : une modification faite sur une version dépassée est présentée comme un conflit à résoudre, pas écrasée ;
  - hors ligne, un appareil émet des **tickets de caisse** numérotés avec son préfixe (`A3-000127`). Les **numéros de facture** légaux, séquentiels sans trou, ne sont attribués que par le serveur ; une facture créée hors ligne est un brouillon jusqu'à la synchronisation ;
  - quotas et durée de vie : un appareil garde au plus N jours d'opérations non synchronisées (valeur configurable en base) et alerte avant ;
  - la déconnexion efface la base locale de l'appareil ; une opération non synchronisée bloque la déconnexion avec un avertissement explicite.
- **Conséquences** : chaque module de vente et de stock est conçu dès sa phase pour l'écriture hors ligne (identifiant client, opération rejouable) ; les lectures analytiques (statistiques, comptabilité) restent en ligne, avec la dernière version consultée en cache. Le jeton Supabase expire : l'appareil continue de travailler hors ligne avec l'identité connue, et la synchronisation exige une session rafraîchie.
- **Mise en œuvre (Phase 8)** :
  - service worker écrit à la main (`apps/web/src/lib/pwa/service-worker-source.ts`, servi sur `/sw.js`), plutôt qu'une bibliothèque (Serwist) : une soixantaine de lignes, testées unitairement, sans dépendance ni étape de build supplémentaire ;
  - il ne met en cache **aucune donnée d'utilisateur** : seulement la page `/hors-ligne`, ses fichiers et les fichiers immuables de `/_next/static/`. Les pages et les réponses de l'API passent toujours par le réseau ; une navigation impossible affiche la page hors ligne ;
  - le cache est versionné par build (`NAGAW_BUILD_ID`) et les anciens caches sont supprimés à l'activation ;
  - `experimental.useOffline` de Next.js met en attente navigations et Server Actions pendant la coupure et les relance au retour du réseau ; le hook `useOffline` alimente le bandeau « Pas de connexion internet ».
- **Alternatives écartées** : PowerSync, ElectricSQL ou réplication Postgres directe vers le client, qui contourneraient l'API et donc les contrôles d'ADR-005 et ADR-013 ; application native, plus coûteuse à distribuer et à maintenir pour un premier produit.

## ADR-021 — Design system coloré et accessible, mobile first

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-24), livrée en Phase 8.
- **Décision proposée** : palette vive avec une couleur par module, jetons sémantiques Tailwind 4, police **Nunito** (choix du propriétaire, 2026-10-24), typographie de 16 px minimum, cibles tactiles de 48 px, WCAG 2.2 AA vérifié automatiquement (axe-core) et tests sur mobile (360 px) et ordinateur. Détail et contrastes calculés : [`DESIGN.md`](./DESIGN.md).
- **Conséquence** : l'interface livrée en Phases 3 à 7 est reprise en Phase 8 avec ces jetons et la nouvelle navigation (barre inférieure sur mobile, barre latérale sur ordinateur).

## ADR-022 — Impression des tickets sur imprimante thermique Bluetooth, dès le MVP

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-24, inclusion au MVP). Mise en œuvre en Phase 10.
- **Contexte** : les boutiques utilisent des imprimantes thermiques portables (papier de 58 ou 80 mm, commandes ESC/POS). L'application est une PWA (ADR-020), et non une application native.
- **Décision proposée** :
  - impression via **Web Bluetooth** (Bluetooth basse consommation, profil GATT), depuis le navigateur, **sans réseau** : le ticket est généré sur l'appareil à partir de la vente locale ;
  - un encodeur ESC/POS dans `apps/web/src/lib/printing/` (texte, montants alignés, accents, coupe du papier), testé unitairement ;
  - l'imprimante choisie et la largeur du papier sont des réglages **de l'appareil** (stockés localement), pas de la boutique ;
  - en secours, toujours disponibles : partage du ticket en image ou en PDF (WhatsApp) et impression système du navigateur.
- **Limites connues, à vérifier sur du matériel réel avant de déclarer la fonction opérationnelle** :
  - Web Bluetooth n'existe que sur les navigateurs Chromium (Chrome, Edge) sous Android et sur ordinateur ; il est absent de Safari sur iPhone et de Firefox : ces appareils n'ont que le secours ;
  - beaucoup d'imprimantes d'entrée de gamme n'offrent que le Bluetooth « classique » (profil série), inaccessible à Web Bluetooth : l'application annoncera la liste des modèles **testés** ;
  - si les modèles courants chez les boutiques pilotes ne sont pas compatibles, l'alternative est d'emballer la PWA dans une application Android (par exemple Capacitor) avec un module Bluetooth natif : cela ferait l'objet d'un nouvel ADR.
- **État (Phase 10)** : non livrée. La Phase 10 fournit l'impression par l'imprimante du système (mise en page 58 mm) et le partage du ticket sur WhatsApp. L'impression Bluetooth directe sera développée dès qu'au moins un modèle d'imprimante réel sera disponible pour les essais : elle ne sera pas annoncée avant d'avoir été vérifiée.
- **Cible fixée par le propriétaire (2026-10-24)** : être compatible avec les modèles les plus répandus sur le marché, **en priorité les petites imprimantes portables 58 mm**. Conséquence : la Phase 10 commence par un banc d'essai sur plusieurs de ces modèles ; comme une grande partie d'entre eux n'offre que le Bluetooth classique, l'emballage Android (Capacitor) est probablement nécessaire pour atteindre cette cible, et fera l'objet d'un ADR au vu des résultats.

## ADR-023 — Catalogue et stock : prix TTC, stock par mouvements, photos en base

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-24, Phase 9).
- **Décision** :
  - **prix de vente taxes comprises** : c'est le prix affiché et payé en boutique. Le taux de taxe du produit sert à retrouver le hors-taxe sur les factures (Phase 12). Les taux sont des données de la boutique (`tax_rates`), jamais codés en dur ;
  - **montants entiers en unités mineures** de la devise de la boutique, lus et affichés par des fonctions partagées (`packages/shared/src/money.ts`) ; **quantités** en `numeric(14,3)`, entières pour les unités comptées à la pièce (pièce, carton, sac…), décimales pour le poids, le volume et la longueur ;
  - **le stock n'est jamais écrasé** : il est la somme d'un journal de mouvements en ajout seul (stock de départ, entrée, perte, inventaire ; vente et retour en Phase 10). Un inventaire enregistre la quantité comptée et l'écart. Une perte supérieure au stock est refusée ; l'inventaire corrige un stock faux ;
  - chaque création (produit, mouvement) porte un **identifiant d'opération** fourni par l'appareil : un renvoi répond 200 avec le résultat d'origine, sans doublon (préparation d'ADR-020) ; les modifications d'un produit exigent la **version** lue (409 `VERSION_CONFLICT` sinon) ;
  - seuls le propriétaire et les gérants gèrent le catalogue et le stock (`catalog.manage`, `stock.move`) ; tout le monde le consulte (`catalog.read`) ;
  - noms uniques parmi les éléments actifs (insensible à la casse) ; **archivage** au lieu de suppression ; plafonds par boutique en base (`max_products`, `max_product_categories`, `max_suppliers`, `max_tax_rates`) ;
  - **photos dans Postgres** (`product_photos`, 512 Ko au plus), réduites à 800 px et réencodées en WebP (ou JPEG) **sur l'appareil**, vérifiées par signature côté API, servies au navigateur par une route du web qui relaie la session. Supabase Storage aurait demandé une nouvelle clé privilégiée côté API et une intégration non vérifiée ; le passage à Storage reste possible si le volume le justifie.
- **Conséquence** : une photo retirée est masquée (`photo_sha256` à null), ses octets restent jusqu'à la prochaine photo, faute de droit `DELETE` pour l'API (ADR-013).

## ADR-024 — Ventes au comptoir et crédit client

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-24, Phase 10).
- **Décision** :
  - **le serveur fait foi** : l'appareil n'envoie que les produits, les quantités, la remise et les paiements. Les prix sont relus dans le catalogue et les totaux recalculés avec la même fonction partagée (`computeSaleTotals`). Si le total affiché au vendeur diffère, la vente est refusée (`PRICE_CHANGED`) avec le nouveau total : jamais de surprise à la caisse ;
  - **taxes incluses** : la taxe de chaque ligne est extraite du montant payé après une remise répartie au prorata des lignes ;
  - **remise** sur la vente entière ; un vendeur est limité par `organizations.seller_max_discount_basis_points` (10 % par défaut, réglable en base), le propriétaire et les gérants non ;
  - **paiements** : espèces (somme reçue et monnaie rendue), Mobile Money saisi à la main avec l'opérateur et le numéro de transaction facultatif (aucune intégration, ADR-019), carte, **crédit** ; plusieurs moyens par vente ; leur somme égale exactement le total ;
  - **crédit client** : le solde dû n'est jamais stocké, il est calculé (crédits des ventes non annulées moins remboursements) ; un plafond de crédit facultatif par client est vérifié sous verrou ; un remboursement ne peut pas dépasser le solde ;
  - **stock** : chaque vente crée des mouvements `sale` liés à la vente ; le stock peut devenir négatif plutôt que de bloquer une vente déjà faite (ADR-020) ;
  - **numéros de ticket** séquentiels par boutique, pris sous verrou de la boutique (sans trou) ; les numéros par appareil viendront avec le hors ligne (Phase 11) ;
  - **une vente n'est jamais modifiée** : lignes et paiements en ajout seul ; seule l'**annulation** est possible (propriétaire ou gérant, motif obligatoire), garantie par un trigger en base ; elle remet les articles en stock par des mouvements `return` et efface le crédit correspondant ;
  - **visibilité** : un vendeur voit ses propres ventes ; propriétaire, gérants et lecteur voient toutes celles de la boutique.
- **Reporté** : retours partiels (une partie des articles), caisses et clôture de caisse (Phase 13), impression Bluetooth (ADR-022).

## ADR-025 — Caisse hors ligne : page statique, file d'attente et prix vu par le client

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-24, Phase 11).
- **Contexte** : ADR-020 fixe le principe ; cette décision précise la mise en œuvre de la vente sans réseau.
- **Décision** :
  - **une seule caisse**, `/caisse`, page **statique** (aucune donnée de personne dans son code), gardée par le service worker : elle s'ouvre sans réseau. Elle lit le catalogue, les clients et l'appareil dans une base locale **IndexedDB**, rafraîchie à chaque ouverture avec réseau. L'ancienne page `/espace/vendre` redirige vers elle ;
  - **toute vente passe par la file d'attente** du téléphone, même en ligne : elle est enregistrée localement (avec son numéro de ticket d'appareil), puis envoyée aussitôt si le réseau le permet. Il n'existe donc qu'un seul chemin, testé hors ligne comme en ligne ;
  - **appareils** : un navigateur s'enregistre à la première ouverture de la caisse et reçoit un préfixe (`A`, `B`… `AA`) ; ses tickets hors ligne sont numérotés `B-000012`. Le serveur attribue en plus son numéro séquentiel à l'arrivée. Un gérant peut **retirer** un appareil (perdu, volé) : ses envois sont alors refusés ;
  - **synchronisation** : `POST /api/v1/sync`, lots de 50 opérations au plus, traitées dans l'ordre et chacune dans sa transaction ; réponses `accepted`, `duplicate` (déjà reçue, sans effet) ou `rejected` (avec le motif, conservé et affiché sur le téléphone et dans le bandeau) ; un client créé hors ligne est envoyé avant la vente qui le référence ;
  - **prix** : une vente faite hors ligne garde **le prix payé par le client** ; si ce prix diffère du catalogue au moment de l'envoi, la vente est acceptée et marquée **« Prix à vérifier »** pour le gérant, plutôt que refusée après coup. Les autres règles (remise des vendeurs, paiements, crédit, produits de la boutique) s'appliquent à l'identique ;
  - **ancienneté** : une vente de plus de `organizations.max_offline_days` jours (7 par défaut, réglable en base) ou datée dans le futur (au-delà de 5 minutes) est refusée avec son motif ;
  - **envoi automatique** : à l'ouverture, au retour du réseau et toutes les 30 secondes tant que des ventes attendent ; un bandeau indique en permanence ce qui attend ou a été refusé ;
  - **déconnexion** : la base locale est effacée ; s'il reste des ventes non envoyées, la personne est prévenue qu'elles seraient perdues et peut annuler.
- **Limites** : les entrées, pertes et inventaires de stock restent en ligne ; les fiches et listes de l'espace (hors caisse) demandent le réseau ; une session expirée doit être renouvelée pour envoyer (les ventes attendent sans risque).

## ADR-026 — Factures, devis et avoirs

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-25, Phase 12).
- **Contexte** : une boutique doit remettre des devis et des factures conformes (numéro unique et continu, identité du vendeur et du client, HT / TVA / TTC) et ne jamais pouvoir réécrire une facture déjà remise.
- **Décision** :
  - **numérotation par le serveur seul**, par boutique, type et année : `D-2026-0001` (devis, dès la création), `F-2026-0001` (facture, **à l'émission**), `A-2026-0001` (avoir). Le compteur `document_sequences` est verrouillé pendant l'attribution : ni trou ni doublon, même avec deux gérants en même temps ;
  - **facture en deux temps** : un **brouillon** sans numéro se modifie librement ; une fois **émise**, la facture reçoit son numéro, sa date et son échéance, et **ne change plus** (trigger en base, même pour un accès SQL direct) ;
  - **annulation par un avoir** du même montant, numéroté, lié à la facture ; une facture qui a déjà reçu des paiements ne s'annule pas (rembourser d'abord) ; un seul avoir par facture ;
  - **lignes en JSON validé** sur le document (`lines jsonb`, schéma partagé `documentLineSchema`) plutôt qu'en tables de lignes : les lignes sont figées avec le document et un brouillon se réécrit sans droit de suppression (ADR-013) ; lignes du catalogue (produit vérifié de la boutique) ou libres (service) ;
  - **prix TTC** comme à la caisse (ADR-024) et **même calcul partagé** (`computeDocumentTotals` sur `computeSaleTotals`), avec la TVA détaillée par taux et le total HT ;
  - **paiements partiels** en ajout seul (espèces, Mobile Money avec opérateur, carte, virement, chèque), jamais au-delà du reste à payer, idempotents (`clientOperationId`) ; l'état « à payer / payée en partie / payée / en retard » est **calculé**, jamais stocké ;
  - **devis** : brouillon → envoyé → accepté ou refusé ; modifiable seulement en brouillon ; « expiré » calculé après la date de validité ; un devis accepté donne **une** facture brouillon qui reprend ses lignes ;
  - **facture d'une vente** payée en caisse (pas à crédit) : brouillon reprenant les lignes du ticket, au nom du client de la vente ou d'un client choisi ; à l'émission, les paiements de la vente y sont recopiés, marqués « réglé en caisse » (`from_sale`) pour ne jamais être comptés deux fois en trésorerie (Phase 13) ; une vente n'a qu'une facture non annulée ;
  - **PDF généré par l'API** (`pdf-lib`, sans navigateur ni service externe), A4, police standard : identité de la boutique (raison sociale, adresse, téléphone, NINEA, RCCM, mention de bas de page), client, lignes, HT / TVA / TTC, paiements et reste à payer, mention « ACQUITTÉE » ou « ANNULÉE ». Le web le relaie avec le jeton de la personne ; il se partage par la feuille de partage du téléphone (WhatsApp, e-mail) ;
  - **réglages en base** : identité légale, délai de paiement (`invoice_due_days`, 30 jours par défaut) et validité des devis (`quote_validity_days`, 30 jours) dans `organizations`, modifiables dans Paramètres ;
  - **droits** : propriétaire et gérants font les documents (`documents.manage`) ; le lecteur les consulte (`documents.read`) ; un vendeur n'y a pas accès (le menu ne les montre pas).
- **Limites** : pas de logo sur le PDF ; pas d'envoi d'e-mail par le serveur (partage par le téléphone) ; avoir uniquement total (pas d'avoir partiel) ; pas de facture d'acompte ; documents en ligne uniquement (pas de création hors ligne).

## ADR-027 — Trésorerie et statistiques calculées, jamais stockées

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-25, Phase 13).
- **Contexte** : le commerçant doit savoir combien il a gagné et où est son argent, sans double saisie et sans écart possible entre ventes, factures et caisses.
- **Décision** :
  - **caisses** (`cash_accounts`) créées pour chaque boutique (trigger à la création, migration pour les existantes) : « Caisse » (espèces), un compte par opérateur Mobile Money (Wave, Orange Money, Free Money, autre) et « Banque ». Une seule caisse espèces par boutique au MVP ;
  - **chaque paiement va dans la caisse de son moyen** : espèces → Caisse, Mobile Money → compte de l'opérateur, carte, virement et chèque → Banque ; le crédit n'apporte pas d'argent. Rien n'est saisi deux fois ;
  - **le solde n'est jamais stocké** : il est calculé à chaque lecture à partir de ce qui enregistre déjà l'argent (paiements des ventes, remboursements des clients, paiements de factures hors ceux recopiés d'une vente) et de ce que cette phase ajoute (dépenses, transferts, écarts de clôture), plus l'**argent de départ** saisi par le gérant. Une vente annulée rend son argent le jour de l'annulation ;
  - **dépenses** avec catégorie portant son **compte SYSCOHADA** (catégories par défaut modifiables, plafond en base) ; elles ne s'effacent pas, elles s'**annulent** avec un motif (trigger) ;
  - **transferts** entre caisses (dépôt à la banque, retrait Mobile Money) : l'argent change de caisse sans entrer ni sortir de la boutique ;
  - **clôture de caisse** : le serveur calcule ce qui devrait y avoir à la fin du jour, la personne saisit ce qu'elle a compté ; l'écart est enregistré et devient un mouvement du jour, si bien que le lendemain part de ce qui était réellement là. Une journée clôturée **ne change plus** : dépense, transfert, annulation de dépense ou argent de départ à cette date ou avant sont refusés. Une clôture par caisse et par jour, toujours après la précédente ;
  - **statistiques** par période (un an au plus) dans le fuseau de la boutique : chiffre d'affaires, nombre de ventes, panier moyen, ventes par jour, par moyen de paiement, produits les plus vendus, produits en stock sans vente, dépenses ; ventes annulées exclues ; remise répartie au prorata des lignes ;
  - **marge brute honnête** : le prix d'achat est désormais **figé sur chaque ligne de vente** (`sale_lines.unit_cost`) ; la marge ne porte que sur les lignes dont le coût était connu et la page dit quelle part du chiffre d'affaires elle couvre ;
  - **comparaison entre boutiques** : `GET /stats/shops` parcourt les boutiques de la personne et ne retient que celles où son rôle permet de lire les statistiques, l'appartenance étant vérifiée pour chacune ;
  - **droits** : propriétaire et gérants gèrent l'argent (`treasury.manage`) ; le lecteur (comptable) lit statistiques et trésorerie ; un vendeur n'y a pas accès.
- **Limites** : une vente faite hors ligne et envoyée après la clôture de son jour fausse cette clôture et ressort en écart à la clôture suivante (d'où le conseil d'envoyer les ventes avant de clôturer) ; achats de marchandises non reliés au stock (à saisir comme dépense « Achat de marchandises ») ; pas de justificatif photo des dépenses (Phase 14) ; ventes d'avant cette phase sans coût d'achat, donc hors marge ; calcul à la lecture, à revoir par des agrégats si une boutique dépasse quelques centaines de milliers d'opérations.

## ADR-028 — Comptabilité : système minimal de trésorerie (SMT) SYSCOHADA

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-25, Phase 14).
- **Contexte** : les très petites entités relevant du SYSCOHADA révisé peuvent tenir un **système minimal de trésorerie** : un journal des recettes et des dépenses et un état de fin d'exercice. Le commerçant ne doit rien saisir de plus que ses ventes, paiements et dépenses ; le comptable doit pouvoir tout reprendre.
- **Décision** :
  - **comptabilité de trésorerie** : une recette est de l'argent reçu, une dépense de l'argent sorti, à la date du mouvement. Le journal est **calculé** à partir des mouvements de la trésorerie (ADR-027), jamais saisi ni stocké : il ne peut pas diverger des caisses ;
  - **comptes du plan SYSCOHADA révisé** : 70 « Ventes » pour les encaissements (ventes au comptoir, remboursements des clients, paiements de factures ; une vente annulée vient en déduction), compte de la catégorie pour une dépense, 585 « Virements de fonds » pour un transfert entre caisses, 658 / 758 pour un manquant / un excédent de caisse ; trésorerie : 571 Caisse, 55 monnaie électronique (Mobile Money), 521 Banques ;
  - **pièces** : chaque ligne porte sa pièce (n° de ticket, n° de facture) ; les dépenses reçoivent un **numéro de pièce** `DEP-AAAA-NNNN` attribué par le serveur, par boutique et par année de la dépense, sans trou (compteur verrouillé, ADR-026) ; les dépenses existantes ont été numérotées par la migration dans l'ordre de leur saisie ; une dépense annulée garde son numéro ;
  - **justificatif** : une photo par dépense (WebP, JPEG ou PNG, 512 Ko au plus, réduite sur le téléphone, signature vérifiée), remplaçable mais jamais supprimée ;
  - **exercice = année civile** (SYSCOHADA) ; l'**état de fin d'exercice** donne les recettes et les dépenses par compte, le résultat (recettes − dépenses), la trésorerie au début et à la fin par caisse (sa variation égale le résultat, les transferts étant neutres), les créances clients et les factures à encaisser à la date de fin, et le stock estimé au prix d'achat actuel ; l'exercice en cours est marqué **provisoire** ;
  - **exports CSV** pour le comptable : séparateur `;`, UTF-8 avec BOM et fins de ligne CRLF (ouverture directe dans un tableur réglé en français), dates `JJ/MM/AAAA`, montants sans séparateur de milliers ;
  - **droits** : `accounting.read` pour le propriétaire, les gérants et le lecteur (le comptable) ; un vendeur n'y a pas accès.
- **Reporté** : clôture définitive d'un exercice (verrou des dépenses et transferts de l'année), export PDF, partie double (journaux, grand livre, balance), dettes fournisseurs et achats à crédit, immobilisations.

## ADR-029 — Offres et quotas, sans prestataire de paiement

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-25, Phase 15). Pas de prestataire de paiement pour l’instant (décision du propriétaire du 2026-10-25).
- **Contexte** : le modèle économique repose sur des offres par boutique. Le propriétaire a fixé la grille le 2026-10-25 ; il n'a pas encore choisi de prestataire de paiement (Mobile Money), qui ne doit pas être intégré sans sa décision.
- **Décision** :
  - **offres en base** (`plans`), modifiables sans déploiement : **Gratuit** (0 F : 50 produits, 2 personnes, 1 téléphone de caisse), **Essentiel** (5 000 F par mois : 500, 5, 3), **Pro** (15 000 F par mois : 5 000, 20, 10) — limites de produits remplacées par l'ADR-033 (3, 10, sans limite). Ventes, factures, trésorerie et comptabilité sont dans toutes les offres ;
  - **un abonnement par boutique** (`subscriptions`) : une nouvelle boutique démarre en Gratuit ; les boutiques créées avant cette phase sont passées en **Pro** (décision du propriétaire : personne ne perd rien) ;
  - **les limites de l'offre deviennent les plafonds de la boutique** (`organizations.max_products`, `max_members`, `max_devices`), recopiés par un trigger à chaque changement d'offre. Les contrôles déjà en place à chaque création s'appliquent donc sans code nouveau ; un nouveau plafond, **`max_members`**, compte les personnes actives (et, à l'invitation, les invitations en attente), vérifié à l'invitation, à l'acceptation et à la réactivation, sous verrou de la boutique ;
  - **passer à une offre plus petite ne retire rien** : ce qui existe reste ; seules les nouvelles créations au-delà de la limite sont refusées, avec un message qui renvoie vers « Abonnement » ;
  - **changement d'offre** : l'API ne peut pas modifier un abonnement (aucun droit en base). Le propriétaire **demande** une offre (une demande en cours à la fois, annulable, auditée, jamais supprimée) ; la plateforme fait le changement, en attendant le paiement en ligne et l'administration de la plateforme (Phase 16) ;
  - **droits** : propriétaire et gérants voient l'abonnement (`subscription.read`) ; seul le propriétaire demande un changement (`subscription.manage`) ; la grille des offres est lisible par toute personne connectée.
- **Reporté** : paiement en ligne et renouvellement automatique (prestataire à choisir par le propriétaire), facturation de l'abonnement, période d'essai, offre annuelle.
- **Points d'attention** : une boutique existante qui avait plus de 10 téléphones de caisse les garde mais ne peut plus en ajouter (le plafond était de 20) ; une demande de changement n'est traitée que par la plateforme, à la main, jusqu'à la Phase 16.

## ADR-030 — Administration de la plateforme et observabilité

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-25, Phase 16).
- **Contexte** : sans paiement en ligne, les demandes de changement d'offre (ADR-029) doivent être traitées par quelqu'un ; la plateforme doit aussi voir la santé de la synchronisation et les boutiques proches de leurs limites, sans jamais lire leurs ventes, produits ou clients.
- **Décision** :
  - **administrateurs de la plateforme** dans une table à part (`platform_admins`), **ajoutés uniquement en SQL** par le propriétaire : aucun endpoint n'en crée. Un administrateur n'est membre d'aucune boutique : les routes des boutiques lui restent fermées (404) ;
  - **endpoints `/api/v1/admin/*`** protégés par une garde qui relit la table à chaque requête ; ils ne renvoient que des comptes, des offres et des agrégats (nombre de produits, de personnes, de téléphones, date de la dernière vente), jamais de contenu métier ;
  - **demandes d'offre** : l'administrateur accepte (l'offre change, la demande est close) ou refuse, avec une remarque ; il peut aussi changer l'offre d'une boutique directement (paiement reçu hors application). L'API reçoit pour cela le droit de modifier l'offre d'un abonnement, protégé par la garde ;
  - **suspension** d'une boutique avec un motif : ses membres n'y ont plus accès (la boutique disparaît de leur liste) ; rien n'est effacé ; la réactivation rend tout ;
  - **transparence** : chaque action de la plateforme sur une boutique est inscrite dans **l'historique de cette boutique** (« Nagaw (plateforme) »), visible par son propriétaire ;
  - **métriques de synchronisation** : chaque lot reçu (acceptées, doublons, refusées) et chaque refus avec son motif sont désormais **enregistrés en base** (ajout seul) ; vue par jour, motifs les plus fréquents, téléphones silencieux ;
  - **alertes calculées** à l'ouverture du tableau de bord, avec des **seuils en base** (`platform_settings`) : taux de refus hors ligne sur 7 jours (5 % par défaut), quota presque atteint (90 %), téléphone sans envoi depuis 3 jours, demandes d'offre en attente ;
  - **espace web séparé** `/admin`, lien « Administration de la plateforme » affiché aux seuls administrateurs.
- **Reporté** : envoi des alertes (e-mail, SMS, WhatsApp : prestataire à choisir), métriques HTTP par route (fournies par Vercel en attendant), gestion des administrateurs dans l'application, effacement d'une boutique.

## ADR-031 — Garde-fous de stabilisation

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-25, Phase 17).
- **Contexte** : avant le pilote, chaque règle de sécurité doit être vérifiée automatiquement, pour qu'une phase future ne puisse pas la casser sans que la CI le voie.
- **Décision** :
  - **inventaire des routes** : un test d'intégration énumère toutes les routes de l'API depuis le routeur et vérifie que chacune refuse une requête sans session (401) et, pour toute route d'une boutique, une personne qui n'en est pas membre (404) ; les routes d'administration refusent un propriétaire de boutique (403). Les seules exceptions (santé, profil, création de boutique, invitations, offres, comparaison entre boutiques, documentation hors production) sont listées dans le test : une nouvelle route sans contrôle fait échouer la CI ;
  - **aucun secret dans le navigateur** : la CI construit le web avec des **valeurs leurres** pour les secrets (`API_PROTECTION_BYPASS`, clé `service_role` et clé secrète Supabase, `DATABASE_URL`), puis `scripts/check-client-bundle.mjs` vérifie qu'aucune n'apparaît, ni aucune forme de clé privilégiée, dans le JavaScript client et les pages pré-rendues ; gitleaks ignore ces seuls leurres (`.gitleaks.toml`) ;
  - **dépendances** : `pnpm audit --prod --audit-level high` en CI ; une dépendance transitive vulnérable est corrigée par une surcharge datée (`pnpm-workspace.yaml`) ;
  - **en-têtes de sécurité du site** : `X-Frame-Options: DENY` et `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, HSTS, `Permissions-Policy` (caméra seule), `base-uri`, `form-action` et `object-src` restreints. **Pas encore de CSP sur les scripts** : Next.js insère des scripts en ligne qui demanderaient des nonces (et rendraient toutes les pages dynamiques) ;
  - **base injoignable = 503, pas 500** : une connexion à Postgres qui n'aboutit pas (délai dépassé, refus, trop de connexions) répond `503 DATABASE_UNAVAILABLE` « réessayez », que la caisse hors ligne traite comme un envoi à reporter ; le délai d'ouverture d'une connexion devient réglable (`DATABASE_CONNECT_TIMEOUT_MS`, 5 s par défaut, inchangé en production) ;
  - **budget de poids** des pages clés (caisse, accueil, produits, statistiques, factures) au premier chargement, compressé : 300 Ko de JavaScript et 450 Ko au total, vérifié en end-to-end.
- **Reporté** : CSP complète avec nonces, limitation de débit applicative (l'API sur Vercel est sans état : à faire au niveau de la plateforme ou d'un service tiers), mesure de performance sur appareil réel pendant le pilote.

## ADR-032 — Outillage du pilote : avis dans l'application et test de fumée

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-25, Phase 18).
- **Contexte** : pendant le pilote, chaque difficulté d'un commerçant doit remonter sans friction, et chaque déploiement de production être vérifié sans attendre qu'un commerçant tombe sur un problème.
- **Décision** :
  - **« Donner mon avis »** dans le menu de toute personne d'une boutique (vendeurs compris) : problème, idée ou question, avec la page d'où elle écrit (chemin seul, jamais l'adresse complète ni ses paramètres) ; elle retrouve ses messages et la réponse de l'équipe ; la plateforme les lit et y répond dans **Administration → Avis** ; un message n'est jamais modifié ni supprimé (trigger), seuls son statut et la réponse changent ; chaque réponse est inscrite dans l'historique de la boutique ;
  - **test de fumée** en lecture seule (`pnpm smoke <site> <API>`) : santé de l'API, routes fermées sans session, pas de documentation en production, pages et en-têtes de sécurité, application installable, aucun secret dans les pages ni le JavaScript téléchargé ; lancé par GitHub quand Vercel signale le déploiement réussi du site sur `main` (statut de commit « Vercel – nagaw-web »), et à la demande ;
  - **plan du pilote et protocole de test utilisateur** dans `docs/PILOT.md`, avec les décisions qui reviennent au propriétaire.
- **Reporté** : notification de l'équipe à chaque nouvel avis (prestataire d'envoi à choisir) ; pièces jointes (capture d'écran) dans un avis.

## ADR-033 — Limite de produits des offres : 3, 10, sans limite

- **Statut** : **Acceptée** (décision du propriétaire, 2026-10-26).
- **Contexte** : la grille de l'ADR-029 donnait 50, 500 et 5 000 produits. Le propriétaire la resserre pour que l'offre Gratuit serve à essayer et que l'offre Pro n'ait pas de plafond.
- **Décision** :
  - **Gratuit** : 3 produits ; **Essentiel** : 10 produits ; **Pro** : **sans limite**. Les autres limites (personnes, téléphones de caisse) et les prix ne changent pas ;
  - « sans limite » est un plafond **vide** (`null`) dans `plans.max_products` et `organizations.max_products`, jamais un grand nombre présenté comme illimité ; l'API ne vérifie alors rien, l'écran affiche « Produits sans limite », l'administration ne lève pas d'alerte de quota ;
  - chaque boutique prend le plafond de son offre (migration `20261026090000_plan_product_limits.sql`) ; comme pour tout passage à une offre plus petite (ADR-029), **les produits déjà créés sont gardés**, seuls les nouveaux sont refusés au-delà du plafond.
- **Conséquence** : une boutique Gratuit qui avait plus de 3 produits (ou Essentiel plus de 10) ne peut plus en ajouter sans changer d'offre.

## ADR-034 — Grille des offres publique, affichée sur la page d'accueil

- **Statut** : **Proposée** (demande du propriétaire du 2026-10-26 : « mettre les tarifs sur le landing page »).
- **Contexte** : la page d'accueil doit montrer les tarifs. Prix et limites sont en base (ADR-029, ADR-033) et ne doivent jamais être écrits dans la page ; `GET /api/v1/plans` demandait une session.
- **Décision** :
  - `GET /api/v1/plans` devient **public** (`@Public`) : la grille ne contient que des noms, des prix et des limites, aucune donnée de boutique ; toutes les autres routes de l'abonnement restent protégées ;
  - la page d'accueil lit la grille **au moment de la requête** (section « Tarifs », sous `<Suspense>`) ; si l'API ne répond pas, elle le dit sans afficher de prix ;
  - le changement d'offre se demande toujours depuis l'application (ADR-029), sans paiement en ligne.
- **Conséquence** : un changement de prix en base apparaît sur la page d'accueil sans redéploiement. L'inventaire des routes (`routes.integration-spec.ts`) classe la route comme publique, et un test vérifie que la grille servie sans session est identique à celle servie avec.

## ADR-035 — Référencement (SEO et GEO) et guides publics

- **Statut** : **Proposée** (demande du propriétaire du 2026-10-26 : « améliorer le référencement SEO, GEO, ajouter un blog et 20 articles »).
- **Contexte** : le site public se résumait à la page d'accueil, sans `robots.txt`, plan du site, URL canonique, image de partage ni données structurées. Les commerçants cherchent des réponses à leurs problèmes (stock, caisse, crédit, TVA, SYSCOHADA) sur Google et, de plus en plus, auprès d'assistants IA.
- **Décision** :
  - **guides** sous `/blog` : articles écrits dans le dépôt (`apps/web/src/content/blog/*.ts`) dans un **sous-ensemble de Markdown** (titres, listes, tableaux, encadrés, gras, liens) analysé par `lib/blog/markdown.ts` et rendu par React, sans HTML brut ni nouvelle dépendance ; pages statiques (`generateStaticParams`), hors du proxy Supabase ;
  - **règle de contenu** (comme la page d'accueil) : toute promesse sur l'application est une fonction livrée, chaque chiffre d'exemple est présenté comme un exemple, aucun prix d'offre n'est écrit (ADR-029), aucun témoignage ni auteur inventé (« l'équipe Nagaw Business ») ; les sujets fiscaux et comptables renvoient au comptable ou à l'administration ;
  - **structure pensée pour les moteurs et les assistants (GEO)** : réponse dès le premier paragraphe, encadré « En bref », intertitres en questions, tableaux, questions fréquentes, date de mise à jour visible, maillage interne entre guides ;
  - **SEO technique** : `metadataBase` depuis `SITE_URL`, URL canoniques, Open Graph et image de partage générée (`next/og`) pour l'accueil et chaque guide, `robots.txt` (pages privées exclues, robots des assistants IA nommés et admis), `sitemap.xml`, **`llms.txt`** généré à partir des mêmes données ; une prévisualisation Vercel (`VERCEL_ENV` ≠ `production`) est fermée à l'indexation ;
  - **données structurées JSON-LD** : `Organization`, `WebSite`, `SoftwareApplication` (offres lues dans la grille en base), `FAQPage` sur l'accueil ; `Blog`, `BlogPosting`, `BreadcrumbList`, `FAQPage` sur les guides ;
  - **garde-fous** : un test unitaire refuse un lien interne cassé, un slug en double, une description hors 110–165 caractères, un titre de plus de 60 caractères ou un article trop court ; des tests de bout en bout vérifient robots, plan du site, `llms.txt`, données structurées et accessibilité (axe) des guides.
- **Reporté** : interface d'édition des articles (un article s'ajoute par un fichier et une revue de code), auteurs nommés, Google Search Console et Bing Webmaster Tools (comptes du propriétaire), traduction.
- **Conséquence** : publier un guide = ajouter un fichier dans `content/blog` et l'inscrire dans `content/blog/index.ts` ; il apparaît dans la liste, le plan du site et `llms.txt` au déploiement suivant.

## ADR-036 — Notifications, accès élargi des vendeurs, contrôle du stock à la vente

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-26). Demande du propriétaire du 2026-10-26 : « ajouter un système de notification intelligent, donner plus d'accès raisonnable au profil vendeur, la vente doit vérifier le stock avec possibilité d'ajuster le stock » ; choix faits le même jour : avertir et ajuster, les quatre accès vendeur proposés, notifications dans l'application et sur le téléphone, résumé chaque soir des ventes, factures et dépenses).
- **Décision** :
  - **contrôle du stock à la vente** : la caisse compare le panier au stock connu du téléphone (stock du serveur moins les ventes et plus les corrections pas encore envoyées) et affiche « Stock insuffisant » sous la ligne ; le vendeur peut **corriger le stock** sur place (quantité comptée et raison), sinon le bouton devient « Vendre quand même ». La vente n'est **jamais refusée** pour le stock (ADR-020, ADR-024) : le serveur recompte et marque la vente `stockReview` (« Stock à vérifier »), et les gérants sont prévenus ;
  - **correction de stock à la caisse** : nouvelle opération de synchronisation `stock_correction`, envoyée dans l'ordre avant la vente qui suit, idempotente, enregistrée comme mouvement `adjustment` (la **différence** comptée, pas le compte : les ventes des autres téléphones restent comptées) ; un vendeur est limité par `organizations.seller_stock_correction_max` (20 par défaut, 0 = interdit), le propriétaire et les gérants non ; chaque correction est auditée et signalée aux gérants ;
  - **accès du vendeur** (`member`), en plus de vendre et servir les clients : `stock.receive` (entrées de marchandise, pas les pertes ni l'inventaire, qui restent à `stock.move`), `stock.correct` (corrections à la caisse), `documents.read` (lire factures et devis), `quotes.manage` (préparer, modifier et faire avancer un devis ; le facturer reste à `documents.manage`), et ses **propres chiffres** (`GET /sales/my-stats` : aujourd'hui, 7 jours, panier moyen, meilleurs produits). Il ne voit toujours ni la trésorerie, ni les statistiques de la boutique, ni les ventes des autres ;
  - **notifications** : lignes en base adressées à une personne, créées **dans la transaction** de l'événement qu'elles racontent ; sujets `stock`, `controls`, `credit`, `activity`, `summary`, chacun réservé aux rôles qui ont le droit de lire ce qu'il raconte, avec un choix par défaut par rôle (le propriétaire reçoit tout, le gérant les contrôles, le stock et les crédits, le vendeur le stock) que chacun peut changer ;
  - **« intelligentes »** sans IA (ADR-007) : on prévient **une fois, quand une ligne est franchie** (stock passé sous le seuil, épuisé ; client qui atteint 80 % de son plafond), on **regroupe** ce qui se répète (une seule notification non lue « 12 ventes aujourd'hui : 145 000 F » mise à jour vente après vente ; corrections, entrées et refus du jour), on **anticipe** (produits qui tiendront moins de 3 jours au rythme des 14 derniers), on **ne répète pas** (un produit ou un client déjà annoncé n'est pas redit avant le délai), on **se tait** les jours sans activité, et on ne prévient pas la personne de ce qu'elle vient de faire ;
  - **résumé du soir** : ventes du jour comparées au même jour de la semaine précédente, ventes annulées, crédit accordé, meilleurs produits, factures émises, dépenses, produits à racheter ; préparé à `daily_summary_hour` (20 h, heure de la boutique) avec la prévision de rupture et les crédits en retard (`credit_overdue_days`, 30 jours sans remboursement) ;
  - **planification** (ADR-006) : `GET /api/v1/cron/daily`, appelé par **Vercel Cron une fois par jour à 20 h UTC** (`apps/api/vercel.json`, compatible avec toutes les offres Vercel) et protégé par `CRON_SECRET`, plus un **rattrapage à l'ouverture** de l'application (cloche ou liste). Le jour d'une boutique est **réservé dans la même transaction** que ses notifications (`daily_run_on`) : jamais préparé deux fois, repris à la tentative suivante en cas d'échec ;
  - **sur le téléphone** : **Web Push** standard (clés VAPID générées par nous, bibliothèque `web-push`, aucun prestataire payant), activé par chaque personne sur chaque téléphone ; une notification à envoyer est marquée `pending` puis réservée (`SKIP LOCKED`) et envoyée après la transaction, dans un délai borné (5 s) ; un message du même groupe remplace le précédent sur le téléphone ; un navigateur qui répond 404/410 ou échoue 5 fois est coupé. Sans clés, rien n'est marqué à envoyer et l'écran le dit ;
  - **seuils en base** (`organizations`), modifiables par le propriétaire et les gérants dans Paramètres, audités.
- **Limites** : un message push réservé puis interrompu (fonction arrêtée pendant l'envoi) n'est pas renvoyé ; sur iPhone, le push exige l'application ajoutée à l'écran d'accueil ; les notifications ne sont pas encore purgées (pas de droit `DELETE`, ADR-013) ; prévision au rythme moyen, sans saisonnalité.
- **Reporté** : e-mail, SMS et WhatsApp (prestataire à choisir, ADR-015) ; fréquence de planification plus fine (offre Vercel Pro) ; retours partiels.

## ADR-037 — La caisse s'ouvre dans toutes les circonstances

- **Statut** : **Acceptée** (demande du propriétaire du 2026-10-27 : « plus de blocage sur l'ouverture de la caisse, elle doit s'ouvrir dans toutes les circonstances »). Modifie ADR-029 pour les appareils.
- **Contexte** : une boutique arrivée au nombre d'appareils de son offre (doublons créés par la caisse, navigateurs abandonnés) ne pouvait plus enregistrer de nouveau téléphone : la caisse restait fermée.
- **Décision** :
  - le nombre d'appareils de l'offre **n'est plus un refus** : un nouveau téléphone est toujours enregistré ; le dépassement est inscrit dans l'historique (`device.registered` avec `overLimit`) et reste visible (page Abonnement, alertes de quota de l'administration). Les limites de produits et de personnes ne changent pas ;
  - la caisse s'ouvre **toujours avec la copie du téléphone** quand elle existe, quelle que soit la réponse du serveur ; les ventes attendent sur le téléphone et le bandeau dit pourquoi si elles ne peuvent pas partir ;
  - sans copie (premier passage), elle **réessaie seule** toutes les 15 secondes et au retour du réseau.
- **Limites** : sans aucune copie et sans serveur joignable, il n'y a rien à vendre (ni produits, ni appareil) : la caisse attend et réessaie ; une personne déconnectée doit se reconnecter avant le premier chargement.

## ADR-038 — Unités de vente et prix négocié

- **Statut** : **Acceptée** (demande du propriétaire du 2026-10-28 : « les articles veulent avoir plusieurs unités logiques, stockés en mètre ou en kilogramme puis vendus en mètre ou en kilogramme ; le prix de vente enregistré au départ peut être différent du prix réellement vendu à cause de la négociation » ; choix du même jour : pas de limite de négociation par défaut, elle dépend du vendeur ; pas de prix plancher ; vente sous le prix d'achat interdite aux vendeurs par défaut ; vente « pour un montant » incluse. Complément du même jour : « unités configurables et règles de négociation configurables ; à la vente on peut choisir des sous-multiples, multiples ou autres unités logiques » ; choix : conversions automatiques et modèles de la boutique, prix calculé modifiable, règles par vendeur, écrans compris). Modifie ADR-024 (limite de remise).
- **Décision** :
  - **une unité de stock par produit** (l'actuelle `products.unit`) : stock, inventaire et prix d'achat sont comptés dans cette unité ; le journal des mouvements ne change pas ;
  - **trois sortes d'unités à la vente**, au choix du vendeur quand le produit en a plusieurs :
    - **conversions automatiques** (kg → g, g → kg, L → cl et ml, ml → L, m → cm), proposées sans rien régler, au prix de l'unité de stock ; la liste est dans le code partagé (`UNIT_CONVERSIONS`), jamais en base ;
    - **unités de vente du produit** (`product_units`) : multiples (« sac de 50 kg », « carton de 24 ») ou sous-multiples (« demi-kilo », facteur 0,5), un nom, un **facteur** en unités de stock, un code-barres facultatif (unique dans la boutique, produits et unités confondus), l'autorisation des fractions ; au plus `organizations.max_product_units` par produit (10, réglable en base) ;
    - **modèles de la boutique** (`unit_templates`) : nom, unité de stock concernée et facteur, recopiés en un geste dans un produit ; changer ou retirer un modèle ne change aucun produit ; au plus `organizations.max_unit_templates` (50) ;
  - **prix d'une unité** : **calculé** par défaut (prix de l'unité de stock × stock pris, donc juste même pour 250 g), ou **fixé** pour l'unité (prix de gros d'un sac). La ligne de vente dit lequel (`price_basis` : `unit` ou `stock`) ;
  - **le facteur ne change jamais** (trigger en base) : une vente faite hors ligne avec « sac = 50 kg » est convertie avec le même nombre à son arrivée ; pour un autre conditionnement, on retire l'unité et on en crée une autre. L'unité de stock d'un produit ne change plus tant qu'il a des unités de vente ;
  - **la ligne de vente garde tout** : unité vendue, nom et facteur figés, quantité vendue, **quantité sortie du stock** (`base_quantity`, colonne calculée par la base), base du prix, prix du catalogue et **coût par unité de stock** (× `base_quantity` pour la marge) ;
  - **prix négocié** : le vendeur saisit le **montant convenu de la ligne** (`agreedTotal`), jamais un prix unitaire (28 000 F pour un sac, sans fraction de franc impossible). La ligne garde le montant du catalogue (`list_total`) et le montant payé (`line_total`) ; la remise globale reste possible et se répartit sur les montants convenus ; la taxe est extraite de ce qui est payé. La **vente « pour un montant »** (« 500 F de sucre ») est un montant convenu dont la caisse calcule la quantité ;
  - un prix négocié est un **choix**, pas une anomalie : il ne déclenche pas « Prix à vérifier » (ADR-025), réservé au catalogue changé pendant le hors-ligne ;
  - **règles de négociation réglables** : une **limite de réduction par personne** (`organization_memberships.max_discount_basis_points`, page Équipe), **vide par défaut = sans limite** ; négociations et remise sont additionnées et rapportées au montant du catalogue. Elle remplace `organizations.seller_max_discount_basis_points`, qui n'est plus lue (gardée pour le déploiement en deux temps, supprimée par une migration ultérieure). Aucun prix plancher. **Vente sous le prix d'achat** : refusée à un vendeur sauf si la boutique l'autorise (`seller_can_sell_below_cost`, page Paramètres) ; permise au propriétaire et aux gérants, et les autres gérants sont prévenus (« Vente à vérifier ») ;
  - **la caisse applique les mêmes règles avant la vente** (limite de la personne et réglage gardés avec la copie hors ligne) : le vendeur est arrêté au comptoir avec le motif, pas refusé après coup ; le serveur revérifie ;
  - **facture d'une vente** : prix du catalogue, négociations ajoutées à la remise ; une unité à prix fixe devient « Produit (sac de 50 kg) » comptée en sacs (ou en pièces) ; une unité au prix calculé est reprise dans l'unité de stock (0,25 kg à 650 F).
- **Découpage** : étape 1 (base, contrats, API, tests) et étape 2 (conversions, prix calculé, modèles, fiche produit, caisse, réglages des règles) livrées ; étape 3 à valider : entrées et inventaire par conditionnement, factures et devis multi-unités, statistiques des négociations.
- **Limites** : la facture d'une vente dont un prix a été **augmenté**, ou d'« 1,5 sac », est refusée avec un message (faire une facture à part) ; la taxe d'une facture tirée d'une vente négociée peut différer d'un franc de celle du ticket ; les entrées de stock et l'inventaire restent saisis dans l'unité de stock.
