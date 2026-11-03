import { http, HttpResponse } from 'msw';
import type { Insight } from '@/features/campuses/model';
import { shortUniversityName } from '@/features/tours/model';
import type { UniversityRow } from '@/mocks/db/schema';
import { getDb } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { MockApiError } from '@/mocks/rules/errors';
import { toUniversity } from '@/mocks/rules/views';
import { api, withErrors } from './util';

// "방학 상권 인사이트" 카드(설계 5.6)의 자리 값. 실제 지표 · 출처는 팀 데이터 담당이 정한다(5개교 공통 예시).
const INSIGHT_TITLE = '방학 상권 인사이트';
const INSIGHT_SOURCE = '팀 데이터 담당 확정 전 예시';

function insightOf(u: UniversityRow): Insight {
  const area = u.administrativeDong ?? `${shortUniversityName(u.name)} 주변 상권`;
  return {
    universityId: u.id,
    title: INSIGHT_TITLE,
    text: `${area}은 방학이면 대학가 손님이 크게 줄어요. 이 코스는 그 상권으로 신청자들을 보내요.`,
    source: INSIGHT_SOURCE,
    isPlaceholder: true,
  };
}

export const campusHandlers = [
  http.get(
    api('/universities'),
    withErrors(async () => {
      await delayBase();
      const db = getDb();
      const list = [...db.universities].sort((a, b) => a.id - b.id);
      return HttpResponse.json(list.map((u) => toUniversity(db, u)));
    }),
  ),

  http.get(
    api('/universities/:id/insight'),
    withErrors(async ({ params }) => {
      await delayBase();
      const university = getDb().universities.find((u) => u.id === Number(params.id));
      if (!university) throw new MockApiError(404, 'NOT_FOUND');
      return HttpResponse.json(insightOf(university));
    }),
  ),
];
