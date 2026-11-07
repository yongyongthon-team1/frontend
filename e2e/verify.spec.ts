import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// 재학 인증 · 보호자 동의 (/verify). 시연 링크 하나로 시작하고(`reset=1`로 목업 DB를 되돌린다) 계정은 시연 패널로 바꾼다.
// ① 실제 브라우저의 multipart 업로드(Review Focus 1 — jsdom은 서비스 워커를 거치는 업로드를 시험하지 못한다)
// ② · ③ 같은 탭 보호자 동의 · 시연 건너뛰기가 새로고침 없이 반영된다(Review Focus 2).
const START = '/?demo=1&reset=1&as=student';

test.describe('/verify', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(START);
    await expect(page.getByRole('region', { name: '시연 패널' })).toBeVisible();
  });

  /**
   * 시연 패널 `P1 계정`에서 이 계정으로 전환하고 `/verify` 화면이 뜰 때까지 기다린다. 전환이 끝났는지는 패널이 기록하는
   * 빠른 로그인 계정(`ytt.demo`)으로 안다 — 그 기록과 이동은 한 동기 구간이라 기록이 보이면 이동도 끝나 있다.
   * 인증이 끝나 가는 계정(`waiting`)의 첫 화면은 `/`라서, 그때는 `MY` 탭의 `인증 상태 확인` 행으로 `/verify`에 들어간다.
   */
  async function switchTo(page: Page, email: string) {
    const panel = page.getByRole('region', { name: '시연 패널' });
    await panel.getByRole('combobox', { name: 'P1 계정' }).selectOption(email);
    await panel.getByRole('button', { name: '이 계정으로 전환' }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('ytt.demo') ?? '{}').state?.activeDemoEmail ?? null,
        ),
      )
      .toBe(email);
    if (new URL(page.url()).pathname !== '/verify') {
      await page.getByRole('link', { name: 'MY', exact: true }).click();
      await page.getByRole('link', { name: /^인증 상태 확인/ }).click();
    }
    await expect(page).toHaveURL(/\/verify$/);
    await expect(
      page.getByRole('heading', { level: 1, name: '인증하고 탐방 신청하기' }),
    ).toBeVisible();
  }

  const step1 = (page: Page) => page.getByRole('region', { name: 'STEP 1 · 재학 인증' });
  const step2 = (page: Page) => page.getByRole('region', { name: 'STEP 2 · 보호자 동의 요청' });

  test('① newbie가 실제 jpg를 올려 재학 인증을 제출하면 심사 중', async ({ page }) => {
    await switchTo(page, 'newbie@demo.kr');
    await expect(step1(page).getByText('미제출', { exact: true })).toBeVisible();

    await page.getByRole('combobox', { name: '학년 선택' }).selectOption({ label: '1학년' });
    await page.getByLabel('학생증 / 재학증명서 업로드').setInputFiles({
      name: 'student-id.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    await expect(page.getByText(/student-id\.jpg · /)).toBeVisible();
    await page.getByRole('button', { name: '재학 인증 제출하기' }).click();

    await expect(step1(page).getByText('심사 중', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '재학 인증 제출하기' })).toHaveCount(0);
  });

  test('② waiting이 보호자 페이지에서 동의하고 돌아오면 새로고침 없이 동의 완료', async ({
    page,
  }) => {
    await switchTo(page, 'waiting@demo.kr');
    await expect(step2(page).getByText('동의 대기', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: '보호자 페이지 열기' }).click();
    await expect(page).toHaveURL(/\/consent\/demo-consent-valid$/);
    await page.getByRole('button', { name: '안내 확인 후 동의하기' }).click();
    await expect(page.getByText('동의를 마쳤어요')).toBeVisible();

    await page.getByRole('link', { name: '학생 화면으로 돌아가기' }).click();
    await expect(page).toHaveURL(/\/verify$/);
    await expect(step2(page).getByText('동의 완료', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '보호자 페이지 열기' })).toHaveCount(0);
  });

  test('③ rejected가 동의를 다시 요청하고 동의 완료로 건너뛰면 새로고침 없이 동의 완료', async ({
    page,
  }) => {
    await switchTo(page, 'rejected@demo.kr');
    await page.getByLabel('보호자 성함').fill('윤보호');
    await page.getByLabel('보호자 이메일').fill('parent@example.com');
    await page.getByRole('button', { name: '동의 링크 보내기' }).click();
    await expect(step2(page).getByText('동의 대기', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '동의 완료로 건너뛰기' }).click();
    await expect(step2(page).getByText('동의 완료', { exact: true })).toBeVisible();
    await expect(page.getByText('시연용으로 보호자 동의를 마쳤어요.')).toBeVisible();
    await expect(page.getByRole('button', { name: '동의 완료로 건너뛰기' })).toHaveCount(0);
  });
});
