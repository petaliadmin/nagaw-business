'use client';

import {
  AVAILABILITY_LABELS,
  formatAmount,
  type StorefrontArticleSettingDto,
} from '@nagaw/shared';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/form-state';
import { saveArticles } from '../actions';

/** Which products and services the storefront shows (ADR-075). */
export function ArticlesForm({
  organizationId,
  articles,
  currency,
}: {
  organizationId: string;
  articles: StorefrontArticleSettingDto[];
  currency: string;
}) {
  const [state, action, pending] = useActionState(
    saveArticles,
    initialFormState,
  );
  const [shown, setShown] = useState(
    () => new Set(articles.filter((a) => a.visible).map((a) => a.productId)),
  );
  const toggleAll = (on: boolean) =>
    setShown(on ? new Set(articles.map((a) => a.productId)) : new Set());
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => toggleAll(true)}
          className="min-h-12 rounded-full border-2 border-line-strong px-4 font-bold"
        >
          Tout montrer
        </button>
        <button
          type="button"
          onClick={() => toggleAll(false)}
          className="min-h-12 rounded-full border-2 border-line-strong px-4 font-bold"
        >
          Tout cacher
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {articles.map((article) => {
          const on = shown.has(article.productId);
          return (
            <li key={article.productId} className="rounded-3xl bg-surface p-4">
              <input type="hidden" name="productId" value={article.productId} />
              <label className="flex min-h-12 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  name="visible"
                  value={article.productId}
                  checked={on}
                  onChange={(e) =>
                    setShown((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(article.productId);
                      else next.delete(article.productId);
                      return next;
                    })
                  }
                  className="size-6 shrink-0 accent-brand-strong"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold">{article.name}</span>
                  <span className="text-sm text-ink-muted">
                    {article.kind === 'service' ? 'Service' : 'Produit'}
                    {article.categoryName ? ` · ${article.categoryName}` : ''}
                    {' · '}
                    {AVAILABILITY_LABELS[article.availability]}
                    {article.hasPhoto ? '' : ' · sans photo'}
                  </span>
                </span>
                <span className="font-extrabold tabular-nums text-sales-ink">
                  {article.openPrice
                    ? 'Prix tapé'
                    : formatAmount(article.salePrice, currency)}
                </span>
              </label>
              {on && (
                <div className="mt-2 flex flex-col gap-2 border-t border-line pt-2">
                  <label className="flex min-h-12 items-center gap-3">
                    <input
                      type="checkbox"
                      name="onRequest"
                      value={article.productId}
                      defaultChecked={article.priceMode === 'on_request'}
                      disabled={article.openPrice}
                      className="size-5 accent-brand-strong"
                    />
                    Prix sur demande
                    {article.openPrice ? ' (prix tapé à chaque vente)' : ''}
                  </label>
                  <label
                    htmlFor={`description-${article.productId}`}
                    className="text-sm font-bold"
                  >
                    Un mot pour les clients (facultatif)
                  </label>
                  <input
                    id={`description-${article.productId}`}
                    name={`description-${article.productId}`}
                    defaultValue={article.description}
                    maxLength={300}
                    className="min-h-12 rounded-2xl border border-line-strong bg-canvas px-4"
                  />
                </div>
              )}
              {!on && (
                <input
                  type="hidden"
                  name={`description-${article.productId}`}
                  value={article.description}
                />
              )}
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-20 md:bottom-4">
        <SubmitButton pendingLabel="Enregistrement…" className="w-full">
          {`Montrer ${shown.size} ${shown.size > 1 ? 'articles' : 'article'}`}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
