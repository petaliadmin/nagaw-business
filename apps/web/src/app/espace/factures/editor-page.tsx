import { roleHasPermission } from '@nagaw/shared';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import type { requireReadyWorkspace } from '@/lib/workspace/load';
import { DocumentEditor, type EditorDocument } from './document-editor';
import { loadEditorData } from './editor-data';

type Workspace = NonNullable<Awaited<ReturnType<typeof requireReadyWorkspace>>>;

/** Page around the editor: permission, data, then the form. */
export async function EditorPage({
  workspace,
  kind,
  title,
  initial,
  documentId,
}: {
  workspace: Workspace;
  kind: 'quote' | 'invoice';
  title: string;
  initial: EditorDocument;
  documentId?: string;
}) {
  const { organization, accessToken } = workspace;
  if (!roleHasPermission(organization.role, 'documents.manage'))
    return (
      <>
        <PageHeader title={title} />
        <Alert>
          Seuls le propriétaire et les gérants font les factures et les devis.
        </Alert>
      </>
    );
  const data = await loadEditorData(accessToken, organization.id);
  return (
    <>
      <PageHeader title={title} />
      {!data.ok ? (
        <Alert tone="error">Formulaire indisponible : {data.message}</Alert>
      ) : (
        <Card>
          <DocumentEditor
            kind={kind}
            organizationId={organization.id}
            currency={organization.defaultCurrency}
            customers={data.customers}
            products={data.products}
            taxRates={data.taxRates}
            initial={initial}
            documentId={documentId}
          />
        </Card>
      )}
    </>
  );
}

export const EMPTY_LINE: EditorDocument['lines'][number] = {
  productId: null,
  label: '',
  unit: 'piece',
  quantity: 1,
  unitPrice: 0,
  taxRateBasisPoints: null,
};
