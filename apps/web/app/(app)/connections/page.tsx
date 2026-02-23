import Link from 'next/link';
import { ConnectionList } from '@/components/connections/ConnectionList';

export default function ConnectionsPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[1.875rem] font-semibold text-[var(--color-text-primary)]">
            Connections
          </h1>
          <p className="mt-1 text-body text-[var(--color-text-secondary)]">
            Connect to your databases to start exploring data
          </p>
        </div>
        <Link
          href="/connections/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          + New Connection
        </Link>
      </div>
      <ConnectionList />
    </div>
  );
}
