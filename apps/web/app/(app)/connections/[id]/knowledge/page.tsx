import { KnowledgeViewer } from '@/components/context/KnowledgeViewer';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KnowledgePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/settings"
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Knowledge Base</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Business context and data profiles automatically learned for this connection.
        </p>
      </div>
      <KnowledgeViewer connectionId={id} />
    </div>
  );
}
