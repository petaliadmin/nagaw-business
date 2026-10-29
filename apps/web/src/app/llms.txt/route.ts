import { getArticles } from '@/lib/blog/articles';
import { CATEGORIES } from '@/lib/blog/types';
import { siteUrl } from '@/lib/env';
import { SITE_NAME, SITE_SUMMARY } from '@/lib/seo';

/**
 * llms.txt (https://llmstxt.org): a plain summary of the site for AI
 * assistants, with what the product does, its limits, and the guides.
 * Built from the same data as the pages, so that it never drifts.
 */
export function GET() {
  const base = siteUrl();
  const guides = getArticles()
    .map(
      (article) =>
        `- [${article.title}](${base}/blog/${article.slug}) (${CATEGORIES[article.category].label}) : ${article.description}`,
    )
    .join('\n');

  const body = `# ${SITE_NAME}

> ${SITE_SUMMARY}

## Le produit

- Application web en français, qui s’ouvre dans le navigateur d’un téléphone ou d’un ordinateur et s’ajoute à l’écran d’accueil ; rien à télécharger dans un magasin d’applications.
- Caisse : grandes tuiles produits, monnaie à rendre, paiement en espèces, Mobile Money (opérateur et numéro de transaction), carte, crédit ou plusieurs moyens ; ticket imprimable au format 58 mm ou envoyé sur WhatsApp.
- Connexion : pour l’instant, la caisse enregistre chaque vente sur le serveur et demande une connexion internet, comme les autres écrans.
- Stock : entrées de marchandise, pertes, inventaire avec écart, seuil d’alerte par produit ; unités pièce, carton, paquet, sachet, bouteille, sac, kg, g, litre, ml, mètre.
- Clients : crédit avec plafond par client, liste « Ils me doivent », remboursements.
- Trésorerie : caisses Caisse, Wave, Orange Money, Free Money, autre Mobile Money et Banque ; soldes calculés, dépenses avec justificatif photo, clôture de caisse. L’application n’est pas reliée aux comptes Wave ou Orange Money : elle calcule le solde attendu à partir de ce qui est enregistré.
- Factures, devis et avoirs numérotés par le serveur, en PDF, avec TVA par taux.
- Statistiques : chiffre d’affaires, panier moyen, marge brute, dépenses, bénéfice estimé, produits les plus vendus et ceux qui ne se vendent pas.
- Comptabilité : système minimal de trésorerie du SYSCOHADA révisé (journal des recettes et dépenses, état de fin d’exercice, exports CSV) ; pas de partie double.
- Équipe : rôles propriétaire, gérant, vendeur et lecteur ; historique des actions ; plusieurs boutiques par compte.
- Offres : une offre gratuite pour commencer, sans carte bancaire ; les offres payantes changent seulement les limites (produits, personnes, téléphones). Tarifs à jour : ${base}/#tarifs. Pas encore de paiement en ligne de l’abonnement.
- Données hébergées sur des serveurs en France.

## Pages

- [Accueil](${base}/) : présentation, captures d’écran, tarifs et questions fréquentes.
- [Guides](${base}/blog) : conseils de gestion pour les commerçants d’Afrique de l’Ouest.
- [Créer un compte](${base}/inscription)

## Guides

${guides}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
