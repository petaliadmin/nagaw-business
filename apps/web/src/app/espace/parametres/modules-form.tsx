'use client';

import { showsModule, type ShopModule } from '@nagaw/shared';
import { Check } from 'lucide-react';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { ALWAYS_SHOWN, MODULE_OPTIONS } from '@/lib/profile/choices';
import { updateModules } from '../profil/actions';

/** What the menu shows (ADR-062): unticked leaves it, nothing is erased. */
export function ModulesForm({
  organizationId,
  hiddenModules,
}: {
  organizationId: string;
  hiddenModules: readonly ShopModule[];
}) {
  const [state, action, pending] = useActionState(
    updateModules,
    initialFormState,
  );
  const [hidden, setHidden] = useState<readonly ShopModule[]>(hiddenModules);
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
    >
      <FormMessage state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-base font-semibold">
          Ce que montre le menu
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MODULE_OPTIONS.map(({ value, label, icon: Icon }) => {
            const shown = showsModule(hidden, value);
            return (
              <label
                key={value}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 text-base font-bold focus-within:outline-3 focus-within:outline-focus ${
                  shown
                    ? 'border-brand-strong bg-brand-soft text-brand-ink'
                    : 'border-line-strong bg-surface'
                }`}
              >
                <input
                  type="checkbox"
                  name="shown"
                  value={value}
                  checked={shown}
                  onChange={() =>
                    setHidden((list) =>
                      shown
                        ? [...list, value]
                        : list.filter((module) => module !== value),
                    )
                  }
                  className="sr-only"
                />
                <Icon aria-hidden className="size-6 shrink-0" />
                <span className="flex-1">{label}</span>
                <Check
                  aria-hidden
                  className={`size-5 shrink-0 ${shown ? '' : 'invisible'}`}
                />
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="text-ink-muted">
        Toujours dans le menu : {ALWAYS_SHOWN}. Retirer une entrée n’efface rien
        : vous la retrouvez telle quelle en la cochant de nouveau.
      </p>
      <SubmitButton pendingLabel="Enregistrement…">
        Enregistrer le menu
      </SubmitButton>
    </ActionForm>
  );
}
