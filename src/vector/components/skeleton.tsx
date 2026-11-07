import { cn } from '../lib/utils';

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    aria-hidden
    className={cn(
      'animate-shimmer bg-foreground/[0.05] bg-[linear-gradient(110deg,transparent_30%,color-mix(in_oklab,var(--foreground)_8%,transparent)_50%,transparent_70%)] bg-[length:200%_100%]',
      className,
    )}
    {...props}
  />
);
