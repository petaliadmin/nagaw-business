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
  title: 'Conditions d’utilisation — Nagaw Business',
  description:
    'Les règles d’utilisation de Nagaw Business : compte, offres, données, responsabilités.',
  alternates: { canonical: '/conditions' },
};

export default function ConditionsPage() {
  return (
    <LegalPage title="Conditions d’utilisation" updated={LEGAL_UPDATED}>
      <p>
        Nagaw Business est une application de gestion de boutique éditée par{' '}
        {PUBLISHER}. Créer un compte, c’est accepter ces conditions.
      </p>

      <h2>Votre compte</h2>
      <ul>
        <li>Les informations que vous donnez doivent être exactes.</li>
        <li>
          Gardez votre mot de passe pour vous : ce qui est fait avec votre
          compte est fait sous votre responsabilité.
        </li>
        <li>
          Le propriétaire d’une boutique choisit qui y entre et avec quel rôle.
        </li>
      </ul>

      <h2>Les offres</h2>
      <p>
        Les offres, leurs prix et leurs limites sont affichés sur la{' '}
        <Link
          href="/#tarifs"
          className="font-semibold text-brand-ink underline underline-offset-4"
        >
          page des tarifs
        </Link>
        . Passer à une offre payante se demande depuis l’application, et le
        règlement se fait avec l’équipe : le paiement en ligne n’est pas encore
        ouvert. Passer à une offre plus petite ne retire rien de ce qui existe.
      </p>

      <h2>Vos données</h2>
      <p>
        Ce que vous saisissez reste à vous. Vous êtes responsable de ce que vous
        enregistrez, notamment sur vos clients : gardez seulement ce qui vous
        est utile, et obtenez leur accord lorsque c’est nécessaire. La{' '}
        <Link
          href="/confidentialite"
          className="font-semibold text-brand-ink underline underline-offset-4"
        >
          politique de confidentialité
        </Link>{' '}
        dit ce qui est gardé et où.
      </p>

      <h2>Vendre sans internet</h2>
      <p>
        Une vente faite sans réseau est gardée sur le téléphone jusqu’à son
        envoi. Tant qu’elle n’est pas envoyée, elle n’existe que là : si le
        téléphone est perdu, cassé ou vidé, elle est perdue. Reconnectez
        régulièrement vos téléphones à internet.
      </p>

      <h2>Vos factures et votre comptabilité</h2>
      <p>
        L’application vous aide à tenir vos chiffres. Elle ne remplace ni un
        comptable, ni un conseil fiscal : vous restez responsable de vos
        déclarations et de vos documents.
      </p>

      <h2>Ce qui est interdit</h2>
      <ul>
        <li>Utiliser l’application pour une activité illégale.</li>
        <li>Essayer d’accéder aux données d’une autre boutique.</li>
        <li>Perturber le service ou tenter de le contourner.</li>
      </ul>
      <p>
        En cas de manquement, {PUBLISHER} peut suspendre une boutique. Rien
        n’est effacé pendant une suspension, et le motif est inscrit dans
        l’historique de la boutique.
      </p>

      <h2>Disponibilité et responsabilité</h2>
      <p>
        Nous faisons de notre mieux pour que le service reste disponible et
        fiable, sans pouvoir garantir qu’il ne connaîtra jamais d’interruption
        ni d’erreur. Vérifiez vos chiffres importants.
      </p>

      <h2>Changements</h2>
      <p>
        Ces conditions peuvent évoluer. La date en haut de cette page indique la
        dernière mise à jour.
      </p>

      <h2>Droit applicable et contact</h2>
      <p>
        Ces conditions relèvent du droit sénégalais. Pour toute question ou
        difficulté, appelez le{' '}
        <a
          href={CONTACT_PHONE_LINK}
          className="font-semibold text-brand-ink underline underline-offset-4"
        >
          {CONTACT_PHONE}
        </a>
        .
      </p>
    </LegalPage>
  );
}
