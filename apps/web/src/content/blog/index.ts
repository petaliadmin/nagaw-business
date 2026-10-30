import type { Article } from '@/lib/blog/types';
import { article as applicationCaisseTelephone } from './application-caisse-telephone';
import { article as calculTva } from './calcul-tva-18-ht-ttc';
import { article as calculerMarge } from './calculer-marge-benefice';
import { article as clotureDeCaisse } from './cloture-de-caisse';
import { article as creditClients } from './credit-clients-boutique';
import { article as eviterVols } from './eviter-vols-pertes-boutique';
import { article as faireUnDevis } from './faire-un-devis';
import { article as faireUnInventaire } from './faire-un-inventaire';
import { article as gererVendeurs } from './gerer-vendeurs-boutique';
import { article as boutiqueTelephones } from './gestion-boutique-telephones';
import { article as gestionDeStock } from './gestion-de-stock-boutique';
import { article as quincaillerie } from './gestion-quincaillerie';
import { article as logicielGestion } from './logiciel-gestion-boutique';
import { article as mentionsFacture } from './mentions-obligatoires-facture-senegal';
import { article as reapprovisionnement } from './reapprovisionnement-stock-dormant';
import { article as cahierDeVentes } from './remplacer-cahier-de-ventes';
import { article as waveOrangeMoney } from './suivre-wave-orange-money';
import { article as syscohada } from './syscohada-commercant';
import { article as tresorerie } from './tresorerie-petit-commerce';
import { article as vendreSansInternet } from './vendre-sans-internet';
import { article as gestionEntrepriseServices } from './gestion-entreprise-services';
import { article as gestionSalonCoiffure } from './gestion-salon-coiffure';
import { article as gestionAtelierCouture } from './gestion-atelier-couture';
import { article as gestionGarage } from './gestion-garage-mecanique';
import { article as gestionSuperette } from './gestion-superette-alimentation';
import { article as gestionPretAPorter } from './gestion-boutique-pret-a-porter';
import { article as ouvrirBoutique } from './ouvrir-boutique-senegal';
import { article as fixerPrix } from './fixer-prix-de-vente';
import { article as seuilRentabilite } from './seuil-de-rentabilite';
import { article as fondsDeRoulement } from './fonds-de-roulement-boutique';
import { article as separerArgent } from './separer-argent-perso-boutique';
import { article as stockSecurite } from './stock-de-securite';
import { article as detailEtGros } from './vente-detail-et-gros';
import { article as vendreWhatsapp } from './vendre-sur-whatsapp';
import { article as fideliserClients } from './fideliser-clients-boutique';
import { article as factureTelephone } from './faire-facture-telephone';
import { article as factureProforma } from './facture-proforma-devis';
import { article as factureAvoir } from './facture-avoir';
import { article as relancerImpayee } from './relancer-facture-impayee';
import { article as impotsSenegal } from './impots-commercant-senegal';

/** Every article, in reading order for a new shopkeeper (the guide first). */
export const ARTICLES: Article[] = [
  logicielGestion,
  applicationCaisseTelephone,
  vendreSansInternet,
  cahierDeVentes,
  gestionDeStock,
  faireUnInventaire,
  reapprovisionnement,
  creditClients,
  clotureDeCaisse,
  calculerMarge,
  waveOrangeMoney,
  tresorerie,
  mentionsFacture,
  faireUnDevis,
  calculTva,
  syscohada,
  gererVendeurs,
  eviterVols,
  boutiqueTelephones,
  quincaillerie,
  gestionEntrepriseServices,
  gestionSalonCoiffure,
  gestionAtelierCouture,
  gestionGarage,
  gestionSuperette,
  gestionPretAPorter,
  ouvrirBoutique,
  fixerPrix,
  seuilRentabilite,
  fondsDeRoulement,
  separerArgent,
  stockSecurite,
  detailEtGros,
  vendreWhatsapp,
  fideliserClients,
  factureTelephone,
  factureProforma,
  factureAvoir,
  relancerImpayee,
  impotsSenegal,
];
