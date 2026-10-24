import { parseAmount } from '@nagaw/shared';

/**
 * Reads catalogue forms into the values the shared schemas validate.
 * Amounts are typed in the shop's currency (« 12 500 ») and sent in minor
 * units; an unreadable value becomes NaN so that the schema reports it on
 * the right field.
 */
function text(formData: FormData, name: string): string {
  return formData.get(name)?.toString().trim() ?? '';
}

export function amountField(
  formData: FormData,
  name: string,
  currency: string,
): number {
  return parseAmount(text(formData, name), currency) ?? Number.NaN;
}

export function optionalAmountField(
  formData: FormData,
  name: string,
  currency: string,
): number | null {
  return text(formData, name) === ''
    ? null
    : amountField(formData, name, currency);
}

/** « 2,5 » or « 2.5 »; empty is null. */
export function optionalQuantityField(
  formData: FormData,
  name: string,
): number | null {
  const value = text(formData, name).replace(/[\s  ]/g, '');
  if (value === '') return null;
  return /^-?\d+(?:[.,]\d+)?$/.test(value)
    ? Number(value.replace(',', '.'))
    : Number.NaN;
}

export function quantityField(formData: FormData, name: string): number {
  return optionalQuantityField(formData, name) ?? Number.NaN;
}

export function optionalIdField(
  formData: FormData,
  name: string,
): string | null {
  const value = text(formData, name);
  return value === '' ? null : value;
}

/** Product form → values for createProductSchema / updateProductSchema. */
export function productValues(formData: FormData, currency: string) {
  return {
    name: text(formData, 'name'),
    categoryId: optionalIdField(formData, 'categoryId'),
    unit: text(formData, 'unit'),
    salePrice: amountField(formData, 'salePrice', currency),
    purchasePrice: optionalAmountField(formData, 'purchasePrice', currency),
    taxRateId: optionalIdField(formData, 'taxRateId'),
    barcode: text(formData, 'barcode'),
    trackStock: formData.get('trackStock') === 'on',
    lowStockThreshold: optionalQuantityField(formData, 'lowStockThreshold'),
  };
}
