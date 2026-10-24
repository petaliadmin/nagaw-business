import Link from 'next/link';
import type { ComponentProps } from 'react';
import { buttonClasses, type ButtonVariant } from './button-styles';

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={buttonClasses(variant, className)} />;
}
