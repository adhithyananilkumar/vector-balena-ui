import * as React from 'react';
import { useTheme } from '@mui/material';
import { cn } from '../lib/utils';

/** Applies the Vector design tokens (and the matching light/dark set) to everything inside. */
export const VxScope = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { mode?: 'dark' | 'light' }
>(({ className, mode, ...props }, ref) => {
  const themeMode = useTheme().palette.mode;
  const resolved = mode ?? themeMode;
  return <div ref={ref} className={cn('vx', resolved === 'dark' && 'dark', className)} {...props} />;
});
VxScope.displayName = 'VxScope';
