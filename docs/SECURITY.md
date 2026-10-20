# Sécurité

> **État** : exigences et conception **proposées**. Aucun contrôle n'est encore implémenté. Chaque contrôle sera marqué « implémenté et testé » dans [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md) au moment de sa livraison.

## Principes

1. **Authentification côté serveur** : le JWT Supabase est vérifié par l'API à chaque requête (signature JWKS, `exp`, `aud`).
2. **Autorisation à chaque opération** : guards tenant et permission, plus filtre `organization_id` imposé au niveau repository. Masquer un bouton dans l'interface n'est jamais un contrôle d'accès.
3. **Aucune confiance dans le client** : `organization_id`, rôle, montant et prix sont toujours revérifiés côté serveur.
4. **Aucune confiance dans le modèle IA** : sa sortie est validée (zod), puis soumise au moteur de politiques, qui s'exécute en dehors du modèle.
5. **Secrets côté serveur uniquement** : la clé `service_role`, les clés IA et la clé maître de chiffrement ne sont jamais dans `NEXT_PUBLIC_*`. La CI vérifie le bundle.
6. **Moindre privilège** : RLS activée, aucun accès direct `anon`/`authenticated` aux tables métier, rôle Postgres dédié à l'API.
7. **Traçabilité** : chaque action sensible écrit un `audit_logs` immuable dans la même transaction.

## Menaces principales et contrôles prévus

| Menace | Contrôle | Phase |
|---|---|---|
| IDOR / accès inter-organisations | TenantGuard, repositories scopés, RLS, tests d'isolation | 2 |
| Élévation de rôle | Changements de rôle limités (un admin ne peut pas promouvoir en owner), dernier owner protégé, audit | 4 |
| Vol de jeton d'invitation | Jeton aléatoire de 256 bits, stocké hashé, expiration, usage unique, liaison à l'e-mail invité | 4 |
| Prompt injection via contenu externe | Contenu externe balisé comme non fiable, politiques hors modèle, approbation pour les actions sensibles | 7–9 |
| Contournement d'approbation | Hash canonique de l'action, contrôle au moment de l'exécution, expiration | 8 |
| Fuite de credentials d'intégration | AES-256-GCM, jamais renvoyés, logs masqués (redaction pino) | 9 |
| Fichiers dangereux | Liste blanche MIME + vérification de signature, taille max, URLs signées courtes | 10 |
| Rejeu de webhooks | Signature vérifiée, `UNIQUE(provider, event_id)` | 12 |
| Abus / brute force | Throttling sur auth, invitations, déclenchement de tâches | 2–7 |
| Explosion des coûts IA | Quotas par organisation, `max_steps` et `max_tokens` par exécution | 7 |
| Admin plateforme trop puissant | Pas d'accès au contenu métier, actions auditées | 13 |
