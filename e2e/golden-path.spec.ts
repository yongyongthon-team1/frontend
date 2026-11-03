import { EXAMPLE_QUERIES } from '../src/features/tours/examples'; // examples.ts는 import가 없는 파일이어야 한다
import { expect, test } from './fixtures';

// 시연 골든 패스(설계 6.1)를 배포 빌드 · 목업(AI 속도 보통)으로 끝까지 돈다. 무대에서처럼 원클릭 시연 링크로 시작하고
// 역할은 시연 패널로 바꾼다. 페이지 오류 · 실패한 API 요청이 있으면 실패한다(fixtures).
test('시연 골든 패스', async ({ page }) => {
  // 고교생: 예시 문장 → AI 추천 → 탐방 상세 → 신청서(시연 모드라 미리 채움) → 신청 완료
  await page.goto('/?demo=1&reset=1&as=student');
  await page.getByRole('button', { name: EXAMPLE_QUERIES[0] }).click();
  await page.getByRole('button', { name: '나에게 맞는 탐방 추천받기' }).click();
  await expect(page.getByText('디자인 분야에 관심이 많군요!')).toBeVisible();
  await page.getByText('경희대학교 국제캠퍼스').first().click();
  await page.getByRole('button', { name: '탐방 신청하기' }).click();
  await page.getByRole('button', { name: '탐방 신청 완료하기' }).click();
  await expect(page.getByText('신청이 접수됐어요!')).toBeVisible();

  // 가이드: 김민지 승인 → AI 코스 초안 → 둘째 지점을 아래로 → 확정(쿠폰 발급)
  await page.getByRole('button', { name: '가이드', exact: true }).click();
  await page.getByRole('link', { name: '신청자 보기' }).first().click();
  // 승인 토스트에도 이름이 들어가므로 신청자 카드(article) 안에서 찾는다.
  const applicant = page.locator('article', { hasText: '김민지' });
  await applicant.getByRole('button', { name: '승인', exact: true }).click();
  await expect(applicant).toContainText('승인됨');
  await page.getByRole('button', { name: 'AI 코스 만들기' }).click();
  await expect(page.getByText('2시간 30분 추천 코스')).toBeVisible();
  await page.getByRole('button', { name: '코스 수정하기' }).click();
  const moveDown = page.getByRole('button', { name: /아래로 이동/ }).nth(1);
  const movedStop = (await moveDown.getAttribute('aria-label'))?.replace(/ 아래로 이동$/, '') ?? '';
  expect(movedStop).not.toBe('');
  await moveDown.click();
  await expect(page.getByRole('article').nth(2).getByRole('heading')).toContainText(movedStop);
  await page.getByRole('button', { name: '최종 코스 확정' }).click();
  await page.getByRole('button', { name: '확정하기' }).click();
  await expect(page.getByText(/쿠폰 [1-9]\d*장 발급/)).toBeVisible();

  // 고교생: 내 탐방 → 코스 지도 → 제휴 상점 쿠폰 → 6자리 코드
  await page.getByRole('button', { name: '고교생', exact: true }).click();
  await page.getByRole('link', { name: '내 탐방', exact: true }).click();
  await page.getByRole('link', { name: /코스 지도 보기/ }).click();
  await expect(page.getByText('오늘의 탐방 코스')).toBeVisible();
  await page.getByRole('link', { name: '제휴 상점 쿠폰 확인' }).click();
  await page.getByRole('link', { name: /할인/ }).first().click();
  const couponCode = page.getByTestId('coupon-code');
  await expect(couponCode).toHaveText(/^\d( \d){5}$/);
  const code = (await couponCode.innerText()).replace(/ /g, '');

  // 사장님: 시연 패널이 그 쿠폰을 발급한 가게의 사장님으로 바꾸고 코드를 채운다 → 사용 처리
  await page.getByRole('button', { name: '쿠폰 가게 사장님으로 전환' }).click();
  await expect(page.getByLabel('6자리 쿠폰 코드')).toHaveValue(code);
  await page.getByRole('button', { name: '사용 처리' }).click();
  await expect(page.getByText('이번 탐방으로 온 학생 1명')).toBeVisible();
});
