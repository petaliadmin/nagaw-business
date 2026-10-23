'use server';

import {
  agentConfigurationSchema,
  changeAgentStatusSchema,
  createAgentSchema,
  updateAgentSchema,
  type AgentDto,
  type AgentTestReportDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiAsUser, getSession } from '@/lib/api/server';
import type { ApiResult } from '@/lib/api/call-api';
import { parseValues, type FormState } from '@/lib/auth/schemas';

export type TestState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'done'; report: AgentTestReportDto };

async function requireToken() {
  const session = await getSession();
  if (session.status !== 'signed-in') redirect('/connexion');
  return session.accessToken;
}

function text(formData: FormData, name: string): string {
  return formData.get(name)?.toString() ?? '';
}

/** Hidden fields; the API checks membership and that the agent is in it. */
function ids(formData: FormData) {
  return {
    organizationId: text(formData, 'organizationId'),
    agentId: text(formData, 'agentId'),
  };
}

function configurationValues(formData: FormData) {
  return {
    instructions: text(formData, 'instructions'),
    objectives: text(formData, 'objectives'),
    maxSteps: text(formData, 'maxSteps'),
    maxDurationSeconds: text(formData, 'maxDurationSeconds'),
    errorPolicy: text(formData, 'errorPolicy'),
    tools: formData.getAll('tools').map(String),
  };
}

/** API error as form state, with field details mapped to their inputs. */
function apiError(
  result: Extract<ApiResult<unknown>, { ok: false }>,
): FormState {
  if (!result.details) return { status: 'error', message: result.message };
  const fieldErrors: Record<string, string> = {};
  for (const detail of result.details) {
    const field = detail.path.replace(/^configuration\./, '').split('.')[0];
    if (field) fieldErrors[field] ??= detail.message;
  }
  return {
    status: 'error',
    message: `${result.message} ${result.details.map((d) => d.message).join(' ')}`,
    fieldErrors,
  };
}

export async function createAgent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const { organizationId } = ids(formData);
  const parsed = parseValues(
    createAgentSchema,
    {
      name: text(formData, 'name'),
      description: text(formData, 'description'),
      roleKey: text(formData, 'roleKey'),
      configuration: configurationValues(formData),
    },
    'configuration.',
  );
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<AgentDto>(accessToken, {
    method: 'POST',
    path: '/agents',
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiError(result);
  redirect(`/espace/agents/${result.data.id}`);
}

export async function updateAgent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const { organizationId, agentId } = ids(formData);
  const parsed = parseValues(updateAgentSchema, {
    name: text(formData, 'name'),
    description: text(formData, 'description'),
    roleKey: text(formData, 'roleKey'),
  });
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<AgentDto>(accessToken, {
    method: 'PATCH',
    path: `/agents/${encodeURIComponent(agentId)}`,
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiError(result);
  refresh();
  return { status: 'success', message: 'Identité enregistrée.' };
}

export async function configureAgent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const { organizationId, agentId } = ids(formData);
  const parsed = parseValues(
    agentConfigurationSchema,
    configurationValues(formData),
  );
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<AgentDto>(accessToken, {
    method: 'POST',
    path: `/agents/${encodeURIComponent(agentId)}/versions`,
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiError(result);
  refresh();
  return {
    status: 'success',
    message: `Configuration enregistrée (version ${result.data.currentVersion.version}).`,
  };
}

export async function changeAgentStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const { organizationId, agentId } = ids(formData);
  const parsed = parseValues(changeAgentStatusSchema, {
    status: text(formData, 'status'),
  });
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<AgentDto>(accessToken, {
    method: 'POST',
    path: `/agents/${encodeURIComponent(agentId)}/status`,
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiError(result);
  refresh();
  return { status: 'success', message: 'Statut mis à jour.' };
}

export async function testAgent(
  _prev: TestState,
  formData: FormData,
): Promise<TestState> {
  const accessToken = await requireToken();
  const { organizationId, agentId } = ids(formData);
  const result = await apiAsUser<AgentTestReportDto>(accessToken, {
    method: 'POST',
    path: `/agents/${encodeURIComponent(agentId)}/test`,
    organizationId,
  });
  if (!result.ok) return { status: 'error', message: result.message };
  return { status: 'done', report: result.data };
}
