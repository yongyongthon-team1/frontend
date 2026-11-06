import { act, createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { EXAMPLE_QUERIES } from '@/features/tours/examples';
import { useLastQuery } from '@/features/tours/lastQuery';
import { renderApp } from '@/test/renderApp';

describe('홈 (hs-s03 · H01)', () => {
  beforeEach(() => {
    useLastQuery.setState({ search: null });
    act(() => useDemoStore.setState({ enabled: false }));
  });

  it('문구: 브랜드 · 제목 · 설명 · 히어로 · 입력칸 · 소제목', async () => {
    await renderApp('/', { as: 'student' });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      '내가 궁금한 대학 생활, 직접 만나보세요.',
    );
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();
    expect(screen.getByText('전공 이야기부터 동네 맛집까지 함께 걸어요.')).toBeInTheDocument();
    expect(screen.getByText('어떤 전공이 궁금한가요?')).toBeInTheDocument();
    expect(screen.getByLabelText('하고 싶은 것')).toHaveAttribute(
      'placeholder',
      '예: 제품을 만들고 디자인해보고 싶어요',
    );
    expect(screen.getByRole('button', { name: '나에게 맞는 탐방 추천받기' })).toBeInTheDocument();
    expect(screen.getByText('이번 방학, 이런 탐방은 어때요?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).toBeNull();
  });

  it('예시 칩 · 학교 · 학과 · 날짜 칸은 없다 (2A-R1)', async () => {
    await renderApp('/', { as: 'student' });
    await screen.findByLabelText('하고 싶은 것');
    expect(screen.queryByRole('button', { name: EXAMPLE_QUERIES[0] })).toBeNull();
    expect(screen.queryByLabelText('관심 학과 (선택)')).toBeNull();
    expect(screen.queryByLabelText('방문할 학교 (선택)')).toBeNull();
    expect(screen.queryByLabelText('방학 중 탐방 날짜 (선택)')).toBeNull();
    expect(screen.queryByText('탐방 조건')).toBeNull();
  });

  it('입력칸은 처음엔 비어 있다(시연 도구가 꺼졌을 때)', async () => {
    await renderApp('/', { as: 'student' });
    expect(await screen.findByLabelText('하고 싶은 것')).toHaveValue('');
  });

  it('시연 도구가 켜져 있으면 입력칸에 첫 예시 문장이 채워진다', async () => {
    act(() => useDemoStore.setState({ enabled: true }));
    await renderApp('/', { as: 'student' });
    expect(await screen.findByLabelText('하고 싶은 것')).toHaveValue(EXAMPLE_QUERIES[0]);
  });

  it('빈 문장은 안내', async () => {
    const { user, router } = await renderApp('/', { as: 'student' });
    await user.click(await screen.findByRole('button', { name: '나에게 맞는 탐방 추천받기' }));
    expect(await screen.findByText('하고 싶은 것을 한 문장 이상 적어 주세요.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('5자 미만도 안내', async () => {
    const { user } = await renderApp('/', { as: 'student' });
    await user.type(await screen.findByLabelText('하고 싶은 것'), '밥먹고싶');
    await user.click(screen.getByRole('button', { name: '나에게 맞는 탐방 추천받기' }));
    expect(await screen.findByText('하고 싶은 것을 한 문장 이상 적어 주세요.')).toBeInTheDocument();
    expect(screen.getByLabelText('하고 싶은 것')).toBeInvalid();
  });

  it('추천받기 → AI 결과, 주소에는 q만, 검색은 기억된다', async () => {
    const { user, router } = await renderApp('/', { as: 'student' });
    await user.type(await screen.findByLabelText('하고 싶은 것'), EXAMPLE_QUERIES[0]);
    await user.click(screen.getByRole('button', { name: '나에게 맞는 탐방 추천받기' }));
    expect(await screen.findByText('디자인 분야에 관심이 많군요!')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/recommendations');
    const params = new URLSearchParams(router.state.location.search);
    expect([...params.keys()]).toEqual(['q']);
    expect(params.get('q')).toBe(EXAMPLE_QUERIES[0]);
    expect(useLastQuery.getState().search).toBe(router.state.location.search.slice(1));
  });

  it('주소의 검색 파라미터에서 q를 채운다 (다시 추천받기)', async () => {
    await renderApp(
      '/?q=%EB%B0%A5%20%EC%A2%80%20%EB%A8%B9%EA%B3%A0%20%EC%8B%B6%EC%96%B4%EC%9A%94&school=2',
      { as: 'student' },
    );
    expect(await screen.findByLabelText('하고 싶은 것')).toHaveValue('밥 좀 먹고 싶어요');
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

  it('입력칸이 포커스를 받으면 감싸는 상자에 포커스 링이 있다(키보드 사용자)', async () => {
    await renderApp('/', { as: 'student' });
    const input = await screen.findByLabelText('하고 싶은 것');
    expect(input.parentElement).toHaveClass(
      'focus-within:outline-2',
      'focus-within:outline-accent',
    );
  });

  it('한글 조합 중 Enter는 막는다 (Review Focus 1)', async () => {
    await renderApp('/', { as: 'student' });
    const input = await screen.findByLabelText('하고 싶은 것');
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
});
