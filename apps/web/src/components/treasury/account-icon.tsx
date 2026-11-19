import type { CashAccountKind, MobileMoneyProvider } from '@nagaw/shared';
import { Banknote, Landmark } from 'lucide-react';
import { OperatorLogo } from '@/components/sales/operator-logo';

export interface AccountLook {
  kind: CashAccountKind;
  provider: MobileMoneyProvider | null;
}

/**
 * What an account looks like, for people who do not read easily: banknotes
 * for the cash drawer, the operator's own logo for Mobile Money, a bank
 * for the bank. Always beside the account's name: it only repeats it.
 */
export function AccountIcon({
  account,
  size = 'size-8',
}: {
  account: AccountLook;
  size?: string;
}) {
  if (account.kind === 'mobile_money' && account.provider)
    return <OperatorLogo provider={account.provider} className={size} />;
  const Icon = account.kind === 'bank' ? Landmark : Banknote;
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-lg ${size} ${
        account.kind === 'bank'
          ? 'bg-brand-soft text-brand-ink'
          : 'bg-sales-soft text-sales-ink'
      }`}
    >
      <Icon className="size-[60%]" />
    </span>
  );
}
