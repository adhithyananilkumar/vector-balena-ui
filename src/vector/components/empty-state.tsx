import React from 'react';
import { cn } from '../lib/utils';

/** Centered empty state: a doodle, a short title, one line of help and an optional action. */
export const EmptyState: React.FC<{
  doodle: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ doodle, title, text, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
    <div className='w-full max-w-[300px] text-foreground/55 [&_svg]:h-auto [&_svg]:w-full'>{doodle}</div>
    <h3 className='mt-6 text-sm font-semibold'>{title}</h3>
    <p className='mt-1.5 max-w-sm text-[13px] text-muted-foreground'>{text}</p>
    {action && <div className='mt-5'>{action}</div>}
  </div>
);
