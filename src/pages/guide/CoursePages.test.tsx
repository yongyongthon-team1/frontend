import { configure, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { getDb, mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { formatMonthDay, formatTimeRange } from '@/shared/lib/date';
import { renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

afterEach(() => {
  server.events.removeAllListeners('request:start');
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
  configure({ reactStrictMode: false });
});

/** AI 초안 생성 요청(`POST /tours/{tourId}/course`, C-01). 확정(`…/course/confirm`)과 스팟 PUT은 세지 않는다. */
const isDraftPost = (request: Request) =>
  request.method === 'POST' && /^\/api\/tours\/\d+\/course$/.test(new URL(request.url).pathname);

const G03_TITLE = '코스를 완성해 볼까요?';
const G08_TITLE = '코스를 확정할까요?';

const stopList = () => screen.getByRole('list', { name: '코스 지점' });

/** G03 지점 카드를 위에서부터 `{시간} {이름}`으로(시간 알약 · 이름 제목). */
const stopRows = () =>
  within(stopList())
    .getAllByRole('listitem')
    .map((li) => {
      const time = within(li).getByText(/^\d{2}:\d{2}$/).textContent;
      return `${time} ${within(li).getByRole('heading').textContent}`;
    });

/** 이름으로 찾은 G03 지점 카드. */
const stopCard = (name: string) => within(stopList()).getByRole('heading', { name }).closest('li')!;

/** 승인자가 있는 탐방 1에서 AI 초안을 만들어 G03(코스 완성)을 연다. */
async function openCourse() {
  const result = await renderApp('/guide/tours/1/course/draft?generate=1', {
    as: 'guide',
    checkpoint: 'APPROVED',
  });
  await screen.findByRole('heading', { name: G03_TITLE });
  return result;
}

/** 지점 카드의 `≡`(`{이름} 편집`)로 지점 시트를 연다. */
async function openStopSheet(user: Awaited<ReturnType<typeof openCourse>>['user'], name: string) {
  await user.click(screen.getByRole('button', { name: `${name} 편집` }));
  return screen.findByRole('dialog', { name });
}

describe('코스 완성 G03 (guide-s04 · s05)', () => {
  it('승인 완료 후 코스 만들기 → AI 로딩 → G03 → 둘째 지점 아래로 → 확정 점검 → 확정 → 쿠폰 발급', async () => {
    const { user, router } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    await user.click(await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }));
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/edit');
    expect(screen.getByText("승인된 학생의 '하고 싶은 것'만 반영했어요.")).toBeInTheDocument();
    // 페일 블루 카드: AI 추천 코스 · 소요 · 지점 분류
    expect(screen.getByRole('group', { name: 'AI 결과' })).toHaveTextContent('AI 추천 코스');
    expect(screen.getByText('2시간 30분')).toBeInTheDocument();
    expect(screen.getByText('캠퍼스·식사·카페')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '일정 · 3개 장소' })).toBeInTheDocument();
    expect(screen.getByText('코스에 제휴 가게 1곳 이상 포함해 주세요.')).toBeInTheDocument();
    // 지점 카드: 이유(한줄평이 없으면 AI 추천 이유) · 머무는 분(다음 지점까지, 마지막은 탐방 종료까지)
    expect(within(stopCard('예술·디자인대학')).getByText(/전공 공간에서/)).toBeInTheDocument();
    expect(within(stopCard('예술·디자인대학')).getByText('· 70분')).toBeInTheDocument();
    expect(within(stopCard('서천 밥상')).getByText('· 50분')).toBeInTheDocument();
    expect(within(stopCard('카페 모래시계')).getByText('· 30분')).toBeInTheDocument();

    const second = within(stopList()).getAllByRole('button', { name: / 편집$/ })[1]!;
    const moved = second.getAttribute('aria-label')!.replace(/ 편집$/, '');
    await user.click(second);
    await user.click(
      within(await screen.findByRole('dialog', { name: moved })).getByRole('button', {
        name: '아래로 이동',
      }),
    );
    await waitFor(() => expect(stopRows()[2]).toBe(`16:00 ${moved}`));

    // 순서 변경 요청이 끝나야 확정 버튼이 풀린다(진행 중에는 편집 · 확정 버튼을 모두 잠근다).
    const toConfirm = screen.getByRole('button', { name: '이 코스로 확정하기' });
    await waitFor(() => expect(toConfirm).toBeEnabled());
    await user.click(toConfirm);
    expect(await screen.findByRole('heading', { name: G08_TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm');
    await user.click(screen.getByRole('button', { name: '코스 확정하기' }));
    expect(await screen.findByRole('heading', { name: '코스를 확정했어요' })).toBeInTheDocument();
    expect(screen.getByText(/쿠폰 [1-9]\d*장 발급/)).toBeInTheDocument();
  });

  it('순서를 바꿔도 시간은 14:00/15:10/16:00 — 시트는 동작을 시작하면 닫히고, 첫 지점은 위로 · 마지막 지점은 아래로를 못 누른다', async () => {
    const { user } = await openCourse();
    expect(stopRows()).toEqual(['14:00 예술·디자인대학', '15:10 서천 밥상', '16:00 카페 모래시계']);

    const sheet = await openStopSheet(user, '서천 밥상');
    await user.click(within(sheet).getByRole('button', { name: '아래로 이동' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(stopRows()).toEqual([
        '14:00 예술·디자인대학',
        '15:10 카페 모래시계',
        '16:00 서천 밥상',
      ]),
    );
    // 순서 변경이 끝나면 포커스는 옮긴 지점의 새 자리 `≡`로 돌아온다(시트가 닫히며 body로 떨어지지 않는다).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '서천 밥상 편집' })).toHaveFocus(),
    );

    const first = await openStopSheet(user, '예술·디자인대학');
    expect(within(first).getByRole('button', { name: '위로 이동' })).toBeDisabled();
    expect(within(first).getByRole('button', { name: '아래로 이동' })).toBeEnabled();
    await user.click(within(first).getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: '예술·디자인대학 편집' })).toHaveFocus();

    const last = await openStopSheet(user, '서천 밥상');
    expect(within(last).getByRole('button', { name: '위로 이동' })).toBeEnabled();
    expect(within(last).getByRole('button', { name: '아래로 이동' })).toBeDisabled();
  });

  it('편집 요청이 진행 중이면 지점 편집 · 다시 만들기 · 확정 버튼을 모두 잠근다', async () => {
    const { user } = await openCourse();
    // 응답이 늦어야 요청이 진행 중인 화면을 볼 수 있다(지연이 0이면 클릭이 끝나기 전에 응답이 온다).
    setMockLatency({ base: 150, ai: 0 });
    const sheet = await openStopSheet(user, '서천 밥상');
    await user.click(within(sheet).getByRole('button', { name: '아래로 이동' }));
    for (const button of within(stopList()).getAllByRole('button')) expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: '다시 만들기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이 코스로 확정하기' })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '이 코스로 확정하기' })).toBeEnabled(),
    );
    for (const button of within(stopList()).getAllByRole('button')) expect(button).toBeEnabled();
  });

  it('지점 목록 아래에 추천 상점 기준과 인사이트 카드(예시 표시)가 남는다', async () => {
    await openCourse();
    expect(await screen.findByText('방학 상권 인사이트')).toBeInTheDocument();
    expect(screen.getByText('예시')).toBeInTheDocument();
    expect(screen.getByText(/^출처 · /)).toBeInTheDocument();
    expect(screen.getByText('추천 상점 기준')).toBeInTheDocument();
    // 지점 목록 → 확정 버튼 → 기준 · 인사이트 순서(카드는 무대에서 접힘 아래)
    const list = stopList();
    const insight = screen.getByText('방학 상권 인사이트');
    const cta = screen.getByRole('button', { name: '이 코스로 확정하기' });
    expect(list.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cta.compareDocumentPosition(insight) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 옛 와이어프레임 기준 문구는 쓰지 않는다
    expect(screen.queryByText('지역 데이터 점수 · 제휴 여부 · 리뷰 요약')).toBeNull();
  });

  it('AI 결과 표시: 히어로 배지 하나 + AI 추천 이유를 보이는 지점마다 화면 낭독기용 표시', async () => {
    await openCourse();
    // 1단계의 "✦ 배지 4개"(위쪽 칩 + 지점 3곳)와 같은 뜻 — 지점의 ✦는 장식이라 숨기고 글로 읽힌다.
    expect(screen.getAllByRole('group', { name: 'AI 결과' })).toHaveLength(1);
    expect(within(stopList()).getAllByText('AI 추천 이유:')).toHaveLength(3);
    expect(
      within(stopCard('서천 밥상')).getByText(/^신청자 2명이/).parentElement,
    ).toHaveTextContent(/^✦AI 추천 이유: 신청자 2명이/);
  });

  it('StrictMode로 다시 마운트돼도 초안 생성 요청은 한 번이고, 성공하면 편집 주소로 replace', async () => {
    configure({ reactStrictMode: true });
    let drafts = 0;
    server.events.on('request:start', ({ request }) => {
      if (isDraftPost(request)) drafts++;
    });
    const { user, router } = await renderApp('/guide/tours/1/course/draft', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    // ?generate=1 없이 들어오면 만들지 않고 빈 상태를 보여 준다(코스 없음이 캐시에 남는다)
    expect(await screen.findByText('아직 코스 초안이 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI 코스 만들기' })).toHaveAttribute(
      'href',
      '/guide/tours/1/course/draft?generate=1',
    );
    expect(drafts).toBe(0);

    // 캐시에 "코스 없음"이 있는 채로 다시 마운트 — StrictMode가 마운트 effect를 두 번 돌린다
    await router.navigate('/guide/tours/1/applicants');
    await user.click(await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }));
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/edit');
    expect(router.state.location.search).toBe('');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(drafts).toBe(1);
  });

  it('초안 생성 요청이 진행 중일 때 화면을 떠났다 돌아와도 요청은 한 번', async () => {
    // AI 응답이 늦어야 요청이 진행 중인 채로 생성 화면을 다시 마운트할 수 있다.
    setMockLatency({ base: 0, ai: 400 });
    let drafts = 0;
    server.events.on('request:start', ({ request }) => {
      if (isDraftPost(request)) drafts++;
    });
    const { user, router } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    await user.click(await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }));
    await waitFor(() => expect(drafts).toBe(1));

    // 생성 중에 신청자 관리로 갔다가 다시 코스 만들기 — 새로 마운트된 생성 화면은 진행 중인 생성을 기다린다
    await router.navigate('/guide/tours/1/applicants');
    await user.click(await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }));
    expect(await screen.findByText('신청자 관심사를 모으고 있어요')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/edit');
    expect(drafts).toBe(1);
  });

  it('초안 생성이 실패하면 오류를 보여 주고, 다시 시도하면 다시 만든다', async () => {
    server.use(http.post('/api/tours/:tourId/course', () => wireFail('E500'), { once: true }));
    const { user } = await renderApp('/guide/tours/1/course/draft?generate=1', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
  });

  it('AI가 코스를 못 만들면(502 AI_FAILED) 그 안내를 보여 주고, 다시 시도하면 다시 만든다', async () => {
    server.use(
      http.post('/api/tours/:tourId/course', () => wireFail('E502_AI_FAILED'), { once: true }),
    );
    const { user } = await renderApp('/guide/tours/1/course/draft?generate=1', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'AI가 코스를 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
  });

  it('다시 만들기는 확인 창을 거쳐 초안을 새로 만들고 G03에 머문다', async () => {
    let drafts = 0;
    server.events.on('request:start', ({ request }) => {
      if (isDraftPost(request)) drafts++;
    });
    const { user, router } = await openCourse();
    await user.click(screen.getByRole('button', { name: '다시 만들기' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('초안을 다시 만들까요?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('지금 초안과 편집 내용이 새 초안으로 바뀌어요.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '다시 만들기' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(drafts).toBe(2);
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/edit');
    expect(stopRows()).toHaveLength(3);
  });

  it('한줄평을 저장하면 카드에 보이고, 비워서 저장하면 추천 이유로 돌아간다', async () => {
    const { user } = await openCourse();
    await user.click(
      within(await openStopSheet(user, '서천 밥상')).getByRole('button', { name: '한줄평' }),
    );
    let sheet = await screen.findByRole('dialog', { name: '서천 밥상 한줄평' });
    const field = within(sheet).getByRole('textbox', { name: '한줄평' });
    expect(field).toHaveValue('');
    await user.type(field, '양이 많아 든든해요');
    await user.click(within(sheet).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(stopCard('서천 밥상')).getByText('양이 많아 든든해요')).toBeInTheDocument();
    // 가이드 한줄평에는 AI 표시가 없다
    expect(within(stopCard('서천 밥상')).queryByText('AI 추천 이유:')).toBeNull();
    // 한줄평 창이 닫히면 포커스는 그 지점의 `≡`로 돌아온다
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '서천 밥상 편집' })).toHaveFocus(),
    );

    // 다시 열면 지금 한줄평이 채워져 있다
    await user.click(
      within(await openStopSheet(user, '서천 밥상')).getByRole('button', { name: '한줄평' }),
    );
    sheet = await screen.findByRole('dialog', { name: '서천 밥상 한줄평' });
    expect(within(sheet).getByRole('textbox', { name: '한줄평' })).toHaveValue(
      '양이 많아 든든해요',
    );
    await user.clear(within(sheet).getByRole('textbox', { name: '한줄평' }));
    await user.click(within(sheet).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(stopCard('서천 밥상')).getByText(/^신청자 2명이/)).toBeInTheDocument();
    expect(within(stopCard('서천 밥상')).getByText('AI 추천 이유:')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '서천 밥상 편집' })).toHaveFocus(),
    );
  });

  it('마지막 한 곳은 뺄 수 없다 — 두 곳을 빼면 일정 · 1개 장소, 남은 지점의 빼기는 비활성 + 사유, 포커스는 이웃 지점 · 소제목으로', async () => {
    const { user } = await openCourse();
    for (let left = 3; left > 1; left--) {
      const name = within(stopList()).getAllByRole('heading')[0]!.textContent!;
      await waitFor(() =>
        expect(screen.getByRole('button', { name: `${name} 편집` })).toBeEnabled(),
      );
      await user.click(
        within(await openStopSheet(user, name)).getByRole('button', { name: '빼기' }),
      );
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText('이 지점을 뺄까요?')).toBeInTheDocument();
      expect(
        within(dialog).getByText('시간은 남은 지점 순서대로 다시 맞춰져요.'),
      ).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: '빼기' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      await waitFor(() =>
        expect(within(stopList()).queryAllByRole('listitem')).toHaveLength(left - 1),
      );
      // 뺀 지점의 `≡`는 사라졌다 — 포커스는 같은 자리의 다음 지점, 남은 지점이 없으면 일정 소제목으로 간다.
      const next = within(stopList()).queryAllByRole('heading')[0]?.textContent;
      await waitFor(() =>
        expect(
          next === undefined
            ? screen.getByRole('heading', { name: `일정 · 0개 장소` })
            : screen.getByRole('button', { name: `${next} 편집` }),
        ).toHaveFocus(),
      );
    }
    expect(screen.getByRole('heading', { name: '일정 · 1개 장소' })).toBeInTheDocument();
    expect(stopRows()).toEqual(['14:00 카페 모래시계']);
    expect(screen.getByRole('button', { name: '이 코스로 확정하기' })).toBeEnabled();
    // 백엔드는 지점이 1곳 이상이어야 코스를 바꿀 수 있다(2C-R12 ②) — 마지막 지점의 빼기는 사유와 함께 잠긴다.
    const sheet = await openStopSheet(user, '카페 모래시계');
    const remove = within(sheet).getByRole('button', { name: '빼기' });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAccessibleDescription('지점은 1곳 이상 있어야 해요.');
    expect(within(sheet).getByRole('button', { name: '한줄평' })).toBeEnabled();
  });

  it('초안을 만든 뒤 신청자 관리로 돌아가면 코스 버튼은 코스 이어서 편집, 탐방 목록도 다시 불러온다', async () => {
    let guideTourGets = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'GET' && new URL(request.url).pathname === '/api/users/me/tours') {
        guideTourGets++;
      }
    });
    const { user, router } = await renderApp('/guide/tours', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    await user.click((await screen.findAllByRole('link', { name: '신청자 관리하기' }))[0]!);
    await user.click(await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }));
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(await screen.findByRole('button', { name: '코스 이어서 편집' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/applicants');
    expect(
      screen.queryByRole('button', { name: '승인 완료 후 코스 만들기' }),
    ).not.toBeInTheDocument();

    expect(guideTourGets).toBe(1);
    await router.navigate('/guide/tours');
    await waitFor(() => expect(guideTourGets).toBe(2));
  });
});

describe('코스 주소 가드 (막다른 곳 없음)', () => {
  it('코스가 없으면 편집 · 확정 점검 · 옛 확정 주소는 신청자 관리로 보낸다', async () => {
    const { router } = await renderApp('/guide/tours/1/course/edit', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours/1/applicants'));
    for (const path of ['/guide/tours/1/course/confirm', '/guide/tours/1/course/confirmed']) {
      await router.navigate(path);
      await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours/1/applicants'));
    }
    expect(
      await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }),
    ).toBeInTheDocument();
  });

  it('초안이 있으면 /course/draft는 편집 화면으로 replace하고 다시 만들지 않는다', async () => {
    let drafts = 0;
    server.events.on('request:start', ({ request }) => {
      if (isDraftPost(request)) drafts++;
    });
    const { router } = await openCourse();
    for (const path of ['/guide/tours/1/course/draft', '/guide/tours/1/course/draft?generate=1']) {
      await router.navigate(path);
      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/guide/tours/1/course/edit'),
      );
      expect(router.state.historyAction).toBe('REPLACE');
    }
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
    expect(drafts).toBe(1);
  });

  it('확정된 코스는 편집 · 생성 · 옛 확정 주소로 와도 확정 점검 주소의 완료 상태', async () => {
    const { router } = await renderApp('/guide/tours/1/course/edit', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    expect(await screen.findByRole('heading', { name: '코스를 확정했어요' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm');
    expect(await screen.findByText('참가 승인 3명 · 쿠폰 6장 발급')).toBeInTheDocument();
    for (const path of ['/guide/tours/1/course/draft', '/guide/tours/1/course/confirmed']) {
      await router.navigate(path);
      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm'),
      );
      expect(router.state.historyAction).toBe('REPLACE');
    }
  });
});

describe('확정 전 점검 G08 (guide-s06)', () => {
  it('초안 코스로 오면 점검 화면: 소요 · 지점 분류 요약과 점검 두 줄, 뒤로는 G03', async () => {
    const { user, router } = await openCourse();
    await router.navigate('/guide/tours/1/course/confirm');
    expect(await screen.findByRole('heading', { name: G08_TITLE })).toBeInTheDocument();
    expect(screen.getByText('확정 후 참가자에게 최종 일정이 공개돼요.')).toBeInTheDocument();
    expect(screen.getByText('2시간 30분 코스 초안 완성')).toBeInTheDocument();
    expect(screen.getByText('캠퍼스 · 식사 · 카페 등 3개 장소로 구성했어요.')).toBeInTheDocument();
    expect(screen.getByText('승인된 고교생 요청 반영')).toBeInTheDocument();
    expect(screen.getByText('확인 완료')).toBeInTheDocument();
    expect(screen.getByText('제휴 상점 1곳 이상')).toBeInTheDocument();
    expect(screen.getByText('충족')).toBeInTheDocument();
    expect(
      screen.getByText('확정하면 참가자에게 코스가 공개되고 쿠폰이 자동 발급돼요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '코스 확정하기' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
  });

  it('제휴 지점이 0이면 미충족 · 확정 비활성 + 사유 · 코스 편집으로', async () => {
    const { user, router } = await renderApp('/guide/me', { as: 'guide', checkpoint: 'APPROVED' });
    // 탐방 날짜에 유효한 제휴가 하나도 없으면 AI 초안에 제휴 지점이 없다.
    mutate((db) => {
      db.partnerships.length = 0;
    });
    await router.navigate('/guide/tours/1/course/draft?generate=1');
    await screen.findByRole('heading', { name: G03_TITLE });
    await user.click(screen.getByRole('button', { name: '이 코스로 확정하기' }));
    expect(await screen.findByRole('heading', { name: G08_TITLE })).toBeInTheDocument();
    expect(screen.getByText('미충족')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: '코스 확정하기' });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription('제휴 상점을 1곳 이상 넣어 주세요.');
    const toEdit = screen.getByRole('link', { name: '코스 편집으로' });
    expect(toEdit).toHaveAttribute('href', '/guide/tours/1/course/edit');
    await user.click(toEdit);
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
  });

  it('서버가 제휴 0곳으로 확정을 거절하면(422 PARTNER_REQUIRED) 안내 토스트를 보이고 점검 화면에 머문다', async () => {
    const { user, router } = await openCourse();
    await router.navigate('/guide/tours/1/course/confirm');
    await screen.findByRole('heading', { name: G08_TITLE });
    server.use(
      http.post('/api/tours/:tourId/course/confirm', () => wireFail('E422_PARTNER_REQUIRED'), {
        once: true,
      }),
    );
    await user.click(screen.getByRole('button', { name: '코스 확정하기' }));
    expect(await screen.findByText('제휴 상점을 1곳 이상 넣어 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: G08_TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm');
  });

  it('AI 초안을 다시 만드는 중이면 코스 확정하기는 비활성 + 사유, 끝나면 풀린다', async () => {
    const { user, router } = await openCourse();
    // AI 응답이 늦어야 다시 만들기가 진행 중인 채로 확정 점검에 들어올 수 있다.
    setMockLatency({ base: 0, ai: 400 });
    await user.click(screen.getByRole('button', { name: '다시 만들기' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '다시 만들기' }),
    );
    await router.navigate('/guide/tours/1/course/confirm');
    const confirm = await screen.findByRole('button', { name: '코스 확정하기' });
    expect(screen.getByText('충족')).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription(
      'AI가 코스를 짜고 있어요. 끝나면 확정할 수 있어요.',
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '코스 확정하기' })).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: '코스 확정하기' })).not.toHaveAccessibleDescription();
  });

  it('코스 확정하기를 연타해도 확정 요청은 한 번이고, 같은 화면이 완료 상태로 바뀐다', async () => {
    const { user, router } = await openCourse();
    await router.navigate('/guide/tours/1/course/confirm');
    await screen.findByRole('heading', { name: G08_TITLE });
    // 응답이 늦어야 첫 클릭의 요청이 진행 중인 채로 두 번째 클릭이 들어온다.
    setMockLatency({ base: 150, ai: 0 });
    let confirms = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/course/confirm')) confirms++;
    });
    await user.dblClick(screen.getByRole('button', { name: '코스 확정하기' }));
    expect(await screen.findByRole('heading', { name: '코스를 확정했어요' })).toBeInTheDocument();
    expect(screen.getByText('참가 승인 3명 · 쿠폰 6장 발급')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm');
    expect(screen.queryByRole('heading', { name: G08_TITLE })).toBeNull();
    expect(screen.getByRole('link', { name: '내가 개설한 탐방으로' })).toHaveAttribute(
      'href',
      '/guide/tours',
    );
    expect(confirms).toBe(1);
  });

  it('쿠폰이 0장이면 완료 카드에 1단계 안내 문구', async () => {
    const { router } = await renderApp('/guide/me', { as: 'guide', checkpoint: 'CONFIRMED' });
    mutate((db) => {
      db.coupons.length = 0;
    });
    await router.navigate('/guide/tours/1/course/confirm');
    expect(await screen.findByText('참가 승인 3명 · 쿠폰 0장 발급')).toBeInTheDocument();
    expect(screen.getByText('코스에 제휴 상점이 없어 발급된 쿠폰이 없어요.')).toBeInTheDocument();
  });

  it('완료 카드는 날짜 · 시간, 지점 분류와 총 지점 수, 이후 승인 안내를 보인다(1단계 정보)', async () => {
    await renderApp('/guide/tours/1/course/confirm', { as: 'guide', checkpoint: 'CONFIRMED' });
    expect(await screen.findByRole('heading', { name: '코스를 확정했어요' })).toBeInTheDocument();
    const card = screen.getByRole('heading', { name: '코스를 확정했어요' }).closest('section')!;
    const tour = getDb().tours.find((t) => t.id === 1)!;
    expect(
      within(card).getByText(
        `${formatMonthDay(tour.startsAt)} ${formatTimeRange(tour.startsAt, tour.endsAt)}`,
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText('캠퍼스 · 식사 · 카페 / 총 3개 장소')).toBeInTheDocument();
    expect(
      within(card).getByText('코스 확정 후에 신청을 승인하면 새 승인자에게도 쿠폰을 발급해요.'),
    ).toBeInTheDocument();
  });

  it('신청자 보드를 못 불러와도 완료 카드는 그대로, 승인 수 줄만 짧은 오류와 다시 시도', async () => {
    server.use(http.get('/api/tours/:tourId/applications', () => wireFail('E403')));
    const { user } = await renderApp('/guide/tours/1/course/confirm', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    expect(await screen.findByRole('heading', { name: '코스를 확정했어요' })).toBeInTheDocument();
    const retry = await screen.findByRole('button', { name: '다시 시도' });
    expect(screen.getByText('캠퍼스 · 식사 · 카페 / 총 3개 장소')).toBeInTheDocument();
    expect(screen.queryByText(/참가 승인/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // 카드를 ErrorState로 바꾸지 않는다
    expect(screen.getByRole('link', { name: '내가 개설한 탐방으로' })).toBeInTheDocument();

    server.resetHandlers();
    await user.click(retry);
    expect(await screen.findByText('참가 승인 3명 · 쿠폰 6장 발급')).toBeInTheDocument();
  });

  it('신청자 보드를 불러오는 동안에도 완료 카드 제목은 보인다', async () => {
    server.use(
      http.get('/api/tours/:tourId/applications', async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return undefined;
      }),
    );
    await renderApp('/guide/tours/1/course/confirm', { as: 'guide', checkpoint: 'CONFIRMED' });
    expect(await screen.findByRole('heading', { name: '코스를 확정했어요' })).toBeInTheDocument();
    expect(screen.queryByText(/참가 승인/)).not.toBeInTheDocument();
    expect(await screen.findByText('참가 승인 3명 · 쿠폰 6장 발급')).toBeInTheDocument();
  });

  it('코스 확정 뒤에 승인하면 완료 상태의 승인 수 · 쿠폰 발급 수가 늘어난다', async () => {
    const { user, router } = await renderApp('/guide/tours/1/course/confirm', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    expect(await screen.findByText('참가 승인 3명 · 쿠폰 6장 발급')).toBeInTheDocument();
    // 완료 상태의 뒤로는 신청자 관리다(편집 주소는 확정 코스를 다시 이 화면으로 보낸다).
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    // 최유진(승인 대기)을 승인하면 코스 안 제휴 상점 2곳의 쿠폰이 더 발급된다.
    const yujin = (await screen.findByRole('heading', { name: /최유진/ })).closest('article')!;
    await user.click(within(yujin).getByRole('button', { name: '승인하기' }));
    expect(await screen.findByText('최유진 님을 승인했어요.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '확정 코스 보기' }));
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm');
    expect(await screen.findByText('참가 승인 4명 · 쿠폰 8장 발급')).toBeInTheDocument();
  });
});
