import { computePartnershipState, type MyStore } from './model';

// 백엔드 S-01 보완 `GET /users/me/store`의 와이어 모양(키는 `request`가 camelCase로 바꾼 뒤의 것).

export interface WirePartnership {
  discountText: string;
  startDate: string;
  endDate: string;
}

export interface WireMyStore {
  storeId: number;
  name: string;
  address: string;
  category: string;
  partnership: WirePartnership | null;
}

/**
 * 제휴 `id`는 명세에 없어 0, `condition`은 명세에도 확장 표에도 없어 null이다(화면은 둘 다 읽지 않는다).
 * `state`는 서버가 주지 않으므로 `now`(서울 날짜)와 기간으로 계산한다.
 */
export function fromWireMyStore(w: WireMyStore, now: Date): MyStore {
  return {
    id: w.storeId,
    name: w.name,
    address: w.address,
    category: w.category,
    partnership: w.partnership
      ? {
          id: 0,
          discount: w.partnership.discountText,
          condition: null,
          startDate: w.partnership.startDate,
          endDate: w.partnership.endDate,
          state: computePartnershipState(w.partnership, now),
        }
      : null,
  };
}
