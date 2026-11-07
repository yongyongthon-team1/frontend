import {
  computePartnershipState,
  type MyStore,
  type StoreReport,
  type StoreSearchItem,
} from './model';

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

// 백엔드 S-07 `GET /users/me/store/report`의 와이어 모양(키는 `request`가 camelCase로 바꾼 뒤의 것).

export interface WireStoreReport {
  from: string;
  to: string;
  visitCount: number;
  reviewCount: number;
  averageRating: number | null;
}

export function fromWireStoreReport(w: WireStoreReport): StoreReport {
  return {
    from: w.from,
    to: w.to,
    visitCount: w.visitCount,
    reviewCount: w.reviewCount,
    averageRating: w.averageRating,
  };
}

// 백엔드 S-01 `GET /stores/search` · `POST /users/me/store`와 S-03 `PUT /users/me/store/partnership`의 와이어 모양.

export interface WireStoreSearchItem {
  storeId: number;
  name: string;
  address: string;
  category: string;
  isRegistered: boolean;
}

/** `POST /users/me/store`(201)의 데이터. 화면은 이 응답 대신 내 가게를 다시 읽는다. */
export interface WireRegisteredStore {
  storeId: number;
  name: string;
  address: string;
  category: string;
}

/** `PUT /users/me/store/partnership`의 데이터. */
export interface WirePartnershipSaved {
  discountText: string;
  startDate: string;
  endDate: string;
}

export function fromWireStoreSearchItem(w: WireStoreSearchItem): StoreSearchItem {
  return {
    storeId: w.storeId,
    name: w.name,
    address: w.address,
    category: w.category,
    registered: w.isRegistered,
  };
}
