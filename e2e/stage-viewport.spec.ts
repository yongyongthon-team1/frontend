import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { EXAMPLE_QUERIES } from '../src/features/tours/examples'; // examples.ts는 import가 없는 파일이어야 한다
import { expect, test } from './fixtures';

// 무대 노트북 화면 점검(Review Focus 3 · 판정 28 · 30). 골든 패스 핵심 정보 — 관심 키워드 · 첫 추천 이유, 코스 초안
// 지점, 쿠폰 코드 — 가 스크롤 없이 보여야 한다. 뷰포트는 브라우저 UI를 뺀 실제 페이지 영역이다. 폰 프레임 높이가
// min(844px, 뷰포트 높이 − 32px)이라 TopBar(68px)와 하단 탭(81px) 사이 본문은 439 · 419 · 409px뿐이다(설계 5.7의
// 무대 400px 예산). 실패하면 단언을 느슨하게 하지 말고 화면 배치를 고친다.
const STAGE_VIEWPORTS = [
  { width: 1366, height: 620, deviceScaleFactor: 1 },
  { width: 1280, height: 600, deviceScaleFactor: 1 },
  { width: 1280, height: 590, deviceScaleFactor: 1.5 },
];

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`화면에 없는 요소: ${locator}`);
  return box;
}

/**
 * 핵심 요소가 스크롤 없이 다 보이는지: 화면 영역(main)이 맨 위에 있고, 요소마다 뷰포트 안(ratio 1)이면서 하단 탭
 * 위에서 끝난다. IntersectionObserver(`toBeInViewport`)는 다른 요소가 덮는 것을 보지 않아서 탭 위치는 따로 잰다.
 */
async function expectVisibleWithoutScroll(page: Page, targets: Locator[]) {
  // 글꼴이 다 와야 줄바꿈 · 높이가 무대와 같다.
  await page.waitForFunction("document.fonts.status === 'loaded'");
  await expect(page.getByRole('main')).toHaveJSProperty('scrollTop', 0);
  const tabBar = page.getByRole('navigation', { name: '주요 메뉴' });
  await expect(tabBar).toBeVisible();
  const tabBarTop = (await boxOf(tabBar)).y;
  for (const target of targets) {
    await expect(target).toBeInViewport({ ratio: 1 });
    const box = await boxOf(target);
    expect(box.y + box.height, `${target}의 하단이 하단 탭 위`).toBeLessThanOrEqual(tabBarTop);
  }
}

for (const { width, height, deviceScaleFactor } of STAGE_VIEWPORTS) {
  const stage = `${width}x${height}@${deviceScaleFactor}x`;
  const screenshot = (page: Page, n: number) =>
    page.screenshot({ path: path.join(test.info().project.outputDir, `stage-${stage}-${n}.png`) });

  test.describe(`무대 ${stage}`, () => {
    test.use({ viewport: { width, height }, deviceScaleFactor });

    test('① 추천: 첫 관심 키워드 칩과 첫 행의 추천 이유', async ({ page }) => {
      await page.goto('/?demo=1&reset=1&as=student');
      await page.getByLabel('하고 싶은 것').fill(EXAMPLE_QUERIES[0]);
      await page.getByRole('button', { name: '나에게 맞는 탐방 추천받기' }).click();
      await expect(page.getByText('디자인 분야에 관심이 많군요!')).toBeVisible();

      // 첫 키워드 칩 = 필터 칩 줄의 `전체` 다음 칩(학과에 든 키워드 칩, 없으면 학교 칩)이고, 추천 이유는 첫 행의 셋째 줄이다.
      const main = page.getByRole('main');
      const firstKeyword = main
        .getByRole('radiogroup', { name: '추천 필터' })
        .getByRole('radio')
        .nth(1);
      const firstReason = main.getByTestId('recommendation-reason-line').first();
      await expectVisibleWithoutScroll(page, [firstKeyword, firstReason]);
      await screenshot(page, 1);
    });

    test('② 코스 초안: 지점 카드 3개', async ({ page }) => {
      await page.goto('/?demo=1&reset=1&checkpoint=APPROVED&as=guide');
      // 가이드 첫 화면 /guide는 자리 화면이다(Task 9가 홈으로 채운다) — 개설한 탐방 목록을 거쳐 간다.
      await page.getByRole('link', { name: '내가 개설한 탐방' }).click();
      await page.getByRole('link', { name: '신청자 보기' }).first().click();
      await page.getByRole('button', { name: 'AI 코스 만들기' }).click();
      await expect(page.getByRole('heading', { name: '2시간 30분 추천 코스' })).toBeVisible();

      // 지점 카드는 제목(heading)이 있는 목록 항목이다(관심사 칩은 제목이 없다).
      const stops = page
        .getByRole('main')
        .getByRole('listitem')
        .filter({ has: page.getByRole('heading') });
      await expect(stops).toHaveCount(3);
      await expectVisibleWithoutScroll(page, await stops.all());
      await screenshot(page, 2);
    });

    test('③ 쿠폰 상세: 쿠폰 코드(3자리씩)', async ({ page }) => {
      await page.goto('/?demo=1&reset=1&checkpoint=CONFIRMED&as=student');
      await page.getByRole('link', { name: '내 탐방', exact: true }).click();
      await page.getByRole('link', { name: '코스 확인하기', exact: true }).click();
      await page.getByRole('link', { name: '내 쿠폰 확인하기' }).click();
      // 쿠폰이 1장뿐이면 목록이 바로 상세로 넘어간다 — 목록이든 상세든 코드가 보일 때까지 기다린다.
      const code = page.getByTestId('coupon-code');
      const firstCoupon = page.getByRole('main').getByRole('listitem').getByRole('link').first();
      await expect(code.or(firstCoupon)).toBeVisible();
      if (!(await code.isVisible())) await firstCoupon.click();
      await expect(code).toHaveText(/^\d{3} \d{3}$/);
      await expectVisibleWithoutScroll(page, [code]);
      // 하단에 붙은 버튼 같은 다른 요소가 코드를 덮지 않는다(가운데 점의 맨 위 요소가 코드).
      const covered = await code.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return !el.contains(
          el.ownerDocument.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      });
      expect(covered, '쿠폰 코드가 다른 요소에 덮이지 않는다').toBe(false);
      await screenshot(page, 3);
    });
  });
}
