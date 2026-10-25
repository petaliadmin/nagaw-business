'use server';

import { createFeedbackSchema, type FeedbackDto } from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';
import { requireReadyWorkspace } from '@/lib/workspace/load';

const text = (formData: FormData, name: string) =>
  formData.get(name)?.toString() ?? '';

export async function sendFeedback(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const workspace = await requireReadyWorkspace();
  if (!workspace) redirect('/espace');
  if (text(formData, 'organizationId') !== workspace.organization.id)
    return {
      status: 'error',
      message:
        'La boutique active a changé dans un autre onglet. Rechargez la page.',
    };
  const parsed = parseValues(createFeedbackSchema, {
    kind: text(formData, 'kind'),
    message: text(formData, 'message'),
    page: text(formData, 'page'),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<FeedbackDto>(workspace.accessToken, {
    method: 'POST',
    path: '/feedback',
    organizationId: workspace.organization.id,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: 'Merci ! Votre message est envoyé à l’équipe Nagaw.',
  };
}
