import {
  baseQuantityOf,
  computeSaleTotals,
  formatAmount,
  pricingOf,
  reductionBasisPoints,
  sellingOptionsOf,
  type ProductDto,
  type SellingOption,
} from '@nagaw/shared';

/** A line of the cart, as typed by the seller (ADR-038). */
export interface CartLine {
  productId: string;
  /** SellingOption.key: `stock`, `conversion:g`, `unit:<id>`. */
  optionKey: string;
  /** As typed (« 1,5 »), so that the field keeps what the seller types. */
  quantityText: string;
  /** Amount agreed with the customer for the line; '' when none. */
  agreedText: string;
}

export const lineKey = (line: Pick<CartLine, 'productId' | 'optionKey'>) =>
  `${line.productId}|${line.optionKey}`;

export const parseQuantity = (text: string): number => {
  const value = text.replace(/\s/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(value) ? Number(value) : Number.NaN;
};
export const quantityText = (value: number) =>
  String(Math.round(value * 1000) / 1000).replace('.', ',');

/** Whole francs typed by the seller, or NaN. */
export const parseFrancs = (text: string): number => {
  const value = text.replace(/[\s ]/g, '');
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
};

export interface PricedLine {
  line: CartLine;
  product: ProductDto;
  option: SellingOption;
  quantity: number;
  /** In the stock unit; NaN when the quantity is not valid. */
  baseQuantity: number;
  pricing: ReturnType<typeof pricingOf>;
  /** Null when the seller kept the catalogue price. */
  agreedTotal: number | null;
}

/** Why a typed quantity is refused, or null when it is fine. */
export function quantityError(
  option: Pick<SellingOption, 'allowsDecimals' | 'factor'>,
  quantity: number,
): string | null {
  if (!(quantity > 0)) return 'Tapez un nombre plus grand que 0.';
  if (!option.allowsDecimals && !Number.isInteger(quantity))
    return 'Tapez un nombre entier, sans virgule.';
  if (baseQuantityOf(quantity, option.factor) === null)
    return 'Quantité trop précise pour cette unité.';
  return null;
}

/** The cart with its options and prices, ready for the totals. */
export function priceCart(
  cart: readonly CartLine[],
  products: ReadonlyMap<string, ProductDto>,
): PricedLine[] {
  return cart.flatMap((line) => {
    const product = products.get(line.productId);
    const option = product
      ? sellingOptionsOf(product).find((o) => o.key === line.optionKey)
      : undefined;
    if (!product || !option) return [];
    const quantity = parseQuantity(line.quantityText);
    const valid = quantityError(option, quantity) === null;
    const agreed = line.agreedText.trim() ? parseFrancs(line.agreedText) : null;
    return [
      {
        line,
        product,
        option,
        quantity,
        baseQuantity: valid
          ? (baseQuantityOf(quantity, option.factor) ?? Number.NaN)
          : Number.NaN,
        pricing: pricingOf(option, product.salePrice, valid ? quantity : 0),
        agreedTotal: agreed !== null && Number.isFinite(agreed) ? agreed : null,
      },
    ];
  });
}

export function totalsOf(lines: readonly PricedLine[], discount: number) {
  return computeSaleTotals(
    lines.map(({ product, pricing, agreedTotal }) => ({
      unitPrice: pricing.unitPrice,
      quantity: pricing.pricedQuantity,
      taxRateBasisPoints: product.taxRate?.rateBasisPoints ?? null,
      agreedTotal,
    })),
    discount,
  );
}

/** Stock asked by the cart, product by product, in the stock unit. */
export function wantedStock(lines: readonly PricedLine[]): Map<string, number> {
  const wanted = new Map<string, number>();
  for (const { product, baseQuantity } of lines)
    if (Number.isFinite(baseQuantity))
      wanted.set(
        product.id,
        Math.round(((wanted.get(product.id) ?? 0) + baseQuantity) * 1000) /
          1000,
      );
  return wanted;
}

/**
 * Quantity bought « for this amount » (« 500 F de sucre ») of an option
 * that takes decimals; null when it cannot be worked out.
 */
export function quantityForAmount(
  option: Pick<SellingOption, 'factor' | 'price' | 'allowsDecimals'>,
  stockPrice: number,
  amount: number,
): number | null {
  const priceOfOne = option.price ?? stockPrice * option.factor;
  if (!(amount > 0) || !(priceOfOne > 0)) return null;
  const raw = amount / priceOfOne;
  const quantity = option.allowsDecimals
    ? Math.round(raw * 1000) / 1000
    : Math.max(1, Math.round(raw));
  return baseQuantityOf(quantity, option.factor) === null ? null : quantity;
}

/** What the checkout knows of the seller's negotiation rules (ADR-038). */
export interface NegotiationRules {
  /** Owner and managers: no rule applies to them. */
  manager: boolean;
  /** Basis points; null: no limit. */
  maxDiscountBasisPoints: number | null;
  sellerCanSellBelowCost: boolean;
}

/**
 * Why the server would refuse these prices, so that the seller learns it
 * at the counter, not after the sale: the same rules, checked again by the
 * server.
 */
export function negotiationProblem(
  lines: readonly PricedLine[],
  totals: ReturnType<typeof totalsOf>,
  rules: NegotiationRules,
  currency: string,
): string | null {
  const limit = rules.maxDiscountBasisPoints;
  if (
    limit !== null &&
    reductionBasisPoints(totals.listSubtotal, totals.total) > limit
  )
    return `Vous ne pouvez pas baisser les prix de plus de ${new Intl.NumberFormat('fr').format(limit / 100)} % : demandez au propriétaire ou à un gérant.`;
  if (rules.manager || rules.sellerCanSellBelowCost) return null;
  for (const [index, { product, baseQuantity }] of lines.entries()) {
    if (product.purchasePrice === null || !Number.isFinite(baseQuantity))
      continue;
    const loss =
      Math.round(product.purchasePrice * baseQuantity) -
      (totals.lines[index]?.paid ?? 0);
    if (loss > 0)
      return `« ${product.name} » serait vendu sous son prix d’achat (${formatAmount(loss, currency)} de perte) : demandez au propriétaire ou à un gérant.`;
  }
  return null;
}
