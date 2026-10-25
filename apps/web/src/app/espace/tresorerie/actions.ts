'use server';

import {
  cancelExpenseSchema,
  createClosingSchema,
  createExpenseCategorySchema,
  createExpenseSchema,
  createTransferSchema,
  parseAmount,
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
    label: text(formData, 'label'),
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

export async function createClosing(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(createClosingSchema, {
    cashAccountId: text(formData, 'cashAccountId'),
    day: text(formData, 'day'),
    countedAmount: amountField(formData, 'countedAmount', shop.currency),
    note: text(formData, 'note'),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<ClosingDto>(shop.token, {
    method: 'POST',
    path: '/treasury/closings',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  const { difference } = result.data;
  return {
    status: 'success',
    message:
      difference === 0
        ? 'Caisse clôturée : le compte est juste.'
        : 'Caisse clôturée : l’écart est enregistré.',
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
