# Design et accessibilité

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

Couleurs vives, une par module, pour se repérer d'un coup d'œil. Chaque couleur a trois teintes : **vive** (illustrations, icônes, grandes surfaces avec texte foncé), **foncée** (boutons et textes sur fond blanc, texte blanc dessus), **claire** (fonds de cartes et badges, texte foncé dessus). Contrastes calculés selon WCAG 2.x.

| Rôle                  | Vive      | Foncée    | Claire    | Blanc sur foncée | Foncée sur claire |
| --------------------- | --------- | --------- | --------- | :--------------: | :---------------: |
| Marque (navigation)   | `#7C3AED` | `#6D28D9` | `#EDE9FE` |      7,10 ✔      |      5,98 ✔       |
| Ventes                | `#16A34A` | `#15803D` | `#DCFCE7` |      5,02 ✔      |      4,57 ✔       |
| Produits et stock     | `#2563EB` | `#1D4ED8` | `#DBEAFE` |      6,70 ✔      |      5,49 ✔       |
| Factures et devis     | `#DB2777` | `#BE185D` | `#FCE7F3` |      6,04 ✔      |      5,14 ✔       |
| Statistiques          | `#F97316` | `#C2410C` | `#FFEDD5` |      5,18 ✔      |      4,52 ✔       |
| Comptabilité          | `#0D9488` | `#0F766E` | `#CCFBF1` |      5,47 ✔      |      4,86 ✔       |
| Erreur / danger       | `#DC2626` | `#B91C1C` | `#FEE2E2` |      6,47 ✔      |      5,30 ✔       |
| Attention (stock bas) | `#F59E0B` | `#B45309` | `#FEF3C7` |      5,02 ✔      |      4,51 ✔       |

- Texte principal `#111827` sur blanc : 17,74 ; texte secondaire `#4B5563` : 7,56 ; fond d'application `#F8F7FC`.
- Les teintes **vives** de Ventes, Statistiques, Comptabilité et Attention ne portent **jamais de texte blanc** (contraste inférieur à 4,5) : texte `#111827` dessus.
- Un mode sombre est prévu dans les jetons mais n'est pas prioritaire : en plein soleil, le mode clair est plus lisible.
- **Séries de graphiques** (ADR-041) : `--chart-1` (bleu `#2563EB`), `--chart-2` (orange `#C2410C`), `--chart-3` (violet `#6D28D9`), en sombre `#3B82F6`, `#EA580C`, `#8B5CF6`, dans cet ordre fixe ; une série seule prend `--chart-1`. Vérifiées avec l'outil de contrôle de palette (luminosité, saturation, séparation pour les daltoniens et à vue normale, contraste 3:1 sur la surface) ; toute nouvelle couleur de série passe le même contrôle. Une couleur de série ne porte jamais de texte, et chaque graphique a son tableau de chiffres.

Ces valeurs deviennent des jetons CSS (`@theme` de Tailwind 4) dans `apps/web/src/app/globals.css`, avec des noms sémantiques (`--color-sales`, `--color-sales-strong`, `--color-sales-soft`…). Aucun composant n'utilise une couleur en dur.

## Typographie

- Police : **Nunito** (choix du propriétaire, 2026-10-24) : formes arrondies et chaleureuses, très lisible, accents français complets, chiffres tabulaires disponibles. Chargée via `next/font/google`, avec repli système.
- Taille minimale **16 px** pour tout texte lisible, 18 px pour le corps sur mobile, montants principaux en 32 à 40 px gras.
- Chiffres tabulaires (`font-variant-numeric: tabular-nums`) dans les listes et les totaux.
- Texte posé sur une teinte vive : jeton `on-vivid` (`#111827`), foncé dans les deux thèmes.
- Montants formatés avec `Intl.NumberFormat('fr', { style: 'currency', currency: 'XOF' })` : `12 500 FCFA`.

## Mise en page

- **Mobile (< 768 px)** : barre de navigation en bas avec **trois entrées au plus et « Plus »**, pour garder des libellés de 16 px sur 360 px de large. Aujourd'hui : Accueil, Équipe, Historique ; Vendre, Produits et Factures les remplaceront à mesure de leur livraison. Le reste (Paramètres, boutique, compte) est dans le panneau « Plus ».
- **Tablette et ordinateur (≥ 768 px)** : barre latérale colorée, contenu en grille, écran de vente en deux colonnes (produits à gauche, panier à droite).
- Marges latérales de 16 px minimum sur mobile ; aucun défilement horizontal.
- Bandeau d'état de connexion permanent mais discret : « Hors ligne — vos ventes sont gardées sur ce téléphone » / « 3 ventes en attente d'envoi » / « Tout est à jour ».

## Accessibilité (WCAG 2.2 AA minimum)

- Cibles tactiles d'au moins **48 × 48 px**, espacées de 8 px.
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
