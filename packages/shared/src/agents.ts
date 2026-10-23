import { z } from 'zod';

/** Business area of an agent; display only, no behavior attached. */
export const AGENT_ROLE_KEYS = [
  'sales',
  'finance',
  'marketing',
  'hr',
  'management',
  'customer_service',
  'operations',
  'other',
] as const;
export type AgentRoleKey = (typeof AGENT_ROLE_KEYS)[number];

export const AGENT_STATUSES = [
  'draft',
  'active',
  'suspended',
  'archived',
] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const ERROR_POLICIES = ['stop', 'retry_once', 'escalate'] as const;
export type ErrorPolicy = (typeof ERROR_POLICIES)[number];

/**
 * Tools an agent may be allowed to use. A tool can only be granted once it
 * is implemented and tested (`available: true`); planned tools are listed
 * so the interface can say what is coming, never as usable.
 */
export const TOOL_REGISTRY = {
  'email.send': {
    label: 'Envoyer un e-mail',
    description:
      'Envoie un e-mail au nom de l’organisation, après approbation humaine.',
    available: false,
  },
} as const satisfies Record<
  string,
  { label: string; description: string; available: boolean }
>;
export type ToolKey = keyof typeof TOOL_REGISTRY;
export const TOOL_KEYS = Object.keys(TOOL_REGISTRY) as ToolKey[];

/** Absolute bounds; each organization sets its own, lower caps in base. */
export const AGENT_LIMIT_BOUNDS = {
  maxSteps: { min: 1, max: 100 },
  maxDurationSeconds: { min: 10, max: 3600 },
} as const;

const textField = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} : au moins ${min} caractères`)
    .max(max, `${label} : au plus ${max} caractères`);

export const agentIdentitySchema = z.object({
  name: textField(2, 80, 'Nom'),
  description: textField(0, 500, 'Description'),
  roleKey: z.enum(AGENT_ROLE_KEYS),
});

export const agentConfigurationSchema = z
  .object({
    instructions: textField(0, 20_000, 'Instructions'),
    objectives: textField(0, 2_000, 'Objectifs'),
    maxSteps: z.coerce
      .number()
      .int('Nombre entier attendu')
      .min(AGENT_LIMIT_BOUNDS.maxSteps.min)
      .max(AGENT_LIMIT_BOUNDS.maxSteps.max),
    maxDurationSeconds: z.coerce
      .number()
      .int('Nombre entier attendu')
      .min(AGENT_LIMIT_BOUNDS.maxDurationSeconds.min)
      .max(AGENT_LIMIT_BOUNDS.maxDurationSeconds.max),
    errorPolicy: z.enum(ERROR_POLICIES),
    tools: z
      .array(z.enum(TOOL_KEYS as [ToolKey, ...ToolKey[]]))
      .max(TOOL_KEYS.length)
      .refine((tools) => new Set(tools).size === tools.length, {
        message: 'Outil en double',
      })
      .default([]),
  })
  .strict();
export type AgentConfigurationInput = z.infer<typeof agentConfigurationSchema>;

export const createAgentSchema = agentIdentitySchema
  .extend({ configuration: agentConfigurationSchema })
  .strict();
export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = agentIdentitySchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à modifier',
  });
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export const changeAgentStatusSchema = z
  .object({ status: z.enum(AGENT_STATUSES) })
  .strict();
export type ChangeAgentStatusInput = z.infer<typeof changeAgentStatusSchema>;

export interface AgentLimitsCaps {
  maxAgents: number;
  maxSteps: number;
  maxDurationSeconds: number;
}

export interface AgentVersionDto {
  id: string;
  version: number;
  instructions: string;
  objectives: string;
  maxSteps: number;
  maxDurationSeconds: number;
  errorPolicy: ErrorPolicy;
  tools: ToolKey[];
  createdAt: string;
  createdBy: { userId: string; email: string };
}

export interface AgentDto {
  id: string;
  name: string;
  description: string;
  roleKey: AgentRoleKey;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
  currentVersion: AgentVersionDto;
}

export type AgentCheckCode =
  | 'INSTRUCTIONS_TOO_SHORT'
  | 'OBJECTIVES_MISSING'
  | 'TOOL_UNAVAILABLE'
  | 'MAX_STEPS_ABOVE_CAP'
  | 'MAX_DURATION_ABOVE_CAP'
  | 'AGENT_ARCHIVED'
  | 'NO_AI_MODEL'
  | 'NO_TOOLS';

export interface AgentCheck {
  code: AgentCheckCode;
  severity: 'error' | 'warning';
  message: string;
}

/** Result of the controlled test: no model is called (ADR-007). */
export interface AgentTestReportDto {
  ready: boolean;
  checks: AgentCheck[];
  /** The brief the agent would receive, assembled from its configuration. */
  brief: string;
  testedVersion: number;
}

export const MIN_INSTRUCTIONS_LENGTH = 20;

/**
 * Deterministic readiness checks of a configuration against the
 * organization's caps. Errors block activation; warnings are shown.
 */
export function checkAgentConfiguration(
  agent: { status: AgentStatus },
  configuration: Pick<
    AgentConfigurationInput,
    'instructions' | 'objectives' | 'maxSteps' | 'maxDurationSeconds' | 'tools'
  >,
  caps: Pick<AgentLimitsCaps, 'maxSteps' | 'maxDurationSeconds'>,
): AgentCheck[] {
  const checks: AgentCheck[] = [];
  const error = (code: AgentCheckCode, message: string) =>
    checks.push({ code, severity: 'error', message });
  const warning = (code: AgentCheckCode, message: string) =>
    checks.push({ code, severity: 'warning', message });

  if (agent.status === 'archived') {
    error('AGENT_ARCHIVED', 'L’agent est archivé.');
  }
  if (configuration.instructions.trim().length < MIN_INSTRUCTIONS_LENGTH) {
    error(
      'INSTRUCTIONS_TOO_SHORT',
      `Les instructions doivent contenir au moins ${MIN_INSTRUCTIONS_LENGTH} caractères.`,
    );
  }
  if (configuration.objectives.trim().length === 0) {
    error('OBJECTIVES_MISSING', 'Indiquez au moins un objectif.');
  }
  for (const tool of configuration.tools) {
    if (!TOOL_REGISTRY[tool].available) {
      error(
        'TOOL_UNAVAILABLE',
        `L’outil « ${TOOL_REGISTRY[tool].label} » n’est pas encore disponible.`,
      );
    }
  }
  if (configuration.maxSteps > caps.maxSteps) {
    error(
      'MAX_STEPS_ABOVE_CAP',
      `Au plus ${caps.maxSteps} étapes par exécution dans cette organisation.`,
    );
  }
  if (configuration.maxDurationSeconds > caps.maxDurationSeconds) {
    error(
      'MAX_DURATION_ABOVE_CAP',
      `Au plus ${caps.maxDurationSeconds} secondes par exécution dans cette organisation.`,
    );
  }
  warning(
    'NO_AI_MODEL',
    'Aucun modèle d’IA n’est configuré sur la plateforme : l’agent ne pourra exécuter que des outils déterministes.',
  );
  if (configuration.tools.length === 0) {
    warning('NO_TOOLS', 'Aucun outil n’est autorisé pour cet agent.');
  }
  return checks;
}

/** Allowed status changes. Archiving is final. */
const TRANSITIONS: Record<AgentStatus, readonly AgentStatus[]> = {
  draft: ['active', 'archived'],
  active: ['suspended', 'archived'],
  suspended: ['active', 'archived'],
  archived: [],
};

export function canTransition(from: AgentStatus, to: AgentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Text assembled from the configuration, shown by the controlled test. */
export function buildAgentBrief(
  agent: { name: string; roleKey: AgentRoleKey },
  configuration: Pick<
    AgentConfigurationInput,
    'instructions' | 'objectives' | 'maxSteps' | 'maxDurationSeconds' | 'tools'
  > & { errorPolicy: ErrorPolicy },
  labels: {
    role: Record<AgentRoleKey, string>;
    errorPolicy: Record<ErrorPolicy, string>;
  },
): string {
  const tools = configuration.tools.length
    ? configuration.tools.map((tool) => TOOL_REGISTRY[tool].label).join(', ')
    : 'aucun';
  return [
    `Agent : ${agent.name} (${labels.role[agent.roleKey]})`,
    '',
    'Objectifs :',
    configuration.objectives.trim() || '—',
    '',
    'Instructions :',
    configuration.instructions.trim() || '—',
    '',
    `Outils autorisés : ${tools}`,
    `Limites : ${configuration.maxSteps} étapes, ${configuration.maxDurationSeconds} secondes par exécution`,
    `En cas d’erreur : ${labels.errorPolicy[configuration.errorPolicy]}`,
  ].join('\n');
}

export const AGENT_ROLE_LABELS: Record<AgentRoleKey, string> = {
  sales: 'Commercial',
  finance: 'Finance',
  marketing: 'Marketing',
  hr: 'Ressources humaines',
  management: 'Direction',
  customer_service: 'Service client',
  operations: 'Opérations',
  other: 'Autre',
};

export const ERROR_POLICY_LABELS: Record<ErrorPolicy, string> = {
  stop: 'arrêter l’exécution',
  retry_once: 'réessayer une fois, puis arrêter',
  escalate: 'arrêter et prévenir un responsable',
};
