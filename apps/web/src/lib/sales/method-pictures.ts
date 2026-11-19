import {
  Banknote,
  CreditCard,
  FileSignature,
  HandCoins,
  Landmark,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

/**
 * A picture per way of paying, always beside its name (ADR-063): for the
 * people who read slowly, the banknotes, the phone or the card say it first.
 */
export const METHOD_PICTURES: Record<string, LucideIcon> = {
  cash: Banknote,
  mobile_money: Smartphone,
  card: CreditCard,
  credit: HandCoins,
  bank_transfer: Landmark,
  cheque: FileSignature,
};
