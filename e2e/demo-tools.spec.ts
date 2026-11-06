import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';

// 시연 도구(발표 모드 역할 배지 · 좁은 화면 시연 패널 토글)가 화면 헤더의 오른쪽 조작을 덮지 않는다(판정 R13).
// 배지와 토글은 `pointer-events: none`이거나 위에 떠 있어 elementFromPoint로는 겹침을 못 잡으므로, 상자끼리의
// 겹침(boundingBox)으로 본다. 오른쪽 위 조작은 사장님 내 가게(O01 · O01-E)의 `로그아웃`뿐이다.
const PRESENT_OWNER = '/?demo=1&mode=mock&reset=1&as=owner&present=1';

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`화면에 없는 요소: ${locator}`);
  return box;
}

async function expectNoOverlap(a: Locator, b: Locator, what: string) {
  const [boxA, boxB] = [await boxOf(a), await boxOf(b)];
  const overlaps =
    boxA.x < boxB.x + boxB.width &&
    boxA.x + boxA.width > boxB.x &&
    boxA.y < boxB.y + boxB.height &&
    boxA.y + boxA.height > boxB.y;
  expect(overlaps, `${what}: ${JSON.stringify(boxA)} vs ${JSON.stringify(boxB)}`).toBe(false);
}

test.describe('발표 모드 배지와 헤더 오른쪽 조작', () => {
  test('무대 1280×600: 사장님 배지가 내 가게의 로그아웃을 덮지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(PRESENT_OWNER);
    const badge = page.getByText('사장님 화면', { exact: true });
    const logout = page.getByRole('button', { name: '로그아웃', exact: true });
    await expect(badge).toBeVisible();
    await expect(logout).toBeVisible();
    await expect(page.getByRole('link', { name: '내 가게', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expectNoOverlap(badge, logout, '배지와 로그아웃');
    await expect(logout).toBeInViewport({ ratio: 1 });
  });

  test('좁은 화면 800×700: 배지와 시연 패널 토글이 로그아웃을 덮지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 700 });
    await page.goto(PRESENT_OWNER);
    const badge = page.getByText('사장님 화면', { exact: true });
    const toggle = page.getByRole('button', { name: '시연 패널', exact: true });
    const logout = page.getByRole('button', { name: '로그아웃', exact: true });
    await expect(badge).toBeVisible();
    await expect(toggle).toBeVisible();
    await expect(logout).toBeVisible();
    await expectNoOverlap(badge, logout, '배지와 로그아웃');
    await expectNoOverlap(toggle, logout, '시연 패널 토글과 로그아웃');
    await expect(logout).toBeInViewport({ ratio: 1 });
  });
});
