import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLastQuery } from '@/features/tours/lastQuery';
import type { Recommendation, RecommendationResult, TourSummary } from '@/features/tours/model';
import { toSearch } from '@/features/tours/recommendationParams';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';

const DESIGN_TEXT = '산업디자인을 공부하고 싶고, 학생들이 주로 어디서 시간을 보내는지 궁금해요.';
const DESIGN_Q = encodeURIComponent(DESIGN_TEXT);

function row(id: number, shortName: string, major: string, reason: string): Recommendation {
  const tour: TourSummary = {
    id,
    title: `${shortName} 탐방 ${id}`,
    universityId: id,
    universityName: `${shortName}학교`,
    universityShortName: shortName,
    campusName: '본교',
    major,
    guideName: '가이드',
    guideVerified: true,
    startsAt: `2026-11-1${id}T14:00:00+09:00`,
    endsAt: null,
    capacity: 5,
    approvedCount: 2,
    remainingSeats: 3,
    status: 'RECRUITING',
  };
  return { tour, reason };
}

const MIXED: RecommendationResult = {
  headline: '디자인 분야에 관심이 많군요!',
  keywords: ['디자인'],
  fallback: null,
  items: [
    row(1, '경희대', '산업디자인학과', '직접 제품을 만드는 경험을 원해서'),
    row(2, '강남대', '콘텐츠학과', '콘텐츠를 만드는 하루가 궁금해서'),
    row(3, '경희대', '시각디자인학과', '시각 디자인 수업이 궁금해서'),
  ],
};

describe('AI 추천 목록 (hs-s04 · H02 · hs-a06 · H13)', () => {
  beforeEach(() => useLastQuery.setState({ search: null }));

  it('로딩 문구 → 결과(제목 · 설명 · 칩 · 행 · 이유 상자)', async () => {
    await renderApp(`/recommendations?q=${DESIGN_Q}`, { as: 'student' });
    expect(screen.getByText('관심사를 분석하고 있어요')).toBeInTheDocument();
    // 로딩 중에도 화면 제목(h1)이 있다.
    expect(screen.getByRole('heading', { level: 1, name: '추천 탐방' })).toBeInTheDocument();
    expect(await screen.findByText('디자인 분야에 관심이 많군요!')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /^\d+개의 탐방을 추천해요\.$/,
    );
    expect(screen.getByRole('radiogroup', { name: '추천 필터' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '전체' })).toBeChecked();
    expect(screen.getByText('왜 추천했나요?')).toBeInTheDocument();
    expect(screen.getByLabelText('AI 결과')).toBeInTheDocument();
  });

  it('제목의 개수는 결과 수', async () => {
    server.use(http.post('/api/recommendations', () => HttpResponse.json(MIXED)));
    await renderApp(`/recommendations?q=${DESIGN_Q}`, { as: 'student' });
    await screen.findByText('디자인 분야에 관심이 많군요!');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('3개의 탐방을 추천해요.');
  });

  it('행은 탐방 상세로 가는 링크이고 둘째 줄이 제목, 셋째 줄이 날짜 · 추천 이유(2A-R3)', async () => {
    await renderApp(`/recommendations?q=${DESIGN_Q}`, { as: 'student' });
    await screen.findByText('디자인 분야에 관심이 많군요!');
    const list = screen.getByRole('list', { name: '추천 탐방' });
    const first = within(list).getAllByRole('link')[0];
    expect(first).toHaveAttribute('href', '/tours/1');
    expect(within(first).getByText('경희대학교 국제캠퍼스')).toBeInTheDocument();
    expect(first).toHaveTextContent(/\d\d\.\d\d · /);
    // 첫 행의 메타에 첫 추천 이유가 들어간다.
    const line = within(first).getByTestId('recommendation-reason-line');
    // ✦는 장식(숨김), 화면 낭독기에는 `AI 추천 이유:`가 읽힌다.
    expect(line.textContent).toMatch(/^✦AI 추천 이유: \d\d\.\d\d · .*관심이 있다고 해서/);
    expect(within(line).getByText('✦')).toHaveAttribute('aria-hidden', 'true');
    expect(within(line).getByText('AI 추천 이유:')).toHaveClass('sr-only');
    // 아래 상자에도 같은 이유(전문)가 있다.
    const box = screen.getByText('왜 추천했나요?').closest('section')!;
    expect(box.textContent).toContain(line.textContent!.replace(/^.*? · /, ''));
  });

  it('필터 칩: 전체 · 학과 키워드 · 학교 — 학교 칩을 고르면 다른 학교 행이 없다', async () => {
    server.use(http.post('/api/recommendations', () => HttpResponse.json(MIXED)));
    const { user } = await renderApp(`/recommendations?q=${DESIGN_Q}`, { as: 'student' });
    await screen.findByText('디자인 분야에 관심이 많군요!');
    const chips = within(screen.getByRole('radiogroup', { name: '추천 필터' }));
    expect(chips.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      '전체',
      '디자인',
      '경희대',
      '강남대',
    ]);
    const list = screen.getByRole('list', { name: '추천 탐방' });
    expect(within(list).getAllByRole('link')).toHaveLength(3);

    await user.click(chips.getByRole('radio', { name: '경희대' }));
    expect(chips.getByRole('radio', { name: '경희대' })).toBeChecked();
    expect(within(list).getAllByRole('link')).toHaveLength(2);
    expect(within(list).queryByText('강남대학교')).toBeNull();
    // 제목의 개수는 결과 수 그대로.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('3개의 탐방을');

    await user.click(chips.getByRole('radio', { name: '강남대' }));
    expect(within(list).getAllByRole('link')).toHaveLength(1);
    expect(within(list).getByText('강남대학교')).toBeInTheDocument();
    // 이유 상자는 보이는 첫 행의 이유다.
    expect(screen.getByText('왜 추천했나요?').closest('section')).toHaveTextContent(
      '콘텐츠를 만드는 하루가 궁금해서',
    );
  });

  it('뒤로 가기는 입력을 담아 홈으로', async () => {
    const { user, router } = await renderApp(`/recommendations?q=${DESIGN_Q}&school=2`, {
      as: 'student',
    });
    await screen.findByText('디자인 분야에 관심이 많군요!');
    await user.click(screen.getByRole('link', { name: '뒤로 가기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByLabelText('하고 싶은 것')).toHaveValue(DESIGN_TEXT);
  });

  it('매칭이 없으면 넓힌 결과: 경고 칩이 제목 위, 제목은 개수', async () => {
    await renderApp('/recommendations?q=%EC%9A%B0%EC%A3%BC%ED%95%AD%EA%B3%B5', { as: 'student' });
    expect(await screen.findByText('조건을 넓혀서 보여 드려요')).toBeInTheDocument();
    const chip = screen.getByText('조건에 맞는 추천이 없어요');
    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent(/^\d+개의 탐방을 추천해요\.$/);
    expect(chip.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /\/?경희대|대학교/ }).length).toBeGreaterThan(0);
  });

  it('결과가 하나도 없으면 H13 추천 0건 카드와 다시 추천받기 링크', async () => {
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
    expect(await screen.findByText('아직 맞는 탐방이 없어요')).toBeInTheDocument();
    expect(screen.getByText('추천 0건')).toBeInTheDocument();
    expect(screen.getByText('관심 문장을 바꿔 다시 검색해 보세요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /다시 추천받기/ })).toHaveAttribute(
      'href',
      `/?${toSearch({ q: '우주항공', universityId: 2 })}`,
    );
    expect(screen.queryByText('왜 추천했나요?')).toBeNull();
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
    const retry = await screen.findByRole('button', { name: '다시 시도' });
    expect(screen.getByRole('heading', { level: 1, name: '추천 탐방' })).toBeInTheDocument();
    await user.click(retry);
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
