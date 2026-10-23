import 'server-only';
import type { MemberDto, ResponsibilityLimitsCaps } from '@nagaw/shared';
import { apiAsUser } from '@/lib/api/server';
import type { Option } from './responsibility-forms';

export type ResponsibilityFormData =
  | { ok: true; members: Option[]; caps: ResponsibilityLimitsCaps }
  | { ok: false; message: string };

/** Choices offered by the responsibility form: the active members. */
export async function loadFormData(
  accessToken: string,
  organizationId: string,
): Promise<ResponsibilityFormData> {
  const [members, caps] = await Promise.all([
    apiAsUser<MemberDto[]>(accessToken, {
      path: '/organizations/current/members',
      organizationId,
    }),
    apiAsUser<ResponsibilityLimitsCaps>(accessToken, {
      path: '/responsibilities/limits',
      organizationId,
    }),
  ]);
  if (!members.ok) return { ok: false, message: members.message };
  if (!caps.ok) return { ok: false, message: caps.message };
  return {
    ok: true,
    members: members.data
      .filter((member) => member.status === 'active')
      .map((member) => ({
        value: member.userId,
        label: member.displayName ?? member.email,
      })),
    caps: caps.data,
  };
}
