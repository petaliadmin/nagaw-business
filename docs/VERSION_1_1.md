# Version 1.1 — plan

> **État** : périmètre **validé par le propriétaire le 2026-11-04** (décisions en section 6). Chaque phase démarre seulement sur son feu vert explicite (CLAUDE.md) et se termine par une PR, le rapport de fin de phase et sa validation.

## 1. Point de départ

La demande du propriétaire (2026-11-04) réunit deux choses :

1. **adapter l'application au profil de chaque client** : lui poser quelques questions (secteur, ce qu'il veut faire) et n'activer que les modules utiles ;
2. **ouvrir de nouveaux marchés** : vendeurs WhatsApp/Instagram, logiciels de niche (pharmacies, quincailleries, cliniques, auto-écoles, salles de sport), écoles privées, gestion locative, facturation et paie des PME.

Ce que dit l'existant :

- le produit est une **application de gestion de boutique** (ADR-019) : une organisation est une boutique, avec produits, stock, ventes, factures, trésorerie et comptabilité ;
- un premier réglage de profil existe déjà : `organizations.offer` (`products`, `services`, `both`), qui adapte menus et titres (ADR-047). C'est un réglage d'affichage, pas une règle ;
- **le pilote de la Phase 18 n'a pas eu lieu** : aucune boutique réelle n'a utilisé l'application (`docs/PLAN_AMELIORATION.md`). Il est mené en parallèle de la Phase 19 (D7) ;
- l'application est **100 % manuelle** (ADR-017). La 1.1 lève cette règle pour les seules relances (D1, ADR-064) ;
- aucun **prestataire de paiement** n'est intégré (ADR-029, ADR-056). La 1.1 intègre **Wave** (D2, ADR-065).

## 2. Ce que la version 1.1 contient, et ce qu'elle laisse

Les cinq marchés de la demande sont des **produits différents** : chacun a sa propre unité (l'élève, le logement, le patient, l'adhérent) et ses propres paiements récurrents. La 1.1 pose le **socle profil et modules**, ajoute **un seul nouveau marché**, les **vendeurs WhatsApp/Instagram**, avec le paiement Wave et les relances automatiques, et les **dates de péremption**. L'élargissement à d'autres activités vient en 1.2 (D6).

| Demande                                       | Version            | Pourquoi                                                                                                                                         |
| --------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Questions sur le profil, modules activés      | **1.1** (Phase 19) | Généralise ADR-047. Nécessaire à tout le reste                                                                                                   |
| Vendeurs WhatsApp/Instagram (n° 1)            | **1.1** (20 à 22)  | Catalogue, stock, clients, ventes et partage WhatsApp existent déjà. Marché le plus large, le plus facile à tester                               |
| Pharmacies, quincailleries (n° 6, partie)     | **1.1** (Phase 23) | Ce sont des boutiques. Il manque surtout lots et péremptions ; les unités de vente existent (ADR-038)                                            |
| Écoles privées (n° 2)                         | **1.2**            | Socle commun « échéances et recouvrement » (section 4), puis élèves, parents, bulletins, absences                                                |
| Gestion locative (n° 3)                       | **1.2**            | Même socle : logements, locataires, quittances. Encaissement par Wave (ADR-065)                                                                  |
| Salles de sport, auto-écoles (n° 6)           | 1.2 ou plus tard   | Même socle : adhérents ou élèves, forfaits, séances                                                                                              |
| Cliniques et cabinets : rendez-vous, dossiers | **Hors plan**      | Les données de santé demandent un hébergement, une autorisation et un avis juridique adaptés                                                     |
| Paie, IPRES, CSS (n° 5)                       | **Hors plan**      | Marché déjà occupé, règles qui changent, erreur coûteuse pour le client. À ne reconsidérer que comme niche précise, sur décision du propriétaire |
| Factures conformes DGID (n° 5)                | À vérifier         | Les factures existent (ADR-026). Ce que « conforme DGID » exige (facture normalisée, mentions, transmission) n'est pas établi : à faire vérifier |

## 3. Phases de la version 1.1

Numérotation à la suite de `docs/ROADMAP.md`. Ordre : 19 avec le pilote (D7), puis 20 après les premiers retours du pilote.

### Phase 19 — Profil de la boutique et modules (ADR-062)

> **Livrée en code le 2026-11-04**, en attente de validation. Écart au plan : modules masqués et état du questionnaire en colonnes de `organizations`, choix proposés dans `profile_choices` (voir ADR-062).

**But** : à la création, la boutique répond à quelques questions ; elle ne voit ensuite que ce qui lui sert, et peut tout changer dans Paramètres.

Questions (une par écran, réponses en grosses cartes avec icône, « Passer » toujours possible, DESIGN.md) :

1. **Votre activité** : boutique de quartier, mode et beauté, électronique et téléphones, alimentation, pharmacie, quincaillerie, restaurant, services, autre ;
2. **Ce que vous vendez** : des produits, des services, les deux (le réglage `offer` d'ADR-047, repris tel quel) ;
3. **Comment vous vendez** (plusieurs choix) : au comptoir, sur WhatsApp ou Instagram, avec livraison ;
4. **Ce que vous voulez d'abord** (plusieurs choix) : savoir ce que je gagne, suivre qui me doit, gérer mon stock, faire des factures et devis, prendre des commandes ;
5. **Vous êtes combien** : seul, 2 à 5, plus de 5.

Contenu :

- table `organization_profiles` (secteur, canaux de vente, objectifs, taille d'équipe, date des réponses) ; modules masqués et état du questionnaire en colonnes de `organizations` (`hidden_modules`, `profile_status`), l'historique des changements dans le journal d'audit. Les **activités, les objectifs et les modules que chacun affiche** sont en base (`profile_choices`), modifiables sans déploiement : aucun choix de modules codé en dur. Une activité n'apparaît dans la liste que si ses modules sont livrés : la 1.2 ajoutera école ou location par de simples lignes en base (D6) ;
- liste des modules dans `packages/shared` : Vendre, Produits et stock, Clients, Fournisseurs, Factures et devis, Trésorerie, Comptabilité, Statistiques, et les nouveaux de la 1.1 : **Commandes** (Phase 20), **Péremptions** (Phase 23) ;
- la navigation (`apps/web/src/components/shell/navigation.ts`) et le tableau de bord n'affichent que les modules actifs. « Vendre », la trésorerie et les paramètres restent toujours là ;
- **règle** : désactiver un module existant **cache, ne supprime rien et ne refuse rien** (comme ADR-047). Les nouveaux modules sont contrôlés aussi par l'API : une boutique qui n'a pas activé Commandes n'a pas de catalogue public ouvert ;
- **boutiques existantes** : tous leurs modules restent actifs ; le questionnaire leur est proposé une fois, sans obligation ;
- endpoints `GET|PUT /organizations/current/profile`, `POST /organizations/current/profile/skip` et `PUT /organizations/current/modules`, réservés au propriétaire et aux gérants, audités, avec test d'isolation inter-boutiques ;
- mesure, sans donnée personnelle : répartition des activités et des objectifs dans l'administration de la plateforme, pour choisir l'ordre des activités de la 1.2 sur des faits.

**Acceptation** : une boutique « mode, vend sur WhatsApp, veut prendre des commandes » arrive sur un menu avec Commandes et sans Comptabilité ; elle réactive Comptabilité dans Paramètres et retrouve tout ; une boutique existante ne perd aucun écran.

Taille estimée : **M**.

### Phase 20 — Catalogue en lien et commandes (ADR-063)

**But** : remplacer le cahier de commandes. Le vendeur partage un lien ; le client choisit ; la commande arrive dans l'application ; le vendeur suit paiement, livraison et relance.

Contenu :

- **catalogue public** à l'adresse `/b/{slug}` (le `slug` existe déjà sur `organizations`) : nom, logo, produits choisis par la boutique, photo, prix de vente. **Jamais** le prix d'achat, le stock exact (seulement « disponible » / « épuisé »), les clients ou les chiffres. Ouvert seulement si le module Commandes est actif et que la boutique a publié son catalogue ;
- **commande par le client** sans compte : nom, téléphone, quartier, articles. Elle arrive en « Nouvelle ». Lien « Commander sur WhatsApp » qui ouvre la conversation avec le récapitulatif ; la commande est aussi enregistrée côté boutique ;
- **commandes** (`orders`, `order_lines`) : Nouvelle → Confirmée → Payée → En livraison → Livrée, ou Annulée avec motif. Une commande livrée devient une **vente** (réutilise `sales`, ADR-024) avec son `client_operation_id` : le stock, la trésorerie et la comptabilité ne changent pas de logique. Le stock n'est sorti qu'à la vente ;
- **paiement à la main** en attendant la Phase 21 : numéros Wave et Orange Money de la boutique, montant et **référence** de commande (modèle d'ADR-056) ; le vendeur marque « Payée » à réception. Ce mode reste disponible après la Phase 21 pour les boutiques sans compte Wave Business et pour Orange Money ;
- **livraison** : frais de livraison, livreur (nom, téléphone), message prêt à envoyer au livreur sur WhatsApp (adresse, montant à encaisser) ;
- **relances préparées** : liste « À relancer » (commandes confirmées non payées, livrées non payées) avec un message WhatsApp prêt en un toucher, envoyé par le vendeur depuis son téléphone (ADR-056). Elles restent dans toutes les offres après la Phase 22 ;
- **protection du catalogue public** : limite de commandes par numéro et par minute, en base ; aucune donnée d'une autre boutique accessible ; tests d'isolation sur chaque endpoint public et privé ; test qu'aucun champ privé ne sort ;
- **offres** (D4) : Commandes dans toutes les offres ; **Gratuit limité à 30 commandes par mois**, Essentiel et Pro sans limite. Colonne `plans.max_orders_per_month`, valeur modifiable en base.

**Acceptation** : un client ouvre le lien sur un téléphone d'entrée de gamme, commande trois articles ; la commande apparaît chez le vendeur ; il la confirme, la marque payée avec la référence, l'envoie au livreur, la marque livrée ; une vente est créée, le stock baisse une seule fois ; rejouer l'opération ne crée pas de doublon.

Taille estimée : **L**.

### Phase 21 — Paiement par Wave (ADR-065)

**But** : le client paie la commande par un lien Wave ; la commande passe en « Payée » sans saisie.

Contenu :

- **l'argent va directement sur le compte Wave Business de la boutique**, jamais sur celui de Nagaw : Nagaw n'encaisse pas pour le compte de tiers. La boutique relie son compte dans Paramètres ; sa clé d'API est **chiffrée côté serveur** (ADR-009), jamais renvoyée au navigateur ni écrite dans les logs ;
- création d'une session de paiement Wave à la commande ; le lien est montré sur la page de commande et dans le message WhatsApp ;
- **confirmation par webhook Wave** : signature vérifiée, traitement idempotent (identifiant de la transaction Wave unique par boutique), montant et devise comparés à la commande. Un paiement qui ne correspond pas est signalé au vendeur, jamais appliqué en silence ;
- le paiement entre dans la trésorerie (caisse Mobile Money) avec les **frais Wave** séparés (point 3.6 du plan d'amélioration) ;
- **abonnements Nagaw** : le même mécanisme, avec le compte Wave Business de Nagaw, remplace la validation à la main d'ADR-056 quand il est vérifié ;
- **offres** (D4) : dans toutes les offres. Les frais sont ceux de Wave, payés par la boutique ; Nagaw ne prend pas de commission en 1.1 ;
- **vérification** : rien n'est annoncé comme opérationnel avant un paiement réel de bout en bout, sur un vrai compte Wave Business, en préproduction (CLAUDE.md). Le format exact de l'API et des webhooks est à lire dans la documentation Wave Business au démarrage de la phase.

**Acceptation** : un vrai paiement Wave de petit montant fait passer la commande en « Payée » ; renvoyer le même webhook ne change rien ; un webhook mal signé est refusé ; une boutique ne peut pas voir ni utiliser la clé d'une autre.

Taille estimée : **L**.

### Phase 22 — Relances automatiques par WhatsApp et SMS (ADR-064)

**But** : la boutique choisit de laisser Nagaw relancer à sa place les commandes impayées, puis, en 1.2, les échéances.

Contenu :

- **levée partielle d'ADR-017** : seules les relances deviennent automatiques, et seulement si la boutique les active. Tout le reste de l'application reste manuel ;
- **file de tâches** d'ADR-006 réactivée : table `jobs`, traitement par lots, déclenchement par Vercel Cron protégé par `CRON_SECRET`. La fréquence dépend du plan Vercel (une fois par jour sur Hobby) : à vérifier au démarrage ;
- **WhatsApp** par l'API WhatsApp Business (modèles de messages validés par Meta) et **SMS** par un prestataire sénégalais, à choisir ; WhatsApp d'abord, SMS en secours si le numéro n'a pas WhatsApp ;
- **règles en base, par boutique** : délai avant la première relance, nombre maximum de relances, heures d'envoi (pas la nuit, pas aux heures de prière choisies par la boutique), texte choisi parmi des modèles. Aucune valeur codée en dur ;
- **respect du client final** : la boutique confirme avoir l'accord de ses clients ; « STOP » arrête les envois vers ce numéro ; chaque envoi est journalisé (date, canal, résultat), sans le contenu de la conversation ;
- **coût** : chaque message a un prix chez le prestataire. Relances automatiques **à partir d'Essentiel**, avec un quota mensuel par offre en base (`plans.max_auto_reminders_per_month`, valeurs à fixer quand les prix des prestataires seront connus) ; Gratuit garde les relances préparées ;
- **vérification** : aucun envoi présenté comme opérationnel avant des messages réels reçus sur de vrais téléphones, en préproduction.

**Acceptation** : une commande confirmée non payée reçoit une relance WhatsApp au bon délai et à la bonne heure ; une seconde exécution du traitement n'envoie pas de doublon ; « STOP » arrête tout ; le quota de l'offre est respecté ; une boutique qui n'a pas activé les relances n'envoie rien.

Taille estimée : **L**.

### Phase 23 — Lots et dates de péremption

**But** : savoir ce qui va périmer et le vendre d'abord. Utile aux pharmacies, mais aussi aux cosmétiques et à l'alimentation.

Contenu :

- un produit peut **suivre ses lots** (réglage par produit) : numéro de lot facultatif, date de péremption, quantité ; l'entrée fournisseur (Phase 9) saisit le lot ;
- la vente sort le lot qui périme le premier ; le vendeur peut en choisir un autre ;
- alerte « Bientôt périmé » sur le tableau de bord, avec un délai **réglable en base** par boutique (ex. 30 jours) ; perte « Périmé » en un toucher (mouvement de stock en ajout seul, ADR-023) ;
- le stock reste la somme des mouvements ; le lot est une précision du mouvement, pas un second stock ;
- **limite pour les pharmacies** : la 1.1 ne gère ni ordonnances, ni substances réglementées, ni tiers payant. Elle ne doit pas être présentée comme un logiciel de pharmacie complet.

**Acceptation** : une entrée de deux lots à dates différentes, une vente qui sort le plus ancien, une alerte qui apparaît au bon délai, une perte « Périmé » qui baisse le stock et apparaît dans les pertes.

Taille estimée : **M**. Peut glisser en 1.2 si les Phases 21 et 22 prennent plus de temps.

### Phase 24 — Stabilisation et clôture de la 1.1

- revue de sécurité du catalogue public, des webhooks Wave et des clés chiffrées ;
- accessibilité (axe-core) et essai à 360 px sur les nouveaux parcours ;
- mise à jour de `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`, `docs/API.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`, des numéros de version (ADR-061) et du site public (nouveau guide « Vendre sur WhatsApp ») ;
- **essai avec 3 à 5 vendeurs WhatsApp réels**.

## 4. Version 1.2 : élargir selon l'activité (D6)

Décision du propriétaire : l'application s'adapte aussi à des activités qui ne sont pas des boutiques. Écoles, gestion locative, salles de sport et auto-écoles ont le même cœur : **une personne doit une somme à date régulière, il faut l'encaisser, le prouver et relancer**. La 1.2 livre donc d'abord un module commun :

- **payeurs** (élève et parent, locataire, adhérent) rattachés à un **contrat** (classe, logement, forfait) avec un **échéancier** ;
- encaissement par Wave (Phase 21) ou saisi (espèces, Orange Money), **reçu ou quittance** PDF numéroté par le serveur ;
- relances automatiques des retards (Phase 22) ;
- tableau « encaissé / attendu » : le taux de recouvrement, l'argument de vente principal ;
- puis, par activité, une couche fine : bulletins et absences (écoles), quittances et tableau du propriétaire (locatif), séances (sport).

Cela demande de **modifier ADR-019** (une organisation n'est plus seulement une boutique) et d'ajouter des modèles de prix nouveaux (par élève, par logement, à la commission). Le plan détaillé de la 1.2 sera proposé après la Phase 19, à partir des réponses réelles au questionnaire.

## 5. Correction de l'argumentaire

- **Calcul des coûts** : 25 utilisateurs × 89 € × 36 mois = 80 100 €, soit environ **52,5 millions FCFA** (1 € = 655,957 F), et non 80 millions.
- **Prix** : les prix évoqués (5 000 à 15 000 F par mois, 300 à 500 F par élève, 1 à 3 % des loyers) restent des hypothèses ; la grille actuelle est en base (ADR-029, ADR-054).

## 6. Décisions du propriétaire (2026-11-04)

| #   | Question                             | Décision                                                                                                                            |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Relances préparées ou automatiques ? | **Les deux** : préparées dans toutes les offres (Phase 20), automatiques par WhatsApp et SMS (Phase 22)                             |
| D2  | Prestataire de paiement              | **Wave** (Phase 21)                                                                                                                 |
| D3  | Périmètre de la 1.1                  | **Validé**                                                                                                                          |
| D4  | Commandes dans quelles offres ?      | Laissé au choix technique : commandes et Wave partout, 30 commandes par mois en Gratuit, relances automatiques à partir d'Essentiel |
| D5  | Argument hébergement local           | **Retiré** du plan et de l'argumentaire                                                                                             |
| D6  | Élargir au-delà de la boutique       | **Oui, selon l'activité**, en 1.2 (section 4)                                                                                       |
| D7  | Pilote et 1.1                        | **Phase 19 en parallèle du pilote**, Phase 20 après les premiers retours                                                            |

### Restent à fournir ou à choisir

| Quand             | Quoi                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Avant la Phase 21 | Un compte **Wave Business** de Nagaw avec accès à l'API, et une boutique pilote qui a le sien        |
| Avant la Phase 22 | Le compte **WhatsApp Business** (Meta) de Nagaw, le **prestataire SMS**, et le plan Vercel pour Cron |
| Avant la Phase 22 | Les quotas de relances par offre, une fois les prix des messages connus                              |
