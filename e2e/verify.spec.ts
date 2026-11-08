import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// 재학 인증(C03) · 반려 재제출(C08) · 보호자 동의 요청(C04) · 인증 상태(C07). 시연 링크 하나로 시작하고(`reset=1`로 목업 DB를 되돌린다)
// 계정은 시연 패널로 바꾼다.
// ① 실제 브라우저의 multipart 업로드(Review Focus 1 — jsdom은 서비스 워커를 거치는 업로드를 시험하지 못한다)
// ② · ③ 같은 탭 보호자 동의 · 시연 건너뛰기가 새로고침 없이 반영된다(Review Focus 2).
const START = '/?demo=1&reset=1&as=student';

test.describe('재학 인증 · 보호자 동의', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(START);
    await expect(page.getByRole('region', { name: '시연 패널' })).toBeVisible();
  });

  /**
   * 시연 패널 `P1 계정`에서 이 계정으로 전환한다. 전환이 끝났는지는 패널이 기록하는 빠른 로그인 계정(`ytt.demo`)으로 안다
   * — 그 기록과 이동은 한 동기 구간이라 기록이 보이면 이동도 끝나 있다. 전환하면 그 계정의 첫 화면이 열린다
   * (인증 전 · 반려는 `/verify`, 동의 대기 · 심사 중은 `/`).
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
  }

  /**
   * MY → `인증 상태 확인` → 내 정보 · 인증 상태(C07). 하단 탭이 있는 화면(`/`)에서는 MY 탭으로, 탭이 없는 인증 화면(첫 화면 `/verify`)
   * 에서는 상단 바 뒤로 가기(→ MY)로 들어간다.
   */
  async function openStatus(page: Page) {
    if (new URL(page.url()).pathname !== '/me') {
      const tab = page.getByRole('link', { name: 'MY', exact: true });
      if ((await tab.count()) > 0) await tab.click();
      else await page.getByRole('button', { name: '뒤로 가기' }).click();
    }
    await expect(page).toHaveURL(/\/me$/);
    await page.getByRole('link', { name: /^인증 상태 확인/ }).click();
    await expect(page).toHaveURL(/\/me\/status$/);
    await expect(page.getByRole('heading', { level: 1, name: '내 정보' })).toBeVisible();
  }

  /** C07의 `보호자 참여 동의` 줄로 보호자 동의 요청(C04)을 연다. */
  async function openGuardian(page: Page) {
    await openStatus(page);
    await page.getByRole('link', { name: /^보호자 참여 동의/ }).click();
    await expect(page).toHaveURL(/\/verify\/guardian$/);
    await expect(page.getByRole('heading', { level: 1, name: '보호자 동의 요청' })).toBeVisible();
  }

  const progress = (page: Page) => page.getByRole('region', { name: '진행 상태' });
  const enrollmentRow = (page: Page) => page.getByRole('link', { name: /^학생증 인증/ });

  test('① newbie가 실제 jpg를 올려 재학 인증을 제출하면 심사 중', async ({ page }) => {
    await switchTo(page, 'newbie@demo.kr');
    await expect(page).toHaveURL(/\/verify$/);
    await expect(
      page.getByRole('heading', { level: 1, name: '재학 인증 · 학생증 업로드' }),
    ).toBeVisible();
    // 미제출 — C07의 상태 줄도 같은 말을 한다.
    await openStatus(page);
    await expect(enrollmentRow(page)).toHaveAccessibleName('학생증 인증 미제출');
    await enrollmentRow(page).click();
    await expect(page).toHaveURL(/\/verify$/);

    await page.getByRole('combobox', { name: '학년' }).selectOption({ label: '1학년' });
    await page.getByLabel('학생증 사진 올리기').setInputFiles({
      name: 'student-id.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    await expect(page.getByText(/student-id\.jpg · /)).toBeVisible();
    await page.getByRole('button', { name: '인증 요청하기' }).click();

    // 제출하면 다음 단계(C04)로 간다. 심사 중은 C07과 `/verify`에서 본다.
    await expect(page).toHaveURL(/\/verify\/guardian$/);
    await openStatus(page);
    await expect(enrollmentRow(page)).toHaveAccessibleName('학생증 인증 심사 중');
    await enrollmentRow(page).click();
    await expect(page).toHaveURL(/\/verify$/);
    await expect(
      page.getByRole('heading', { level: 2, name: '학생증을 심사하고 있어요.' }),
    ).toBeVisible();
    await expect(page.getByRole('definition')).toHaveText('심사 중');
    await expect(page.getByRole('button', { name: '인증 요청하기' })).toHaveCount(0);
  });

  test('② waiting이 보호자 페이지에서 동의하고 돌아오면 새로고침 없이 동의 완료', async ({
    page,
  }) => {
    await switchTo(page, 'waiting@demo.kr');
    await openGuardian(page);
    await expect(progress(page).getByText('동의 요청 대기', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: '보호자 페이지 열기' }).click();
    await expect(page).toHaveURL(/\/consent\/demo-consent-valid$/);
    await page.getByRole('button', { name: '안내 확인 후 동의하기' }).click();
    await expect(page.getByText('동의를 마쳤어요')).toBeVisible();

    await page.getByRole('link', { name: '학생 화면으로 돌아가기' }).click();
    await expect(page).toHaveURL(/\/verify\/guardian$/);
    await expect(progress(page).getByText('동의 완료', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '보호자 페이지 열기' })).toHaveCount(0);
  });

  test('③ rejected가 동의를 다시 요청하고 동의 완료로 건너뛰면 새로고침 없이 동의 완료', async ({
    page,
  }) => {
    await switchTo(page, 'rejected@demo.kr');
    await openGuardian(page);
    await page.getByLabel('보호자 성함').fill('윤보호');
    await page.getByLabel('보호자 이메일').fill('parent@example.com');
    await page.getByRole('button', { name: '동의 링크 보내기' }).click();
    await expect(progress(page).getByText('동의 요청 대기', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '동의 완료로 건너뛰기' }).click();
    await expect(progress(page).getByText('동의 완료', { exact: true })).toBeVisible();
    await expect(page.getByText('시연용으로 보호자 동의를 마쳤어요.')).toBeVisible();
    await expect(page.getByRole('button', { name: '동의 완료로 건너뛰기' })).toHaveCount(0);
  });

  test('④ rejected가 반려 사유를 보고 새 사진으로 재제출하면 심사 중', async ({ page }) => {
    await switchTo(page, 'rejected@demo.kr');
    await expect(page).toHaveURL(/\/verify$/);
    await expect(page.getByRole('heading', { level: 1, name: '인증 반려 · 재제출' })).toBeVisible();
    await expect(
      page.getByText('반려 사유: 학생증 사진이 흐려서 학교 이름을 읽을 수 없어요.'),
    ).toBeVisible();

    await page.getByRole('combobox', { name: '학년' }).selectOption({ label: '2학년' });
    await page.getByLabel('학생증 다시 올리기').setInputFiles({
      name: 'student-id.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    await page.getByRole('button', { name: '재제출하기' }).click();

    await expect(page).toHaveURL(/\/verify\/guardian$/);
    await openStatus(page);
    await expect(enrollmentRow(page)).toHaveAccessibleName('학생증 인증 심사 중');
  });
});
