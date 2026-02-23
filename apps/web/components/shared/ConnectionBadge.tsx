import { cn } from '@/lib/utils';
import type { ConnectionType } from '@open-query/shared';
import { CONNECTION_TYPE_LABELS } from '@open-query/shared';

interface ConnectionBadgeProps {
  type: ConnectionType;
  className?: string;
}

const TYPE_COLORS: Record<ConnectionType, string> = {
  postgres: 'bg-blue-50 text-blue-700 border-blue-200',
  mysql: 'bg-orange-50 text-orange-700 border-orange-200',
  sqlite: 'bg-green-50 text-green-700 border-green-200',
  mongodb: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function ConnectionBadge({ type, className }: ConnectionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-label font-medium border',
        TYPE_COLORS[type],
        className
      )}
    >
      {CONNECTION_TYPE_LABELS[type]}
    </span>
  );
}
