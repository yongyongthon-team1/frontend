import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { qk } from '@/shared/api/queryKeys';
import { mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

// T-08 가이드의 고교생 희망 사항. 원문 그대로(줄바꿈 포함), 학생 이름은 어디에도 없다(Review Focus 5).

const school = () => screen.getByLabelText('학교', { exact: true });
const major = () => screen.getByLabelText('학과 (선택)', { exact: true });
const findButton = () => screen.getByRole('button', { name: '찾기' });
const wishList = () => screen.getByRole('list', { name: '고교생 희망 사항' });
const texts = () => within(wishList()).getAllByTestId('wish-text');

const HAEUN_TEXT = '디자인 작업실에서 선배들이 과제하는 모습을 보고, 학생 식당도 가 보고 싶어요.';
const PAST1_TEXT =
  '제품 디자인 수업에서 무엇을 만드는지 궁금해요.\n실기 준비 이야기도 듣고 싶어요.';
const YUJIN_TEXT = '통역 실습실을 구경하고 선배에게 어학 공부법을 묻고 싶어요.';

/** 이 테스트 동안 나간 `GET /api/tour-wishes` 요청 주소. */
function watchGuideWishRequests() {
  const urls: string[] = [];
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'GET' && new URL(request.url).pathname === '/api/tour-wishes') {
      urls.push(request.url);
    }
  });
  return urls;
}

describe('고교생 희망 사항 (T-08 · 가이드)', () => {
  it('정다은: 내 학교(경희, 2)를 고른 채 이하은 · 정우진 글이 원문 그대로, 이름은 없다', async () => {
    await renderApp('/guide/wishes', { as: 'guide' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '고교생 희망 사항' }),
    ).toBeVisible();
    expect(
      screen.getByText('고교생이 남긴 그대로예요. 이름 같은 개인정보는 보이지 않아요.'),
    ).toBeInTheDocument();
    await screen.findByRole('option', { name: '경희대학교 국제캠퍼스' });
    await waitFor(() => expect(school()).toHaveValue('2'));
    expect(
      within(school())
        .getAllByRole('option')
        .map((o) => [o.getAttribute('value'), o.textContent]),
    ).toEqual([
      ['1', '강남대학교'],
      ['2', '경희대학교 국제캠퍼스'],
      ['3', '단국대학교 죽전캠퍼스'],
      ['4', '명지대학교 자연캠퍼스'],
      ['5', '한국외국어대학교 글로벌캠퍼스'],
    ]);
    expect(major()).toHaveAttribute('placeholder', '예: 산업디자인');
    expect(await screen.findByRole('heading', { level: 2, name: '희망 사항 2개' })).toBeVisible();
    expect(texts().map((t) => t.textContent)).toEqual([HAEUN_TEXT, PAST1_TEXT]);
    expect(texts()[1]).toHaveClass('whitespace-pre-wrap', 'break-words');
    expect(screen.queryByText('이하은')).toBeNull();
    expect(screen.queryByText('정우진')).toBeNull();
    const cards = within(wishList()).getAllByRole('article');
    expect(cards[0]).toHaveTextContent('경희대학교 국제캠퍼스 · 시각디자인');
    expect(within(cards[0]).queryByRole('link')).toBeNull();
    expect(within(cards[0]).queryByRole('button')).toBeNull();
    // 가이드 `내 탐방` 탭이 켜져 있다.
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getByRole('link', { name: '내 탐방' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('학과 `산업` → `찾기`를 눌러야 바뀌고 정우진 글만 남는다', async () => {
    const urls = watchGuideWishRequests();
    const { user } = await renderApp('/guide/wishes', { as: 'guide' });
    await screen.findByRole('heading', { level: 2, name: '희망 사항 2개' });
    const before = urls.length;
    await user.type(major(), '산업');
    // 누르기 전에는 조건이 바뀌지 않는다.
    expect(urls).toHaveLength(before);
    expect(texts()).toHaveLength(2);
    await user.click(findButton());
    expect(await screen.findByRole('heading', { level: 2, name: '희망 사항 1개' })).toBeVisible();
    expect(texts().map((t) => t.textContent)).toEqual([PAST1_TEXT]);
    const last = new URL(urls.at(-1)!).searchParams;
    expect(last.get('campus_id')).toBe('2');
    expect(last.get('major')).toBe('산업');
  });

  it('학과 입력 칸에서 Enter로도 찾는다', async () => {
    const { user } = await renderApp('/guide/wishes', { as: 'guide' });
    await screen.findByRole('heading', { level: 2, name: '희망 사항 2개' });
    await user.type(major(), '산업{Enter}');
    expect(await screen.findByRole('heading', { level: 2, name: '희망 사항 1개' })).toBeVisible();
  });

  it('학교 5(한국외대) → 찾기 → 최유진 글', async () => {
    const { user } = await renderApp('/guide/wishes', { as: 'guide' });
    await screen.findByRole('heading', { level: 2, name: '희망 사항 2개' });
    await user.selectOptions(school(), '5');
    await user.click(findButton());
    expect(await screen.findByRole('heading', { level: 2, name: '희망 사항 1개' })).toBeVisible();
    expect(texts().map((t) => t.textContent)).toEqual([YUJIN_TEXT]);
    expect(screen.queryByText('최유진')).toBeNull();
  });

  it('조건에 맞는 글이 없으면 빈 상태', async () => {
    const { user } = await renderApp('/guide/wishes', { as: 'guide' });
    await screen.findByRole('heading', { level: 2, name: '희망 사항 2개' });
    await user.type(major(), '없는학과');
    await user.click(findButton());
    expect(await screen.findByText('조건에 맞는 희망 사항이 아직 없어요')).toBeInTheDocument();
    expect(screen.getByText('학과를 비우거나 다른 학교로 찾아보세요.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '고교생 희망 사항' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: '희망 사항 0개' })).toBeVisible();
  });

  it('내 학교를 모르면 첫 선택지 `내 학교`로 시작하고 학교 조건 없이 부른다(서버 기본 = 내 인증 학교)', async () => {
    const urls = watchGuideWishRequests();
    const app = await renderApp('/explore', { as: 'guide' });
    mutate((db) => {
      const me = db.users.find((u) => u.email === 'guide@demo.kr')!;
      db.guideProfiles = db.guideProfiles.filter((g) => g.id !== me.id);
    });
    await app.queryClient.invalidateQueries({ queryKey: qk.me });
    await app.queryClient.refetchQueries({ queryKey: qk.me });
    await app.router.navigate('/guide/wishes');
    await screen.findByRole('heading', { level: 2, name: '희망 사항 2개' });
    expect(school()).toHaveValue('');
    expect(
      within(school())
        .getAllByRole('option')
        .map((o) => [o.getAttribute('value'), o.textContent])
        .slice(0, 2),
    ).toEqual([
      ['', '내 학교'],
      ['1', '강남대학교'],
    ]);
    expect(within(school()).getAllByRole('option')).toHaveLength(6);
    expect(new URL(urls[0]).searchParams.has('campus_id')).toBe(false);
  });

  it.each([
    ['guide-pending@demo.kr', '심사 중'],
    ['guide-new@demo.kr', '미제출'],
  ])('재학 인증이 승인 전(%s, %s)이면 안내와 `인증 상태 보기`, 요청도 폼도 없다', async (email) => {
    const urls = watchGuideWishRequests();
    await renderApp('/guide/wishes', { as: email });
    expect(await screen.findByText('재학 인증이 승인된 뒤에 볼 수 있어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '인증 상태 보기' })).toHaveAttribute(
      'href',
      '/guide/verify',
    );
    expect(screen.queryByRole('button', { name: '찾기' })).toBeNull();
    expect(screen.queryByLabelText('학교', { exact: true })).toBeNull();
    expect(screen.queryByRole('list', { name: '고교생 희망 사항' })).toBeNull();
    // 안내가 뜬 뒤 한 박자 더 기다려도 요청은 없다.
    await new Promise((r) => setTimeout(r, 50));
    expect(urls).toHaveLength(0);
  });

  it('뒤로 가기는 /guide로', async () => {
    const { user, router } = await renderApp('/guide/wishes', { as: 'guide' });
    await user.click(await screen.findByRole('button', { name: '뒤로 가기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide'));
  });

  it('고교생이 주소로 들어오면 가이드 화면이 아니다(역할 가드)', async () => {
    const { router } = await renderApp('/guide/wishes', { as: 'student' });
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/guide/wishes'));
  });

  it('불러오지 못하면 오류 상태', async () => {
    server.use(http.get('/api/tour-wishes', () => wireFail('E500')));
    await renderApp('/guide/wishes', { as: 'guide' });
    expect(
      await screen.findByRole('button', { name: '다시 시도' }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
