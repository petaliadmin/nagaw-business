import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { CreateOrganizationForm } from '../create-organization-form';

export const metadata: Metadata = {
  title: 'Nouvelle organisation — Nagaw Business',
};

export default function NewOrganizationPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nouvelle organisation"
        description="Vous en deviendrez propriétaire. Chaque organisation a ses membres et ses données, totalement séparés des autres."
      />
      <Card>
        <CreateOrganizationForm />
      </Card>
    </div>
  );
}
