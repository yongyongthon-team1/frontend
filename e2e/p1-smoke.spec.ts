import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// P1 스모크(Plan 2B′ 마감). ① 역할마다 P1 화면을 앱 안 링크로 열어 막다른 곳(`곧 열려요.` 자리 화면)이 없음을 본다
// — 자리 화면은 `/explore`(P2)뿐이다. ② 사장님 온보딩을 처음부터 끝까지 돈다. 시연 링크 하나로 시작하고(`reset=1`로 목업 DB를
// 되돌린다) 계정은 시연 패널의 `P1 계정`으로 바꾼다. 이 파일은 앱 소스를 import하지 않아 이메일 · 문구는 문자열이다.
const PLACEHOLDER = '곧 열려요.';

/** 주소가 `url`이 되고 화면 제목(h1)이 보이며 자리 화면이 아님을 본다. 제목은 `title`을 주면 그 이름이어야 한다. */
async function expectOpen(page: Page, url: RegExp, title?: string | RegExp) {
  await expect(page).toHaveURL(url);
  const h1 = page.getByRole('heading', {
    level: 1,
    ...(title === undefined ? {} : { name: title }),
  });
  await expect(h1.first()).toBeVisible();
  await expect(page.getByText(PLACEHOLDER)).toHaveCount(0);
}

const back = (page: Page) => page.getByRole('button', { name: '뒤로 가기' }).click();

/**
 * 시연 패널 `P1 계정`에서 이 계정으로 전환한다. 전환이 끝났는지는 패널이 기록하는 빠른 로그인 계정(`ytt.demo`)으로 안다
 * — 그 기록과 이동은 한 동기 구간이라 기록이 보이면 이동도 끝나 있다(e2e/verify.spec.ts와 같은 방식).
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

async function start(page: Page, query: string) {
  await page.goto(`/?demo=1&reset=1&${query}`);
  await expect(page.getByRole('region', { name: '시연 패널' })).toBeVisible();
}

test.describe('막다른 곳 없음', () => {
  test('고교생: 인증 전(newbie) → 인증 상태 확인 · 내 정보 수정', async ({ page }) => {
    await start(page, 'as=student');
    await switchTo(page, 'newbie@demo.kr');

    // 인증 전이라 첫 화면이 재학 인증(C03)이다 — 하단 탭이 없어 상단 바 뒤로 가기로 MY에 간다.
    await expectOpen(page, /\/verify$/, '재학 인증 · 학생증 업로드');
    await back(page);
    await expectOpen(page, /\/me$/, 'MY');
    await page.getByRole('link', { name: /^인증 상태 확인/ }).click();
    await expectOpen(page, /\/me\/status$/, '내 정보');
    await page.getByRole('link', { name: /^학생증 인증/ }).click();
    await expectOpen(page, /\/verify$/, '재학 인증 · 학생증 업로드');
    await back(page);
    await page.getByRole('link', { name: /^내 정보 수정/ }).click();
    await expectOpen(page, /\/me\/edit$/, '내 정보 수정');
  });

  test('가이드: 인증 전(guide-new) → 대학생 재학 인증', async ({ page }) => {
    await start(page, 'as=student');
    await switchTo(page, 'guide-new@demo.kr');

    // 첫 화면이 재학 인증(C03)이다 — 하단 탭이 없어 상단 바 뒤로 가기로 MY에 간다.
    await expectOpen(page, /\/guide\/verify$/, '재학 인증 · 학생증 업로드');
    await back(page);
    await expectOpen(page, /\/guide\/me$/, 'MY');
    await page.getByRole('link', { name: /^내 정보·인증 상태/ }).click();
    await expectOpen(page, /\/guide\/me\/status$/, '내 정보');
    await page.getByRole('link', { name: /^학생증 인증/ }).click();
    await expectOpen(page, /\/guide\/verify$/, '재학 인증 · 학생증 업로드');
  });

  test('가이드: 인증 완료(guide) → 개설 · 완료 · 취소 · 장소 고르기 · 확정 코스 지도', async ({
    page,
  }) => {
    await start(page, 'checkpoint=APPROVED&as=guide');
    await expectOpen(page, /\/guide$/, /^이번 주, /);

    // 신청자 관리 → 탐방 완료(G09) · 탐방 취소(G10). 완료의 뒤로 가기는 신청자 관리, 취소의 뒤로 가기는 내가 개설한 탐방(G06)이다.
    await page.getByRole('link', { name: '신청자 확인하기' }).first().click();
    await expectOpen(page, /\/guide\/tours\/\d+\/applicants$/, '신청자 관리');
    await page.getByRole('link', { name: '탐방 완료', exact: true }).click();
    await expectOpen(page, /\/guide\/tours\/\d+\/complete$/, '탐방 종료 · 완료 처리');
    await back(page);
    await expectOpen(page, /\/guide\/tours\/\d+\/applicants$/, '신청자 관리');
    await page.getByRole('link', { name: '탐방 취소', exact: true }).click();
    await expectOpen(page, /\/guide\/tours\/\d+\/cancel$/, '탐방 취소 확인');
    await back(page);
    await expectOpen(page, /\/guide\/tours$/, '내가 개설한 탐방');
    await page.getByRole('link', { name: '신청자 관리하기' }).first().click();
    await expectOpen(page, /\/guide\/tours\/\d+\/applicants$/, '신청자 관리');

    // 코스 초안(AI) → 장소 고르기(G07) → 확정 → 확정 코스 지도
    await page.getByRole('button', { name: '승인 완료 후 코스 만들기' }).click();
    await expect(page.getByRole('heading', { name: '코스를 완성해 볼까요?' })).toBeVisible();
    await page.getByRole('button', { name: '+ 장소 추가' }).click();
    await expectOpen(page, /\/course\/stops\/pick/, '코스 장소 추가');
    await back(page);
    await page.getByRole('button', { name: '이 코스로 확정하기' }).click();
    await page.getByRole('button', { name: '코스 확정하기' }).click();
    await expect(page.getByText(/쿠폰 [1-9]\d*장 발급/)).toBeVisible();
    await page.getByRole('link', { name: '확정 코스 지도 보기' }).click();
    await expectOpen(page, /\/guide\/tours\/\d+\/course$/, '확정 코스 지도 보기');
    await back(page);

    // 내가 개설한 탐방 → 새 탐방 만들기(G04)
    await page.getByRole('link', { name: '내가 개설한 탐방으로' }).click();
    await expectOpen(page, /\/guide\/tours$/);
    await page.getByRole('link', { name: /^새 탐방 개설하기/ }).click();
    await expectOpen(page, /\/guide\/tours\/new$/, '새 탐방 만들기');

    // MY → 가이드 프로필 · 인증 상태
    await page.getByRole('link', { name: 'MY', exact: true }).click();
    await page.getByRole('link', { name: /^가이드 프로필 수정/ }).click();
    await expectOpen(page, /\/guide\/me\/profile$/);
    await page.getByRole('link', { name: 'MY', exact: true }).click();
    await page.getByRole('link', { name: /^내 정보·인증 상태/ }).click();
    await expectOpen(page, /\/guide\/me\/status$/, '내 정보');
    await page.getByRole('link', { name: /^학생증 인증/ }).click();
    await expectOpen(page, /\/guide\/verify$/);
  });

  test('사장님: 인증 전(owner-new) → 사업자 인증, 가게 있는(owner1) → 리포트 · 가게 수정', async ({
    page,
  }) => {
    await start(page, 'as=owner');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.getByRole('link', { name: '내 가게', exact: true }).click();
    await expectOpen(page, /\/owner\/store$/);

    await page.getByRole('link', { name: /^방문 · 리뷰 리포트/ }).click();
    await expectOpen(page, /\/owner\/report$/, '방문 · 리뷰 리포트');
    await back(page);
    await page.getByRole('link', { name: /^제휴 혜택 수정/ }).click();
    await expectOpen(page, /\/owner\/store\/partnership$/, '제휴 할인 설정');
    await back(page);
    await page.getByRole('link', { name: /^가게 정보 수정/ }).click();
    await expectOpen(page, /\/owner\/store\/edit$/, '가게 정보 수정');

    await switchTo(page, 'owner-new@demo.kr');
    await expectOpen(page, /\/owner\/verify$/, '사업자 인증');
  });

  test('운영자: 대기 목록 → 상세 → 반려 사유', async ({ page }) => {
    await start(page, 'as=admin');
    await expectOpen(page, /\/admin\/verifications$/, '인증 심사');
    await page.locator('a[href^="/admin/verifications/"]').first().click();
    await expectOpen(page, /\/admin\/verifications\/\d+$/, '인증 상세 · 승인/반려');
    await page.getByRole('link', { name: '반려 사유 입력' }).click();
    await expectOpen(page, /\/admin\/verifications\/\d+\/reject$/);
  });
});

test('사장님 온보딩: 사업자 인증 → 가게 연결 → 제휴 저장 → 내 가게', async ({ page }) => {
  await start(page, 'as=student');
  await switchTo(page, 'owner-new@demo.kr');
  await expectOpen(page, /\/owner\/verify$/, '사업자 인증');

  await page.getByRole('button', { name: '시연 사업자 정보 채우기' }).click();
  await page.getByRole('button', { name: '사업자 정보 확인' }).click();

  await expectOpen(page, /\/owner\/store\/connect$/, '가게 찾기 · 연결');
  await page.getByRole('textbox', { name: '가게 이름 검색' }).fill('일삼일구');
  await page.getByRole('button', { name: '검색' }).click();
  await page.getByRole('button', { name: '일삼일구 이 가게 연결하기' }).click();
  await page.getByRole('button', { name: '다음으로' }).click();
  await page.getByRole('button', { name: '연결하기', exact: true }).click();

  await expectOpen(page, /\/owner\/store\/partnership$/, '제휴 할인 설정');
  await expect(page.getByText('연결 완료', { exact: true })).toBeVisible();
  await page.getByLabel('혜택 이름').fill('음료 10% 할인');
  await page.getByRole('button', { name: '제휴 혜택 저장' }).click();

  await expectOpen(page, /\/owner\/store$/);
  await expect(page.getByText('일삼일구', { exact: true })).toBeVisible();
  // 방금 저장한 제휴 혜택이 내 가게 화면에 보인다.
  await expect(page.getByText('음료 10% 할인')).toBeVisible();
});
