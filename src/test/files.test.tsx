import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { formFile, readForm } from '@/mocks/handlers/util';
import { server } from '@/mocks/node';
import { withWire } from '@/mocks/wire/envelope';
import { upload } from '@/shared/lib/http';
import { testImage } from './files';

describe('testImage', () => {
  it('기본값: student-id.jpg · image/jpeg', () => {
    const file = testImage();
    expect(file).toMatchObject({ name: 'student-id.jpg', type: 'image/jpeg' });
    expect(file.size).toBeGreaterThan(0);
  });

  it('type · size 옵션: 내용은 작아도 그 크기로 보인다', () => {
    const file = testImage('big.heic', { type: '', size: 10 * 1024 * 1024 + 1 });
    expect(file).toMatchObject({ name: 'big.heic', type: '', size: 10 * 1024 * 1024 + 1 });
  });
});

describe('jsdom 업로드 경로(전역 FormData · File이 Node 구현이어도)', () => {
  it('userEvent.upload가 고른 파일을 FormData에 담아 보내면 목업이 파싱한다', async () => {
    server.use(
      http.post(
        '/api/_upload',
        withWire(async ({ request }) => {
          const file = formFile(await readForm(request), 'document');
          return HttpResponse.json({ name: file?.name, type: file?.type });
        }),
      ),
    );
    const user = userEvent.setup({ applyAccept: false });
    let picked: File | undefined;
    render(
      <input
        type="file"
        accept="image/png"
        aria-label="사진"
        onChange={(e) => {
          picked = e.target.files?.[0];
        }}
      />,
    );
    // accept를 무시하고 형식 오류 파일(PDF)을 올린다 — 틀린 파일을 즉시 버리는 화면 시험용.
    await user.upload(
      screen.getByLabelText('사진'),
      testImage('card.pdf', { type: 'application/pdf' }),
    );
    expect(picked).toMatchObject({ name: 'card.pdf', type: 'application/pdf' });

    const form = new FormData();
    form.append('document', picked!);
    expect(await upload('/_upload', form)).toEqual({ name: 'card.pdf', type: 'application/pdf' });
  });

  it('폼 요소로 FormData를 만들어도 된다(React 19가 제출 이벤트에서 부른다). 파일 항목은 이름 · 형식만 있고 내용은 비어 있다', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(
      <form>
        <input name="title" defaultValue="투어" />
        <input type="file" name="document" aria-label="사진" />
      </form>,
    );
    await user.upload(screen.getByLabelText('사진'), testImage('card.png', { type: 'image/png' }));
    const data = new FormData(container.querySelector('form')!);
    expect(data.get('title')).toBe('투어');
    const entry = data.get('document') as File;
    expect(entry).toMatchObject({ name: 'card.png', type: 'image/png', size: 0 });
  });

  it('원래 jsdom 생성자를 표식에 보관한다(setup이 다시 실행돼도 두 번 바꾸지 않는다)', () => {
    const original = Reflect.get(globalThis, Symbol.for('ytt.test.jsdomFormData'));
    expect(typeof original).toBe('function');
    expect(original).not.toBe(FormData);
  });
});
