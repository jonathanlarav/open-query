import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

interface ActionableErrorProps {
  message: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function ActionableError({ message, action, className = '' }: ActionableErrorProps) {
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50 ${className}`}
    >
      <AlertCircle className="w-4 h-4 text-[var(--color-error)] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--color-error)]">{message}</p>
        {action && (
          <div className="mt-2">
            {action.href ? (
              <Link
                href={action.href}
                className="inline-flex items-center text-sm font-medium text-white px-3 py-1.5 rounded-md"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {action.label} →
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="inline-flex items-center text-sm font-medium text-white px-3 py-1.5 rounded-md"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {action.label} →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
