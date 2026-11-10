import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import { clearMockFiles } from '@/mocks/db/files';
import { getDb, mutate, resetDb } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { MockApiError } from '@/mocks/rules/errors';
import { SEED_CHECKPOINTS, type SeedCheckpoint } from '@/shared/config/demoAccounts';
import { ok, withWire } from '@/mocks/wire/envelope';
import { api, readBody } from './util';

// 시연 데이터 초기화(목업 전용 확장 엔드포인트, 백엔드 봉투). 목업의 초기화는 `X-Demo-Key`를 보지 않는다(403은 실서버 전용).

const isCheckpoint = (value: unknown): value is SeedCheckpoint =>
  SEED_CHECKPOINTS.includes(value as SeedCheckpoint);

export const demoHandlers = [
  // 오늘 기준 시드(체크포인트를 주면 그 단계까지 진행한 시드)로 되돌린다. 모르는 체크포인트는 400이고 DB는 그대로다.
  // 시드 사용자 id는 늘 같으므로 기존 세션을 새 DB로 옮겨 로그인을 유지한다(새 DB에 없는 사용자의 세션은 버린다).
  http.post(
    api('/demo/reset'),
    withWire(async ({ request }) => {
      await delayBase();
      const checkpoint = (await readBody(request)).checkpoint ?? 'START';
      if (!isCheckpoint(checkpoint)) throw new MockApiError(400, 'VALIDATION');
      const { sessions } = getDb();
      resetDb({ today: mockNow(), checkpoint });
      clearMockFiles(); // 업로드한 목업 사진은 DB와 함께 초기화한다
      mutate((db) => {
        db.sessions = sessions.filter((s) => db.users.some((u) => u.id === s.userId));
      });
      return ok({ ok: true });
    }),
  ),
];
