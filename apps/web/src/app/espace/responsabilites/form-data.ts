import 'server-only';
import type {
  AgentDto,
  MemberDto,
  ResponsibilityLimitsCaps,
} from '@nagaw/shared';
import { apiAsUser } from '@/lib/api/server';
import type { Option } from './responsibility-forms';

export type ResponsibilityFormData =
  | {
      ok: true;
      agents: Option[];
      members: Option[];
      caps: ResponsibilityLimitsCaps;
    }
  | { ok: false; message: string };

/** Choices offered by the responsibility form: real agents and members. */
export async function loadFormData(
  accessToken: string,
  organizationId: string,
): Promise<ResponsibilityFormData> {
  const [agents, members, caps] = await Promise.all([
    apiAsUser<AgentDto[]>(accessToken, { path: '/agents', organizationId }),
    apiAsUser<MemberDto[]>(accessToken, {
      path: '/organizations/current/members',
      organizationId,
    }),
    apiAsUser<ResponsibilityLimitsCaps>(accessToken, {
      path: '/responsibilities/limits',
      organizationId,
    }),
  ]);
  for (const result of [agents, members, caps]) {
    if (!result.ok) return { ok: false, message: result.message };
  }
  if (!agents.ok || !members.ok || !caps.ok) {
    return { ok: false, message: 'Données indisponibles.' };
  }
  return {
    ok: true,
    agents: agents.data.map((agent) => ({
      value: agent.id,
      label: agent.name,
    })),
    members: members.data
      .filter((member) => member.status === 'active')
      .map((member) => ({
        value: member.userId,
        label: member.displayName ?? member.email,
      })),
    caps: caps.data,
  };
}
