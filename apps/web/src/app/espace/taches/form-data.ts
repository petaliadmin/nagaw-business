import 'server-only';
import {
  roleHasPermission,
  type MemberDto,
  type OrganizationWithRoleDto,
  type ResponsibilityDto,
} from '@nagaw/shared';
import { apiAsUser } from '@/lib/api/server';
import type { Option, ResponsibilityOption } from './task-forms';

export type TaskFormData =
  | { ok: true; members: Option[]; responsibilities: ResponsibilityOption[] }
  | { ok: false; message: string };

/**
 * Choices offered when launching a task. Managers pick any active member
 * and active responsibility; a member launches only for themself, on the
 * responsibilities entrusted to them (the API enforces the same rule).
 */
export async function loadTaskFormData(
  accessToken: string,
  organization: OrganizationWithRoleDto,
  userId: string,
): Promise<TaskFormData> {
  const manager = roleHasPermission(organization.role, 'tasks.manage');
  const [members, responsibilities] = await Promise.all([
    apiAsUser<MemberDto[]>(accessToken, {
      path: '/organizations/current/members',
      organizationId: organization.id,
    }),
    apiAsUser<ResponsibilityDto[]>(accessToken, {
      path: manager
        ? '/responsibilities'
        : `/responsibilities?assigneeUserId=${encodeURIComponent(userId)}`,
      organizationId: organization.id,
    }),
  ]);
  if (!members.ok) return { ok: false, message: members.message };
  if (!responsibilities.ok)
    return { ok: false, message: responsibilities.message };
  return {
    ok: true,
    members: members.data
      .filter(
        (member) =>
          member.status === 'active' && (manager || member.userId === userId),
      )
      .map((member) => ({
        value: member.userId,
        label: member.displayName ?? member.email,
      })),
    responsibilities: responsibilities.data
      .filter((responsibility) => responsibility.status === 'active')
      .map((responsibility) => ({
        value: responsibility.id,
        label: responsibility.title,
        assigneeUserId: responsibility.assignee.userId,
      })),
  };
}
