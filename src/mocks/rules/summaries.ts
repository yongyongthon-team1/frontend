import { shortUniversityName, tourTitle, type TourSummary } from '@/features/tours/model';
import type { DB, TourRow } from '@/mocks/db/schema';
import { remainingSeats } from './applications';

/**
 * 탐방 행 → `TourSummary`. 목업 AI 추천과 핸들러의 DTO(Task 9 `views.ts`)가 함께 쓴다.
 * 제목은 "대학교 + 가이드 학과 + 탐방"(ERD에 탐방 제목이 없다), 남은 자리는 정원 − 승인 수다.
 */
export function buildTourSummary(db: DB, tour: TourRow): TourSummary {
  const university = db.universities.find((u) => u.id === tour.universityId)!;
  const major = db.guideProfiles.find((g) => g.id === tour.guideId)?.major ?? null;
  return {
    id: tour.id,
    title: tourTitle(university.name, university.campusName, major),
    universityId: university.id,
    universityName: university.name,
    universityShortName: shortUniversityName(university.name),
    campusName: university.campusName,
    major,
    guideName: db.users.find((u) => u.id === tour.guideId)?.name ?? '',
    guideVerified: db.verifications.find((v) => v.id === tour.guideId)?.status === 'APPROVED',
    startsAt: tour.startsAt,
    endsAt: tour.endsAt,
    capacity: tour.capacity,
    approvedCount: db.applications.filter((a) => a.tourId === tour.id && a.status === 'APPROVED')
      .length,
    remainingSeats: remainingSeats(db, tour.id),
    status: tour.status,
  };
}
