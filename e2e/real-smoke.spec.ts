import { expect, test } from './fixtures';

// 실서버 스모크: 리허설 때만 돈다(`E2E_REAL=1`). 쓰기는 없다 — 실서버에서는 빠른 로그인이 없으므로(11/10) 원클릭 링크
// `?as=`로 열어도 자동 로그인하지 않고 로그인 화면에 머무는 것만 본다.
// 목업 빌드의 `/api`는 실서버가 아니므로, `E2E_BASE_URL`로 실서버에 닿는 배포(또는 프록시를 단 `vite preview`)를 가리킨다.
test.skip(!process.env.E2E_REAL, '실서버 리허설 때만');

test('실서버: 원클릭 링크로 열어도 자동 로그인하지 않고 로그인 화면이 열린다', async ({ page }) => {
  await page.goto('/?demo=1&mode=real&as=student');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  await expect(page.getByRole('link', { name: '내 투어', exact: true })).toHaveCount(0);
});
