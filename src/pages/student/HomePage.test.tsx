import { createEvent, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { EXAMPLE_QUERIES } from '@/features/tours/examples';
import { useLastQuery } from '@/features/tours/lastQuery';
import { renderApp } from '@/test/renderApp';

describe('홈 (hs-s03)', () => {
  beforeEach(() => useLastQuery.setState({ search: null }));

  it('예시 칩을 누르면 입력칸이 채워진다', async () => {
    const { user } = await renderApp('/', { as: 'student' });
    await user.click(await screen.findByRole('button', { name: EXAMPLE_QUERIES[0] }));
    expect(screen.getByLabelText('하고 싶은 것')).toHaveValue(EXAMPLE_QUERIES[0]);
  });

  it('문구: 제목 · 도움말 · 각주 · 학교 옵션', async () => {
    await renderApp('/', { as: 'student' });
    expect(
      await screen.findByRole('heading', { name: '어떤 캠퍼스가 궁금해?' }),
    ).toBeInTheDocument();
    expect(screen.getByText('하고 싶은 것을 편하게 문장으로 적어 주세요.')).toBeInTheDocument();
    expect(screen.getByText('탐방 조건')).toBeInTheDocument();
    expect(
      screen.getByText('추천은 가이드 정보와 관심 키워드를 비교해 정렬돼요.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('하고 싶은 것')).toHaveAttribute(
      'placeholder',
      EXAMPLE_QUERIES[0],
    );
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).toBeNull();
    expect(await screen.findByRole('option', { name: '경희대 국제캠퍼스' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '전체' })).toBeInTheDocument();
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
  });

  it('추천받기 → AI 결과, 검색은 기억된다', async () => {
    const { user, router } = await renderApp('/', { as: 'student' });
    await user.click(await screen.findByRole('button', { name: EXAMPLE_QUERIES[0] }));
    await user.click(screen.getByRole('button', { name: '나에게 맞는 탐방 추천받기' }));
    expect(await screen.findByText('디자인 분야에 관심이 많군요!')).toBeInTheDocument();
    expect(screen.getByText('AI가 관심사를 분석했어요 ✦')).toBeInTheDocument();
    expect(screen.getAllByText('경희대학교 국제캠퍼스')[0]).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/recommendations');
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe(EXAMPLE_QUERIES[0]);
    expect(useLastQuery.getState().search).toBe(router.state.location.search.slice(1));
  });

  it('학교 · 학과 · 날짜 조건이 주소에 실린다', async () => {
    const { user, router } = await renderApp('/', { as: 'student' });
    await user.type(await screen.findByLabelText('하고 싶은 것'), '산업디자인이 궁금해요');
    await user.type(screen.getByLabelText('관심 학과 (선택)'), '산업디자인');
    await user.selectOptions(screen.getByLabelText('방문할 학교 (선택)'), '경희대 국제캠퍼스');
    await user.click(screen.getByRole('button', { name: '나에게 맞는 탐방 추천받기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/recommendations'));
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get('major')).toBe('산업디자인');
    expect(Number(params.get('school'))).toBeGreaterThan(0);
    expect(params.has('date')).toBe(false);
  });

  it('주소의 검색 파라미터로 폼을 채운다 (학교 · 날짜 다시 선택)', async () => {
    await renderApp(
      '/?q=%EB%B0%A5%20%EC%A2%80%20%EB%A8%B9%EA%B3%A0%20%EC%8B%B6%EC%96%B4%EC%9A%94&major=%EB%94%94%EC%9E%90%EC%9D%B8&school=2&date=2026-12-28',
      {
        as: 'student',
      },
    );
    expect(await screen.findByLabelText('하고 싶은 것')).toHaveValue('밥 좀 먹고 싶어요');
    expect(screen.getByLabelText('관심 학과 (선택)')).toHaveValue('디자인');
    await waitFor(() => expect(screen.getByLabelText('방문할 학교 (선택)')).toHaveValue('2'));
    expect(screen.getByLabelText('방학 중 탐방 날짜 (선택)')).toHaveValue('2026-12-28');
  });

  it('한글 조합 중 Enter는 막는다 (Review Focus 1)', async () => {
    await renderApp('/', { as: 'student' });
    const input = await screen.findByLabelText('관심 학과 (선택)');
    const ev = createEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent(input, ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
