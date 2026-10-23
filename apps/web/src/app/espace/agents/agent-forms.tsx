'use client';

import {
  canTransition,
  type AgentDto,
  type AgentLimitsCaps,
  type AgentStatus,
} from '@nagaw/shared';
import { useActionState } from 'react';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import {
  changeAgentStatus,
  configureAgent,
  createAgent,
  testAgent,
  updateAgent,
  type TestState,
} from './actions';
import {
  ConfigurationFields,
  IdentityFields,
  type ConfigurationDefaults,
} from './agent-fields';

const NEW_CONFIGURATION: ConfigurationDefaults = {
  instructions: '',
  objectives: '',
  maxSteps: 10,
  maxDurationSeconds: 120,
  errorPolicy: 'escalate',
  tools: [],
};

function Hidden({
  organizationId,
  agentId,
}: {
  organizationId: string;
  agentId?: string;
}) {
  return (
    <>
      <input type="hidden" name="organizationId" value={organizationId} />
      {agentId && <input type="hidden" name="agentId" value={agentId} />}
    </>
  );
}

export function CreateAgentForm({
  organizationId,
  caps,
}: {
  organizationId: string;
  caps: AgentLimitsCaps;
}) {
  const [state, action] = useActionState(createAgent, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Hidden organizationId={organizationId} />
      <FormMessage state={state} />
      <IdentityFields
        defaults={{ name: '', description: '', roleKey: 'sales' }}
        errors={state.fieldErrors}
      />
      <ConfigurationFields
        defaults={{
          ...NEW_CONFIGURATION,
          maxSteps: Math.min(NEW_CONFIGURATION.maxSteps, caps.maxSteps),
          maxDurationSeconds: Math.min(
            NEW_CONFIGURATION.maxDurationSeconds,
            caps.maxDurationSeconds,
          ),
        }}
        caps={caps}
        errors={state.fieldErrors}
      />
      <div>
        <SubmitButton pendingLabel="Création…">
          Créer l’agent (brouillon)
        </SubmitButton>
      </div>
    </form>
  );
}

export function IdentityForm({
  organizationId,
  agent,
}: {
  organizationId: string;
  agent: AgentDto;
}) {
  const [state, action] = useActionState(updateAgent, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Hidden organizationId={organizationId} agentId={agent.id} />
      <FormMessage state={state} />
      <IdentityFields defaults={agent} errors={state.fieldErrors} />
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          Enregistrer l’identité
        </SubmitButton>
      </div>
    </form>
  );
}

export function ConfigurationForm({
  organizationId,
  agent,
  caps,
}: {
  organizationId: string;
  agent: AgentDto;
  caps: AgentLimitsCaps;
}) {
  const [state, action] = useActionState(configureAgent, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Hidden organizationId={organizationId} agentId={agent.id} />
      <FormMessage state={state} />
      <ConfigurationFields
        key={agent.currentVersion.id}
        defaults={agent.currentVersion}
        caps={caps}
        errors={state.fieldErrors}
      />
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          Enregistrer une nouvelle version
        </SubmitButton>
      </div>
    </form>
  );
}

const STATUS_ACTIONS: { to: AgentStatus; label: string }[] = [
  { to: 'active', label: 'Activer' },
  { to: 'suspended', label: 'Suspendre' },
  { to: 'archived', label: 'Archiver' },
];

export function StatusActions({
  organizationId,
  agent,
}: {
  organizationId: string;
  agent: AgentDto;
}) {
  const [state, action] = useActionState(changeAgentStatus, initialFormState);
  const actions = STATUS_ACTIONS.filter(({ to }) =>
    canTransition(agent.status, to),
  );
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start gap-2">
        {actions.map(({ to, label }) => (
          <form key={to} action={action} className="flex flex-col gap-1">
            <Hidden organizationId={organizationId} agentId={agent.id} />
            <input type="hidden" name="status" value={to} />
            {to === 'archived' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="confirm" required />
                Archivage définitif
              </label>
            )}
            <SubmitButton variant="secondary" pendingLabel="…">
              {label}
            </SubmitButton>
          </form>
        ))}
      </div>
      <FormMessage state={state} />
    </div>
  );
}

const initialTest: TestState = { status: 'idle' };

export function TestPanel({
  organizationId,
  agentId,
}: {
  organizationId: string;
  agentId: string;
}) {
  const [state, action] = useActionState(testAgent, initialTest);
  return (
    <div className="flex flex-col gap-4">
      <form action={action}>
        <Hidden organizationId={organizationId} agentId={agentId} />
        <SubmitButton variant="secondary" pendingLabel="Test en cours…">
          Lancer le test contrôlé
        </SubmitButton>
      </form>
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          Test impossible : {state.message}
        </p>
      )}
      {state.status === 'done' && (
        <div
          role="region"
          aria-label="Résultat du test"
          className="flex flex-col gap-3 text-sm"
        >
          <p className="font-medium">
            {state.report.ready
              ? `Version ${state.report.testedVersion} : prête à être activée.`
              : `Version ${state.report.testedVersion} : incomplète, l’activation est bloquée.`}
          </p>
          <ul className="flex flex-col gap-1">
            {state.report.checks.map((check) => (
              <li
                key={`${check.code}-${check.message}`}
                className={
                  check.severity === 'error'
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-amber-800 dark:text-amber-300'
                }
              >
                {check.severity === 'error' ? 'Bloquant' : 'Avertissement'} :{' '}
                {check.message}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1">
            <p className="font-medium">Consignes assemblées pour l’agent</p>
            <pre className="whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900">
              {state.report.brief}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
