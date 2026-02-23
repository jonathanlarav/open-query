import Link from 'next/link';
import { ConnectionForm } from '@/components/connections/ConnectionForm';

export default function NewConnectionPage() {
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
          New Connection
        </h1>
        <p className="mt-1 text-body text-[var(--color-text-secondary)]">
          Connect to a database using a read-only user for best security
        </p>
      </div>
      <ConnectionForm />
    </div>
  );
}
