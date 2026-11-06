import { stopKindLabel, type CourseStop } from '@/features/courses/model';

/**
 * V2 H04 단계 막대: 번호 원(1~n)을 연한 선으로 잇고 그 아래에 지점 종류(`stopKindLabel`)를 적는다. 지점 수가 늘어도
 * 칸이 균등하게 줄고, 라벨은 한 줄 말줄임이다.
 */
export function CourseStepBar({ stops }: { stops: CourseStop[] }) {
  return (
    <ol data-testid="course-step-bar" className="relative flex items-start">
      {stops.map((stop, index) => (
        <li key={stop.id} className="relative flex min-w-0 flex-1 flex-col items-center gap-2">
          {/* 원과 원을 잇는 선: 이 칸의 가운데에서 다음 칸의 가운데까지 */}
          {index < stops.length - 1 ? (
            <span
              aria-hidden
              className="absolute top-[11px] left-1/2 h-1 w-full -translate-y-1/2 bg-brand/25"
            />
          ) : null}
          <span className="relative flex size-[22px] items-center justify-center rounded-full bg-brand text-xs font-bold text-on-primary tabular-nums">
            {index + 1}
          </span>
          <span className="w-full truncate text-center text-[11px] font-medium text-ink">
            {stopKindLabel(stop)}
          </span>
        </li>
      ))}
    </ol>
  );
}
