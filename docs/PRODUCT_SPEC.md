# Spécification produit — Nagaw Business

> « Nagaw fournit des collaborateurs numériques autonomes, auxquels le dirigeant peut déléguer des responsabilités. »

## Vision

Nagaw Business est une plateforme SaaS multi-entreprises de gestion. Elle permet à un dirigeant d'organiser son équipe et de confier à ses membres des **responsabilités durables** (objectif, règles, critères de réussite), suivies et historisées. **Pour l'instant, l'application est 100 % manuelle : ni automatisation, ni agent, ni IA (ADR-017).** La vision initiale d'« agents numériques » est suspendue.

## Concepts

| Concept            | Définition                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Organisation       | Entreprise cliente (tenant). Toutes les données lui appartiennent et en sont isolées.                                                                                                                                    |
| Membre             | Utilisateur appartenant à une organisation, avec un rôle propre à cette organisation.                                                                                                                                    |
| Agent numérique    | **Suspendu (ADR-017)** : la notion d'agent a été retirée de l'application.                                                                                                                                               |
| Responsabilité     | Délégation durable confiée à un membre de l'équipe : objectif, périmètre, règles, critères de réussite, escalade. Déclenchement uniquement manuel.                                                                       |
| Tâche (exécution)  | Une exécution concrète, ponctuelle ou issue d'une responsabilité, avec ses étapes, résultats, erreurs et consommation.                                                                                                   |
| Outil              | **Suspendu (ADR-017)** : aucune action automatique.                                                                                                                                                                      |
| Politique d'action | `lecture seule` · `préparation sans exécution` · `exécution automatique dans un périmètre limité` · `approbation obligatoire` · `interdite`. Elle peut comporter des conditions, comme un seuil de montant configurable. |
| Approbation        | Décision humaine liée à une action précise et à ses paramètres. Elle devient invalide si ceux-ci changent.                                                                                                               |

## Persona principal

Le dirigeant d'une PME, qui veut déléguer des tâches récurrentes (synthèses, relances, suivi des factures) sans perdre le contrôle. Les autres personas sont les collaborateurs opérationnels (membres) et les administrateurs de la plateforme.

## Périmètre MVP

Voir [`AUDIT_PHASE_0.md` § 5](./AUDIT_PHASE_0.md#5-périmètre-mvp-proposé) et [`ROADMAP.md`](./ROADMAP.md).

## Fonctionnalités disponibles

Comptes (inscription, connexion, réinitialisation), organisations, équipe (invitations par lien, rôles, désactivation), journal d'audit, paramètres, responsabilités confiées aux membres (Phase 6, en validation). Tout est manuel.
