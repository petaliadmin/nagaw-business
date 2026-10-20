import type { Metadata } from 'next';
import { NewPasswordForm } from './new-password-form';

export const metadata: Metadata = {
  title: 'Nouveau mot de passe — Nagaw Business',
};

/** Reached from the e-mailed link; the session is checked by the action. */
export default function NewPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">
        Choisir un nouveau mot de passe
      </h1>
      <NewPasswordForm />
    </>
  );
}
