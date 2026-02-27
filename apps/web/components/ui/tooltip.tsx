'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  children,
  side = 'right',
}: {
  children: React.ReactNode;
  side?: 'right' | 'left' | 'top' | 'bottom';
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        sideOffset={8}
        className="z-50 px-2.5 py-1.5 text-xs font-medium rounded-md shadow-md
          bg-[var(--color-text-primary)] text-white
          animate-in fade-in-0 zoom-in-95"
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-[var(--color-text-primary)]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
