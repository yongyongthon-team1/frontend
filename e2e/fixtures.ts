import { expect, test as base } from '@playwright/test';

/**
 * 골든 패스 · 무대 점검이 쓰는 `test`(판정 30). 페이지에서 잡히지 않은 오류(`pageerror`)나 실패한 `/api/` 요청
 * (`requestfailed` · 5xx 응답)이 하나라도 있으면 테스트가 실패한다 — 화면이 그럭저럭 그려져도 목업 워커 · 핸들러가
 * 깨진 것을 놓치지 않게. 404 같은 4xx는 화면이 다루는 정상 응답이라 보지 않는다(예: 코스가 아직 없음).
 * 이 `test`를 쓰는 테스트는 `page.goto`를 처음 한 번만 한다 — 전체 페이지 이동은 진행 중인 요청을 끊어 실패로 잡힌다.
 */
export const test = base.extend<{ failOnPageProblems: void }>({
  failOnPageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      const isApi = (url: string) => new URL(url).pathname.startsWith('/api/');
      page.on('pageerror', (error) => problems.push(`페이지 오류: ${error.message}`));
      page.on('requestfailed', (request) => {
        if (!isApi(request.url())) return;
        problems.push(
          `API 요청 실패: ${request.method()} ${request.url()} (${request.failure()?.errorText})`,
        );
      });
      page.on('response', (response) => {
        if (!isApi(response.url()) || response.status() < 500) return;
        problems.push(`API ${response.status()}: ${response.request().method()} ${response.url()}`);
      });
      await use();
      expect(problems, '페이지 오류 · 실패한 API 요청이 없어야 한다').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
