'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Settings, BarChart3, BrainCircuit, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const NAV_ITEMS = [
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Pins', href: '/reports', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored !== null) setCollapsed(stored === 'true');
    setIsElectron(!!window.electronAPI);
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          'border-r border-[var(--color-border)] bg-[var(--color-background)] flex flex-col h-screen shrink-0 transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-14' : 'w-56'
        )}
      >
        {/* Electron traffic-light spacer — draggable, clears the ⚫🟡🟢 buttons */}
        {isElectron && (
          <div
            className="h-9 shrink-0 w-full"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          />
        )}

        {/* Logo / header */}
        <div
          className={cn(
            'flex items-center border-b border-[var(--color-border)] shrink-0',
            collapsed ? 'h-14 justify-center' : 'h-14 px-4 gap-2'
          )}
          style={isElectron ? { WebkitAppRegion: 'drag' } as React.CSSProperties : undefined}
        >
          <BrainCircuit
            className="w-5 h-5 shrink-0"
            style={{ color: 'var(--brand-primary)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          />
          {!collapsed && (
            <span className="flex-1 font-semibold text-sm text-[var(--color-text-primary)] truncate">
              Open Query
            </span>
          )}
          {!collapsed && (
            <button
              onClick={toggle}
              className="p-1 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn('flex-1 py-3 space-y-0.5', collapsed ? 'px-1.5' : 'px-2')}>
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            const linkEl = (
              <Link
                href={href}
                className={cn(
                  'flex items-center rounded-md text-sm transition-colors',
                  collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2',
                  isActive
                    ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)] font-medium'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && label}
              </Link>
            );

            return collapsed ? (
              <Tooltip key={href}>
                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={href}>{linkEl}</div>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className={cn(
            'border-t border-[var(--color-border)] shrink-0',
            collapsed ? 'flex justify-center p-2' : 'px-4 py-3 flex items-center justify-between'
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
                  aria-label="Expand sidebar"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">open-query v0.1.0</p>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
