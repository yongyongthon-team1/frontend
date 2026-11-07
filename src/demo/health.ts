import { ApiError, request } from '@/shared/lib/http';

/**
 * 백엔드가 살아 있는지 확인한다(시연 패널의 `백엔드` 배지). 먼저 `GET /health`(목업 확장). 실서버에는 없어 404가 오면
 * 토큰 없는 `GET /campuses`가 되는지로 대신한다(2C-R28). 어느 쪽이든 되면 정상이고, 그 밖의 오류(네트워크 · 시간 초과 ·
 * 404가 아닌 상태)는 그대로 던진다. 돌려주는 값은 무엇으로 확인했는지다.
 */
export async function checkBackend(): Promise<'health' | 'campuses'> {
  try {
    await request<unknown>('/health');
    return 'health';
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
  await request<unknown>('/campuses', { auth: false });
  return 'campuses';
}
