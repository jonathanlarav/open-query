'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Settings, BarChart3, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Pins', href: '/reports', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-[var(--color-border)] bg-[var(--color-background)] flex flex-col h-screen">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-6 h-6" style={{ color: 'var(--brand-primary)' }} />
          <span className="font-semibold text-sm text-[var(--color-text-primary)]">
            Open Query
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)] font-medium'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--color-border)]">
        <p className="text-label text-[var(--color-text-muted)]">open-query v0.1.0</p>
      </div>
    </aside>
  );
}
