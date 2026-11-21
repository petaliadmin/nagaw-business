'use client';

import {
  displayFromHabits,
  sellsGoods,
  type ShopHabits,
  type ShopOffer,
  type ShopSection,
} from '@nagaw/shared';
import {
  ArrowLeft,
  ChevronRight,
  House,
  Package,
  Receipt,
  Scissors,
  Settings,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useActionState, useEffect, useRef, useState, type Ref } from 'react';
import { ActionForm } from '@/components/action-form';
import { HabitsField } from '@/components/catalog/habits-field';
import { OfferCards } from '@/components/catalog/offer-cards';
import { catalogShortLabel } from '@/components/shell/navigation';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { FormSteps } from '@/components/ui/form-steps';
import { initialFormState, type FormState } from '@/lib/auth/form-state';
import { SECTION_OPTIONS } from '@/lib/shop/sections';
import { createOrganization } from './actions';

/** Three steps, then the application they give (maquette « Profils »). */
type Step = 1 | 2 | 3 | 'summary';
const LABELS = {
  1: 'Votre boutique',
  2: 'Ce que vous vendez',
  3: 'Vos habitudes',
} as const;

/** The step that holds a refused field. */
function stepOf(errors: Record<string, string>): Step {
  if (errors.name || errors.ownerName || errors.phone) return 1;
  if (errors.offer) return 2;
  return 3;
}

const ALL_YES: ShopHabits = {
  credit: true,
  stock: true,
  documents: true,
  team: true,
};

/** « Voici votre application »: what the answers give, before creating. */
function Summary({
  offer,
  habits,
  titleRef,
}: {
  offer: ShopOffer;
  habits: ShopHabits;
  titleRef: Ref<HTMLHeadingElement>;
}) {
  const display = { offer, ...displayFromHabits(offer, habits) };
  const bar: { label: string; icon: LucideIcon; main?: boolean }[] = [
    { label: 'Accueil', icon: House },
    { label: 'Ventes', icon: Receipt },
    { label: 'Caisse', icon: ShoppingCart, main: true },
    {
      label: catalogShortLabel(display),
      icon: offer === 'services' ? Scissors : Package,
    },
    { label: 'Argent', icon: Wallet },
  ];
  // A shop of services never has suppliers (ADR-047).
  const options = SECTION_OPTIONS.filter(
    ({ section }) => section !== 'suppliers' || sellsGoods(offer),
  );
  const hidden = (section: ShopSection) =>
    display.hiddenSections.includes(section);
  const shown = options.filter(({ section }) => !hidden(section));
  const later = options.filter(({ section }) => hidden(section));
  const facts = [
    offer === 'services'
      ? 'des services'
      : offer === 'both'
        ? 'des produits et des services'
        : 'des produits',
    habits.credit ? 'du crédit' : 'pas de crédit',
    ...(sellsGoods(offer)
      ? [habits.stock ? 'le stock compté' : 'pas de stock compté']
      : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 ref={titleRef} tabIndex={-1} className="text-2xl font-extrabold">
          Voici votre application
        </h2>
        <p className="text-ink-muted">
          D’après vos réponses : {facts.join(', ')}.
        </p>
      </div>
      <section
        aria-label="En bas de l’écran"
        className="flex flex-col gap-2.5 rounded-3xl bg-surface p-4"
      >
        <h3 className="font-bold">En bas de l’écran</h3>
        <ul className="flex justify-between">
          {bar.map(({ label, icon: Icon, main }) => (
            <li
              key={label}
              className="flex flex-col items-center gap-1 text-sm font-extrabold"
            >
              <span
                className={`flex size-11 items-center justify-center ${
                  main
                    ? 'rounded-2xl bg-ink text-canvas'
                    : 'rounded-full bg-canvas'
                }`}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </section>
      <section
        aria-label="Dans le Menu"
        className="flex flex-col rounded-3xl bg-surface px-4 py-2"
      >
        <h3 className="py-1 font-bold">Dans le Menu</h3>
        <ul>
          {[
            ...shown,
            { section: 'settings', label: 'Paramètres', icon: Settings },
          ].map(({ section, label, icon: Icon }) => (
            <li
              key={section}
              className="flex min-h-11 items-center gap-3 font-bold"
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </li>
          ))}
        </ul>
      </section>
      {later.length > 0 && (
        <section
          aria-label="Caché pour l’instant"
          className="flex flex-col gap-2"
        >
          <h3 className="font-bold">
            Caché pour l’instant, à ajouter quand vous voulez
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {later.map(({ section, label }) => (
              <li
                key={section}
                className="rounded-full bg-surface px-3 py-1.5 text-sm font-bold text-ink-muted"
              >
                {label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function CreateOrganizationForm({
  ownerName,
  phone,
  title: heading = 'Votre boutique',
}: {
  /** The page's title, with « Revenir » beside it; null under a page header. */
  title?: string | null;
  /** Already known for a second shop. */
  ownerName?: string | null;
  /** International digits of the account, when it signed up by phone. */
  phone?: string | null;
}) {
  const [state, action, pending] = useActionState(
    createOrganization,
    initialFormState,
  );
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [offer, setOffer] = useState<ShopOffer>('products');
  const [habits, setHabits] = useState<ShopHabits>(ALL_YES);
  const [problem, setProblem] = useState('');
  const [seen, setSeen] = useState<FormState>(state);
  const title = useRef<HTMLHeadingElement>(null);
  const errors = state.fieldErrors ?? {};
  if (state !== seen) {
    setSeen(state);
    if (state.fieldErrors) setStep(stepOf(state.fieldErrors));
  }
  // Focus follows the step, so that a screen reader says where it is.
  const focused = useRef(step);
  useEffect(() => {
    if (focused.current === step) return;
    focused.current = step;
    title.current?.focus();
  }, [step]);

  function next() {
    if (step === 1 && name.trim().length < 2) {
      setProblem('Donnez le nom de votre boutique.');
      return;
    }
    setProblem('');
    setStep((current) => (current === 1 ? 2 : current === 2 ? 3 : 'summary'));
  }
  function back() {
    setProblem('');
    setStep((current) => (current === 'summary' ? 3 : current === 3 ? 2 : 1));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* As in the maquette: « Revenir » beside the title, never a second
          button under the form. */}
      {(heading || step !== 1) && (
        <div className="flex min-h-12 items-center gap-3">
          {step !== 1 && (
            <button
              type="button"
              onClick={back}
              aria-label="Revenir"
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface"
            >
              <ArrowLeft aria-hidden className="size-6" />
            </button>
          )}
          {heading && <h1 className="text-2xl font-extrabold">{heading}</h1>}
        </div>
      )}
      {step !== 'summary' && (
        <FormSteps step={step} total={3} label={LABELS[step]} />
      )}
      {step !== 'summary' && (
        <h2 ref={title} tabIndex={-1} className="sr-only">
          {LABELS[step]}
        </h2>
      )}
      <FormMessage state={state} />
      <ActionForm
        action={action}
        pending={pending}
        className="flex flex-col gap-5"
        noValidate
        onKeyDown={(event) => {
          // « Entrée » goes to the next step, it does not create too early.
          if (
            event.key === 'Enter' &&
            step !== 'summary' &&
            event.target instanceof HTMLInputElement
          ) {
            event.preventDefault();
            next();
          }
        }}
      >
        {/* Step 1: the shop. The hidden steps keep their values. */}
        <div hidden={step !== 1} className="flex flex-col gap-4">
          <FormField
            label="Nom de la boutique"
            name="name"
            autoComplete="organization"
            hint="Il apparaît sur vos tickets et vos factures."
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(event) => {
              setProblem('');
              setName(event.target.value);
            }}
            error={errors.name}
          />
          {/* V3: only what is not known yet is asked (ADR-063). */}
          {ownerName ? (
            <input type="hidden" name="ownerName" value={ownerName} />
          ) : (
            <FormField
              label="Votre nom complet"
              name="ownerName"
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              error={errors.ownerName}
            />
          )}
          {phone && !errors.phone ? (
            <input type="hidden" name="phone" value={`+${phone}`} />
          ) : (
            <FormField
              label="Votre téléphone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              hint="Il figure sur vos factures et vos devis. Vous pourrez le changer dans Paramètres."
              required
              maxLength={30}
              error={errors.phone}
            />
          )}
          <p className="text-ink-muted">
            Gratuit pour commencer, sans carte bancaire.
          </p>
        </div>

        {/* Step 2: what the shop sells (ADR-047). */}
        <div hidden={step !== 2}>
          <OfferCards value={offer} onChange={setOffer} error={errors.offer} />
        </div>

        {/* Step 3: how it works (ADR-067). */}
        <div hidden={step !== 3}>
          <HabitsField
            offer={offer}
            value={habits}
            onChange={setHabits}
            errors={errors}
          />
        </div>

        {step === 'summary' && (
          <Summary offer={offer} habits={habits} titleRef={title} />
        )}

        {problem && (
          <p role="alert" className="font-semibold text-danger-ink">
            {problem}
          </p>
        )}

        {step === 'summary' ? (
          <div className="flex flex-col gap-2">
            <SubmitButton pendingLabel="Création…" className="min-h-14 text-lg">
              C’est parti
            </SubmitButton>
            <button
              type="button"
              onClick={back}
              className="inline-flex min-h-12 items-center justify-center self-center font-extrabold text-brand-ink underline underline-offset-4"
            >
              Changer mes réponses
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={next}
            className={buttonClasses('primary', 'min-h-14 text-lg')}
          >
            {step === 3 ? 'Voir mon application' : 'Continuer'}
            <ChevronRight aria-hidden className="size-5" />
          </button>
        )}
      </ActionForm>
    </div>
  );
}
