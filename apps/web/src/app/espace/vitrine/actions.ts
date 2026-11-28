'use server';

import {
  storefrontArticlesSchema,
  updateStorefrontSchema,
  type StorefrontArticleSettingDto,
  type StorefrontSettingsDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';
import { requireReadyWorkspace } from '@/lib/workspace/load';

/** Ma vitrine (ADR-075); the API checks every right again. */

const text = (formData: FormData, name: string) =>
  formData.get(name)?.toString() ?? '';

async function shopOf(formData: FormData) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) redirect('/espace');
  if (text(formData, 'organizationId') !== workspace.organization.id)
    return {
      ok: false as const,
      error: {
        status: 'error',
        message:
          'La boutique active a changé dans un autre onglet. Rechargez la page.',
      } satisfies FormState,
    };
  return {
    ok: true as const,
    token: workspace.accessToken,
    organizationId: workspace.organization.id,
  };
}

async function update(
  formData: FormData,
  values: Record<string, unknown>,
  done: string,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const parsed = parseValues(updateStorefrontSchema, values);
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<StorefrontSettingsDto>(shop.token, {
    method: 'PATCH',
    path: '/storefront',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: done };
}

export async function switchStorefront(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const enabled = text(formData, 'enabled') === 'true';
  return update(
    formData,
    { enabled },
    enabled
      ? 'Votre vitrine est en ligne. Partagez son lien.'
      : 'Votre vitrine est éteinte.',
  );
}

export async function saveStorefront(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return update(
    formData,
    {
      slug: text(formData, 'slug'),
      tagline: text(formData, 'tagline'),
      landmark: text(formData, 'landmark'),
      hours: text(formData, 'hours'),
      whatsapp: text(formData, 'whatsapp'),
      indexable: formData.has('indexable'),
    },
    'Vitrine enregistrée.',
  );
}

export async function saveArticles(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const ids = formData.getAll('productId').map((v) => v.toString());
  const visible = new Set(formData.getAll('visible').map((v) => v.toString()));
  const onRequest = new Set(
    formData.getAll('onRequest').map((v) => v.toString()),
  );
  const parsed = parseValues(storefrontArticlesSchema, {
    articles: ids.map((productId) => ({
      productId,
      visible: visible.has(productId),
      priceMode: onRequest.has(productId) ? 'on_request' : 'shown',
      description: text(formData, `description-${productId}`),
    })),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<StorefrontArticleSettingDto[]>(shop.token, {
    method: 'PUT',
    path: '/storefront/articles',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: `${visible.size} ${visible.size > 1 ? 'articles' : 'article'} sur votre vitrine.`,
  };
}
