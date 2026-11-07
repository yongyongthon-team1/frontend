import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { DEMO_WISH } from '../src/features/tours/examples'; // examples.ts는 import가 없는 파일이어야 한다
import { expect, test } from './fixtures';

// 무대 노트북 화면 점검(Review Focus 3 · 판정 28 · 30). 골든 패스 핵심 정보 — 탐방 찾기 결과의 희망 원문 카드 · 첫 탐방 행,
// 코스 완성 지점, 쿠폰 코드 — 가 스크롤 없이, 다른 요소에 덮이지 않고 보여야 한다. 뷰포트는 브라우저 UI를 뺀 실제 페이지
// 영역이다. 폰 프레임 높이가 min(844px, 뷰포트 높이 − 32px)이라 TopBar 하단(프레임 위 16 + 56 = 뷰포트 y 72px)과
// 하단 탭(80px) 사이 본문은 452 · 432 · 422px뿐이다(Task 10 실측, 설계 5.7의 무대 400px 예산). 실패하면 단언을
// 느슨하게 하지 말고 화면 배치를 고친다.
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

const TOPBAR_HEIGHT = 56; // tokens.css --topbar-h

/** 덮임 검사의 표본 점: 요소 상자의 가로 25 · 50 · 75%, 세로 15 · 50 · 85%(판정 R4). */
const COVER_SAMPLES_X = [0.25, 0.5, 0.75];
const COVER_SAMPLES_Y = [0.15, 0.5, 0.85];

/**
 * 핵심 요소가 스크롤 없이 다 보이는지: 화면 영역(main)이 맨 위에 있고, 요소마다 뷰포트 안(ratio 1)이면서 하단 탭
 * 위에서 끝나며, 다른 요소에 덮이지 않는다. IntersectionObserver(`toBeInViewport`)는 다른 요소가 덮는 것을 보지
 * 않아서 탭 위치는 따로 재고, 덮임은 요소 상자의 3×3 점마다 그 점의 맨 위 요소(`elementFromPoint`)가 대상 안에
 * 있는지로 본다 — 하단에 붙은 버튼 같은 것이 핵심 정보를 가리면 실패한다(판정 R4).
 */
async function expectVisibleWithoutScroll(page: Page, targets: Locator[], name: string) {
  // 글꼴이 다 와야 줄바꿈 · 높이가 무대와 같다.
  await page.waitForFunction("document.fonts.status === 'loaded'");
  await expect(page.getByRole('main')).toHaveJSProperty('scrollTop', 0);
  const tabBar = page.getByRole('navigation', { name: '주요 메뉴' });
  await expect(tabBar).toBeVisible();
  const tabBarTop = (await boxOf(tabBar)).y;
  // 기준점은 main 상단 + 56. 코스 · 쿠폰 화면은 TopBar(56)가 있고, 무대 ①(탐방 찾기 결과)은 TopBar 없이 자기 뒤로 가기 줄
  // (`pt-2` + `h-12` = 56)이 같은 기준선을 만든다. 가용 높이가 머리 주석의 452 · 432 · 422다.
  const bodyTop = (await boxOf(page.getByRole('main'))).y + TOPBAR_HEIGHT;
  let lowest = 0;
  for (const target of targets) {
    await expect(target).toBeInViewport({ ratio: 1 });
    const box = await boxOf(target);
    expect(box.y + box.height, `${target}의 하단이 하단 탭 위`).toBeLessThanOrEqual(tabBarTop);
    lowest = Math.max(lowest, box.y + box.height);
    const samples = await target.evaluate(
      (el, { xs, ys }) => {
        const rect = el.getBoundingClientRect();
        return ys.flatMap((fy) =>
          xs.map((fx) => {
            const x = rect.x + rect.width * fx;
            const y = rect.y + rect.height * fy;
            // 한계: elementFromPoint는 `pointer-events: none` 겹침(발표 모드 역할 배지 같은 장식)을
            // 건너뛰므로 그런 덮임은 잡지 못한다.
            const top = el.ownerDocument.elementFromPoint(x, y);
            return {
              point: `(${fx * 100}%, ${fy * 100}%) = (${Math.round(x)}, ${Math.round(y)})`,
              covered: !el.contains(top),
              top: top === null ? 'null' : top.outerHTML.slice(0, 120),
            };
          }),
        );
      },
      { xs: COVER_SAMPLES_X, ys: COVER_SAMPLES_Y },
    );
    for (const { point, covered, top } of samples) {
      expect(covered, `${target}의 ${point} 점이 다른 요소에 덮이지 않는다(맨 위: ${top})`).toBe(
        false,
      );
    }
  }
  // 실측 기록(README 무대 실측표의 출처): 상단 바 하단에서 가장 아래 대상의 하단까지가 사용 높이, 하단 탭 위까지가 가용 높이다.
  const used = lowest - bodyTop;
  const available = tabBarTop - bodyTop;
  test.info().annotations.push({
    type: 'stage-measure',
    description: `${name}: 사용 ${used}px / 가용 ${available}px / 여유 ${available - used}px`,
  });
}

for (const { width, height, deviceScaleFactor } of STAGE_VIEWPORTS) {
  const stage = `${width}x${height}@${deviceScaleFactor}x`;
  const screenshot = (page: Page, n: number) =>
    page.screenshot({ path: path.join(test.info().project.outputDir, `stage-${stage}-${n}.png`) });

  test.describe(`무대 ${stage}`, () => {
    test.use({ viewport: { width, height }, deviceScaleFactor });

    test('① 탐방 찾기: 희망 원문 카드와 첫 탐방 행', async ({ page }) => {
      await page.goto('/?demo=1&reset=1&as=student');
      // 시연 도구가 켜져 있어 칸이 미리 채워진다 — 학교는 캠퍼스 목록이 온 뒤라 그것을 기다렸다가 낸다.
      await expect(page.getByLabel('학교', { exact: true })).toHaveValue(
        String(DEMO_WISH.universityId),
      );
      await page.getByRole('button', { name: '희망 사항 남기고 탐방 찾기' }).click();

      const main = page.getByRole('main');
      const wishCard = main.getByRole('region', { name: '내가 남긴 희망 사항' });
      await expect(wishCard).toBeVisible();
      const firstTour = main
        .getByRole('list', { name: '모집 중 탐방' })
        .getByRole('listitem')
        .first();
      // 목록이 와야 제목(Skeleton → 결과 문구) 높이가 정해진다 — 그 뒤에 잰다.
      await expect(firstTour).toBeVisible();
      await expectVisibleWithoutScroll(page, [wishCard, firstTour], '① 탐방 찾기');
      await screenshot(page, 1);
    });

    test('② 코스 완성: 지점 카드 3개', async ({ page }) => {
      await page.goto('/?demo=1&reset=1&checkpoint=APPROVED&as=guide');
      // 가이드 첫 화면 /guide(G01) → 맨 아래 `내가 개설한 탐방`(G06) → `신청자 관리하기`(G02) → 코스 만들기.
      await page.getByRole('link', { name: '내가 개설한 탐방' }).click();
      await page.getByRole('link', { name: '신청자 관리하기' }).first().click();
      await page.getByRole('button', { name: '승인 완료 후 코스 만들기' }).click();
      // AI 로딩 화면 뒤 코스 완성(G03)으로 바뀐다 — 생성 직후 첫 화면이 무대 장면이다.
      await expect(page.getByRole('heading', { name: '코스를 완성해 볼까요?' })).toBeVisible();

      const stops = page
        .getByRole('main')
        .getByRole('list', { name: '코스 지점' })
        .getByRole('listitem');
      await expect(stops).toHaveCount(3);
      await expectVisibleWithoutScroll(page, await stops.all(), '② 코스 완성');
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
      await expectVisibleWithoutScroll(page, [code], '③ 쿠폰');
      await screenshot(page, 3);
    });
  });
}
