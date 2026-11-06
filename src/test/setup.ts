import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { clearMockFiles } from '@/mocks/db/files';
import { clearDbCache, resetDb } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';

// jsdom의 FormData · File · Blob을 Node(undici) 것으로 바꾼다. jsdom `File`을 담은 FormData는 Node `fetch` →
// MSW → `Request.formData()` 경로에서 끝나지 않는다(multipart 본문을 직렬화하지 못한다). 생성자는 Node `Response`가
// 파싱해 주는 multipart에서 꺼낸다(`node:buffer` import 없이).
{
  const JsdomFormData = globalThis.FormData;
  const probe = await new Response(
    '--b\r\nContent-Disposition: form-data; name="f"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nx\r\n--b--\r\n',
    { headers: { 'Content-Type': 'multipart/form-data; boundary=b' } },
  ).formData();
  const NodeFormData = probe.constructor as typeof FormData;
  const NodeFile = (probe.get('f') as File).constructor as typeof File;

  // React 19는 제출 이벤트에서 `new FormData(formElement)`를 부른다. Node 생성자는 폼 요소를 받지 못하므로
  // 그 호출만 jsdom에게 읽게 하고(파일 칸은 이름 · 형식만 가진 빈 Node File로) 나머지는 Node 구현 그대로 둔다.
  class TestFormData extends NodeFormData {
    constructor(form?: HTMLFormElement, submitter?: HTMLElement | null) {
      super();
      if (form === undefined) return;
      for (const [name, value] of new JsdomFormData(form, submitter)) {
        this.append(
          name,
          typeof value === 'string' ? value : new NodeFile([], value.name, { type: value.type }),
        );
      }
    }
  }

  Object.assign(globalThis, {
    FormData: TestFormData,
    File: NodeFile,
    Blob: Object.getPrototypeOf(NodeFile),
  });
}

beforeAll(() => {
  setMockLatency({ base: 0, ai: 0 });
  server.listen({ onUnhandledRequest: 'error' });
});
// 매 테스트는 오늘 기준 기본 시드(START)에서 시작한다.
beforeEach(() => {
  resetDb({ today: new Date() });
});
afterEach(() => {
  cleanup();
  // sonner는 아직 닫히지 않은 토스트를 모듈 상태에 들고 있다가 다음 테스트의 Toaster에 다시 띄운다 — 모두 닫는다.
  toast.dismiss();
  server.resetHandlers();
  // 연타 시험이 건 `server.events` 리스너(`request:start` 등)가 다음 시험에 남지 않게 한다.
  server.events.removeAllListeners();
  clearMockFiles();
  localStorage.clear();
  clearDbCache();
});
afterAll(() => server.close());
