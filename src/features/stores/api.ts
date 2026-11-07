import { ApiError, request } from '@/shared/lib/http';
import { getStoreReviews } from '@/features/reviews/api';
import type { MyStore, StoreReport, StoreReportView } from './model';
import {
  fromWireMyStore,
  fromWireStoreReport,
  type WireMyStore,
  type WireStoreReport,
} from './wire';

/**
 * S-01 보완 `GET /users/me/store`(사장님). 연결된 가게가 없으면(`E404` → `STORE_NOT_LINKED`, 봉투 없는 404도) 오류가 아니라 null이다. 5xx는 그대로 던진다.
 * `token`을 주면 세션 토큰 대신 그 토큰으로 부르고 401이어도 세션 만료 처리를 하지 않는다(로그인 직후 합성용).
 * 제휴 `state`의 기준 시각은 어댑터의 `new Date()`다.
 */
export async function getMyStore(token?: string): Promise<MyStore | null> {
  try {
    const wire = await request<WireMyStore>('/users/me/store', {
      errorMap: { E404: 'STORE_NOT_LINKED' },
      ...(token !== undefined
        ? { headers: { Authorization: `Bearer ${token}` }, auth: false }
        : {}),
    });
    return fromWireMyStore(wire, new Date());
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * S-07 `GET /users/me/store/report`(사장님). 쿼리 없이 부른다 — 기간은 서버 기본(최근 30일)이다. 연결된 가게가 없으면
 * `E404` → `STORE_NOT_LINKED`.
 */
export async function getStoreReport(): Promise<StoreReport> {
  const wire = await request<WireStoreReport>('/users/me/store/report', {
    errorMap: { E404: 'STORE_NOT_LINKED' },
  });
  return fromWireStoreReport(wire);
}

/**
 * 리포트 화면의 값(2B′-R2 · R19). 리포트 응답에는 AI 요약 · 최근 리뷰 · 가게 id가 없어 내 가게(`GET /users/me/store`)로 가게 id를
 * 얻고 `GET /stores/{storeId}/reviews`로 요약 · 최근 리뷰를 읽는다(내 가게 → 리뷰는 차례, 리포트는 나란히). 가게가 없거나
 * 리포트가 `STORE_NOT_LINKED`면 null이다. 그 밖의 오류는 던진다.
 */
export async function getStoreReportView(): Promise<StoreReportView | null> {
  try {
    const [report, composed] = await Promise.all([
      getStoreReport(),
      getMyStore().then((store) =>
        store ? getStoreReviews(store.id).then((reviews) => ({ store, reviews })) : null,
      ),
    ]);
    return composed ? { report, ...composed } : null;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'STORE_NOT_LINKED') return null;
    throw error;
  }
}
