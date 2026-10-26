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
];
