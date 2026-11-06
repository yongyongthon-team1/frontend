import { cn } from '@/shared/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-md bg-neutral-100 motion-reduce:animate-none',
        className,
      )}
    />
  );
}
