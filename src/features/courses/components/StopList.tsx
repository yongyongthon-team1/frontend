import type { CourseStop } from '@/features/courses/model';
import { cn } from '@/shared/lib/cn';
import { circled } from '@/shared/lib/date';

export interface StopListProps {
  stops: CourseStop[];
  onSelect(stopId: number): void;
}

/**
 * 코스 지점 카드 목록(와이어 hs-s08). 카드를 누르면 그 지점의 상점 시트를 연다. 둘째 줄은 가이드 한줄평(없으면
 * 추천 이유)이고, 제휴 상점은 회색 카드에 쿠폰 안내 줄이 하나 더 붙는다 — 쿠폰이 걸린 곳이라 한줄평을 가리지 않는다.
 */
export function StopList({ stops, onSelect }: StopListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {stops.map((stop) => {
        const detail = stop.description ?? stop.recommendationReason;
        return (
          <li key={stop.id}>
            <button
              type="button"
              onClick={() => onSelect(stop.id)}
              className={cn(
                'w-full rounded-lg p-5 text-left',
                stop.partnership ? 'bg-surface' : 'border border-border bg-bg hover:bg-surface/60',
              )}
            >
              <span className="block text-base font-bold text-ink">
                {`${circled(stop.order)} ${stop.name} · ${stop.visitTime}`}
              </span>
              {detail ? <span className="mt-1.5 block text-sm text-muted">{detail}</span> : null}
              {stop.partnership ? (
                <span className="mt-1.5 block text-sm font-semibold text-ink">
                  공공데이터 기반 추천 · 쿠폰 사용 가능
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
