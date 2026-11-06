import { configure, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';

afterEach(() => {
  server.events.removeAllListeners('request:start');
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
  configure({ reactStrictMode: false });
});

/** 편집 화면 항목 제목들(`≡ ① 이름 · 14:00`). */
const itemTitles = () =>
  within(screen.getByRole('list', { name: '코스 지점' }))
    .getAllByRole('heading')
    .map((heading) => heading.textContent);

/** 편집 화면에서 이름으로 찾은 항목 카드. */
const itemCard = (name: string) =>
  screen.getByRole('heading', { name: new RegExp(name) }).closest('article')!;

/** 승인자가 있는 탐방 1에서 AI 초안을 만들고 편집 화면으로 간다. */
async function openEditor() {
  const result = await renderApp('/guide/tours/1/course/draft?generate=1', {
    as: 'guide',
    checkpoint: 'APPROVED',
  });
  await result.user.click(await screen.findByRole('button', { name: '코스 수정하기' }));
  await screen.findByRole('list', { name: '코스 지점' });
  return result;
}

describe('AI 코스 초안 · 편집 · 확정 (guide-s04 · s05 · s06)', () => {
  it('승인 완료 후 코스 만들기 → 초안(제휴 포함) → 순서 변경 → 확정 → 쿠폰 발급', async () => {
    const { user } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    await user.click(await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }));
    expect(await screen.findByText('2시간 30분 추천 코스')).toBeInTheDocument();
    expect(screen.getAllByText('제휴').length).toBeGreaterThan(0);
    expect(screen.queryByText('지역 데이터 점수 · 제휴 여부 · 리뷰 요약')).toBeNull(); // 옛 기준 문구 금지
    await user.click(screen.getByRole('button', { name: '코스 수정하기' }));
    const third = (await screen.findAllByRole('button', { name: /아래로 이동/ }))[1]; // ② → ③
    await user.click(third);
    // 순서 변경 요청이 끝나야 확정 버튼이 풀린다(진행 중에는 편집 · 확정 버튼을 모두 잠근다).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '최종 코스 확정' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: '최종 코스 확정' }));
    await user.click(await screen.findByRole('button', { name: '확정하기' }));
    expect(await screen.findByText('코스를 확정했어요!')).toBeInTheDocument();
    expect(screen.getByText(/쿠폰 [1-9]\d*장 발급/)).toBeInTheDocument();
  });

  it('순서를 바꿔도 시간은 14:00/15:10/16:00', async () => {
    const { user } = await openEditor();
    expect(itemTitles()).toEqual([
      '≡ ① 예술·디자인대학 · 14:00',
      '≡ ② 서천 밥상 · 15:10',
      '≡ ③ 카페 모래시계 · 16:00',
    ]);
    await user.click(screen.getByRole('button', { name: '서천 밥상 아래로 이동' }));
    await waitFor(() =>
      expect(itemTitles()).toEqual([
        '≡ ① 예술·디자인대학 · 14:00',
        '≡ ② 카페 모래시계 · 15:10',
        '≡ ③ 서천 밥상 · 16:00',
      ]),
    );
    // 맨 위 항목의 위로 · 맨 아래 항목의 아래로는 누를 수 없다
    expect(screen.getByRole('button', { name: '예술·디자인대학 위로 이동' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '서천 밥상 아래로 이동' })).toBeDisabled();
  });

  it('편집 요청이 진행 중이면 편집 · 확정 버튼을 모두 잠근다', async () => {
    const { user } = await openEditor();
    // 응답이 늦어야 요청이 진행 중인 화면을 볼 수 있다(지연이 0이면 클릭이 끝나기 전에 응답이 온다).
    setMockLatency({ base: 150, ai: 0 });
    await user.click(screen.getByRole('button', { name: '서천 밥상 아래로 이동' }));
    const list = screen.getByRole('list', { name: '코스 지점' });
    for (const button of within(list).getAllByRole('button')) expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: '최종 코스 확정' })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '최종 코스 확정' })).toBeEnabled(),
    );
  });

  it('인사이트 카드의 예시 표시', async () => {
    await renderApp('/guide/tours/1/course/draft?generate=1', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    expect(await screen.findByText('방학 상권 인사이트')).toBeInTheDocument();
    expect(screen.getByText('예시')).toBeInTheDocument();
    expect(screen.getByText(/^출처 · /)).toBeInTheDocument();
    // AI 결과에는 ✦ 배지가 붙는다: 위쪽 칩 1개 + 지점 3곳
    expect(screen.getAllByRole('group', { name: 'AI 결과' })).toHaveLength(4);
  });

  it('StrictMode로 다시 마운트돼도 초안 생성 요청은 한 번이고, 성공하면 주소에서 ?generate=1을 지운다', async () => {
    configure({ reactStrictMode: true });
    let drafts = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/course/draft')) drafts++;
    });
    const { user, router } = await renderApp('/guide/tours/1/course/draft', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    // ?generate=1 없이 들어오면 만들지 않고 빈 상태를 보여 준다(코스 없음이 캐시에 남는다)
    expect(await screen.findByText('아직 코스 초안이 없어요')).toBeInTheDocument();
    expect(drafts).toBe(0);

    // 캐시에 "코스 없음"이 있는 채로 다시 마운트 — StrictMode가 마운트 effect를 두 번 돌린다
    await router.navigate('/guide/tours/1/applicants');
    await user.click(await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }));
    expect(await screen.findByText('2시간 30분 추천 코스')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/draft');
    expect(drafts).toBe(1);
  });

  it('초안 생성 요청이 진행 중일 때 화면을 떠났다 돌아와도 요청은 한 번', async () => {
    // AI 응답이 늦어야 요청이 진행 중인 채로 초안 화면을 다시 마운트할 수 있다.
    setMockLatency({ base: 0, ai: 400 });
    let drafts = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/course/draft')) drafts++;
    });
    const { user, router } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    await user.click(await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }));
    await waitFor(() => expect(drafts).toBe(1));

    // 생성 중에 신청자 관리로 갔다가 다시 코스 만들기 — 새로 마운트된 초안 화면은 진행 중인 생성을 기다린다
    await router.navigate('/guide/tours/1/applicants');
    await user.click(await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }));
    expect(await screen.findByText('신청자 관심사를 모으고 있어요')).toBeInTheDocument();
    expect(await screen.findByText('2시간 30분 추천 코스')).toBeInTheDocument();
    expect(drafts).toBe(1);
  });

  it('초안 생성이 실패하면 오류를 보여 주고, 다시 시도하면 다시 만든다', async () => {
    server.use(
      http.post(
        '/api/guide/tours/:id/course/draft',
        () => HttpResponse.json({ code: 'UNKNOWN', message: '실패' }, { status: 500 }),
        { once: true },
      ),
    );
    const { user } = await renderApp('/guide/tours/1/course/draft?generate=1', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('2시간 30분 추천 코스')).toBeInTheDocument();
  });

  it('한줄평을 저장하면 항목에 보이고, 비워서 저장하면 추천 이유로 돌아간다', async () => {
    const { user } = await openEditor();
    await user.click(screen.getByRole('button', { name: '서천 밥상 한줄평' }));
    let sheet = await screen.findByRole('dialog');
    const field = within(sheet).getByRole('textbox', { name: '한줄평' });
    expect(field).toHaveValue('');
    await user.type(field, '양이 많아 든든해요');
    await user.click(within(sheet).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(itemCard('서천 밥상')).getByText('양이 많아 든든해요')).toBeInTheDocument();

    // 다시 열면 지금 한줄평이 채워져 있다
    await user.click(screen.getByRole('button', { name: '서천 밥상 한줄평' }));
    sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('textbox', { name: '한줄평' })).toHaveValue(
      '양이 많아 든든해요',
    );
    await user.clear(within(sheet).getByRole('textbox', { name: '한줄평' }));
    await user.click(within(sheet).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(itemCard('서천 밥상')).getByText(/^신청자 2명이/)).toBeInTheDocument();
  });

  it('지점을 모두 빼면 최종 코스 확정은 비활성 + 사유', async () => {
    const { user } = await openEditor();
    for (let left = 3; left > 0; left--) {
      const list = screen.getByRole('list', { name: '코스 지점' });
      await user.click(within(list).getAllByRole('button', { name: / 삭제$/ })[0]);
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText('이 지점을 뺄까요?')).toBeInTheDocument();
      expect(
        within(dialog).getByText('시간은 남은 지점 순서대로 다시 맞춰져요.'),
      ).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: '빼기' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      await waitFor(() => expect(within(list).queryAllByRole('listitem')).toHaveLength(left - 1));
    }
    expect(screen.getByRole('button', { name: '최종 코스 확정' })).toBeDisabled();
    expect(screen.getByText('지점이 하나 이상 있어야 확정할 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '초안 다시 만들기' })).toHaveAttribute(
      'href',
      '/guide/tours/1/course/draft',
    );
  });

  it('코스가 없으면 확정 화면 주소는 신청자 관리로 보낸다', async () => {
    const { router } = await renderApp('/guide/tours/1/course/confirmed', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    expect(
      await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/applicants');
  });

  it('초안이면 확정 화면 주소는 편집 화면으로 보낸다', async () => {
    const { router } = await renderApp('/guide/tours/1/course/draft?generate=1', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    await screen.findByText('2시간 30분 추천 코스');
    await router.navigate('/guide/tours/1/course/confirmed');
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours/1/course/edit'));
    expect(await screen.findByRole('list', { name: '코스 지점' })).toBeInTheDocument();
  });

  it('확정된 코스는 편집 주소로 와도 확정 화면 — 탐방 정보 카드', async () => {
    const { router } = await renderApp('/guide/tours/1/course/edit', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    expect(await screen.findByText('캠퍼스 → 식사 → 카페 / 총 3개 장소')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirmed');
    expect(screen.getByText('참가 승인 3명 · 쿠폰 6장 발급')).toBeInTheDocument();
    expect(screen.getByText('승인된 신청자에게 제휴 상점 쿠폰이 발급돼요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).toBeNull();
  });

  it('초안을 만든 뒤 신청자 관리로 돌아가면 코스 버튼은 코스 이어서 편집, 탐방 목록도 다시 불러온다', async () => {
    let guideTourGets = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'GET' && new URL(request.url).pathname === '/api/guide/tours') {
        guideTourGets++;
      }
    });
    const { user, router } = await renderApp('/guide/tours', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    await user.click((await screen.findAllByRole('link', { name: '신청자 관리하기' }))[0]!);
    await user.click(await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }));
    expect(await screen.findByText('2시간 30분 추천 코스')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(await screen.findByRole('button', { name: '코스 이어서 편집' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '승인 완료 후 코스 만들기' }),
    ).not.toBeInTheDocument();

    expect(guideTourGets).toBe(1);
    await router.navigate('/guide/tours');
    await waitFor(() => expect(guideTourGets).toBe(2));
  });

  it('코스 확정 뒤에 승인하면 확정 화면의 승인 수 · 쿠폰 발급 수가 늘어난다', async () => {
    const app = await renderApp('/guide/tours/1/course/confirmed', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    const { user } = app;
    expect(await screen.findByText('참가 승인 3명 · 쿠폰 6장 발급')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '신청자 관리로 이동' }));

    // 최유진(승인 대기)을 승인하면 코스 안 제휴 상점 2곳의 쿠폰이 더 발급된다.
    const yujin = (await screen.findByRole('heading', { name: /최유진/ })).closest('article')!;
    await user.click(within(yujin).getByRole('button', { name: '승인하기' }));
    expect(await screen.findByText('최유진 님을 승인했어요.')).toBeInTheDocument();
    // 확정 코스 보기는 확정 점검 주소(`confirm`, Task 10이 채운다)로 간다. 숫자는 지금의 확정 화면(`confirmed`)에서 본다.
    const { router } = app;
    await user.click(screen.getByRole('button', { name: '확정 코스 보기' }));
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm');
    await router.navigate('/guide/tours/1/course/confirmed');
    expect(await screen.findByText('참가 승인 4명 · 쿠폰 8장 발급')).toBeInTheDocument();
  });
});
