import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { CreateOrganizationForm } from '../create-organization-form';

export const metadata: Metadata = {
  title: 'Nouvelle boutique — Nagaw Business',
};

export default function NewOrganizationPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nouvelle boutique"
        description="Vous en deviendrez propriétaire. Chaque boutique a son équipe et ses données, totalement séparées des autres."
      />
      <Card>
        <CreateOrganizationForm />
      </Card>
    </div>
  );
}
