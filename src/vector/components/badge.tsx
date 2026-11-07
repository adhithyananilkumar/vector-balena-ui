import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/** Square status tag: small caps, hairline border. */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 border px-1.5 py-0.5 text-[10px] font-semibold leading-4 tracking-[0.06em] whitespace-nowrap uppercase',
  {
    variants: {
      variant: {
        default: 'border-border text-muted-foreground',
        success: 'border-success/40 text-success',
        warning: 'border-warning/40 text-warning',
        destructive: 'border-destructive/40 text-destructive',
        accent: 'border-accent/40 text-accent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
