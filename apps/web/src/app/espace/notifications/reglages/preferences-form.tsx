'use client';

import {
  NOTIFICATION_CATEGORY_RULES,
  type NotificationPreferenceDto,
} from '@nagaw/shared';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { updatePreferences } from '../actions';

const CHECKBOX = 'size-6 shrink-0 accent-brand-strong';

/** One line per subject the role may receive: on or off, and on the phone. */
export function PreferencesForm({
  organizationId,
  preferences,
}: {
  organizationId: string;
  preferences: NotificationPreferenceDto[];
}) {
  const [state, action, pending] = useActionState(
    updatePreferences,
    initialFormState,
  );
  // Push makes no sense for a subject that is off: it follows.
  const [enabled, setEnabled] = useState(
    () => new Map(preferences.map((p) => [p.category, p.enabled])),
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <FormMessage state={state} />
      <ul className="flex flex-col divide-y divide-line">
        {preferences.map((p) => {
          const rule = NOTIFICATION_CATEGORY_RULES[p.category];
          const on = enabled.get(p.category) ?? false;
          return (
            <li
              key={p.category}
              className="flex flex-col gap-2 py-3 first:pt-0"
            >
              <input type="hidden" name={`shown-${p.category}`} value="1" />
              <label className="flex min-h-12 items-start gap-3">
                <input
                  type="checkbox"
                  name={`enabled-${p.category}`}
                  defaultChecked={p.enabled}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setEnabled((current) =>
                      new Map(current).set(p.category, checked),
                    );
                  }}
                  aria-describedby={`pref-${p.category}-help`}
                  className={`${CHECKBOX} mt-0.5`}
                />
                <span className="flex flex-col">
                  <span className="text-lg font-bold">{rule.label}</span>
                  <span
                    id={`pref-${p.category}-help`}
                    className="text-ink-muted"
                  >
                    {rule.description}
                  </span>
                </span>
              </label>
              <label
                className={`ml-9 flex min-h-12 items-center gap-3 ${on ? '' : 'text-ink-muted'}`}
              >
                <input
                  type="checkbox"
                  name={`push-${p.category}`}
                  defaultChecked={p.push}
                  disabled={!on}
                  className={CHECKBOX}
                />
                Aussi sur le téléphone
              </label>
            </li>
          );
        })}
      </ul>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          Enregistrer mes choix
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
