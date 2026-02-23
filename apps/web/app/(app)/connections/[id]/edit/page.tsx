import Link from 'next/link';
import { EditConnectionForm } from '@/components/connections/EditConnectionForm';

interface EditConnectionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditConnectionPage({ params }: EditConnectionPageProps) {
  const { id } = await params;
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href="/settings"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 inline-block"
        >
          ← Back to Settings
        </Link>
        <h1 className="text-[1.875rem] font-semibold text-[var(--color-text-primary)]">
          Edit Connection
        </h1>
        <p className="mt-1 text-body text-[var(--color-text-secondary)]">
          Update the connection name or credentials
        </p>
      </div>
      <EditConnectionForm connectionId={id} />
    </div>
  );
}
