# Exploitation

> **État** : aucun service n'est en exploitation. Ce document sera complété en Phases 13 et 15. Il fixe dès maintenant les exigences.

## Exigences

- **Santé** : `GET /api/v1/health` (liveness) et `/api/v1/health/ready` (base de données et file joignables).
- **Logs** : JSON structurés, avec `requestId`, `organizationId` et `taskId` lorsque pertinent ; secrets et données personnelles masqués.
- **Métriques** : taux de requêtes, erreurs et latence par route ; profondeur de file ; durée et échecs des exécutions ; consommation IA.
- **Alertes** : taux d'échec des tâches, file bloquée, erreurs 5xx, quotas proches de la limite.
- **Sauvegardes** : sauvegardes quotidiennes Supabase (plan Pro requis pour le PITR), avec une procédure de restauration testée sur la préproduction avant le lancement.
- **Incidents** : un runbook par scénario (base indisponible, fournisseur IA en panne, fuite de secret avec rotation des clés).
