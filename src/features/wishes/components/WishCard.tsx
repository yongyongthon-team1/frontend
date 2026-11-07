import type { ReactNode } from 'react';
import { formatDotDate } from '@/shared/lib/date';
import type { TourWish } from '../model';

/**
 * 희망 사항 카드(T-07 내 목록 · T-08 가이드 목록). 학교 · 학과 줄, 남긴 원문(줄바꿈 그대로), 아래 줄은 왼쪽에 `{MM.DD} 남김`
 * (남긴 시각을 모르면 비움) · 오른쪽에 `action`이다. 학생의 이름 같은 개인정보는 그리지 않는다.
 */
export function WishCard({ wish, action }: { wish: TourWish; action?: ReactNode }) {
  return (
    <article className="rounded-xl bg-surface p-5">
      <p className="text-xs font-medium text-muted">
        {wish.campusLabel} · {wish.major}
      </p>
      <p
        data-testid="wish-text"
        className="mt-2 text-[15px] leading-[1.5] break-words break-keep whitespace-pre-wrap text-ink"
      >
        {wish.wish}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {wish.createdAt ? `${formatDotDate(wish.createdAt)} 남김` : null}
        </p>
        {action}
      </div>
    </article>
  );
}
