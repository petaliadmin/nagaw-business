'use server';

import {
  saveShopProfileSchema,
  SHOP_MODULES,
  type OrganizationDto,
  type ShopModule,
  type ShopProfileDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiAsUser, getSession } from '@/lib/api/server';
import type { FormState } from '@/lib/auth/schemas';

async function requireSession() {
  const session = await getSession();
  if (session.status !== 'signed-in') redirect('/connexion');
  return session;
}

/** The answers and the menu of the last screen (ADR-062). */
export async function saveProfile(
  organizationId: string,
  answers: unknown,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = saveShopProfileSchema.safeParse(answers);
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Réponses incomplètes. Reprenez la dernière question.',
    };
  // The API checks membership and the organization.update permission.
  const result = await apiAsUser<ShopProfileDto>(session.accessToken, {
    method: 'PUT',
    path: '/organizations/current/profile',
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return { status: 'error', message: result.message };
  // The menu is in the shell, which a redirect alone keeps as it was.
  refresh();
  redirect('/espace');
}

/** « Plus tard »: the dashboard stops asking. */
export async function skipProfile(formData: FormData): Promise<void> {
  const session = await requireSession();
  const organizationId = formData.get('organizationId')?.toString();
  if (!organizationId) throw new Error('Boutique inconnue.');
  const result = await apiAsUser<OrganizationDto>(session.accessToken, {
    method: 'POST',
    path: '/organizations/current/profile/skip',
    organizationId,
  });
  if (!result.ok) throw new Error(`Choix non enregistré : ${result.message}`);
  refresh();
  redirect('/espace');
}

/** Settings: the modules ticked stay in the menu, the others leave it. */
export async function updateModules(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const organizationId = formData.get('organizationId')?.toString();
  if (!organizationId)
    return { status: 'error', message: 'Boutique inconnue.' };
  const shown = new Set(formData.getAll('shown').map(String));
  const hiddenModules: ShopModule[] = SHOP_MODULES.filter(
    (module) => !shown.has(module),
  );
  const result = await apiAsUser<OrganizationDto>(session.accessToken, {
    method: 'PUT',
    path: '/organizations/current/modules',
    organizationId,
    body: { hiddenModules },
  });
  if (!result.ok) return { status: 'error', message: result.message };
  // The menu is in the shell: render it again.
  refresh();
  return { status: 'success', message: 'Menu enregistré.' };
}
