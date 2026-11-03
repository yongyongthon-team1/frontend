import { expect, test } from '@playwright/test';

// Review Focus 2: 배포(프로덕션) 빌드에서 딥링크를 새로고침해도 로그인과 목업 데이터가 유지된다.
test('배포 빌드: 로그인 후 딥링크 새로고침에도 상태 유지', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일 주소').fill('student@demo.kr');
  await page.getByLabel('비밀번호').fill('demo1234');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/my-tours');
  await page.reload();

  // 새로고침 뒤에도 /login으로 튕기지 않고, 해당 탭이 활성 상태여야 한다.
  await expect(page).toHaveURL(/\/my-tours$/);
  await expect(page.getByRole('link', { name: '내 탐방' })).toHaveAttribute('aria-current', 'page');
});
