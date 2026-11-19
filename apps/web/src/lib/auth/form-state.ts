/*
 * Kept apart from the schemas: client forms import it without the number
 * checks of the server and their telephone plans (ADR-064).
 */

export type FormState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialFormState: FormState = { status: 'idle' };
