import type { WireCreatedWish } from '@/features/wishes/wire';
import type { TourWishRow } from '@/mocks/db/schema';

// 희망 사항 행 → 와이어 객체(`ok`가 키를 snake로 바꾼다). 등록 응답은 명세 그대로이고 확장이 없다.

/** T-01 `POST /tour-wishes` 201의 `data`. */
export function toWireCreatedWish(row: TourWishRow): WireCreatedWish {
  return {
    wishId: row.id,
    campusId: row.universityId,
    major: row.major,
    wish: row.content,
    date: row.preferredDate,
    createdAt: row.createdAt,
  };
}
