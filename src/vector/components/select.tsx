import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

/** Native select styled like Input, so it is keyboard- and screen-reader-friendly for free. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className='relative'>
      <select
        ref={ref}
        className={cn(
          // the open list is drawn by the browser: it needs an opaque background and explicit option colours,
          // otherwise it opens white and the light option text cannot be read
          'h-10 w-full appearance-none border border-input bg-card pr-9 pl-3 text-sm text-foreground transition-colors outline-none hover:border-foreground/30 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 [&_option]:bg-card [&_option]:text-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className='pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground' aria-hidden />
    </div>
  ),
);
Select.displayName = 'Select';
