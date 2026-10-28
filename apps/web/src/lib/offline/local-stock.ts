import {
  conversionOf,
  stockLevel,
  type ProductDto,
  type SyncOperation,
} from '@nagaw/shared';

/** Rounds away floating-point noise on quantities with 3 decimals. */
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * The stock the phone should show: the server's, plus what this phone did
 * and has not sent yet (sales take goods out, corrections change the
 * count). Without it, a phone selling offline would offer the same last
 * bag of rice all day (ADR-036).
 */
export function applyPendingStock(
  products: readonly ProductDto[],
  operations: readonly SyncOperation[],
): ProductDto[] {
  const change = new Map<string, number>();
  const add = (productId: string, quantity: number) =>
    change.set(productId, (change.get(productId) ?? 0) + quantity);
  // A selling unit or a conversion takes `factor` stock units (« sac de
  // 50 kg », « 250 g », ADR-038).
  const units = new Map(
    products.flatMap((product) => product.units.map((u) => [u.id, u.factor])),
  );
  const stockUnits = new Map(products.map((p) => [p.id, p.unit]));
  const factorOf = (line: {
    productId: string;
    productUnitId: string | null;
    conversion: string | null;
  }) => {
    if (line.productUnitId) return units.get(line.productUnitId) ?? 1;
    const unit = stockUnits.get(line.productId);
    return line.conversion && unit
      ? (conversionOf(unit, line.conversion)?.factor ?? 1)
      : 1;
  };
  for (const operation of operations) {
    if (operation.type === 'sale')
      for (const line of operation.data.lines)
        add(line.productId, -line.quantity * factorOf(line));
    else if (operation.type === 'stock_correction')
      add(operation.data.productId, operation.data.quantity);
  }
  return products.map((product) => {
    const delta = change.get(product.id);
    if (!product.trackStock || !delta) return product;
    const stockQuantity = round3(product.stockQuantity + delta);
    return {
      ...product,
      stockQuantity,
      stockLevel: stockLevel({ ...product, stockQuantity }),
    };
  });
}

/**
 * Why a seller may not record this correction, or null. Managers are not
 * limited; sellers are, by the shop's setting (0: not allowed at all).
 */
export function correctionProblem(
  change: number,
  options: { manager: boolean; max: number },
): string | null {
  if (change === 0) return 'Le stock est déjà juste : rien à corriger.';
  if (options.manager) return null;
  if (options.max <= 0)
    return 'Dans cette boutique, seuls le propriétaire et les gérants corrigent le stock.';
  if (Math.abs(change) > options.max)
    return `Une correction de plus de ${new Intl.NumberFormat('fr').format(options.max)} doit être faite par le propriétaire ou un gérant.`;
  return null;
}
