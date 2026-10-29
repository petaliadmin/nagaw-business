# Exploitation

> **État** : l'application est en production sur Vercel (web et API) avec Supabase (Postgres, authentification). Ce document décrit ce qui est en place et les procédures ; il sera complété en Phase 18 (pilote).

## Ce qui est en place

- **Santé** : `GET /api/v1/health` (vivacité) et `/api/v1/health/ready` (base de données et clés de signature Supabase ; 503 `NOT_READY` sinon).
- **Logs** : JSON structurés (pino), avec `requestId` ; en-têtes `Authorization`, cookies et corps des requêtes jamais journalisés.
- **Métriques de synchronisation** (Phase 16) : chaque lot reçu et chaque refus avec son motif sont enregistrés en base ; vue par jour, motifs les plus fréquents et téléphones silencieux dans **Administration → Synchronisation**.
- **Alertes** (Phase 16) : affichées dans **Administration → Tableau de bord**, avec des seuils réglables dans `app.platform_settings` (taux de refus hors ligne, quota presque atteint, téléphone silencieux). Elles ne sont pas encore envoyées (aucun prestataire d'e-mail ou de SMS choisi) : consulter le tableau de bord chaque jour pendant le pilote.
- **Erreurs HTTP et latence par route** : tableaux de bord Vercel des projets `nagaw-api` et `nagaw-web`.
- **Contrôles en continu** (CI, à chaque PR) : format, lint, types, tests unitaires, d'intégration (dont l'inventaire de toutes les routes de l'API) et de bout en bout, aucun secret dans ce que le navigateur télécharge, aucune dépendance vulnérable connue (`pnpm audit --prod --audit-level high`), aucun secret commité (gitleaks).

## Procédures

### Changer l'administrateur de la plateforme

La plateforme a **un seul administrateur** (ADR-039), imposé par la base. Dans l'éditeur SQL de Supabase (aucun écran ne le permet, ADR-030), retirer l'actuel puis ajouter le nouveau, en une transaction :

```sql
begin;
delete from app.platform_admins;
insert into app.platform_admins (user_id, note)
select id, 'Raison de l’accès' from app.user_profiles where lower(email) = lower('personne@exemple.com')
returning user_id;
commit;
```

Le compte doit exister (inscription faite, ou créé dans **Authentication → Users** de Supabase) ; une insertion qui ne renvoie aucune ligne signifie que l'adresse est inconnue : faire `rollback`.

### Téléphone de caisse perdu ou volé

1. **Retirer l'appareil** : le propriétaire ou un gérant, dans **Paramètres → Appareils de vente**, choisit « Retirer ». Les ventes que ce téléphone enverrait sont refusées et apparaissent dans les métriques de synchronisation.
2. **Fermer l'accès de la personne** si le téléphone restait connecté : **Équipe → Désactiver**. Toutes les routes de la boutique lui sont alors refusées, quel que soit le téléphone.
3. **Changer son mot de passe** (page « Mot de passe oublié ») ; une session déjà ouverte expire au plus tard à l'échéance de son jeton Supabase (1 heure par défaut).
4. Les ventes faites sur ce téléphone et **jamais envoyées** sont perdues : elles n'existent que sur l'appareil (ADR-025). Celles déjà envoyées restent dans la boutique.

### Suspendre une boutique (fraude, impayé)

**Administration → Boutiques → la boutique → Suspendre**, avec un motif : ses membres n'y ont plus accès ; rien n'est effacé ; le motif est inscrit dans l'historique de la boutique. « Réactiver » rend tout.

### Changer l'offre d'une boutique

Après réception du paiement (hors application, tant qu'aucun prestataire n'est choisi) : **Administration → Demandes d'offre → Accepter**, ou **Boutiques → la boutique → Changer l'offre**.

### Secret exposé (rotation)

1. Régénérer le secret chez son fournisseur : clé de signature ou mot de passe de base Supabase, `API_PROTECTION_BYPASS` (Vercel, projet `nagaw-api`).
2. Mettre à jour la variable d'environnement du projet Vercel concerné, puis redéployer.
3. Pour le mot de passe du rôle `nagaw_api`, mettre à jour `DATABASE_URL` du projet `nagaw-api`.
4. Vérifier `/api/v1/health/ready`, puis noter l'incident (date, secret, cause) dans ce document.

### Mise à jour d'une dépendance vulnérable

La CI échoue quand `pnpm audit` signale une vulnérabilité « high » ou « critical ». Mettre à jour la dépendance directe si possible ; sinon, imposer la version corrigée d'une dépendance transitive dans `overrides` (`pnpm-workspace.yaml`) avec un commentaire daté, à retirer quand la dépendance parente l'intègre.

## Reste à faire (Phase 18)

- **Sauvegardes** : sauvegardes quotidiennes Supabase (plan Pro requis pour la restauration à un instant donné), avec une restauration testée avant le pilote.
- **Envoi des alertes** une fois un prestataire choisi.
- **Runbooks** « base indisponible » et « synchronisation en échec » à écrire à partir des premiers incidents du pilote.
