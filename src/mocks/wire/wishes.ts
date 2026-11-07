import { campusLabel } from '@/features/tours/model';
import type { WireCreatedWish, WireUpdatedWish, WireWishItem } from '@/features/wishes/wire';
import type { DB, TourWishRow } from '@/mocks/db/schema';

// 희망 사항 행 → 와이어 객체(`ok`가 키를 snake로 바꾼다). 등록 응답은 명세 그대로이고 확장이 없다. 목록 · 수정 응답은
// 학교 줄이 이름이라 목업 전용 확장(`campus_id` · 목록의 `date` · 수정의 `created_at`, 2C-R8)을 더한다. 학생의 이름은 어디에도 싣지 않는다.

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

/** 행의 학교 줄(`경희대학교 국제캠퍼스`). */
function campusNameOf(db: DB, row: TourWishRow): string {
  const university = db.universities.find((u) => u.id === row.universityId);
  return university ? campusLabel(university.name, university.campusName) : '';
}

/** `GET /users/me/tour-wishes` · `GET /tour-wishes` 항목. 확장: `campus_id` · `date`. */
export function toWireWishItem(db: DB, row: TourWishRow): WireWishItem {
  return {
    wishId: row.id,
    campusName: campusNameOf(db, row),
    major: row.major,
    wish: row.content,
    createdAt: row.createdAt,
    campusId: row.universityId,
    date: row.preferredDate,
  };
}

/** `PATCH /users/me/tour-wishes/{wishId}` 200의 `data`. 확장: `campus_id` · `created_at`. */
export function toWireUpdatedWish(db: DB, row: TourWishRow): WireUpdatedWish {
  return {
    wishId: row.id,
    campusName: campusNameOf(db, row),
    major: row.major,
    wish: row.content,
    date: row.preferredDate,
    updatedAt: row.updatedAt,
    campusId: row.universityId,
    createdAt: row.createdAt,
  };
}
