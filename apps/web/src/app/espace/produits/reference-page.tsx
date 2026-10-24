import { roleHasPermission } from '@nagaw/shared';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { ApiResult } from '@/lib/api/call-api';
import type { requireReadyWorkspace } from '@/lib/workspace/load';
import {
  CreateReferenceForm,
  ReferenceRowActions,
  type ReferenceItem,
  type ReferenceKind,
} from './reference-forms';

type ReadyWorkspace = NonNullable<
  Awaited<ReturnType<typeof requireReadyWorkspace>>
>;

/**
 * Shared layout of the category, supplier and tax rate lists: add form for
 * managers, active items first, archived ones below.
 */
export function ReferenceList<T extends ReferenceItem>({
  kind,
  workspace,
  items,
  addTitle,
  addLabel,
  emptyTitle,
  listLabel,
  describe,
}: {
  kind: ReferenceKind;
  workspace: ReadyWorkspace;
  items: ApiResult<T[]>;
  addTitle: string;
  addLabel: string;
  emptyTitle: string;
  listLabel: string;
  /** Second line of a row (product count, phone, rate…). */
  describe: (item: T) => ReactNode;
}) {
  const { organization } = workspace;
  const canManage = roleHasPermission(organization.role, 'catalog.manage');
  if (!items.ok)
    return <Alert tone="error">Liste indisponible : {items.message}</Alert>;
  const sorted = [...items.data].sort(
    (a, b) => Number(a.status === 'archived') - Number(b.status === 'archived'),
  );
  return (
    <>
      {canManage && (
        <Card title={addTitle} titleId={`add-${kind}`} icon={Plus}>
          <CreateReferenceForm
            kind={kind}
            organizationId={organization.id}
            submitLabel={addLabel}
          />
        </Card>
      )}
      {sorted.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <ul aria-label={listLabel} className="flex flex-col gap-3">
          {sorted.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold">{item.name}</span>
                {item.status === 'archived' && <Badge>Archivé</Badge>}
              </div>
              <div className="text-ink-muted">{describe(item)}</div>
              {canManage && (
                <ReferenceRowActions
                  kind={kind}
                  organizationId={organization.id}
                  item={item}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
