'use server';

import {
  cancelExpenseSchema,
  createClosingSchema,
  createExpenseCategorySchema,
  createExpenseSchema,
  createTransferSchema,
  parseAmount,
  PRODUCT_PHOTO_MAX_BYTES,
  PRODUCT_PHOTO_TYPES,
  updateCashAccountSchema,
  updateExpenseCategorySchema,
  type CashAccountDto,
  type ClosingDto,
  type ExpenseCategoryDto,
  type ExpenseDto,
  type TreasuryDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';
import { amountField } from '@/lib/catalog/form';
import { requireReadyWorkspace } from '@/lib/workspace/load';

/** The page's shop must still be the active one (currency, permissions). */
async function shopOf(organizationId: string | undefined) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) redirect('/espace');
  if (organizationId !== workspace.organization.id) return null;
  return {
    token: workspace.accessToken,
    organizationId: workspace.organization.id,
    currency: workspace.organization.defaultCurrency,
  };
}

const SHOP_CHANGED =
  'La boutique active a changé dans un autre onglet. Rechargez la page.';

const text = (formData: FormData, name: string) =>
  formData.get(name)?.toString() ?? '';
const id = (formData: FormData, name: string) =>
  encodeURIComponent(text(formData, name));

export async function createExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(createExpenseSchema, {
    categoryId: text(formData, 'categoryId'),
    cashAccountId: text(formData, 'cashAccountId'),
    // Without a detail, the expense is named after what it was for.
    label: text(formData, 'label') || text(formData, 'labelFallback'),
    amount: amountField(formData, 'amount', shop.currency),
    occurredOn: text(formData, 'occurredOn'),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<ExpenseDto>(shop.token, {
    method: 'POST',
    path: '/expenses',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Dépense enregistrée.' };
}

export async function cancelExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(cancelExpenseSchema, {
    reason: text(formData, 'reason'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<ExpenseDto>(shop.token, {
    method: 'POST',
    path: `/expenses/${id(formData, 'expenseId')}/cancel`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Dépense annulée.' };
}

export async function createTransfer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(createTransferSchema, {
    fromAccountId: text(formData, 'fromAccountId'),
    toAccountId: text(formData, 'toAccountId'),
    amount: amountField(formData, 'amount', shop.currency),
    occurredOn: text(formData, 'occurredOn'),
    note: text(formData, 'note'),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<TreasuryDto>(shop.token, {
    method: 'POST',
    path: '/treasury/transfers',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Argent déplacé.' };
}

/**
 * Closes the day of several accounts at once (ADR-063): one closing per
 * account counted, each idempotent and checked by the server as before.
 * An account left empty is not closed.
 */
export async function createClosings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const day = text(formData, 'day');
  const note = text(formData, 'note');
  const ids = formData.getAll('accountId').map(String);
  const fieldErrors: Record<string, string> = {};
  let closed = 0;
  let gaps = 0;
  for (const id of ids) {
    if (!text(formData, `counted-${id}`)) continue;
    const parsed = parseValues(createClosingSchema, {
      cashAccountId: id,
      day,
      countedAmount: amountField(formData, `counted-${id}`, shop.currency),
      note,
      clientOperationId: text(formData, `operation-${id}`),
    });
    if (!parsed.ok) {
      fieldErrors[`counted-${id}`] =
        parsed.state.fieldErrors?.countedAmount ??
        parsed.state.message ??
        'Montant invalide.';
      continue;
    }
    const result = await apiAsUser<ClosingDto>(shop.token, {
      method: 'POST',
      path: '/treasury/closings',
      organizationId: shop.organizationId,
      body: parsed.data,
    });
    if (!result.ok) {
      fieldErrors[`counted-${id}`] = result.message;
      continue;
    }
    closed += 1;
    if (result.data.difference !== 0) gaps += 1;
  }
  if (closed > 0) refresh();
  if (Object.keys(fieldErrors).length > 0)
    return {
      status: 'error',
      message:
        closed > 0
          ? `${closed} compte${closed > 1 ? 's' : ''} clôturé${closed > 1 ? 's' : ''} ; corrigez les autres.`
          : 'Rien n’est clôturé : corrigez les montants signalés.',
      fieldErrors,
    };
  if (closed === 0)
    return {
      status: 'error',
      message: 'Tapez ce que vous avez compté pour au moins un compte.',
    };
  return {
    status: 'success',
    message:
      gaps === 0
        ? 'Journée clôturée : les comptes sont justes.'
        : 'Journée clôturée : les écarts sont enregistrés.',
  };
}

export async function updateAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const opening = text(formData, 'openingBalance').trim();
  const negative = opening.startsWith('-');
  const minor = parseAmount(
    negative ? opening.slice(1) : opening,
    shop.currency,
  );
  const parsed = parseValues(updateCashAccountSchema, {
    name: text(formData, 'name'),
    ...(formData.has('openingBalance') && {
      openingBalance:
        opening === ''
          ? 0
          : minor === null
            ? Number.NaN
            : negative
              ? -minor
              : minor,
    }),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<CashAccountDto>(shop.token, {
    method: 'PATCH',
    path: `/treasury/accounts/${id(formData, 'accountId')}`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Caisse enregistrée.' };
}

export async function createExpenseCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(createExpenseCategorySchema, {
    name: text(formData, 'name'),
    accountCode: text(formData, 'accountCode'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<ExpenseCategoryDto>(shop.token, {
    method: 'POST',
    path: '/expense-categories',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: `Catégorie « ${result.data.name} » ajoutée.`,
  };
}

export async function setExpenseCategoryStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(updateExpenseCategorySchema, {
    status: text(formData, 'status'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<ExpenseCategoryDto>(shop.token, {
    method: 'PATCH',
    path: `/expense-categories/${id(formData, 'categoryId')}`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message:
      result.data.status === 'archived'
        ? `« ${result.data.name} » est rangée.`
        : `« ${result.data.name} » est de nouveau proposée.`,
  };
}

/** Receipt photo of an expense, already resized on the device. */
export async function attachReceipt(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0)
    return {
      status: 'error',
      message: 'Prenez ou choisissez d’abord la photo du justificatif.',
      fieldErrors: { photo: 'Aucune photo choisie.' },
    };
  if (
    file.size > PRODUCT_PHOTO_MAX_BYTES ||
    !(PRODUCT_PHOTO_TYPES as readonly string[]).includes(file.type)
  )
    return {
      status: 'error',
      message: 'Vérifiez la photo.',
      fieldErrors: { photo: 'Photo trop lourde ou format non pris en charge.' },
    };
  const result = await apiAsUser<ExpenseDto>(shop.token, {
    method: 'PUT',
    path: `/expenses/${id(formData, 'expenseId')}/receipt`,
    organizationId: shop.organizationId,
    rawBody: { data: file, contentType: file.type },
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: `Justificatif de ${result.data.number} enregistré.`,
  };
}
