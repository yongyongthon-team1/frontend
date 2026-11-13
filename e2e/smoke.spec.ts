import { expect, test } from '@playwright/test';

// Review Focus 2: 배포(프로덕션) 빌드에서 딥링크를 새로고침해도 로그인과 목업 데이터가 유지된다.
test('배포 빌드: 로그인 후 딥링크 새로고침에도 상태 유지', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill('student@demo.kr');
  await page.getByLabel('비밀번호').fill('demo1234');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/my-tours');
  await page.reload();

  // 새로고침 뒤에도 /login으로 튕기지 않고, 해당 탭이 활성 상태여야 한다.
  await expect(page).toHaveURL(/\/my-tours$/);
  await expect(page.getByRole('link', { name: '내 투어', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

// 파비콘 링크가 없으면 브라우저가 /favicon.ico를 찾고, SPA rewrite가 그 요청에 index.html을 준다.
test('배포 빌드: 파비콘은 SVG 파일로 준다', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
  const icon = await page.request.get('/favicon.svg');
  expect(icon.ok()).toBe(true);
  expect(icon.headers()['content-type']).toContain('image/svg+xml');
});
