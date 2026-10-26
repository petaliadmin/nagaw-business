'use client';

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useRef,
  type FormHTMLAttributes,
} from 'react';

const FormPending = createContext(false);

/** Pending state of the enclosing ActionForm (see SubmitButton). */
export function useActionFormPending(): boolean {
  return useContext(FormPending);
}

/**
 * A form bound to a `useActionState` action that **keeps what was typed**
 * when the server answers with an error. React resets uncontrolled fields
 * after every form action, which would erase a whole form because of one
 * mistake; here the action is dispatched from `onSubmit` instead. Without
 * JavaScript, the `action` attribute still submits to the server.
 *
 * To clear the form after a success, change its `key`.
 *
 * When the answer marks fields as wrong, the focus goes to the first one:
 * its message is read and, on a long form, it scrolls into view (WCAG 3.3.1).
 */
export function ActionForm({
  action,
  pending,
  children,
  ...props
}: Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit'> & {
  action: (formData: FormData) => void;
  /** Third value of `useActionState`. */
  pending: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending)
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    wasPending.current = pending;
  }, [pending]);
  return (
    <FormPending.Provider value={pending}>
      <form
        {...props}
        ref={formRef}
        action={action}
        onSubmit={(event) => {
          event.preventDefault();
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const formData = new FormData(event.currentTarget, submitter);
          startTransition(() => action(formData));
        }}
      >
        {children}
      </form>
    </FormPending.Provider>
  );
}
