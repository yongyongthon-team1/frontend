import { expect, test } from './fixtures';

// 실서버 스모크: 리허설 때만 돈다(`E2E_REAL=1`). 쓰기는 없다 — 시연 고교생으로 로그인해 홈이 열리는 것만 본다.
// 목업 빌드의 `/api`는 실서버가 아니므로, `E2E_BASE_URL`로 실서버에 닿는 배포(또는 프록시를 단 `vite preview`)를 가리킨다.
test.skip(!process.env.E2E_REAL, '실서버 리허설 때만');

test('실서버: 시연 고교생으로 로그인하면 홈 · 내 탐방 · MY가 열린다', async ({ page }) => {
  await page.goto('/?demo=1&mode=real&as=student');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: '내 탐방', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'MY', exact: true })).toBeVisible();
});
