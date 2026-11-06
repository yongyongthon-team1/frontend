import type { CourseStop } from '@/features/courses/model';

export interface CourseTimelineProps {
  stops: CourseStop[];
  /** `stopDurations`의 결과 — 지점마다 머무는 분, 모르면 null. */
  durations: (number | null)[];
  onSelect(stopId: number): void;
}

/**
 * V2 H04 시간표: 지점마다 카드 하나(시간 알약 · 이름 · 한줄평 또는 추천 이유 · 머무는 분). 카드 전체가 버튼이라
 * 누르면 그 지점의 상점 시트를 연다. 제휴 상점은 아래 줄에 쿠폰 안내가 하나 더 붙는다(1단계 판정 20).
 */
export function CourseTimeline({ stops, durations, onSelect }: CourseTimelineProps) {
  return (
    <ul data-testid="course-timeline" className="flex flex-col gap-3">
      {stops.map((stop, index) => {
        const detail = stop.description ?? stop.recommendationReason;
        const minutes = durations[index] ?? null;
        const meta = [detail, minutes === null ? null : `${minutes}분`]
          .filter((part): part is string => Boolean(part))
          .join(' · ');
        return (
          <li key={stop.id}>
            <button
              type="button"
              onClick={() => onSelect(stop.id)}
              className="flex min-h-[78px] w-full items-center gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:brightness-[0.98]"
            >
              <span className="shrink-0 rounded-pill bg-brand-soft px-3 py-2 text-[13px] font-bold text-brand tabular-nums">
                {stop.visitTime}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] leading-[1.4] font-bold text-ink">
                  {stop.name}
                </span>
                {meta ? (
                  <span className="mt-0.5 line-clamp-2 text-xs text-muted">{meta}</span>
                ) : null}
                {stop.partnership ? (
                  <span className="mt-1 block text-xs font-bold text-brand">
                    공공데이터 기반 추천 · 쿠폰 사용 가능
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
