import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/marketing/legal-page';
import {
  CONTACT_PHONE,
  CONTACT_PHONE_LINK,
  LEGAL_UPDATED,
  PUBLISHER,
} from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Nagaw Business',
  description:
    'Quelles données garde Nagaw Business, où elles sont, qui peut les voir, et comment exercer vos droits.',
  alternates: { canonical: '/confidentialite' },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Politique de confidentialité" updated={LEGAL_UPDATED}>
      <p>
        Cette page explique, avec des mots simples, ce que Nagaw Business garde
        sur vous et sur vos clients.
      </p>

      <h2>Qui est responsable</h2>
      <p>
        Nagaw Business est édité par {PUBLISHER}. Pour toute question :{' '}
        <a
          href={CONTACT_PHONE_LINK}
          className="font-semibold text-brand-ink underline underline-offset-4"
        >
          {CONTACT_PHONE}
        </a>
        .
      </p>
      <p>
        {PUBLISHER} est responsable des données de votre compte. Le commerçant
        est responsable des données de ses propres clients : {PUBLISHER} les
        garde pour lui, et ne s’en sert pas pour autre chose.
      </p>

      <h2>Ce qui est gardé</h2>
      <ul>
        <li>
          <strong>Votre compte</strong> : adresse e-mail, nom, mot de passe
          protégé, boutiques et rôle.
        </li>
        <li>
          <strong>Votre boutique</strong> : coordonnées, logo, cachet,
          signature, produits, stock, ventes, factures, devis, dépenses et
          justificatifs.
        </li>
        <li>
          <strong>Les clients de la boutique</strong> : ce que vous saisissez,
          comme le nom, le téléphone, l’adresse et ce qu’ils doivent.
        </li>
        <li>
          <strong>L’historique</strong> : qui a fait quoi et quand, et les
          informations techniques qui servent à faire marcher et à protéger le
          service.
        </li>
      </ul>

      <h2>Pourquoi</h2>
      <p>
        Pour faire fonctionner l’application, vous permettre de retrouver vos
        chiffres, gérer votre offre et protéger le service. Vos données ne sont
        ni vendues, ni utilisées pour de la publicité. Le site n’utilise pas
        d’outil de mesure d’audience.
      </p>

      <h2>Où sont les données</h2>
      <p>
        Les données sont gardées sur des serveurs en France (Paris), chez nos
        prestataires techniques : Supabase pour la base de données et Vercel
        pour l’application. Elles quittent donc le Sénégal.
      </p>
      <p>
        <strong>Sur le téléphone aussi.</strong> Pour vendre sans internet, le
        téléphone garde les produits, les prix, les clients et les ventes de la
        boutique. Elles y restent après une déconnexion, et ne sont pas
        chiffrées. Si un téléphone change de main, videz-le : « Paramètres », «
        Effacer ce téléphone ». S’il est perdu, demandez à un gérant de le
        retirer des appareils de vente.
      </p>

      <h2>Qui peut les voir</h2>
      <ul>
        <li>
          Les personnes de votre boutique, selon leur rôle : un vendeur ne voit
          ni la caisse ni les chiffres de la boutique.
        </li>
        <li>
          Personne d’une autre boutique : le serveur le vérifie à chaque action.
        </li>
        <li>
          L’équipe Nagaw voit l’offre, les quantités et l’activité générale
          d’une boutique. Quand elle intervient sur une boutique, l’action est
          inscrite dans son historique.
        </li>
      </ul>

      <h2>Combien de temps</h2>
      <p>
        Les données sont gardées tant que le compte existe. Une suppression se
        demande à l’équipe, qui la traite à la main : certaines pièces, comme
        les factures, peuvent devoir être conservées pour les obligations
        comptables de la boutique.
      </p>

      <h2>Vos droits</h2>
      <p>
        Selon la loi sénégalaise n° 2008-12 sur les données personnelles, vous
        pouvez demander à accéder à vos données, les corriger, les faire
        supprimer ou vous opposer à leur usage. Appelez le{' '}
        <a
          href={CONTACT_PHONE_LINK}
          className="font-semibold text-brand-ink underline underline-offset-4"
        >
          {CONTACT_PHONE}
        </a>
        . Un client d’une boutique peut s’adresser à la boutique ou à nous. Vous
        pouvez aussi saisir la Commission de protection des données personnelles
        (CDP).
      </p>

      <p>
        Voir aussi les{' '}
        <Link
          href="/conditions"
          className="font-semibold text-brand-ink underline underline-offset-4"
        >
          conditions d’utilisation
        </Link>
        .
      </p>
    </LegalPage>
  );
}
