import type { StoreReviews } from '@/features/reviews/model';
import { seoulDateKey } from '@/shared/lib/date';

/** 백엔드는 주지 않는다. 어댑터(`wire.ts`)가 오늘(서울)과 제휴 기간으로 계산한다. ERD 칼럼이 아니다. */
export type PartnershipState = 'ACTIVE' | 'SCHEDULED' | 'ENDED';

export interface Partnership {
  id: number;
  discount: string;
  /** 사용 조건. 없으면 null. */
  condition: string | null;
  /** `YYYY-MM-DD` */
  startDate: string;
  /** `YYYY-MM-DD` */
  endDate: string;
  state: PartnershipState;
}

export interface MyStore {
  id: number;
  name: string;
  address: string;
  category: string;
  /** 가게당 "지금 쓰는 제휴" 1건. 아직 설정하지 않았으면 null. */
  partnership: Partnership | null;
}

/**
 * 어댑터(`fromWireMyStore`)가 와이어의 제휴 기간으로 `Partnership.state`를 계산한다. 컴포넌트는 이 값을 그리기만 한다.
 * 시작일 전이면 SCHEDULED, 종료일 다음 날부터 ENDED(종료일 당일까지는 운영 중). 날짜는 모두 서울 기준이다.
 */
export function computePartnershipState(
  p: { startDate: string; endDate: string },
  now: Date,
): PartnershipState {
  const today = seoulDateKey(now);
  if (today < p.startDate) return 'SCHEDULED';
  if (today > p.endDate) return 'ENDED';
  return 'ACTIVE';
}

/** 제휴 상태 칩의 글자(V2 O01). */
export function partnershipStateLabel(state: PartnershipState): string {
  switch (state) {
    case 'ACTIVE':
      return '제휴 운영 중';
    case 'SCHEDULED':
      return '제휴 예정';
    case 'ENDED':
      return '제휴 종료';
  }
}

/** S-07 방문 · 리뷰 리포트. 기간(`from` ~ `to`, `YYYY-MM-DD`, 양 끝 포함) 안의 쿠폰 사용 수 · 리뷰 수 · 평균(리뷰가 없으면 null). */
export interface StoreReport {
  from: string;
  to: string;
  visitCount: number;
  reviewCount: number;
  averageRating: number | null;
}

/** 리포트 화면의 값. 리포트 응답에 없는 가게 · AI 요약 · 최근 리뷰를 R-02와 합성한다(2B′-R2). */
export interface StoreReportView {
  report: StoreReport;
  store: MyStore;
  reviews: StoreReviews;
}

/** 사업자 인증(U-07) 입력. 번호는 하이픈이 있어도 되고(`normalizeBusinessNumber`가 숫자만 남긴다), 개업일은 `YYYY-MM-DD`다. */
export interface BusinessVerificationInput {
  businessNumber: string;
  representativeName: string;
  openedAt: string;
}

/** 사업자등록번호에서 숫자만 남긴다(`123-45-67890` → `1234567890`). */
export function normalizeBusinessNumber(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** 사업자 인증 실패 안내(결과 카드). 불일치 · 폐업이 아니면 null. */
export function businessNotice(
  code: string | undefined,
): { title: string; description: string } | null {
  switch (code) {
    case 'BIZ_MISMATCH':
      return {
        title: '사업자 정보가 일치하지 않아요',
        description:
          '사업자등록증에 적힌 등록번호 · 대표자명 · 개업일자를 그대로 다시 입력해 주세요.',
      };
    case 'BIZ_CLOSED':
      return {
        title: '휴업 또는 폐업한 사업자예요',
        description: '계속사업자(영업 중)인 사업자 정보로 다시 입력해 주세요.',
      };
    default:
      return null;
  }
}

/** S-01 상점 검색 결과 한 줄. `registered`는 이미 다른 사장님이 연결한 상점이다. */
export interface StoreSearchItem {
  storeId: number;
  name: string;
  address: string;
  category: string;
  registered: boolean;
}

/** 상점 검색어의 최소 글자 수(공백 뺀 것, 명세 `keyword` 2자 이상). */
export const STORE_SEARCH_MIN = 2;

/** 가게 연결 · 등록(S-01) 입력: 검색에서 고른 상점, 또는 직접 입력(좌표는 사장님이 고른 캠퍼스 중심). */
export type StoreRegistrationInput =
  | { storeId: number }
  | { name: string; address: string; category: string; latitude: number; longitude: number };

/** 가게 수정(S-01) 입력: 바뀐 칸만 보낸다. */
export type StoreEditInput = Partial<{ name: string; address: string; category: string }>;

/** 수정 전 가게와 입력을 견줘 값이 다른 칸만 돌려준다. */
export function diffStoreEdit(
  before: MyStore,
  after: { name: string; address: string; category: string },
): StoreEditInput {
  const patch: StoreEditInput = {};
  if (after.name !== before.name) patch.name = after.name;
  if (after.address !== before.address) patch.address = after.address;
  if (after.category !== before.category) patch.category = after.category;
  return patch;
}

/** 제휴 할인 설정(S-03) 입력. 날짜는 `YYYY-MM-DD`. */
export interface PartnershipInput {
  discount: string;
  startDate: string;
  endDate: string;
}

/** 제휴 할인 문구의 최대 글자 수(명세 50자 이내). */
export const PARTNERSHIP_DISCOUNT_MAX = 50;

/** 직접 등록 · 가게 수정의 업종 선택지. */
export const STORE_CATEGORIES = [
  '한식',
  '분식',
  '중식',
  '일식',
  '양식',
  '카페',
  '보드게임카페',
  '노래방',
  '공방',
  '기타',
] as const;
