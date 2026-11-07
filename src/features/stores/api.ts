import { ApiError, request } from '@/shared/lib/http';
import type { MyStore } from './model';
import { fromWireMyStore, type WireMyStore } from './wire';

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
