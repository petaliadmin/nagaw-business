import { z } from 'zod';
import type { MemberStatus } from './members.js';

export const RESPONSIBILITY_STATUSES = [
  'draft',
  'active',
  'suspended',
  'archived',
] as const;
export type ResponsibilityStatus = (typeof RESPONSIBILITY_STATUSES)[number];

/** Absolute bound; each organization sets its own, lower cap in base. */
export const MAX_RUNS_PER_DAY_BOUND = 1000;

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} : au moins ${min} caractères`)
    .max(max, `${label} : au plus ${max} caractères`);

/** Empty form inputs become null; anything else must be a valid value. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    schema.nullable(),
  );

const isoDate = z.iso.date('Date au format AAAA-MM-JJ attendue');

const responsibilityFields = {
  title: text(3, 120, 'Titre'),
  objective: text(0, 2000, 'Objectif'),
  scope: text(0, 2000, 'Périmètre'),
  rules: text(0, 5000, 'Règles'),
  successCriteria: text(0, 2000, 'Critères de réussite'),
  maxRunsPerDay: z.coerce
    .number()
    .int('Nombre entier attendu')
    .min(1, 'Au moins 1')
    .max(MAX_RUNS_PER_DAY_BOUND),
  escalationUserId: optional(z.uuid('Membre inconnu')),
  startsOn: optional(isoDate),
  endsOn: optional(isoDate),
};

function checkPeriod(
  value: { startsOn?: string | null; endsOn?: string | null },
  ctx: z.RefinementCtx,
) {
  if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
    ctx.addIssue({
      code: 'custom',
      path: ['endsOn'],
      message: 'La date de fin doit suivre la date de début',
    });
  }
}

export const createResponsibilitySchema = z
  .object({
    assigneeUserId: z.uuid('Membre inconnu'),
    ...responsibilityFields,
  })
  .strict()
  .superRefine(checkPeriod);
export type CreateResponsibilityInput = z.infer<
  typeof createResponsibilitySchema
>;

/** Full replacement of the editable fields (the assignee can change). */
export const updateResponsibilitySchema = createResponsibilitySchema;
export type UpdateResponsibilityInput = CreateResponsibilityInput;

export const changeResponsibilityStatusSchema = z
  .object({ status: z.enum(RESPONSIBILITY_STATUSES) })
  .strict();

export interface ResponsibilityLimitsCaps {
  maxResponsibilities: number;
  maxRunsPerDay: number;
}

export interface ResponsibilityDto {
  id: string;
  /** The member the responsibility is entrusted to. */
  assignee: {
    userId: string;
    email: string;
    displayName: string | null;
    status: MemberStatus;
  };
  title: string;
  objective: string;
  scope: string;
  rules: string;
  successCriteria: string;
  maxRunsPerDay: number;
  escalation: { userId: string; email: string } | null;
  startsOn: string | null;
  endsOn: string | null;
  status: ResponsibilityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ResponsibilityHistoryEntryDto {
  id: string;
  action: string;
  actor: { userId: string; email: string } | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const TRANSITIONS: Record<
  ResponsibilityStatus,
  readonly ResponsibilityStatus[]
> = {
  draft: ['active', 'archived'],
  active: ['suspended', 'archived'],
  suspended: ['active', 'archived'],
  archived: [],
};

export function canTransitionResponsibility(
  from: ResponsibilityStatus,
  to: ResponsibilityStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export type ResponsibilityCheckCode =
  | 'ASSIGNEE_NOT_ACTIVE'
  | 'OBJECTIVE_MISSING'
  | 'SUCCESS_CRITERIA_MISSING'
  | 'RUNS_ABOVE_CAP'
  | 'PERIOD_ENDED';

export interface ResponsibilityCheck {
  code: ResponsibilityCheckCode;
  message: string;
}

/**
 * What blocks activation: an active member in charge, a stated objective
 * and a way to tell success.
 */
export function responsibilityActivationBlockers(
  responsibility: Pick<
    CreateResponsibilityInput,
    'objective' | 'successCriteria' | 'maxRunsPerDay' | 'endsOn'
  >,
  assigneeStatus: MemberStatus,
  caps: Pick<ResponsibilityLimitsCaps, 'maxRunsPerDay'>,
  today: string,
): ResponsibilityCheck[] {
  const blockers: ResponsibilityCheck[] = [];
  if (assigneeStatus !== 'active') {
    blockers.push({
      code: 'ASSIGNEE_NOT_ACTIVE',
      message: 'La personne responsable doit être un membre actif.',
    });
  }
  if (responsibility.objective.trim() === '') {
    blockers.push({
      code: 'OBJECTIVE_MISSING',
      message: 'Indiquez l’objectif de la responsabilité.',
    });
  }
  if (responsibility.successCriteria.trim() === '') {
    blockers.push({
      code: 'SUCCESS_CRITERIA_MISSING',
      message: 'Indiquez comment juger la réussite.',
    });
  }
  if (responsibility.maxRunsPerDay > caps.maxRunsPerDay) {
    blockers.push({
      code: 'RUNS_ABOVE_CAP',
      message: `Au plus ${caps.maxRunsPerDay} tâches par jour dans cette organisation.`,
    });
  }
  if (responsibility.endsOn && responsibility.endsOn < today) {
    blockers.push({
      code: 'PERIOD_ENDED',
      message: 'La période de la responsabilité est terminée.',
    });
  }
  return blockers;
}
