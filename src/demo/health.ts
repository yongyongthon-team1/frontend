import { ApiError, request } from '@/shared/lib/http';

/**
 * 백엔드가 살아 있는지 확인한다(시연 패널의 `백엔드` 배지). 먼저 `GET /health`(목업 확장). 실서버에는 없어 4xx(404 ·
 * 모르는 경로에 401 · 403을 주는 서버도 있다)가 오면 `GET /campuses`가 되는지로 대신한다(2C-R28) — HTTP 응답이 왔으면
 * 서버는 떠 있다. 두 탐침 모두 토큰을 붙이지 않는다(`auth: false`): 15초마다 도는 확인이 401로 세션 만료 처리를
 * 일으켜 발표자를 로그아웃시키면 안 된다. 어느 쪽이든 되면 정상이고, 그 밖의 오류(5xx · 네트워크 · 시간 초과)는 대신하지
 * 않고 그대로 던진다. 돌려주는 값은 무엇으로 확인했는지다.
 */
export async function checkBackend(): Promise<'health' | 'campuses'> {
  try {
    await request<unknown>('/health', { auth: false });
    return 'health';
  } catch (error) {
    if (!(error instanceof ApiError && error.status >= 400 && error.status < 500)) throw error;
  }
  await request<unknown>('/campuses', { auth: false });
  return 'campuses';
}
