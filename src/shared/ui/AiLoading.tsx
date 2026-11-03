import { useEffect, useState } from 'react';

// AI 처리 중 단계 문구를 intervalMs마다 바꿔 보여 준다. 마지막 문구에서 멈춘다(반복하지 않는다).
export function AiLoading({ steps, intervalMs = 1200 }: { steps: string[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  const last = Math.max(steps.length - 1, 0);

  useEffect(() => {
    if (index >= last) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), intervalMs);
    return () => clearTimeout(timer);
  }, [index, last, intervalMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 px-5 py-10 text-center"
    >
      <span aria-hidden className="animate-pulse text-3xl text-accent motion-reduce:animate-none">
        ✦
      </span>
      <p className="text-base font-semibold text-ink">{steps[Math.min(index, last)]}</p>
    </div>
  );
}
