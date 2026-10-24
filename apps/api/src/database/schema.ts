import type { ColumnType, Generated } from 'kysely';

/**
 * Kysely view of the `app` schema. Must mirror supabase/migrations — the SQL
 * migrations are the source of truth (ADR-004).
 */
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;

export interface UserProfilesTable {
  id: string;
  email: string;
  display_name: string | null;
  locale: Generated<string>;
  timezone: Generated<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface OrganizationsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  status: Generated<'active' | 'suspended'>;
  timezone: Generated<string>;
  default_currency: Generated<string>;
  invitation_ttl_hours: Generated<number>;
  max_pending_invitations: Generated<number>;
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface OrganizationMembershipsTable {
  id: Generated<string>;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: Generated<'active' | 'disabled'>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface OrganizationInvitationsTable {
  id: Generated<string>;
  organization_id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  token_hash: Buffer;
  status: Generated<'pending' | 'accepted' | 'revoked' | 'expired'>;
  invited_by: string;
  expires_at: Timestamp;
  accepted_by: string | null;
  accepted_at: NullableTimestamp;
  revoked_by: string | null;
  revoked_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AuditLogsTable {
  // bigint comes back from pg as a string.
  id: ColumnType<string, never, never>;
  organization_id: string | null;
  actor_type: 'user' | 'agent' | 'system' | 'platform_admin';
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: ColumnType<Record<string, unknown>, string | undefined, never>;
  request_id: string | null;
  created_at: ColumnType<Date, never, never>;
}

export interface Database {
  'app.user_profiles': UserProfilesTable;
  'app.organizations': OrganizationsTable;
  'app.organization_memberships': OrganizationMembershipsTable;
  'app.organization_invitations': OrganizationInvitationsTable;
  'app.audit_logs': AuditLogsTable;
}
