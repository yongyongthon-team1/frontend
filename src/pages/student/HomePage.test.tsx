import { act, createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { DEMO_WISH } from '@/features/tours/examples';
import { useLastQuery } from '@/features/tours/lastQuery';
import { getDb } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { toWireCampus } from '@/mocks/wire/campuses';
import { renderApp } from '@/test/renderApp';
import { wireFail, wireOk } from '@/test/wire';

// T-01 홈(hs-s03 · H01 V2 부품): 학교 · 학과 · 탐방 희망 사항 · 희망 날짜(선택) → `POST /tour-wishes` 한 번 → 결과 화면(2C-R16).

const field = (label: string) => screen.getByLabelText(label, { exact: true });
const submitButton = () => screen.getByRole('button', { name: '희망 사항 남기고 탐방 찾기' });

/** `POST /api/tour-wishes` 요청 수와 본문. */
function watchWishPosts() {
  const bodies: unknown[] = [];
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/tour-wishes') {
      bodies.push(null);
      const at = bodies.length - 1;
      void request
        .clone()
        .json()
        .then((b: unknown) => (bodies[at] = b));
    }
  });
  return bodies;
}

/** 캠퍼스 목록이 와서 학교 선택지가 생길 때까지 기다린다. */
const campusesLoaded = () => screen.findByRole('option', { name: '경희대학교 국제캠퍼스' });

describe('홈 · T-01 희망 사항 등록 (hs-s03 · H01)', () => {
  beforeEach(() => {
    useLastQuery.setState({ search: null });
    act(() => useDemoStore.setState({ enabled: false }));
  });
  afterEach(() => setMockLatency({ base: 0, ai: 0 }));

  it('문구: 브랜드 · 제목 · 설명 · 히어로 · 칸 라벨 넷 · 버튼 · 캡션 · 소제목, 뒤로 가기 없음', async () => {
    await renderApp('/', { as: 'student' });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      '내가 궁금한 대학 생활, 직접 만나보세요.',
    );
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();
    expect(screen.getByText('전공 이야기부터 동네 맛집까지 함께 걸어요.')).toBeInTheDocument();
    expect(screen.getByText('어떤 전공이 궁금한가요?')).toBeInTheDocument();
    expect(field('학교')).toBeInTheDocument();
    expect(field('학과')).toHaveAttribute('placeholder', '예: 산업디자인');
    expect(field('학과')).toHaveAttribute('maxLength', '30');
    expect(field('탐방 희망 사항')).toHaveAttribute(
      'placeholder',
      '예: 디자인 작업실을 구경하고 학생 식당에도 가 보고 싶어요.',
    );
    expect(field('탐방 희망 사항')).toHaveAttribute('maxLength', '100');
    expect(field('탐방 희망 사항')).toHaveAccessibleDescription('한두 문장 · 100자 이내');
    expect(field('희망 날짜 (선택)')).toHaveAttribute('type', 'date');
    expect(submitButton()).toHaveAttribute('type', 'submit');
    expect(
      screen.getByText('남긴 희망 사항은 이름 없이 대학생 가이드에게 보여요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('이번 방학, 이런 탐방은 어때요?')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '뒤로 가기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).toBeNull();
  });

  it('학교 선택지: 첫 줄 `학교를 골라 주세요` + 캠퍼스 5곳(학교 · 캠퍼스 이름)', async () => {
    await renderApp('/', { as: 'student' });
    await campusesLoaded();
    const options = within(field('학교')).getAllByRole('option');
    expect(options.map((o) => [o.getAttribute('value'), o.textContent])).toEqual([
      ['', '학교를 골라 주세요'],
      ['1', '강남대학교'],
      ['2', '경희대학교 국제캠퍼스'],
      ['3', '단국대학교 죽전캠퍼스'],
      ['4', '명지대학교 자연캠퍼스'],
      ['5', '한국외국어대학교 글로벌캠퍼스'],
    ]);
  });

  it('시연 도구가 꺼져 있으면 칸이 비어 있다', async () => {
    await renderApp('/', { as: 'student' });
    await campusesLoaded();
    expect(field('학교')).toHaveValue('');
    expect(field('학과')).toHaveValue('');
    expect(field('탐방 희망 사항')).toHaveValue('');
    expect(field('희망 날짜 (선택)')).toHaveValue('');
  });

  it('시연 도구가 켜져 있으면 DEMO_WISH로 미리 채운다(학교는 캠퍼스 목록이 온 뒤, 날짜는 비움)', async () => {
    act(() => useDemoStore.setState({ enabled: true }));
    await renderApp('/', { as: 'student' });
    await campusesLoaded();
    await waitFor(() => expect(field('학교')).toHaveValue('2'));
    expect(field('학과')).toHaveValue('산업디자인');
    expect(field('탐방 희망 사항')).toHaveValue(DEMO_WISH.wish);
    expect(field('희망 날짜 (선택)')).toHaveValue('');
  });

  it('시연 도구가 켜져 있어도 캠퍼스 목록에 id 2가 없으면 학교는 비워 두고 학과 · 희망 사항만 채운다', async () => {
    act(() => useDemoStore.setState({ enabled: true }));
    server.use(
      http.get('/api/campuses', () => {
        const db = getDb();
        return wireOk({
          items: db.universities.filter((u) => u.id !== 2).map((u) => toWireCampus(db, u)),
        });
      }),
    );
    await renderApp('/', { as: 'student' });
    await screen.findByRole('option', { name: '강남대학교' });
    await waitFor(() => expect(field('학과')).toHaveValue('산업디자인'));
    expect(field('탐방 희망 사항')).toHaveValue(DEMO_WISH.wish);
    expect(field('학교')).toHaveValue('');
  });

  it('칸을 건드린 뒤에는 늦게 온 캠퍼스 목록으로 학교를 채우지 않는다(2C-R19)', async () => {
    act(() => useDemoStore.setState({ enabled: true }));
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/campuses', async () => {
        await gate;
        const db = getDb();
        return wireOk({ items: db.universities.map((u) => toWireCampus(db, u)) });
      }),
    );
    const { user } = await renderApp('/', { as: 'student' });
    // 학과 · 희망 사항은 캠퍼스 목록 없이도 바로 채워진다.
    await waitFor(() => expect(field('학과')).toHaveValue('산업디자인'));
    await user.clear(field('학과'));
    await user.type(field('학과'), '경영');
    release();
    await campusesLoaded();
    expect(field('학교')).toHaveValue('');
    expect(field('학과')).toHaveValue('경영');
    expect(field('탐방 희망 사항')).toHaveValue(DEMO_WISH.wish);
  });

  it('빈 제출: 학교 · 학과 · 희망 사항 칸 오류, 주소는 / 그대로, 요청 0', async () => {
    const posts = watchWishPosts();
    const { user, router } = await renderApp('/', { as: 'student' });
    await campusesLoaded();
    await user.click(submitButton());
    expect(await screen.findByText('학교를 골라 주세요.')).toBeInTheDocument();
    expect(field('학교')).toHaveAccessibleDescription('학교를 골라 주세요.');
    expect(field('학과')).toHaveAccessibleDescription('학과를 적어 주세요.');
    // 희망 사항 칸은 오류 다음에 도움말이 이어 읽힌다.
    expect(field('탐방 희망 사항')).toHaveAccessibleDescription(
      '하고 싶은 것을 한두 문장으로 적어 주세요. 한두 문장 · 100자 이내',
    );
    expect(field('학교')).toBeInvalid();
    // 위에서부터 첫 오류 칸(학교)에 포커스가 간다.
    expect(field('학교')).toHaveFocus();
    expect(router.state.location.pathname).toBe('/');
    expect(posts).toHaveLength(0);
  });

  it('제출: POST /tour-wishes 1번(앞뒤 공백만 뺀 값) → /tours, 검색 키는 school · major · wish, 마지막 검색으로 기억', async () => {
    const posts = watchWishPosts();
    const { user, router } = await renderApp('/', { as: 'student' });
    await campusesLoaded();
    await user.selectOptions(field('학교'), '2');
    await user.type(field('학과'), ' 산업디자인 ');
    await user.type(field('탐방 희망 사항'), '  작업실을 구경하고{Enter}학식도 먹어 보고 싶어요. ');
    await user.click(submitButton());
    await waitFor(() => expect(router.state.location.pathname).toBe('/tours'));
    expect(posts).toEqual([
      {
        campus_id: 2,
        major: '산업디자인',
        wish: '작업실을 구경하고\n학식도 먹어 보고 싶어요.',
        date: null,
      },
    ]);
    const params = new URLSearchParams(router.state.location.search);
    expect([...params.keys()]).toEqual(['school', 'major', 'wish']);
    expect(params.get('school')).toBe('2');
    expect(params.get('major')).toBe('산업디자인');
    expect(params.get('wish')).toBe('작업실을 구경하고\n학식도 먹어 보고 싶어요.');
    expect(useLastQuery.getState().search).toBe(router.state.location.search.slice(1));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        '조건에 맞는 탐방 2개를 찾았어요.',
      ),
    );
  });

  it('희망 날짜를 고르면 본문 date와 주소 date에 실린다', async () => {
    act(() => useDemoStore.setState({ enabled: true }));
    const posts = watchWishPosts();
    const { user, router } = await renderApp('/', { as: 'student' });
    await campusesLoaded();
    await waitFor(() => expect(field('학교')).toHaveValue('2'));
    fireEvent.change(field('희망 날짜 (선택)'), { target: { value: '2027-01-15' } });
    await user.click(submitButton());
    await waitFor(() => expect(router.state.location.pathname).toBe('/tours'));
    expect(posts).toEqual([
      { campus_id: 2, major: '산업디자인', wish: DEMO_WISH.wish, date: '2027-01-15' },
    ]);
    expect(new URLSearchParams(router.state.location.search).get('date')).toBe('2027-01-15');
  });

  it('연타해도 등록은 1번이고 처리 중에는 버튼이 잠긴다', async () => {
    act(() => useDemoStore.setState({ enabled: true }));
    setMockLatency({ base: 150, ai: 0 });
    const posts = watchWishPosts();
    const { user, router } = await renderApp('/', { as: 'student' });
    await campusesLoaded();
    await waitFor(() => expect(field('학교')).toHaveValue('2'));
    await user.dblClick(submitButton());
    await waitFor(() => expect(submitButton()).toBeDisabled());
    await waitFor(() => expect(router.state.location.pathname).toBe('/tours'), { timeout: 3000 });
    expect(posts).toHaveLength(1);
  });

  it('서버 칸 오류(E400 · campus_id)는 학교 칸 아래 문구로 보이고 이동하지 않는다', async () => {
    act(() => useDemoStore.setState({ enabled: true }));
    server.use(
      http.post('/api/tour-wishes', () =>
        wireFail('E400', { errors: [{ field: 'campus_id', reason: '학교를 골라 주세요.' }] }),
      ),
    );
    const { user, router } = await renderApp('/', { as: 'student' });
    await campusesLoaded();
    await waitFor(() => expect(field('학교')).toHaveValue('2'));
    await user.click(submitButton());
    await waitFor(() => expect(field('학교')).toHaveAccessibleDescription('학교를 골라 주세요.'));
    expect(field('학교')).toBeInvalid();
    expect(router.state.location.pathname).toBe('/');
    expect(submitButton()).toBeEnabled();
  });

  it.each([
    ['major', '학과', '학과를 확인해 주세요.'],
    ['wish', '탐방 희망 사항', '희망 사항을 확인해 주세요.'],
    ['date', '희망 날짜 (선택)', '날짜를 확인해 주세요.'],
  ])(
    '서버 칸 오류(E400 · %s)는 그 칸 아래 문구로 보이고 이동하지 않는다',
    async (name, label, reason) => {
      act(() => useDemoStore.setState({ enabled: true }));
      server.use(
        http.post('/api/tour-wishes', () =>
          wireFail('E400', { errors: [{ field: name, reason }] }),
        ),
      );
      const { user, router } = await renderApp('/', { as: 'student' });
      await campusesLoaded();
      await waitFor(() => expect(field('학교')).toHaveValue('2'));
      await user.click(submitButton());
      // 희망 사항 칸은 안내(`한두 문장 · 100자 이내`)도 설명에 같이 든다.
      await waitFor(() =>
        expect(field(label)).toHaveAccessibleDescription(expect.stringContaining(reason)),
      );
      expect(field(label)).toBeInvalid();
      expect(router.state.location.pathname).toBe('/');
      expect(submitButton()).toBeEnabled();
    },
  );

  it('칸 오류가 없는 실패는 토스트로 알린다', async () => {
    act(() => useDemoStore.setState({ enabled: true }));
    server.use(http.post('/api/tour-wishes', () => wireFail('E500')));
    const { user, router } = await renderApp('/', { as: 'student' });
    await campusesLoaded();
    await waitFor(() => expect(field('학교')).toHaveValue('2'));
    await user.click(submitButton());
    expect(
      await screen.findByText('문제가 생겼어요. 잠시 후 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('주소의 검색으로 칸을 채운다(조건 바꾸기로 돌아온 경우) — 시연 미리 채움보다 앞선다', async () => {
    act(() => useDemoStore.setState({ enabled: true }));
    await renderApp(
      '/?school=5&major=%EA%B2%BD%EC%98%81&wish=%EC%B2%AB%20%EC%A4%84%0A%EB%91%98%EC%A7%B8%20%EC%A4%84&date=2027-01-20',
      { as: 'student' },
    );
    await campusesLoaded();
    await waitFor(() => expect(field('학교')).toHaveValue('5'));
    expect(field('학과')).toHaveValue('경영');
    expect(field('탐방 희망 사항')).toHaveValue('첫 줄\n둘째 줄');
    expect(field('희망 날짜 (선택)')).toHaveValue('2027-01-20');
  });

  it('한글 조합 중 Enter는 막는다 (Review Focus 1)', async () => {
    await renderApp('/', { as: 'student' });
    const input = await screen.findByLabelText('학과', { exact: true });
    const ev = createEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent(input, ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('탭: 탐색이 켜져 있다', async () => {
    await renderApp('/', { as: 'student' });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: '탐색' })).toHaveAttribute('aria-current', 'page'),
    );
  });

  it('모집 중 탐방이 행 링크로 최대 3개 (제목 · 학교 · 날짜 · 남은 자리)', async () => {
    await renderApp('/', { as: 'student' });
    const list = await screen.findByRole('list', { name: '모집 중인 탐방' });
    const rows = within(list).getAllByRole('link');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(3);
    expect(rows[0]).toHaveAttribute('href', expect.stringMatching(/^\/tours\/\d+$/));
    expect(rows[0]).toHaveTextContent(/\d\d\.\d\d \([일월화수목금토]\) · \d+자리 남음/);
    expect(within(rows[0]).getByText(/대학교/)).toBeInTheDocument();
  });
});
