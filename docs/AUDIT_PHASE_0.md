# Audit du dépôt — Phase 0

Date de l'audit : 2026-10-20
Dépôt : `https://github.com/petaliadmin/nagaw-business`
Branche de travail : `claude/beautiful-cerf-cbbkzm`

## 1. Constat principal

**Le dépôt est vide.** Il ne contient aucun commit, aucune branche et aucun fichier.

Vérifications effectuées :

| Vérification | Commande / méthode | Résultat |
|---|---|---|
| Contenu du clone local | `git status`, `find . -type f` | `No commits yet`, 0 fichier hors `.git` |
| Références distantes | `git ls-remote origin`, `git fetch origin` | aucune référence |
| Branches via l'API GitHub | `list_branches` | liste vide |
| Contenu via l'API GitHub | `get_file_contents /` | `409 Git Repository is empty` |

Conséquences :

- Il n'existe **aucune architecture à préserver**, aucun code, aucune migration, aucun test, aucune configuration de déploiement et aucun secret exposé.
- Aucune vérification existante (lint, types, tests, build) ne peut être exécutée : il n'y en a pas.
- Toutes les décisions techniques doivent être prises à partir de zéro. Elles sont consignées dans [`DECISIONS.md`](./DECISIONS.md) comme des **choix par défaut réversibles**, à valider avant la Phase 1.
- Le premier push de la branche de travail créera la première branche du dépôt. GitHub la désignera automatiquement comme branche par défaut (voir § 6).

## 2. Carte des modules

| Module (prompt maître § 5) | Existe | Incomplet | Absent | Cassé |
|---|:-:|:-:|:-:|:-:|
| Tableau de bord | | | ✔ | |
| Organisations et entreprises | | | ✔ | |
| Utilisateurs, équipes, permissions | | | ✔ | |
| Agents numériques | | | ✔ | |
| Responsabilités / missions | | | ✔ | |
| Tâches, exécutions, planifications | | | ✔ | |
| Données et documents | | | ✔ | |
| Intégrations externes | | | ✔ | |
| Centre de validation | | | ✔ | |
| Notifications | | | ✔ | |
| Historique / audit | | | ✔ | |
| Paramètres et sécurité | | | ✔ | |
| Abonnements SaaS | | | ✔ | |
| Administration plateforme | | | ✔ | |
| CI/CD, déploiement | | | ✔ | |
| Documentation | | | ✔ (créée par cette phase) | |

## 3. Environnement de développement constaté

L'environnement cloud dispose des outils suivants. Le registre npm est accessible.

| Outil | Version |
|---|---|
| Node.js | 22.22.0 |
| npm / pnpm / yarn | 10.9.4 / 10.28.0 / 1.22.22 |
| Docker | 29.9.1 |
| PostgreSQL client (`psql`) | 16.15 |
| Supabase CLI | non installé (installable via `npx supabase`) |

Versions stables publiées au moment de l'audit : `next` 16.4.2, `@nestjs/core` 12.2.0, `@supabase/supabase-js` 2.118.0, `typescript` 7.0.2. Les versions exactes seront figées dans les `package.json` en Phase 1, après vérification de leur compatibilité mutuelle (en particulier TypeScript 7 avec NestJS et Next.js).

## 4. Risques identifiés

| # | Risque | Gravité | Mitigation proposée |
|---|---|---|---|
| R1 | Branche de travail devenue branche par défaut du dépôt (dépôt vide) | Moyenne | Le propriétaire crée `main` à partir de cette branche et la définit comme branche par défaut, avec protection (§ 6) |
| R2 | Fuite inter-organisations (multi-tenant) | Critique | Scoping systématique par `organization_id` résolu côté serveur + RLS en défense en profondeur + tests d'isolation obligatoires dès la Phase 2 |
| R3 | Agent IA exécutant une action non autorisée (prompt injection, sortie malveillante) | Critique | Moteur de politiques côté serveur indépendant du modèle, validation des paramètres d'outils, approbation liée à une empreinte de l'action (Phases 7–8) |
| R4 | Exposition de secrets (clé `service_role` Supabase, jetons d'intégration) | Critique | Secrets uniquement côté API, chiffrement applicatif des credentials, `.gitignore`, scan de secrets en CI |
| R5 | Coûts IA non maîtrisés | Élevée | Quotas par organisation, limites d'étapes et de jetons par exécution, mesure de la consommation à chaque appel |
| R6 | Double exécution de tâches / webhooks | Élevée | Clés d'idempotence uniques en base, verrouillage via la file de tâches |
| R7 | Traitements longs liés à une requête HTTP | Moyenne | Worker asynchrone séparé (file Postgres) dès la Phase 7 |
| R8 | Périmètre très large (15 phases) face à la capacité réelle | Élevée | MVP resserré (§ 5) ; modules non MVP masqués de la navigation tant qu'ils ne sont pas livrés |
| R9 | Marché cible et moyens de paiement non définis | Moyenne | Question ouverte Q4 ; architecture de paiement par adaptateur en Phase 12 |
| R10 | Données personnelles (RGPD / loi sénégalaise 2008-12 ou autre selon pays) | Élevée | Hébergement et rétention à confirmer (Q5), politique de rétention documentée en Phase 2 |

## 5. Périmètre MVP proposé

Le MVP couvre le **parcours de recette global** (prompt maître § 14) avec un seul type d'exécution réel et une seule intégration réelle.

Inclus dans le MVP :

1. Comptes (inscription, connexion, vérification e-mail, réinitialisation, déconnexion) via Supabase Auth.
2. Organisations multi-tenant, membres, invitations, rôles (`owner`, `admin`, `member`, `viewer`), changement d'organisation active.
3. Journal d'audit immuable.
4. Agents numériques : CRUD, statuts, instructions, modèle, outils autorisés, versions.
5. Responsabilités : CRUD, rattachement à un agent, déclencheur manuel et planifié.
6. Moteur d'exécution asynchrone : tâches, étapes, événements, limites, idempotence, annulation, reprise.
7. Politiques d'action et centre de validation : seuils configurables, approbation liée à l'empreinte de l'action.
8. Un fournisseur IA réel derrière une interface indépendante du fournisseur.
9. Une intégration réelle simple et utile : **envoi d'e-mail transactionnel** (hypothèse par défaut, voir Q3). Elle est aussi réutilisée pour les invitations et les notifications.
10. Notifications in-app, plus e-mail pour les invitations et les approbations.
11. Tableau de bord alimenté par les données réelles.
12. Quotas de base (agents, membres, consommation IA), appliqués côté serveur, avec un plan unique gratuit et sans paiement.

Hors MVP (phases ultérieures) : documents et recherche documentaire, intégrations CRM, calendrier et stockage, paiement en ligne, administration plateforme complète, internationalisation anglaise complète (préparée mais pas traduite).

## 6. Action requise du propriétaire

Le dépôt étant vide, le push de `claude/beautiful-cerf-cbbkzm` en fait la branche par défaut sur GitHub. Avant la Phase 1, il est recommandé de :

1. créer `main` à partir de cette branche (GitHub → *Branches* → *New branch*) ;
2. définir `main` comme branche par défaut (*Settings → General → Default branch*) ;
3. activer une règle de protection sur `main` (PR obligatoire, checks CI requis à partir de la Phase 1).

## 7. Questions ouvertes et hypothèses par défaut

| # | Question | Hypothèse par défaut (réversible) |
|---|---|---|
| Q1 | Le stack proposé (Next.js + NestJS + Supabase + Vercel) est-il confirmé ? | Oui, conformément au prompt maître |
| Q2 | Fournisseur IA prioritaire ? | Anthropic (Claude) en premier, derrière une interface multi-fournisseurs ; modèle configurable par variable d'environnement |
| Q3 | Première intégration réelle ? | E-mail transactionnel (Resend ou SMTP), car elle sert aussi aux invitations et notifications |
| Q4 | Marché cible / moyens de paiement ? | Afrique de l'Ouest francophone probable (nom « Nagaw ») ; prestataire de paiement à choisir en Phase 12 (Stripe, PayDunya, Wave…) |
| Q5 | Région d'hébergement des données et contraintes légales ? | Projet Supabase en région UE (Francfort ou Paris) ; politique de rétention à valider |
| Q6 | Hébergeur de l'API et du worker ? | Conteneur Docker sur Render ou Fly.io (un service API et un service worker), à confirmer en Phase 15 |
| Q7 | Langue de l'interface au lancement ? | Français, avec architecture i18n prête pour l'anglais |
| Q8 | Projet Supabase existant ? | Non ; un projet de préproduction sera à créer par le propriétaire en Phase 2 |
