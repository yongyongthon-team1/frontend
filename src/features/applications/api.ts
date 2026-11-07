import { fetchMe } from '@/features/auth/api';
import { listMyCouponRows } from '@/features/coupons/api';
import { getGuideCourseStatus, getGuideCourseStopCount } from '@/features/courses/api';
import type { TourDetail, TourStatus } from '@/features/tours/model';
import { getTour, type CampusesInput } from '@/features/tours/api';
import { errorMessage, type ErrorCode } from '@/shared/lib/errors';
import { ApiError, listAll, recode, request } from '@/shared/lib/http';
import {
  computeTourActions,
  type ApplicantsBoard,
  type CreateTourInput,
  type GuideTourDetail,
  type GuideTourSummary,
  type MyApplication,
} from './model';
import {
  fromWireApplicants,
  fromWireGuideTourRow,
  fromWireMyTourRow,
  type WireApplicant,
  type WireApplyResult,
  type WireGuideTourRow,
  type WireMyTourRow,
  type WireTourStatus,
} from './wire';

// 백엔드 T-04 `GET /users/me/tours`와 A. 신청(A-01~04). 응답에 탐방 요약이 없어 `GET /tours/{tourId}`로 합성하고(2C-R7),
// 가이드 탐방의 초안 여부는 `GET /tours/{tourId}/course`로 얻는다(2C-R27). 서로 기대지 않는 호출은 함께 보내고(errata G6),
// `campuses`는 배열이나 아직 받는 중인 약속(`loadCampuses`)을 받는다 — 첫 요청과 동시에 나간다(errata G13).
// 신청 단건(상세 · 신청 · 취소 뒤)은 내 탐방 행에서 찾는다. 목업 규칙 함수와 이름이 겹치지 않게 HTTP 동사를 앞에 붙인다.

const notFound = () => new ApiError(404, 'NOT_FOUND', errorMessage('NOT_FOUND'));

/** 같은 탐방 id를 한 번만 부르는 불러오기(같은 탐방의 행이 여럿이어도 — 예: 취소한 옛 신청). */
function oncePerTour<T>(load: (tourId: number) => Promise<T>): (tourId: number) => Promise<T> {
  const started = new Map<number, Promise<T>>();
  return (tourId) => {
    let pending = started.get(tourId);
    if (pending === undefined) {
      pending = load(tourId);
      started.set(tourId, pending);
    }
    return pending;
  };
}

/** T-04 고교생: 내가 신청한 탐방의 행 전부(최근 신청 먼저). 쿠폰 도메인도 신청 id를 합성할 때 쓴다(2C-R27). */
export function listMyTourRows(): Promise<WireMyTourRow[]> {
  return listAll<WireMyTourRow>('/users/me/tours');
}

/**
 * 행마다 탐방 상세(탐방당 한 번)와 쿠폰 수를 함께 불러 내 신청으로 읽는다. 쿠폰 수는 확장 `coupon_count`, 없으면(실서버)
 * `GET /users/me/coupons?tour_id`의 개수를 승인 행에만 준다(탐방당 한 번, 2C-R8 · 2C-R27) — 다른 행은 0이다. 취소 가능 여부는 어댑터의 지금 시각으로 계산한다.
 */
async function composeMyApplications(
  rows: WireMyTourRow[],
  tourOf: (tourId: number) => Promise<TourDetail>,
): Promise<MyApplication[]> {
  const couponsOf = oncePerTour(async (tourId) => (await listMyCouponRows({ tourId })).length);
  const now = new Date();
  return Promise.all(
    rows.map(async (row) => {
      const [tour, couponCount] = await Promise.all([
        tourOf(row.tourId),
        row.couponCount ?? (row.applicationStatus === 'APPROVED' ? couponsOf(row.tourId) : 0),
      ]);
      return fromWireMyTourRow(row, tour, couponCount, now);
    }),
  );
}

/** 행 중에서 이 신청을 찾아 합성한다. 없으면(남의 신청 · 없는 신청) 404 NOT_FOUND. */
async function composeOne(
  rows: WireMyTourRow[],
  applicationId: number,
  tourOf: (tourId: number) => Promise<TourDetail>,
): Promise<MyApplication> {
  const row = rows.find((r) => r.applicationId === applicationId);
  if (row === undefined) throw notFound();
  const [app] = await composeMyApplications([row], tourOf);
  return app;
}

/** 내 신청 목록(행 순서 그대로 — 최근 신청 먼저). */
export async function getMyApplications(campuses: CampusesInput): Promise<MyApplication[]> {
  const [rows, joined] = await Promise.all([listMyTourRows(), campuses]);
  return composeMyApplications(
    rows,
    oncePerTour((tourId) => getTour(tourId, joined)),
  );
}

/** 내 신청 하나. 내 탐방 행에 없으면 404 NOT_FOUND다. */
export async function getMyApplication(
  id: number,
  campuses: CampusesInput,
): Promise<MyApplication> {
  const [rows, joined] = await Promise.all([listMyTourRows(), campuses]);
  return composeOne(
    rows,
    id,
    oncePerTour((tourId) => getTour(tourId, joined)),
  );
}

/**
 * 신청 오류 세분(2C-R15). `E403_VERIFICATION_REQUIRED`는 내 정보를 다시 읽어 재학 인증이 APPROVED면 보호자 동의 차례
 * (`GUARDIAN_NOT_AGREED`), 아니면 `NOT_VERIFIED`. `E409_TOUR_FULL`은 탐방을 다시 읽어 취소 · 완료면 `TOUR_NOT_RECRUITING`,
 * 아니면 정원 마감 `TOUR_CLOSED`. 다시 읽기가 실패하면 기본 표의 코드를 그대로 둔다.
 */
async function refineApplyError(
  error: unknown,
  tourId: number,
  campuses: CampusesInput,
): Promise<unknown> {
  if (!(error instanceof ApiError)) return error;
  try {
    if (error.backendCode === 'E403_VERIFICATION_REQUIRED') {
      const me = await fetchMe();
      return recode(
        error,
        me.verificationStatus === 'APPROVED' ? 'GUARDIAN_NOT_AGREED' : 'NOT_VERIFIED',
      );
    }
    if (error.backendCode === 'E409_TOUR_FULL') {
      const { status } = await getTour(tourId, campuses);
      return recode(
        error,
        status === 'CANCELED' || status === 'COMPLETED' ? 'TOUR_NOT_RECRUITING' : 'TOUR_CLOSED',
      );
    }
  } catch {
    return error;
  }
  return error;
}

/**
 * 탐방 신청(A-01, 본문 `{ wish }`). 201 응답에는 신청 id · 탐방 id뿐이라 내 탐방 행에서 그 신청을 합성한다 — 탐방 id를 알아
 * 탐방 상세를 행과 함께 부른다.
 */
export async function postApplication(
  tourId: number,
  motivation: string,
  campuses: CampusesInput,
): Promise<MyApplication> {
  let created: WireApplyResult;
  try {
    created = await request<WireApplyResult>(`/tours/${tourId}/applications`, {
      method: 'POST',
      body: { wish: motivation },
    });
  } catch (error) {
    throw await refineApplyError(error, tourId, campuses);
  }
  const tourOf = oncePerTour((id) => getTour(id, campuses));
  const [rows] = await Promise.all([listMyTourRows(), tourOf(created.tourId)]);
  return composeOne(rows, created.applicationId, tourOf);
}

/**
 * 취소 오류 세분(2C-R15). `E409_INVALID_APPLICATION_STATUS`는 신청을 다시 읽어 아직 대기 · 승인이면 탐방 날짜가 된 것
 * (`CANCEL_AFTER_TOUR_DATE`), 아니면 이미 끝난 신청(`ALREADY_PROCESSED`)이다. 다시 읽기가 실패하면 기본 표의 코드를 둔다.
 */
async function refineCancelError(error: unknown, id: number): Promise<unknown> {
  if (!(error instanceof ApiError) || error.backendCode !== 'E409_INVALID_APPLICATION_STATUS') {
    return error;
  }
  try {
    const row = (await listMyTourRows()).find((r) => r.applicationId === id);
    const live = row?.applicationStatus === 'PENDING' || row?.applicationStatus === 'APPROVED';
    return recode(error, live ? 'CANCEL_AFTER_TOUR_DATE' : 'ALREADY_PROCESSED');
  } catch {
    return error;
  }
}

/** 신청 취소(A-03). 응답은 상태뿐이라 그 신청을 다시 읽는다. */
export async function postCancelApplication(
  id: number,
  campuses: CampusesInput,
): Promise<MyApplication> {
  try {
    await request<unknown>(`/applications/${id}/cancel`, { method: 'POST' });
  } catch (error) {
    throw await refineCancelError(error, id);
  }
  return getMyApplication(id, campuses);
}

/**
 * 가이드가 개설한 탐방(T-04 대학생) — 시작이 빠른 순(같으면 id). 행마다 탐방 상세를, 코스가 확정이 아니면 초안 여부
 * (`getGuideCourseStatus`)를 함께 부른다.
 */
export async function getGuideTours(campuses: CampusesInput): Promise<GuideTourSummary[]> {
  const [rows, joined] = await Promise.all([
    listAll<WireGuideTourRow>('/users/me/tours'),
    campuses,
  ]);
  const tours = await Promise.all(
    rows.map(async (row) => {
      const [tour, courseStatus] = await Promise.all([
        getTour(row.tourId, joined),
        row.courseConfirmed ? null : getGuideCourseStatus(row.tourId),
      ]);
      return fromWireGuideTourRow(row, tour, courseStatus);
    }),
  );
  return tours.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id - b.id);
}

/** 신청자 보드: 신청자 목록(A-04) · 탐방 상세 · 코스 상태를 함께 부른다. 가이드 본인 탐방이 아니면 403 FORBIDDEN. */
export async function getApplicantsBoard(
  tourId: number,
  campuses: CampusesInput,
): Promise<ApplicantsBoard> {
  const [items, tour, courseStatus] = await Promise.all([
    listAll<WireApplicant>(`/tours/${tourId}/applications`),
    getTour(tourId, campuses),
    getGuideCourseStatus(tourId),
  ]);
  return fromWireApplicants(items, tour, courseStatus);
}

/**
 * 승인 · 거절(A-02) 뒤 바뀐 신청자 보드. 여기서 `E409_TOUR_FULL`은 정원이 차서 승인할 수 없다는 뜻이다(2C-R15).
 * 대기 신청이 아니면 409 ALREADY_PROCESSED.
 */
export async function patchDecision(
  tourId: number,
  applicationId: number,
  decision: 'APPROVED' | 'REJECTED',
  campuses: CampusesInput,
): Promise<ApplicantsBoard> {
  await request<unknown>(`/applications/${applicationId}/decision`, {
    method: 'PATCH',
    body: { decision },
    errorMap: { E409_TOUR_FULL: 'CAPACITY_EXCEEDED' },
  });
  return getApplicantsBoard(tourId, campuses);
}

/**
 * 탐방 개설(T-03). 본문은 명세 그대로 `{ date, start_time, end_time, capacity, intro, open_chat_url }`이고(소개 칸 이름만
 * 도메인의 `introduction`에서 바꾼다) 서버의 `intro` 칸 오류는 `introduction`으로 읽는다. 새 탐방 id를 돌려준다.
 * 방학 밖 날짜는 400 `errors[date]`(명세 문장), 가이드 프로필이 없으면 409 `GUIDE_PROFILE_REQUIRED`다.
 */
export async function postTour(input: CreateTourInput): Promise<number> {
  const created = await request<WireTourStatus>('/tours', {
    method: 'POST',
    body: {
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      capacity: input.capacity,
      intro: input.introduction,
      openChatUrl: input.openChatUrl,
    },
    fieldMap: { intro: 'introduction' },
  });
  return created.tourId;
}

/**
 * 가이드 탐방 상세(G09): 탐방 상세와 확정 코스 지점 수(코스가 없으면 0)를 함께 부르고, 완료 · 취소 활성은 어댑터의 지금 시각으로
 * 계산한다(2B′-R13). 가이드 본인 탐방이 아니면 코스 조회가 403 FORBIDDEN이다.
 */
export async function getGuideTour(
  tourId: number,
  campuses: CampusesInput,
): Promise<GuideTourDetail> {
  const [tour, courseStopCount] = await Promise.all([
    getTour(tourId, campuses),
    getGuideCourseStopCount(tourId),
  ]);
  return { tour, courseStopCount, actions: computeTourActions(tour, new Date()) };
}

/**
 * 완료 · 취소의 `E409_INVALID_TOUR_STATUS` 세분(2B′-R13, 2C-R15 방식). 하나뿐인 명세 코드가 "날짜 전 · 이미 완료 · 취소됨"을
 * 덮으므로 탐방을 다시 읽어 고른다. 다시 읽기가 실패하면 기본 표의 코드를 그대로 둔다.
 */
async function refineTourStatusError(
  error: unknown,
  tourId: number,
  campuses: CampusesInput,
  codeFor: (status: TourStatus) => ErrorCode,
): Promise<unknown> {
  if (!(error instanceof ApiError) || error.backendCode !== 'E409_INVALID_TOUR_STATUS') {
    return error;
  }
  try {
    return recode(error, codeFor((await getTour(tourId, campuses)).status));
  } catch {
    return error;
  }
}

/** 탐방 완료(T-06). 응답은 상태뿐이라 값 없이 끝난다. 날짜 전 · 이미 완료 · 취소됨은 409 하나라 탐방을 다시 읽어 나눈다. */
export async function postCompleteTour(tourId: number, campuses: CampusesInput): Promise<void> {
  try {
    await request<WireTourStatus>(`/tours/${tourId}/complete`, { method: 'POST' });
  } catch (error) {
    throw await refineTourStatusError(error, tourId, campuses, (status) => {
      if (status === 'COMPLETED') return 'TOUR_ALREADY_COMPLETED';
      return status === 'CANCELED' ? 'ALREADY_PROCESSED' : 'COMPLETE_BEFORE_TOUR_DATE';
    });
  }
}

/** 탐방 취소(T-05). 신청자 전원의 신청이 취소된다. 이미 완료 · 취소된 탐방은 409 하나라 탐방을 다시 읽어 나눈다. */
export async function postCancelTour(tourId: number, campuses: CampusesInput): Promise<void> {
  try {
    await request<WireTourStatus>(`/tours/${tourId}/cancel`, { method: 'POST' });
  } catch (error) {
    throw await refineTourStatusError(error, tourId, campuses, (status) =>
      status === 'COMPLETED' ? 'TOUR_ALREADY_COMPLETED' : 'ALREADY_PROCESSED',
    );
  }
}
