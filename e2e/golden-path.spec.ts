import type { Page } from '@playwright/test';
import { EXAMPLE_QUERIES } from '../src/features/tours/examples'; // examples.ts는 import가 없는 파일이어야 한다
import { expect, test } from './fixtures';

// 시연 골든 패스(설계 6.1)를 배포 빌드 · 목업(AI 속도 보통)으로 끝까지 돈다. 무대에서처럼 원클릭 시연 링크로 시작하고
// 역할은 시연 패널로 바꾼다. 페이지 오류 · 실패한 API 요청이 있으면 실패한다(fixtures).
// 두 갈래로 돈다: 전체 시연 패널(4단계 = `쿠폰 가게 사장님으로 전환`)과, README 무대 링크의 발표 모드(`present=1`).
// 발표 모드는 세로 막대의 역할 버튼 4개만 쓴다 — 4단계의 `사장님`이 학생이 방금 본 쿠폰의 가게 사장님으로 바꾼다(판정 32).
const VARIANTS = [
  { title: '시연 골든 패스', link: '/?demo=1&reset=1&as=student', present: false },
  {
    title: '시연 골든 패스 · 발표 모드(역할 막대만)',
    link: '/?demo=1&mode=mock&reset=1&as=student&present=1',
    present: true,
  },
];

/**
 * 발표 모드의 역할 배지(설계 5.8)는 관객이 읽게 16px 이상으로 그리되 화면 제목 글자를 덮지 않는다. 제목(h1)은 줄 끝까지
 * 늘어나는 상자라, 글자가 차지한 줄 상자들(Range의 client rects)이 배지 상자와 겹치는지 본다. TopBar 화면은 제목이
 * 배지와 같은 줄이라 글자 끝이 배지 왼쪽이어야 하고, V2 탭 첫 화면은 제목이 배지 줄 아래라 세로로 비켜 있어야 한다 —
 * 어느 쪽이든 "겹치지 않는다"가 기준이다.
 * (e2e는 DOM 타입 없이 검사하므로 브라우저 전역 대신 요소의 ownerDocument로 닿는다.)
 */
async function expectRoleBadgeBesideTitle(page: Page, label: string) {
  const badge = page.getByText(label, { exact: true });
  await expect(badge).toBeVisible();
  const fontSize: number = await badge.evaluate((el) =>
    parseFloat(el.ownerDocument.defaultView!.getComputedStyle(el).fontSize),
  );
  expect(fontSize, `"${label}" 배지 글자 크기(px)`).toBeGreaterThanOrEqual(16);
  const lines: Array<{ left: number; right: number; top: number; bottom: number }> = await page
    .getByRole('heading', { level: 1 })
    .evaluate((h1) => {
      const range = h1.ownerDocument.createRange();
      range.selectNodeContents(h1);
      const rects = range.getClientRects() as unknown as ArrayLike<{
        left: number;
        right: number;
        top: number;
        bottom: number;
      }>;
      return Array.from(rects, ({ left, right, top, bottom }) => ({ left, right, top, bottom }));
    });
  expect(lines.length, '화면 제목(h1) 글자 상자').toBeGreaterThan(0);
  const box = await badge.boundingBox();
  if (box === null) throw new Error(`화면에 없는 배지: ${label}`);
  for (const line of lines) {
    const overlaps =
      line.left < box.x + box.width &&
      line.right > box.x &&
      line.top < box.y + box.height &&
      line.bottom > box.y;
    expect(overlaps, `화면 제목 글자가 "${label}" 배지와 겹치지 않는다`).toBe(false);
  }
}

for (const { title, link, present } of VARIANTS) {
  test(title, async ({ page }) => {
    const panel = page.getByRole('region', { name: '시연 패널' });
    const switchRole = (name: string) => panel.getByRole('button', { name, exact: true }).click();
    const checkRoleBadge = async (label: string) => {
      if (present) await expectRoleBadgeBesideTitle(page, label);
    };

    // 고교생: 문장 입력(시연 도구가 켜져 있어 미리 채워져 있다 — 다시 채워도 같다) → AI 추천 → 탐방 상세 →
    // 신청서(시연 모드라 미리 채움) → 신청 완료
    await page.goto(link);
    const wish = page.getByLabel('하고 싶은 것');
    await expect(wish).toBeVisible();
    await checkRoleBadge('고교생 화면');
    await wish.fill(EXAMPLE_QUERIES[0]);
    await page.getByRole('button', { name: '나에게 맞는 탐방 추천받기' }).click();
    await expect(page.getByText('디자인 분야에 관심이 많군요!')).toBeVisible();
    await page.getByText('경희대학교 국제캠퍼스').first().click();
    await page.getByRole('button', { name: '이 탐방 신청하기' }).click();
    await page.getByRole('button', { name: '신청 완료하기' }).click();
    await expect(page.getByText('신청이 접수됐어요!')).toBeVisible();
    await checkRoleBadge('고교생 화면');

    // 가이드: 김민지 승인 → AI 코스 초안 → 둘째 지점을 아래로 → 확정(쿠폰 발급)
    await switchRole('가이드');
    // 가이드 첫 화면은 /guide(자리 화면 — Task 9가 홈으로 채운다). 개설한 탐방 목록으로 들어간다.
    await expect(page.getByRole('heading', { name: '내 탐방', exact: true })).toBeVisible();
    await checkRoleBadge('가이드 화면');
    await page.getByRole('link', { name: '내가 개설한 탐방' }).click();
    await expect(page.getByRole('heading', { name: '내가 개설한 탐방' })).toBeVisible();
    await page.getByRole('link', { name: '신청자 보기' }).first().click();
    // 승인 토스트에도 이름이 들어가므로 신청자 카드(article) 안에서 찾는다.
    const applicant = page.locator('article', { hasText: '김민지' });
    await applicant.getByRole('button', { name: '승인', exact: true }).click();
    await expect(applicant).toContainText('승인됨');
    await page.getByRole('button', { name: 'AI 코스 만들기' }).click();
    await expect(page.getByText('2시간 30분 추천 코스')).toBeVisible();
    await page.getByRole('button', { name: '코스 수정하기' }).click();
    const moveDown = page.getByRole('button', { name: /아래로 이동/ }).nth(1);
    const movedStop =
      (await moveDown.getAttribute('aria-label'))?.replace(/ 아래로 이동$/, '') ?? '';
    expect(movedStop).not.toBe('');
    await moveDown.click();
    await expect(page.getByRole('article').nth(2).getByRole('heading')).toContainText(movedStop);
    await page.getByRole('button', { name: '최종 코스 확정' }).click();
    await page.getByRole('button', { name: '확정하기' }).click();
    await expect(page.getByText(/쿠폰 [1-9]\d*장 발급/)).toBeVisible();
    await checkRoleBadge('가이드 화면');

    // 고교생: 내 탐방 → 코스 지도 → 제휴 상점 쿠폰 → 6자리 코드(순서를 바꿨으므로 첫 쿠폰은 상점 1이 아니다)
    await switchRole('고교생');
    // 가이드 탭에도 `내 탐방`이 있으므로, 역할 전환이 끝나(고교생 홈) 그 탭이 사라진 뒤에 누른다.
    // (고교생 홈의 제목은 바뀔 수 있으니, 역할이 바뀌어도 변하지 않는 신호 — 고교생 탭 `탐색`이 켜진 것 — 를 기다린다.)
    await expect(page.getByRole('link', { name: '탐색', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.getByRole('link', { name: '내 탐방', exact: true }).click();
    await expect(page.getByRole('heading', { name: '내 탐방 · 신청 상태' })).toBeVisible();
    await checkRoleBadge('고교생 화면');
    await page.getByRole('link', { name: /코스 지도 보기/ }).click();
    await expect(page.getByText('오늘의 탐방 코스')).toBeVisible();
    await page.getByRole('link', { name: '제휴 상점 쿠폰 확인' }).click();
    await page.getByRole('link', { name: /할인/ }).first().click();
    const couponCode = page.getByTestId('coupon-code');
    await expect(couponCode).toHaveText(/^\d( \d){5}$/);
    const code = (await couponCode.innerText()).replace(/ /g, '');
    await checkRoleBadge('고교생 화면');

    // 사장님: 그 쿠폰을 발급한 가게의 사장님으로 바꾸고 코드를 채운다 → 사용 처리
    if (present) {
      await expect(panel.getByRole('button', { name: '쿠폰 가게 사장님으로 전환' })).toHaveCount(0);
      await switchRole('사장님');
    } else {
      await panel.getByRole('button', { name: '쿠폰 가게 사장님으로 전환' }).click();
    }
    await expect(page.getByLabel('6자리 쿠폰 코드')).toHaveValue(code);
    await expect(page.getByText('내 가게 쿠폰')).toBeVisible();
    await checkRoleBadge('사장님 화면');
    await page.getByRole('button', { name: '사용 처리' }).click();
    await expect(page.getByText('이번 탐방으로 온 학생 1명')).toBeVisible();
  });
}
