import type { Unit } from './catalog.js';
import type { Role } from './permissions.js';
import type { PaymentMethod } from './sales.js';

/** Sales figures of a period, in the shop's time zone (ADR-027). */
export interface StatsSummaryDto {
  from: string;
  to: string;
  salesCount: number;
  /** Sum of the completed sales, taxes included. */
  revenue: number;
  discount: number;
  taxTotal: number;
  /** Revenue over the number of sales, rounded; 0 without sale. */
  averageBasket: number;
  /**
   * Gross margin of the lines whose purchase price was known at the time
   * of the sale; `coverageBasisPoints` says which share of the revenue it
   * covers (10000 = all of it).
   */
  margin: {
    amount: number;
    costedRevenue: number;
    coverageBasisPoints: number;
  };
  byMethod: Record<PaymentMethod, number>;
  /** One entry per day of the period, days without sale included. */
  days: { day: string; revenue: number; count: number }[];
  topProducts: {
    productId: string;
    label: string;
    unit: Unit;
    quantity: number;
    revenue: number;
  }[];
  /** Active products in stock that sold nothing in the period. */
  slowProducts: {
    id: string;
    name: string;
    unit: Unit;
    stockQuantity: number;
  }[];
  /** Recorded (not cancelled) expenses of the period. */
  expenses: number;
}

/** One shop of the person, for the comparison between shops. */
export interface ShopSummaryDto {
  organizationId: string;
  name: string;
  currency: string;
  role: Role;
  today: { revenue: number; count: number };
  period: { revenue: number; count: number };
}

/** Basis points of a share, rounded down (no 100 % before it is all). */
export function shareBasisPoints(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.floor((part * 10000) / whole);
}
