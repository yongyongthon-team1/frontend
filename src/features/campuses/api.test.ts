import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/node';
import { configureHttp } from '@/shared/lib/http';
import { CAMPUSES_LIST } from '@/test/fixtures/backend/campuses';
import { wireOk } from '@/test/wire';
import { getInsight, listCampuses } from './api';

afterEach(() => configureHttp({ getToken: () => null }));

describe('캠퍼스 API는 세션 토큰을 보내지 않는다', () => {
  it('GET /campuses는 로그인 없이 부르는 공개 API(명세 D-01)', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get('/api/campuses', ({ request }) => {
        seen.push(request.headers.get('Authorization'));
        return wireOk(CAMPUSES_LIST.data);
      }),
    );
    configureHttp({ getToken: () => 'session-token' });
    await listCampuses();
    expect(seen).toEqual([null]);
  });

  it('인사이트 확장 호출도 토큰 없이(errata G11)', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get('/api/campuses/:campusId/insight', ({ request }) => {
        seen.push(request.headers.get('Authorization'));
        return wireOk({
          campus_id: 2,
          title: '방학 상권 인사이트',
          text: '본문',
          source: '출처',
          is_placeholder: true,
        });
      }),
    );
    configureHttp({ getToken: () => 'session-token' });
    await getInsight(2);
    expect(seen).toEqual([null]);
  });
});
