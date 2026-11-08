'use client';

import type { ProductDto } from '@nagaw/shared';
import { useActionState } from 'react';
import { useConfirmedSubmit } from '@/components/ui/confirm-dialog';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { setProductStatus } from '../actions';

/** Archive (with confirmation) or put back on sale. */
export function ProductStatusForm({
  organizationId,
  product,
}: {
  organizationId: string;
  product: ProductDto;
}) {
  const [state, action] = useActionState(setProductStatus, initialFormState);
  const archiving = product.status === 'active';
  const [guard, confirmDialog] = useConfirmedSubmit();
  return (
    <form
      action={action}
      onSubmit={(event) =>
        guard(
          event,
          archiving
            ? {
                title: `Archiver « ${product.name} » ?`,
                message:
                  'Il ne sera plus proposé, mais son historique est gardé.',
                confirmLabel: 'Archiver',
              }
            : null,
        )
      }
      className="flex flex-col gap-3"
    >
      {confirmDialog}
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="version" value={product.version} />
      <input
        type="hidden"
        name="status"
        value={archiving ? 'archived' : 'active'}
      />
      <FormMessage state={state} />
      <div>
        <SubmitButton
          variant={archiving ? 'secondary' : 'primary'}
          pendingLabel="Enregistrement…"
        >
          {archiving
            ? `Archiver ce ${product.kind === 'service' ? 'service' : 'produit'}`
            : 'Remettre en vente'}
        </SubmitButton>
      </div>
    </form>
  );
}
