import { listAll, request } from '@/shared/lib/http';
import type { Insight, University } from './model';
import { fromWireCampus, fromWireInsight, type WireCampus, type WireInsight } from './wire';

/** D-01 `GET /campuses`(로그인 없이). */
export async function listCampuses(): Promise<University[]> {
  const items = await listAll<WireCampus>('/campuses', { auth: false });
  return items.map(fromWireCampus);
}

/**
 * 목업 전용 확장 `GET /campuses/{campusId}/insight`. 실서버에는 없어 오류가 나고 카드는 그려지지 않는다.
 * 확장 호출은 토큰 없이 보낸다(errata G11): 실서버가 모르는 경로에 401을 주면 세션 만료 처리로 로그아웃될 수 있다.
 */
export async function getInsight(universityId: number): Promise<Insight> {
  return fromWireInsight(
    await request<WireInsight>(`/campuses/${universityId}/insight`, {
      auth: false,
    }),
  );
}
