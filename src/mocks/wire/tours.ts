import { campusLabel } from '@/features/tours/model';
import type { WireTourDetail, WireTourItem } from '@/features/tours/wire';
import type { DB, TourRow } from '@/mocks/db/schema';
import { newestFirst } from '@/mocks/rules/views';
import { remainingSeats } from '@/mocks/rules/applications';
import { formatTime, seoulDateKey } from '@/shared/lib/date';

// 탐방 행 → 와이어 객체(`ok`가 키를 snake로 바꾼다). 도메인 객체를 만들던 `toTourSummary` · `toTourDetail`의 자리(2C-R26).

/** T-01 보완 `GET /tours` 항목. `campusId`는 목업 전용 확장(2C-R8)이다. */
export function toWireTourItem(db: DB, tour: TourRow): WireTourItem {
  const university = db.universities.find((u) => u.id === tour.universityId)!;
  return {
    tourId: tour.id,
    campusName: campusLabel(university.name, university.campusName),
    major: db.guideProfiles.find((g) => g.id === tour.guideId)?.major ?? null,
    date: seoulDateKey(tour.startsAt),
    startTime: formatTime(tour.startsAt),
    capacity: tour.capacity,
    remaining: remainingSeats(db, tour.id),
    status: tour.status,
    guide: {
      name: db.users.find((u) => u.id === tour.guideId)?.name ?? '',
      verified: db.verifications.find((v) => v.id === tour.guideId)?.status === 'APPROVED',
    },
    campusId: university.id,
  };
}

/**
 * T-02 `GET /tours/{tourId}`. `myApplication`은 요청자의 가장 최근 신청 중 취소되지 않은 것이다(모두 취소했으면 null —
 * 취소 후 재신청은 허용). 오픈채팅 링크는 승인된 신청자와 그 탐방을 연 가이드에게만 준다(명세).
 */
export function toWireTourDetail(db: DB, tour: TourRow, viewerId: number | null): WireTourDetail {
  const item = toWireTourItem(db, tour);
  const profile = db.guideProfiles.find((g) => g.id === tour.guideId);
  const [mine] = db.applications
    .filter((a) => a.tourId === tour.id && a.userId === viewerId && a.status !== 'CANCELED')
    .sort(newestFirst);
  const mayOpenChat =
    mine?.status === 'APPROVED' || (viewerId !== null && viewerId === tour.guideId);
  return {
    ...item,
    endTime: tour.endsAt === null ? null : formatTime(tour.endsAt),
    intro: tour.introduction,
    openChatUrl: mayOpenChat ? tour.openChatUrl : null,
    guide: {
      ...item.guide,
      major: profile?.major ?? null,
      intro: profile?.introduction ?? null,
    },
    myApplication: mine ? { applicationId: mine.id, status: mine.status } : null,
  };
}
