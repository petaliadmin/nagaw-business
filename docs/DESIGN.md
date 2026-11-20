# Design et accessibilité

> **V3 « Teranga » du 2026-11-18 (ADR-063)** : page blanche, cartes `#F5F5F7` sans bordure ni ombre, boutons principaux noirs en pilules, vert pour l'argent, ambre pour le crédit. Barre du bas : Accueil, Ventes, **Caisse** au centre, Stock, Argent ; « Menu » en grille. « Masquer » floute les montants. Le crédit d'un client se lit comme une discussion. Contrastes : encre `#12101C` sur blanc 18,81 ; texte secondaire `#5D5970` 6,71 sur blanc et 6,17 sur `#F5F5F7` ; marque `#4F3FD1` 7,08 ; `sales-ink` `#07603F` 7,63 ; `warning-ink` `#8A4B00` 6,25 sur `#F5F5F7` ; champs bordés de `#767189` (4,6:1). Là où les sections ci-dessous disent autre chose, ADR-063 l'emporte.
>
> **Refonte du 2026-11-16 (ADR-062)** : teintes adoucies, barre du bas à cinq entrées avec « Vendre » au centre, « Menu » dans l'en-tête, la réponse d'abord sur chaque écran, trois étapes pour vendre. Les sections ci-dessous sont à jour.
>
> **État** : accepté (ADR-021) et **implémenté en Phase 8** : jetons dans `apps/web/src/app/globals.css`, composants dans `apps/web/src/components`. Les couleurs de modules (ventes, stock, factures…) servent dès que ces modules sont livrés.

## Pour qui

Des commerçants et vendeurs **peu à l'aise avec le numérique**, sur un smartphone Android d'entrée de gamme, souvent en plein soleil, parfois avec une lecture lente du français. Chaque choix de design se juge à une question : _Moussa peut-il encaisser cette vente sans aide, du premier coup ?_

## Principes

1. **Une action principale par écran**, en gros bouton coloré en bas, à portée de pouce.
2. **Toujours une icône et un mot** : jamais d'icône seule, jamais de couleur seule pour porter un sens (statut, alerte).
3. **Les chiffres en grand** : total d'une vente, argent en caisse et stock restant sont les éléments les plus visibles de leur écran.
4. **Mots du quotidien** : « Vendre », « Ce qui reste », « Argent reçu », « On me doit », « Je dois ». Le vocabulaire comptable n'apparaît que dans le module Comptabilité.
5. **Pas d'impasse** : chaque écran vide explique quoi faire et propose le bouton pour le faire (« Ajoutez votre premier produit »).
6. **Pardonner les erreurs** : confirmation avant suppression ou annulation, « Annuler » pendant quelques secondes après une action, messages d'erreur qui disent comment corriger.
7. **Encourager** : retours visuels positifs (vente enregistrée ✓, animation sobre), sans infantiliser.

## Palette

Une couleur par module, pour se repérer d'un coup d'œil ; depuis ADR-062, la marque, le vert des ventes et l'ambre sont moins saturés, pour un écran plus calme. Chaque couleur a trois teintes : **vive** (illustrations, icônes, grandes surfaces avec texte foncé), **foncée** (boutons et textes sur fond blanc, texte blanc dessus), **claire** (fonds de cartes et badges, texte foncé dessus). Contrastes calculés selon WCAG 2.x.

| Rôle                  | Vive      | Foncée    | Claire    | Blanc sur foncée | Foncée sur claire |
| --------------------- | --------- | --------- | --------- | :--------------: | :---------------: |
| Marque (navigation)   | `#6655D6` | `#5746C9` | `#EEEBFB` |      6,72 ✔      |      7,42 ✔       |
| Ventes (émeraude)     | `#0F9D76` | `#0B7A5C` | `#E3F4EE` |      5,31 ✔      |      6,83 ✔       |
| Produits et stock     | `#2563EB` | `#1D4ED8` | `#DBEAFE` |      6,70 ✔      |      5,49 ✔       |
| Factures et devis     | `#DB2777` | `#BE185D` | `#FCE7F3` |      6,04 ✔      |      5,14 ✔       |
| Statistiques          | `#F97316` | `#C2410C` | `#FFEDD5` |      5,18 ✔      |      4,52 ✔       |
| Comptabilité          | `#0D9488` | `#0F766E` | `#CCFBF1` |      5,47 ✔      |      4,86 ✔       |
| Erreur / danger       | `#DC2626` | `#B91C1C` | `#FEE2E2` |      6,47 ✔      |      5,30 ✔       |
| Attention (stock bas) | `#F59E0B` | `#8F5A00` | `#FFF0D4` |      5,78 ✔      |      6,46 ✔       |

- Texte principal `#1C1A27` sur blanc : 17,12 ; texte secondaire `#5E5A72` : 6,60 (6,03 sur le fond) ; fond d'application `#F5F4F9`.
- Pour la marque, les ventes et l'attention, la colonne « Foncée sur claire » mesure l'**encre** (`brand-ink` `#4636B0`, `sales-ink` `#075E46`, `warning-ink` `#7A4D00`), plus sombre que la teinte foncée depuis ADR-062.
- Les teintes **vives** de Ventes, Statistiques, Comptabilité et Attention ne portent **jamais de texte blanc** (contraste inférieur à 4,5) : texte `#111827` dessus.
- Un mode sombre est prévu dans les jetons mais n'est pas prioritaire : en plein soleil, le mode clair est plus lisible.
- **Séries de graphiques** (ADR-041) : `--chart-1` (bleu `#2563EB`), `--chart-2` (orange `#C2410C`), `--chart-3` (violet `#6D28D9`), en sombre `#3B82F6`, `#EA580C`, `#8B5CF6`, dans cet ordre fixe ; une série seule prend `--chart-1`. Vérifiées avec l'outil de contrôle de palette (luminosité, saturation, séparation pour les daltoniens et à vue normale, contraste 3:1 sur la surface) ; toute nouvelle couleur de série passe le même contrôle. Une couleur de série ne porte jamais de texte, et chaque graphique a son tableau de chiffres.

Ces valeurs deviennent des jetons CSS (`@theme` de Tailwind 4) dans `apps/web/src/app/globals.css`, avec des noms sémantiques (`--color-sales`, `--color-sales-strong`, `--color-sales-soft`…). Aucun composant n'utilise une couleur en dur.

## Typographie

- Police : **Nunito** (choix du propriétaire, 2026-10-24) : formes arrondies et chaleureuses, très lisible, accents français complets, chiffres tabulaires disponibles. Chargée via `next/font/google`, avec repli système.
- **Densité native (ADR-066)** : corps du texte en **16 px**, textes secondaires (dates, détails, descriptions) en **14 px**, titres de page en 26 px, montants principaux en 28 à 36 px gras ; jamais de texte sous 14 px.
- Chiffres tabulaires (`font-variant-numeric: tabular-nums`) dans les listes et les totaux.
- Texte posé sur une teinte vive : jeton `on-vivid` (`#111827`), foncé dans les deux thèmes.
- Montants formatés avec `Intl.NumberFormat('fr', { style: 'currency', currency: 'XOF' })` : `12 500 FCFA`.

## Mise en page

- **Mobile (< 768 px)** (ADR-062) : barre de navigation en bas avec **quatre entrées au plus autour de « Vendre »**, rond vert relevé au centre : Accueil, Stock, Vendre, Crédit, Argent. Libellés de sept lettres au plus, pour rester à 16 px sur 360 px de large. « Crédit » ouvre les clients qui doivent ; un vendeur ne voit pas « Argent ». Le reste (Ventes, Factures, Fournisseurs, Dépenses, Rapports, Paramètres, compte) est dans le panneau « Menu », ouvert depuis l'en-tête.
- **La réponse d'abord** (ADR-062) : chaque écran commence par le chiffre qu'on vient chercher, en grand — « Vous avez gagné » sur l'Accueil, « On vous doit » sur Crédit, le total sur Argent — puis ce qu'il y a à faire (« À faire aujourd'hui », « Relancer », « Clôturer la caisse »). Le détail est un toucher plus loin (« Tous les chiffres »).
- **Tablette et ordinateur (≥ 768 px)** : barre latérale colorée, contenu en grille, écran de vente en deux colonnes (produits à gauche, panier à droite).
- Marges latérales de 16 px minimum sur mobile ; aucun défilement horizontal.
- **« Vendre »** : au centre de la barre du bas sur téléphone ; flottant sur Accueil et Ventes sur tablette et ordinateur, pour qui a le droit de vendre (ADR-044, ADR-062).
- **Filtres d'une liste** : dans un panneau ouvert par « Filtrer », à côté de la recherche ; le filtre choisi reste visible sur la page et se retire d'un toucher.
- **Listes longues** : 20 lignes par page, « Précédent », « Page n », « Suivant » dessous ; rien quand tout tient sur une page.
- **Harmonie des couleurs** (2026-11-03) : les couleurs de module vont sur les **icônes**, pas sur de grandes surfaces. Les chiffres clés sont sur des tuiles blanches avec une pastille d'icône colorée ; les chiffres secondaires sur un fond neutre (`surface-muted`), l'icône seule en couleur. Le vert plein est réservé au bouton « Vendre » ; la bande « Aujourd'hui » est en vert clair. Le vert est un émeraude (`#0B7A5C` depuis ADR-062). Seule grande surface de couleur : la carte « Vous avez gagné » de l'Accueil, en `brand-strong`, texte blanc (6,72:1).
- **La caisse** (2026-11-08, revue le 2026-11-16, ADR-062) : une couleur par rôle, pour que le vendeur sache d'un coup d'œil quoi toucher. Sur téléphone, trois étapes annoncées en haut (« Étape 1 sur 3 · Touchez ce que vous vendez », puis le paiement, puis le ticket), avec une barre verte qui avance. Les en-têtes des sections (Produits, Panier, Paiement) sont sobres : un titre et son icône sur pastille `brand-soft`, sans bande de couleur. **Violet de la marque** = choix : ce qui est choisi (catégorie, moyen de paiement, opérateur, somme reçue, « Vendre / Ventes ») en `brand-soft` bordé de `brand-strong`, texte `brand-ink` (7,42:1) ; liens en `brand-ink`. **Vert** = l'argent et la vente seulement : prix, total « À payer » sur `sales-soft`, et seuls boutons verts pleins « Encaisser » et « Valider la vente ». **Rouge** = retirer (« Vider le panier », corbeilles). Un choix ne ressemble jamais au bouton qui vend. Le bleu du module Produits n'y apparaît pas : la caisse est le module Ventes. Rôles posés en tête de `apps/web/src/app/caisse/checkout.tsx` (`CHOSEN`, `SECTION_HEAD`) ; étapes dans `sale-steps.tsx`.
- **Chiffres en tuile** : composant `Figure` dans un conteneur `@container` : un chiffre ne sort jamais de sa tuile et ne se coupe jamais entre ses chiffres.
- **Sensation d'application installée** : panneaux depuis le bas (composant `BottomSheet`), « Retour » dans l'en-tête des sous-pages, retour visuel au toucher (ADR-044).
- Bandeau d'état de connexion permanent mais discret : « Hors ligne — vos ventes sont gardées sur ce téléphone » / « 3 ventes en attente d'envoi » / « Tout est à jour ».

## Accessibilité (WCAG 2.2 AA minimum)

- Cibles tactiles d'au moins **44 × 44 px** (standard iPhone ; WCAG 2.2 AA en demande 24), espacées de 8 px ; un pas d'espacement vaut 44/48 de celui de Tailwind (ADR-066).
- Contraste ≥ 4,5 pour le texte, ≥ 3 pour les icônes et bordures de champs.
- Navigation complète au clavier sur ordinateur, focus visible et coloré.
- Sur un fond de couleur forte (bande de module, tuile foncée, barre latérale), anneau de focus **blanc** (`focus-visible:outline-white`) : le violet y tombe sous 3:1. Le texte sombre `on-vivid` ne va que sur les teintes vives qui le portent à 4,5:1 (vert, orange, ambre), jamais sur le violet, le bleu, le rose ou le rouge vifs.
- Quand une action fait disparaître le bouton pressé (étapes de la caisse, ticket), le focus est placé sur le titre ou le message qui suit ; un ajout au panier est annoncé par une zone `role="status"` toujours présente.
- Une liste déroulante ne déclenche jamais de navigation à elle seule : un bouton valide le choix (WCAG 3.2.2).
- Libellés visibles au-dessus des champs (pas de placeholder seul), erreurs annoncées (`aria-live`).
- Pavé numérique natif pour les quantités et montants (`inputmode="decimal"`).
- `prefers-reduced-motion` respecté ; aucune information transmise uniquement par une animation.
- Composants accessibles de type shadcn/ui (Radix), copiés dans `apps/web/src/components/ui` (ADR-002).

## Vérification

- Tests Playwright sur deux tailles d'écran (360 × 740 et 1280 × 800) pour chaque parcours.
- Contrôle automatique d'accessibilité (axe-core) dans les tests end-to-end, sans violation de niveau sérieux ou critique.
- Test utilisateur avec au moins deux commerçants réels avant le pilote (Phase 18).
