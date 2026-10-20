# Spécification produit — Nagaw Business

> « Nagaw fournit des collaborateurs numériques autonomes, auxquels le dirigeant peut déléguer des responsabilités. »

## Vision

Nagaw Business est une plateforme SaaS multi-entreprises de gestion et d'orchestration. Elle permet de connecter des données et des outils métier à des **agents numériques**, et de leur confier des **responsabilités durables**. Ces agents agissent dans les limites d'autorisations explicites, sous la supervision humaine du dirigeant. Ce n'est pas un chatbot.

## Concepts

| Concept | Définition |
|---|---|
| Organisation | Entreprise cliente (tenant). Toutes les données lui appartiennent et en sont isolées. |
| Membre | Utilisateur appartenant à une organisation, avec un rôle propre à cette organisation. |
| Agent numérique | Collaborateur numérique configuré : instructions, modèle IA, outils autorisés, limites, politique d'erreur. Versionné. |
| Responsabilité | Délégation durable confiée à un agent : objectif, périmètre, règles, déclencheurs, critères de réussite, escalade. |
| Tâche (exécution) | Une exécution concrète, ponctuelle ou issue d'une responsabilité, avec ses étapes, résultats, erreurs et consommation. |
| Outil | Capacité d'action ou de lecture exposée aux agents (ex. envoyer un e-mail), soumise à une politique. |
| Politique d'action | `lecture seule` · `préparation sans exécution` · `exécution automatique dans un périmètre limité` · `approbation obligatoire` · `interdite`. Elle peut comporter des conditions, comme un seuil de montant configurable. |
| Approbation | Décision humaine liée à une action précise et à ses paramètres. Elle devient invalide si ceux-ci changent. |

## Persona principal

Le dirigeant d'une PME, qui veut déléguer des tâches récurrentes (synthèses, relances, suivi des factures) sans perdre le contrôle. Les autres personas sont les collaborateurs opérationnels (membres) et les administrateurs de la plateforme.

## Périmètre MVP

Voir [`AUDIT_PHASE_0.md` § 5](./AUDIT_PHASE_0.md#5-périmètre-mvp-proposé) et [`ROADMAP.md`](./ROADMAP.md).

## Fonctionnalités disponibles

**Aucune à ce jour.** Cette section listera uniquement les fonctionnalités réellement livrées et testées. Les exemples d'agents (commercial, financier, marketing, RH, direction, service client) sont des **cibles** et ne doivent pas être présentés comme disponibles.
