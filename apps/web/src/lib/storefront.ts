import 'server-only';
import type { PublicStorefrontDto } from '@nagaw/shared';
import { cacheLife } from 'next/cache';
import { apiPublic } from './api/server';
import type { ApiResult } from './api/call-api';

/**
 * A public storefront (ADR-075), kept a minute: a statut seen by a
 * hundred people asks the API once. A change of price or of stock shows
 * within a minute.
 */
export async function getStorefront(
  slug: string,
): Promise<ApiResult<PublicStorefrontDto>> {
  'use cache';
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  return apiPublic<PublicStorefrontDto>(
    `/public/storefronts/${encodeURIComponent(slug)}`,
  );
}

export const photoUrl = (slug: string, handle: string, version: string) =>
  `/b/${encodeURIComponent(slug)}/photo/${encodeURIComponent(handle)}?v=${version}`;

export const storefrontLogoUrl = (slug: string, version: string) =>
  `/b/${encodeURIComponent(slug)}/logo?v=${version}`;
