'use client';

import {
  suggestedHiddenModules,
  type SalesChannel,
  type ShopModule,
  type ShopOffer,
  type ShopProfileDto,
  type TeamSize,
} from '@nagaw/shared';
import { Check, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { OFFER_OPTIONS } from '@/lib/catalog/offer';
import {
  ALWAYS_SHOWN,
  CHANNEL_OPTIONS,
  GOAL_ICONS,
  iconOf,
  MODULE_OPTIONS,
  SECTOR_ICONS,
  TEAM_OPTIONS,
} from '@/lib/profile/choices';
import { saveProfile } from './actions';

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: LucideIcon;
}

const STEPS = ['sector', 'offer', 'channels', 'goals', 'team', 'menu'] as const;
type Step = (typeof STEPS)[number];

const QUESTIONS: Record<Step, { title: string; help: string }> = {
  sector: { title: 'Quelle est votre activité ?', help: 'Un seul choix.' },
  offer: { title: 'Que vendez-vous ?', help: 'Un seul choix.' },
  channels: {
    title: 'Comment vendez-vous ?',
    help: 'Plusieurs choix possibles.',
  },
  goals: {
    title: 'Que voulez-vous faire d’abord ?',
    help: 'Plusieurs choix possibles.',
  },
  team: { title: 'Vous êtes combien à travailler ?', help: 'Un seul choix.' },
  menu: {
    title: 'Votre menu',
    help: 'Décochez ce qui ne vous sert pas. Rien n’est effacé : vous pourrez le remettre dans Paramètres.',
  },
};

/**
 * Questions of the profile, one per screen (ADR-062, DESIGN.md). Nothing is
 * required: « Suivant » without an answer goes on, « Plus tard » leaves.
 */
export function ProfileQuestionnaire({
  organizationId,
  profile,
}: {
  organizationId: string;
  profile: ShopProfileDto;
}) {
  const [step, setStep] = useState(0);
  const [sector, setSector] = useState(profile.sector);
  const [offer, setOffer] = useState<ShopOffer>(profile.offer);
  const [channels, setChannels] = useState<SalesChannel[]>(profile.channels);
  const [goals, setGoals] = useState<string[]>(profile.goals);
  const [teamSize, setTeamSize] = useState<TeamSize | null>(profile.teamSize);
  const [hidden, setHidden] = useState<ShopModule[]>(profile.hiddenModules);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  // Answers the menu on screen was suggested from: the menu kept by an
  // answered shop counts as following its answers.
  const suggestedFrom = useRef(
    profile.status === 'answered'
      ? answersKey(profile.sector, profile.goals)
      : null,
  );

  const current = STEPS[step] ?? 'sector';
  const last = step === STEPS.length - 1;

  // The reader of a screen reader hears the new question.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [step]);

  const goTo = (next: number) => {
    moved.current = true;
    const key = answersKey(sector, goals);
    if (STEPS[next] === 'menu' && suggestedFrom.current !== key) {
      // The menu follows the answers; changed by hand, it stays until the
      // answers change.
      suggestedFrom.current = key;
      const chosen = [
        ...profile.choices.sectors.filter((choice) => choice.key === sector),
        ...profile.choices.goals.filter((choice) => goals.includes(choice.key)),
      ];
      setHidden(suggestedHiddenModules(chosen));
    }
    setStep(next);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveProfile(organizationId, {
        sector,
        channels,
        goals,
        teamSize,
        offer,
        hiddenModules: hidden,
      });
      // Success redirects to the dashboard.
      if (result.status === 'error') setError(result.message ?? null);
    });
  };

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base font-semibold text-ink-muted">
        {last
          ? 'Dernière étape'
          : `Question ${step + 1} sur ${STEPS.length - 1}`}
      </p>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-brand-strong transition-[width]"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
      <div>
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-2xl font-bold focus:outline-none"
        >
          {QUESTIONS[current].title}
        </h2>
        <p className="mt-1 text-base text-ink-muted">
          {QUESTIONS[current].help}
        </p>
      </div>

      {current === 'sector' && (
        <Choices
          legend={QUESTIONS.sector.title}
          type="radio"
          options={profile.choices.sectors.map((choice) => ({
            value: choice.key,
            label: choice.label,
            icon: iconOf(SECTOR_ICONS, choice.key),
          }))}
          isChecked={(value) => sector === value}
          onPick={(value) => setSector(value)}
        />
      )}
      {current === 'offer' && (
        <Choices
          legend={QUESTIONS.offer.title}
          type="radio"
          options={OFFER_OPTIONS}
          isChecked={(value) => offer === value}
          onPick={(value) => setOffer(value)}
        />
      )}
      {current === 'channels' && (
        <Choices
          legend={QUESTIONS.channels.title}
          type="checkbox"
          options={CHANNEL_OPTIONS}
          isChecked={(value) => channels.includes(value)}
          onPick={(value) => setChannels((list) => toggle(list, value))}
        />
      )}
      {current === 'goals' && (
        <Choices
          legend={QUESTIONS.goals.title}
          type="checkbox"
          options={profile.choices.goals.map((choice) => ({
            value: choice.key,
            label: choice.label,
            icon: iconOf(GOAL_ICONS, choice.key),
          }))}
          isChecked={(value) => goals.includes(value)}
          onPick={(value) => setGoals((list) => toggle(list, value))}
        />
      )}
      {current === 'team' && (
        <Choices
          legend={QUESTIONS.team.title}
          type="radio"
          options={TEAM_OPTIONS}
          isChecked={(value) => teamSize === value}
          onPick={(value) => setTeamSize(value)}
        />
      )}
      {current === 'menu' && (
        <>
          <Choices
            legend={QUESTIONS.menu.title}
            type="checkbox"
            options={MODULE_OPTIONS}
            isChecked={(value) => !hidden.includes(value)}
            onPick={(value) => setHidden((list) => toggle(list, value))}
          />
          <p className="text-base">
            <span className="font-bold">Toujours dans le menu :</span>{' '}
            {ALWAYS_SHOWN}.
          </p>
        </>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={pending}
            className={buttonClasses('secondary')}
          >
            Précédent
          </button>
        ) : (
          <span aria-hidden />
        )}
        <button
          type="button"
          onClick={last ? submit : () => goTo(step + 1)}
          disabled={pending}
          aria-disabled={pending}
          className={buttonClasses('primary', 'sm:min-w-48')}
        >
          {last
            ? pending
              ? 'Enregistrement…'
              : 'Enregistrer mon menu'
            : 'Suivant'}
        </button>
      </div>
    </div>
  );
}

const answersKey = (sector: string | null, goals: readonly string[]) =>
  JSON.stringify([sector, [...goals].sort()]);

/** Big cards with a picture; the choice is not told by colour alone. */
function Choices<T extends string>({
  legend,
  type,
  options,
  isChecked,
  onPick,
}: {
  legend: string;
  type: 'radio' | 'checkbox';
  options: readonly Option<T>[];
  isChecked: (value: T) => boolean;
  onPick: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const checked = isChecked(option.value);
          const Icon = option.icon;
          return (
            <label
              key={option.value}
              className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 text-base font-bold focus-within:outline-3 focus-within:outline-focus ${
                checked
                  ? 'border-brand-strong bg-brand-soft text-brand-ink'
                  : 'border-line-strong bg-surface'
              }`}
            >
              <input
                type={type}
                name={`profile-${legend}`}
                value={option.value}
                checked={checked}
                onChange={() => onPick(option.value)}
                className="sr-only"
              />
              {Icon && (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink">
                  <Icon aria-hidden className="size-6" />
                </span>
              )}
              <span className="flex flex-1 flex-col">
                {option.label}
                {option.hint && (
                  <span className="text-base font-normal text-ink-muted">
                    {option.hint}
                  </span>
                )}
              </span>
              <Check
                aria-hidden
                className={`size-6 shrink-0 ${checked ? '' : 'invisible'}`}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
