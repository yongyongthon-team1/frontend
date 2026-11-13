import { act, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLastQuery } from '@/features/tours/lastQuery';
import { toWishSearch, type WishSearch } from '@/features/tours/wishSearch';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';
import { wireFail, wirePage } from '@/test/wire';

// T-01 탐방 찾기 결과(hs-s04 · H02 V2 부품 · hs-a06 0건 · 대체). 원문 카드는 주소의 희망 사항을 가공하지 않고 그대로 보인다
// (줄바꿈 · 끝 공백 포함 — Review Focus 5). 홈 제출의 앞뒤 공백 빼기는 `toWishInput`(홈 테스트)이 따로 지킨다.

/** 줄바꿈과 끝 공백이 든 정확히 100자 원문. */
const RAW_WISH = `첫 줄\n둘째 줄 ${'가'.repeat(90)} `;

const search = (s: Partial<WishSearch> = {}): string =>
  toWishSearch({ universityId: 2, major: '산업디자인', wish: RAW_WISH, date: null, ...s });

const META = /^\d\d\.\d\d \([일월화수목금토]\) \d\d:\d\d · \d+자리 남음$/;

const wishCard = () => screen.getByRole('region', { name: '내가 남긴 희망 사항' });
const tourList = () => screen.getByRole('list', { name: '모집 중 투어' });

describe('투어 찾기 결과 (T-01 · hs-s04)', () => {
  beforeEach(() => useLastQuery.setState({ search: null }));

  it('조건에 맞는 투어: 제목 · 설명, 원문 카드(줄바꿈 · 끝 공백 그대로) · 학교 · 학과, 날짜 빠른 순 행', async () => {
    expect(RAW_WISH).toHaveLength(100);
    await renderApp(`/tours?${search()}`, { as: 'student' });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      '조건에 맞는 투어 2개를 찾았어요.',
    );
    expect(screen.getByText('날짜가 빠른 순이에요.')).toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 투어가 없어요')).toBeNull();

    const card = wishCard();
    expect(within(card).getByText('내가 남긴 희망 사항')).toBeInTheDocument();
    const text = within(card).getByTestId('wish-text');
    expect(text.textContent).toBe(RAW_WISH);
    expect(text).toHaveClass('whitespace-pre-wrap', 'break-words');
    expect(within(card).getByText('경희대학교 국제캠퍼스 · 산업디자인')).toBeInTheDocument();
    // 원문 카드에는 이름 같은 개인정보가 없다.
    expect(card).not.toHaveTextContent('김민지');

    const rows = within(tourList()).getAllByRole('link');
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['/tours/1', '/tours/6']);
    for (const row of rows) {
      expect(within(row).getByText('경희대학교 국제캠퍼스')).toBeInTheDocument();
      expect(within(row).getByText(META)).toBeInTheDocument();
    }
    expect(within(rows[0]).getByText('경희대 국제캠퍼스 산업디자인학과 투어')).toBeInTheDocument();
  });

  it('원문 카드 머리 줄 오른쪽에 `내 희망 사항` 링크(›는 이름에 들지 않음) → /me/wishes', async () => {
    await renderApp(`/tours?${search()}`, { as: 'student' });
    await screen.findByRole('heading', { level: 1 });
    const link = within(wishCard()).getByRole('link', { name: '내 희망 사항' });
    expect(link).toHaveAttribute('href', '/me/wishes');
    expect(link).toHaveClass('min-h-11');
    expect(link).toHaveTextContent('내 희망 사항›');
    // 머리 줄 안, 제목 글자와 같은 줄이다.
    expect(link.parentElement).toContainElement(
      within(wishCard()).getByText('내가 남긴 희망 사항'),
    );
  });

  it('희망 날짜가 있으면 원문 카드 아래 줄에 `{M월 D일} 희망`', async () => {
    await renderApp(`/tours?${search({ date: '2027-01-15' })}`, { as: 'student' });
    await screen.findByRole('heading', { level: 1 });
    expect(
      within(wishCard()).getByText('경희대학교 국제캠퍼스 · 산업디자인 · 1월 15일 희망'),
    ).toBeInTheDocument();
  });

  it('학과에 맞는 투어가 없으면 경고 칩과 같은 학교 투어(대체)', async () => {
    await renderApp(`/tours?${search({ major: '기계공학' })}`, { as: 'student' });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      '같은 학교 투어 2개를 보여 드려요.',
    );
    expect(screen.getByText('조건에 맞는 투어가 없어요')).toBeInTheDocument();
    expect(screen.getByText('학과 · 날짜 조건을 빼고 찾았어요.')).toBeInTheDocument();
    expect(within(wishCard()).getByText('경희대학교 국제캠퍼스 · 기계공학')).toBeInTheDocument();
    expect(
      within(tourList())
        .getAllByRole('link')
        .map((r) => r.getAttribute('href')),
    ).toEqual(['/tours/1', '/tours/6']);
  });

  it('같은 학교에도 모집 중 투어가 없으면 0건 카드와 `조건 바꾸기`', async () => {
    const s = search({ universityId: 3, major: '디자인' });
    await renderApp(`/tours?${s}`, { as: 'student' });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      '아직 모집 중인 투어가 없어요.',
    );
    expect(screen.getByText('다른 학교로 다시 찾아보세요.')).toBeInTheDocument();
    expect(screen.getByText('0건')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '단국대에 모집 중인 투어가 없어요' }),
    ).toBeInTheDocument();
    expect(screen.getByText('학교를 바꿔 다시 찾아보세요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '조건 바꾸기 ›' })).toHaveAttribute('href', `/?${s}`);
    expect(screen.queryByRole('list', { name: '모집 중 투어' })).toBeNull();
    expect(screen.queryByText('조건에 맞는 투어가 없어요')).toBeNull();
    expect(within(wishCard()).getByTestId('wish-text').textContent).toBe(RAW_WISH);
  });

  it('검색이 없거나 틀리면 홈으로', async () => {
    const { router } = await renderApp('/tours', { as: 'student' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await act(() => router.navigate('/tours?school=x&major=a&wish=b'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await act(() => router.navigate('/tours?q=%EB%B0%A5'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('캠퍼스 목록에 없는 학교도 틀린 검색이라 홈으로', async () => {
    const { router } = await renderApp(`/tours?${search({ universityId: 99 })}`, { as: 'student' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    // 홈으로 보낸 틀린 학교는 마지막 검색으로 기억하지 않는다.
    expect(useLastQuery.getState().search).toBeNull();
  });

  it('뒤로 가기는 같은 검색으로 홈(`/?{search}`), 들어오면 마지막 검색으로 기억한다', async () => {
    const s = search();
    await renderApp(`/tours?${s}`, { as: 'student' });
    expect(await screen.findByRole('link', { name: '뒤로 가기' })).toHaveAttribute(
      'href',
      `/?${s}`,
    );
    // 캠퍼스 목록이 와서 학교를 찾은 뒤에 기억한다.
    await waitFor(() => expect(useLastQuery.getState().search).toBe(s));
  });

  it('목록을 받는 동안 원문 카드는 바로 보이고 목록 자리는 Skeleton', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/tours', async () => {
        await gate;
        return wirePage([]);
      }),
    );
    await renderApp(`/tours?${search()}`, { as: 'student' });
    expect(await screen.findByRole('region', { name: '내가 남긴 희망 사항' })).toBeInTheDocument();
    expect(within(wishCard()).getByTestId('wish-text').textContent).toBe(RAW_WISH);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('list', { name: '모집 중 투어' })).toBeNull();
    release();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      '아직 모집 중인 투어가 없어요.',
    );
    expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
  });

  it('목록 조회가 실패하면 ErrorState, 다시 시도하면 목록', async () => {
    server.use(http.get('/api/tours', () => wireFail('E500')));
    const { user } = await renderApp(`/tours?${search()}`, { as: 'student' });
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    // 오류일 때는 제목 자리 Skeleton을 거두고 ErrorState만 남는다.
    expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
    expect(within(wishCard()).getByTestId('wish-text').textContent).toBe(RAW_WISH);
    server.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('list', { name: '모집 중 투어' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('탭: 탐색이 켜져 있다', async () => {
    await renderApp(`/tours?${search()}`, { as: 'student' });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: '탐색' })).toHaveAttribute('aria-current', 'page'),
    );
  });

  it('투어 상세(마감 투어)의 `다른 투어 보기`는 이 결과 화면으로 돌아온다', async () => {
    const s = search();
    const { router } = await renderApp(`/tours?${s}`, { as: 'student' });
    await screen.findByRole('list', { name: '모집 중 투어' });
    await act(() => router.navigate('/tours/2'));
    expect(await screen.findByRole('link', { name: '다른 투어 보기 ›' })).toHaveAttribute(
      'href',
      `/tours?${s}`,
    );
  });
});
