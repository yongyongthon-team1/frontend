import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';

// 시연 도구(발표 모드 역할 배지 · 좁은 화면 시연 패널 토글)가 화면 헤더의 오른쪽 조작을 덮지 않는다(실행 판정: 발표 배지가 머리 줄 조작을 가리지 않음).
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

test.describe('전체 시연 패널 높이', () => {
  test('무대 1280×590: 열린 전체 패널은 세로로 넘치지 않는다(스크롤 없이 모두 보인다)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 590 });
    await page.goto('/?demo=1&mode=mock&reset=1&as=student');
    const panel = page.getByRole('region', { name: '시연 패널' });
    await expect(panel.getByRole('combobox', { name: 'P1 계정' })).toBeVisible();
    await expect(panel.getByRole('button', { name: '발표 모드' })).toBeVisible();
    // 패널을 감싼 옆 슬롯(.mobile-aside)이 max-height + overflow-y: auto라, 넘치면 안쪽 스크롤이 생긴다.
    const aside = await panel.evaluate((el) => {
      const slot = el.closest('.mobile-aside');
      if (!slot) throw new Error('.mobile-aside를 찾지 못했어요');
      return { scrollHeight: slot.scrollHeight, clientHeight: slot.clientHeight };
    });
    expect(aside.scrollHeight, JSON.stringify(aside)).toBeLessThanOrEqual(aside.clientHeight);
    // 마지막 버튼까지 뷰포트 안에 온전히 보인다.
    await expect(panel.getByRole('button', { name: '발표 모드' })).toBeInViewport({ ratio: 1 });
  });
});
