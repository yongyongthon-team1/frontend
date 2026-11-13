import { expect, test } from './fixtures';

// 리뷰 고리(Review Focus 3): 학생이 쿠폰을 쓰고 리뷰를 남기면 상점 시트의 AI 요약과 사장님 리포트에 같은 리뷰가 보인다.
// 시연 링크 하나로 시작하고(`reset=1`로 목업 DB를 되돌리고 `checkpoint=CONFIRMED`까지 진행한다) 역할은 시연 패널로 바꾼다.
const REVIEW = '사장님이 친절하고 양이 많아요';

test('리뷰 쓰기 → 상점 시트의 새 AI 요약 → 사장님 리포트', async ({ page }) => {
  const panel = page.getByRole('region', { name: '시연 패널' });
  const toOwner = () => panel.getByRole('button', { name: '쿠폰 가게 사장님으로 전환' }).click();
  const toStudent = () => panel.getByRole('button', { name: '고교생', exact: true }).click();

  // 학생: 내 탐방 → 코스 확인하기 → 내 쿠폰 확인하기 → (목록이면 첫 쿠폰) 코드
  /** 쿠폰 상세까지 간다. 쿠폰이 둘이면 목록의 첫 행이고, 이 첫 쿠폰이 시연 패널의 `쿠폰 가게 사장님`이 된다. */
  async function openFirstCoupon() {
    await page.getByRole('link', { name: '내 투어', exact: true }).click();
    await page.getByRole('link', { name: '코스 확인하기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '코스 보기' })).toBeVisible();
    await page.getByRole('link', { name: '내 쿠폰 확인하기' }).click();
    const couponCode = page.getByTestId('coupon-code');
    const firstCoupon = page.getByRole('link', { name: /할인/ }).first();
    await expect(couponCode.or(firstCoupon)).toBeVisible();
    if (!(await couponCode.isVisible())) await firstCoupon.click();
    await expect(couponCode).toHaveText(/^\d{3} \d{3}$/);
  }

  await page.goto('/?demo=1&reset=1&checkpoint=CONFIRMED&as=student');
  await openFirstCoupon();

  // 사장님: 그 쿠폰을 사용 처리한다
  await toOwner();
  await page.getByRole('button', { name: '사용 처리하기' }).click();
  await expect(page.getByText('쿠폰 사용이 완료됐어요.')).toBeVisible();

  // 학생: 같은 길로 쿠폰 → 사용 완료 → 방문 리뷰 작성하기
  await toStudent();
  await expect(page.getByRole('link', { name: '탐색', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await openFirstCoupon();
  await expect(page.getByRole('heading', { name: '쿠폰을 사용했어요!' })).toBeVisible();
  await page.getByRole('link', { name: '방문 리뷰 작성하기' }).click();

  await expect(page.getByRole('heading', { name: '오늘 투어는 어땠나요?' })).toBeVisible();
  await page.getByRole('radio', { name: '별점 4점' }).check({ force: true });
  await page.getByLabel('좋았던 점과 아쉬웠던 점').fill(REVIEW);
  await page.getByRole('button', { name: '리뷰 등록하기' }).click();

  // 코스 지도가 그 상점 시트를 연 채로 열리고, 시트의 AI 요약이 방금 쓴 리뷰를 담는다
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('✦ AI 리뷰 요약')).toBeVisible();
  await expect(sheet).toContainText(REVIEW);
  await expect(sheet).toContainText('학생 6명이');
  await expect(sheet.getByText('리뷰 작성 완료')).toBeVisible();

  // 열린 시트는 뒤의 시연 패널을 가린다 — 닫으면 코스 지도 주소에서 storeId가 빠진다
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(page).not.toHaveURL(/storeId=/);

  // 사장님: 내 가게 → 방문 · 리뷰 리포트에 6명, AI 요약에 같은 리뷰
  await toOwner();
  await page.getByRole('link', { name: '내 가게', exact: true }).click();
  await page.getByRole('link', { name: /방문 · 리뷰 리포트/ }).click();
  await expect(page.getByText('6명', { exact: true })).toBeVisible();
  const aiCard = page.locator('section', { hasText: 'AI 리뷰 요약' });
  await expect(aiCard).toContainText(REVIEW);
});
