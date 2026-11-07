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
