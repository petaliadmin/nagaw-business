/** French messages for Supabase Auth error codes shown to users. */
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Adresse e-mail ou mot de passe incorrect.',
  email_not_confirmed:
    'Confirmez d’abord votre adresse e-mail via le lien reçu.',
  user_already_exists: 'Un compte existe déjà avec cette adresse e-mail.',
  weak_password: 'Mot de passe trop faible.',
  over_email_send_rate_limit:
    'Trop d’e-mails envoyés. Réessayez dans quelques minutes.',
  over_request_rate_limit:
    'Trop de tentatives. Réessayez dans quelques minutes.',
  same_password: 'Le nouveau mot de passe doit être différent de l’ancien.',
  signup_disabled: 'Les inscriptions sont actuellement fermées.',
};

export function authErrorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || 'Une erreur est survenue. Réessayez.';
}
