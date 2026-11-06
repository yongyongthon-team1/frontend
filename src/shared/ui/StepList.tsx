import { cn } from '@/shared/lib/cn';

// V2 단계 목록(H08 · H14 · G09): `01 신청 접수` 꼴. current(0부터)는 brand, 나머지는 muted.
export function StepList({ steps, current }: { steps: string[]; current?: number }) {
  return (
    <ol className="flex flex-col gap-2.5 rounded-xl bg-surface p-4">
      {steps.map((step, index) => {
        const isCurrent = index === current;
        return (
          <li
            key={step}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'text-[13px]',
              isCurrent ? 'font-bold text-brand' : 'font-medium text-muted',
            )}
          >
            <span className="tabular-nums">{String(index + 1).padStart(2, '0')}</span> {step}
          </li>
        );
      })}
    </ol>
  );
}
