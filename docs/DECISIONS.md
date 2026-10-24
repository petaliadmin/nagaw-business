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

- **Statut** : Remplacée par ADR-019 : le module Tâches est retiré sur décision du propriétaire (2026-10-24), sans avoir été validé. Les tables restent en base, inutilisées.
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

- **Statut** : **Acceptée** (validée par le propriétaire le 2026-10-24). Socle livré en Phase 8 (voir **Mise en œuvre**) ; base locale et synchronisation en Phase 11.
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
