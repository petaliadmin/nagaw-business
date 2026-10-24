# Exploitation

> **État** : aucun service n'est en exploitation. Ce document sera complété en Phases 16 et 18. Il fixe dès maintenant les exigences.

## Exigences

- **Santé** : `GET /api/v1/health` (liveness) et `/api/v1/health/ready` (base de données et clés de signature).
- **Logs** : JSON structurés, avec `requestId`, `organizationId` et `deviceId` lorsque pertinent ; secrets et données personnelles masqués.
- **Métriques** : taux de requêtes, erreurs et latence par route ; lots de synchronisation reçus, opérations refusées et leur motif, appareils non synchronisés depuis longtemps.
- **Alertes** : taux d'opérations de synchronisation refusées, erreurs 5xx, quotas proches de la limite.
- **Sauvegardes** : sauvegardes quotidiennes Supabase (plan Pro requis pour le PITR), avec une procédure de restauration testée sur la préproduction avant le lancement.
- **Incidents** : un runbook par scénario (base indisponible, synchronisation en échec, appareil perdu, fuite de secret avec rotation des clés).
