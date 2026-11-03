import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLastQuery } from '@/features/tours/lastQuery';
import { toSearch } from '@/features/tours/recommendationParams';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';

const DESIGN_TEXT = '산업디자인을 공부하고 싶고, 학생들이 주로 어디서 시간을 보내는지 궁금해요.';
const DESIGN_Q = encodeURIComponent(DESIGN_TEXT);

describe('AI 추천 목록 (hs-s04 · hs-a06)', () => {
  beforeEach(() => useLastQuery.setState({ search: null }));

  it('로딩 문구 → 결과(칩 · 제목 · 키워드 · 카드)', async () => {
    await renderApp(`/recommendations?q=${DESIGN_Q}`, { as: 'student' });
    expect(screen.getByText('관심사를 분석하고 있어요')).toBeInTheDocument();
    expect(await screen.findByText('디자인 분야에 관심이 많군요!')).toBeInTheDocument();
    expect(screen.getByText('AI가 관심사를 분석했어요 ✦')).toBeInTheDocument();
    expect(screen.getByText('추천 이유와 남은 자리를 확인해보세요.')).toBeInTheDocument();
    expect(
      screen.getByText('탐방이 없다면 같은 학교의 모집 중 탐방을 보여줘요.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('경희대학교 국제캠퍼스')[0]).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '추천 탐방' })).toBeInTheDocument();
  });

  it('카드 전체가 탐방 상세로 가는 링크이고 이유 · 잔여 자리가 있다', async () => {
    await renderApp(`/recommendations?q=${DESIGN_Q}`, { as: 'student' });
    await screen.findByText('디자인 분야에 관심이 많군요!');
    const cards = screen.getAllByRole('link', { name: /경희대학교 국제캠퍼스/ });
    expect(cards[0]).toHaveAttribute('href', '/tours/1');
    expect(within(cards[0]).getByLabelText('AI 결과')).toBeInTheDocument();
    expect(within(cards[0]).getByText(/^잔여 \d+자리$/)).toBeInTheDocument();
    expect(within(cards[0]).getByText('자세히 보기 →')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '자세히 보기 →' })).toBeNull();
    expect(
      within(cards[0]).getByText(/^산업디자인학과 · \d\d\/\d\d\([일월화수목금토]\) \d\d:\d\d$/),
    ).toBeInTheDocument();
  });

  it('매칭이 없으면 넓힌 결과', async () => {
    await renderApp('/recommendations?q=%EC%9A%B0%EC%A3%BC%ED%95%AD%EA%B3%B5', { as: 'student' });
    expect(await screen.findByText('조건을 넓혀서 보여 드려요')).toBeInTheDocument();
    expect(screen.getByText('조건에 맞는 추천이 없어요')).toBeInTheDocument();
    expect(screen.queryByText('AI가 관심사를 분석했어요 ✦')).toBeNull();
    expect(screen.getAllByRole('link', { name: /자세히 보기/ }).length).toBeGreaterThan(0);
  });

  it('결과가 하나도 없으면 빈 상태와 다시 선택 링크', async () => {
    server.use(
      http.post('/api/recommendations', () =>
        HttpResponse.json({
          headline: '조건을 넓혀서 보여 드려요',
          keywords: [],
          items: [],
          fallback: 'ALL',
        }),
      ),
    );
    await renderApp('/recommendations?q=%EC%9A%B0%EC%A3%BC%ED%95%AD%EA%B3%B5&school=2', {
      as: 'student',
    });
    expect(await screen.findByText('지금 모집 중인 탐방이 없어요')).toBeInTheDocument();
    expect(screen.getByText('학교나 날짜를 바꿔 다시 찾아보세요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '학교 · 날짜 다시 선택' })).toHaveAttribute(
      'href',
      `/?${toSearch({ q: '우주항공', universityId: 2 })}`,
    );
  });

  it('학교 · 날짜 다시 선택은 입력을 담아 홈으로', async () => {
    const { user, router } = await renderApp(`/recommendations?q=${DESIGN_Q}&school=2`, {
      as: 'student',
    });
    await screen.findByText('디자인 분야에 관심이 많군요!');
    await user.click(screen.getByRole('link', { name: '학교 · 날짜 다시 선택' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByLabelText('하고 싶은 것')).toHaveValue(DESIGN_TEXT);
    await waitFor(() => expect(screen.getByLabelText('방문할 학교 (선택)')).toHaveValue('2'));
  });

  it('유효한 검색을 마지막 검색으로 기억한다', async () => {
    await renderApp(`/recommendations?q=${DESIGN_Q}`, { as: 'student' });
    await waitFor(() => expect(useLastQuery.getState().search).toBe(toSearch({ q: DESIGN_TEXT })));
  });

  it('쿼리가 없으면 홈으로', async () => {
    const { router } = await renderApp('/recommendations', { as: 'student' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('오류면 다시 시도', async () => {
    let calls = 0;
    server.use(
      http.post('/api/recommendations', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ code: 'UNKNOWN', message: 'x' }, { status: 500 })
          : HttpResponse.json({
              headline: '디자인 분야에 관심이 많군요!',
              keywords: [],
              items: [],
              fallback: null,
            });
      }),
    );
    const { user } = await renderApp(`/recommendations?q=${DESIGN_Q}`, { as: 'student' });
    await user.click(await screen.findByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('디자인 분야에 관심이 많군요!')).toBeInTheDocument();
  });

  it('탭: 탐색이 켜져 있고 내 탐방은 아니다 (판정 11)', async () => {
    await renderApp(`/recommendations?q=${DESIGN_Q}`, { as: 'student' });
    expect(await screen.findByRole('link', { name: '탐색' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '내 탐방' })).not.toHaveAttribute('aria-current');
  });
});
