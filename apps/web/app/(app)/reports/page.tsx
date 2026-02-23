import { ReportsList } from '@/components/reports/ReportsList';

export default function ReportsPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-[1.875rem] font-semibold text-[var(--color-text-primary)]">
          Pins
        </h1>
        <p className="mt-1 text-body text-[var(--color-text-secondary)]">
          Saved queries pinned from chat sessions
        </p>
      </div>
      <ReportsList />
    </div>
  );
}
