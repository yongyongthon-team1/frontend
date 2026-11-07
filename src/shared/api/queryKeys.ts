import type { TourFilter } from '@/features/tours/model';
import type { WishSearch } from '@/features/tours/wishSearch';
import type { GuideWishFilter } from '@/features/wishes/model';

// TanStack Query 키는 모두 여기서 만든다. 첫 요소가 묶음 이름이고, 인자 없는 목록 키(`qk.myApplications`)는 같은
// 묶음 상세 키(`qk.myApplication(id)`)의 접두사라 목록을 무효화하면 상세도 다시 불러온다. 가이드의 신청자 · 코스는
// 탐방 목록(`qk.guideTours`)과 따로 묶는다 — 승인 뒤 목록을 무효화해도 방금 `setQueryData`한 신청자 보드를 다시 부르지 않게.
export const qk = {
  me: ['me'] as const,
  universities: ['universities'] as const,
  insight: (universityId: number) => ['insight', universityId] as const,
  /** 탐방 목록 · 상세 · 탐방 찾기 결과 전부의 접두사(무효화용). */
  allTours: ['tours'] as const,
  tours: (filter: TourFilter) => ['tours', 'list', filter] as const,
  tour: (id: number) => ['tours', 'detail', id] as const,
  /** T-01 탐방 찾기 결과(학교 · 학과 · 날짜 검색). */
  wishTours: (s: WishSearch) => ['tours', 'wish', s] as const,
  /** 내 희망 사항 목록(T-07). 희망 사항을 등록 · 수정하면 무효화한다. */
  myWishes: ['myWishes'] as const,
  /** 가이드가 보는 고교생 희망 사항(T-08). 학교 · 학과 조건마다 한 항목. */
  guideWishes: (f: GuideWishFilter) => ['guideWishes', f] as const,
  myApplications: ['myApplications'] as const,
  myApplication: (id: number) => ['myApplications', id] as const,
  myCoupons: (applicationId?: number) => ['myCoupons', 'list', applicationId ?? null] as const,
  coupon: (id: number) => ['myCoupons', 'detail', id] as const,
  /** 내 쿠폰 목록 · 상세 전부의 접두사(무효화용). */
  allMyCoupons: ['myCoupons'] as const,
  course: (tourId: number) => ['course', tourId] as const,
  /** 코스 전부의 접두사(무효화용). */
  allCourses: ['course'] as const,
  /** 상점의 AI 요약 · 평균 · 최근 리뷰(R-02). */
  storeReviews: (storeId: number) => ['storeReviews', storeId] as const,
  guideTours: ['guideTours'] as const,
  applicants: (tourId: number) => ['applicants', tourId] as const,
  /** 가이드의 신청자 보드 전부의 접두사(무효화용). */
  allApplicants: ['applicants'] as const,
  guideCourse: (tourId: number) => ['guideCourse', tourId] as const,
  /** 가이드의 코스 전부의 접두사(무효화용). */
  allGuideCourses: ['guideCourse'] as const,
  /** 뮤테이션 키: AI 코스 초안 생성. 화면이 다시 마운트돼도 진행 중인 생성을 알아본다. */
  courseDraft: (tourId: number) => ['courseDraft', tourId] as const,
  couponLookup: (code: string) => ['couponLookup', code] as const,
  myStore: ['myStore'] as const,
  /** 사장님 방문 · 리뷰 리포트(S-07) — 리포트 · 내 가게 · 상점 리뷰를 합성한 값. */
  storeReport: ['storeReport'] as const,
  health: ['health'] as const,
};
