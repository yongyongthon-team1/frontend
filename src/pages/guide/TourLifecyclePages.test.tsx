import { act, createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { couponStateLabel } from '@/features/coupons/model';
import { tourDateBoundsNow } from '@/features/campuses/model';
import { getDb, mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { formatShortDate } from '@/shared/lib/date';
import { findApplicationId, renderApp, switchAccount } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

const GUIDE_TOUR_TITLE = '경희대 국제캠퍼스 산업디자인학과 탐방';

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

/** `method` 요청 중 경로가 `path`로 끝나는 것의 개수를 센다. */
function countRequests(method: string, path: string): () => number {
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.method === method && new URL(request.url).pathname.endsWith(path)) count++;
  });
  return () => count;
}

const field = (name: string) => screen.getByLabelText(name, { exact: true });

async function fillTourForm(
  user: UserEvent,
  values: Partial<Record<string, string>> = {},
): Promise<void> {
  const v = {
    날짜: '2027-01-20',
    '시작 시간': '14:00',
    '종료 시간': '16:30',
    정원: '5',
    '탐방 소개': '산업디자인 작업실을 함께 둘러봐요.',
    '연락 링크': 'https://open.kakao.com/o/x',
    ...values,
  };
  for (const [label, value] of Object.entries(v)) {
    if (value === '') continue;
    await user.type(field(label), value);
  }
}

describe('G04 탐방 개설 (guide-s02)', () => {
  it('V2 문구와 카드 순서: 학교 → 일정 → 정원 → 탐방 소개 → 연락 링크, 탐방 이름 칸은 없다', async () => {
    await renderApp('/guide/tours/new', { as: 'guide' });
    expect(await screen.findByRole('heading', { name: '어떤 하루를 보여줄까요?' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: '새 탐방 만들기' })).toBeInTheDocument();
    expect(screen.getByText('방학 중 열 수 있는 작은 캠퍼스 투어를 만들어 봐요.')).toBeVisible();
    expect(screen.getByText('경희대학교 국제캠퍼스')).toBeVisible();
    expect(screen.queryByLabelText(/탐방 이름/)).not.toBeInTheDocument();
    expect(field('정원')).toHaveAttribute('placeholder', '최대 10명');
    expect(field('탐방 소개')).toHaveAttribute('placeholder', '전공 선배와 둘러보는 우리 캠퍼스');
    expect(screen.getByText('승인된 신청자에게만 공개돼요.')).toBeVisible();
    expect(screen.getByText('ⓘ 학교별 방학 기간에만 탐방을 개설할 수 있어요.')).toBeVisible();
    expect(screen.getByRole('button', { name: '모집 시작하기' })).toBeEnabled();
    // 라벨 순서
    const nodes = ['학교', '일정', '정원', '탐방 소개', '연락 링크'].map((name) =>
      screen.getByText(name, { selector: 'h3, label' }),
    );
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i - 1]!.compareDocumentPosition(nodes[i]!)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  it('날짜 칸의 min · max는 학교의 남은 방학(tourDateBoundsNow)이다', async () => {
    await renderApp('/guide/tours/new', { as: 'guide' });
    const date = await screen.findByLabelText('날짜');
    const school = getDb().universities.find((u) => u.id === 2)!;
    const vacations = getDb()
      .vacations.filter((v) => v.universityId === school.id)
      .map((v) => ({ startDate: v.startDate, endDate: v.endDate, label: v.label }));
    const bounds = tourDateBoundsNow(vacations)!;
    expect(date).toHaveAttribute('min', bounds.min);
    expect(date).toHaveAttribute('max', bounds.max);
  });

  it('인증 전(guide-new)이면 칩 · 비활성 · 행동 링크, 입력도 잠긴다', async () => {
    await renderApp('/guide/tours/new', { as: 'guide-new@demo.kr' });
    expect(await screen.findByText('재학 인증 승인 필요')).toBeVisible();
    expect(screen.getByRole('button', { name: '모집 시작하기' })).toBeDisabled();
    expect(
      screen.getByText('학생증 또는 재학증명서 인증 후에만 탐방을 개설할 수 있어요.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: '역할 인증 단계로 이동' })).toHaveAttribute(
      'href',
      '/guide/verify',
    );
    expect(field('정원')).toBeDisabled();
    expect(field('연락 링크')).toBeDisabled();
  });

  it('심사 중 · 학과 없음(guide-pending)의 행동은 가이드 프로필 작성하기이고, 누르면 자리 화면이 열린다', async () => {
    const { user, router } = await renderApp('/guide/tours/new', { as: 'guide-pending@demo.kr' });
    const link = await screen.findByRole('link', { name: '가이드 프로필 작성하기' });
    expect(link).toHaveAttribute('href', '/guide/me/profile');
    await user.click(link);
    expect(router.state.location.pathname).toBe('/guide/me/profile');
    expect(await screen.findByRole('heading', { name: '가이드 프로필 등록' })).toBeInTheDocument();
  });

  it('정상 개설: 요청 1번 → 토스트 → 내가 개설한 탐방에 새 카드(01.20)', async () => {
    const posts = countRequests('POST', '/tours');
    const { user, router } = await renderApp('/guide/tours/new', { as: 'guide' });
    await screen.findByRole('heading', { name: '어떤 하루를 보여줄까요?' });
    await fillTourForm(user);
    expect(await screen.findByText('방학 기간')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '모집 시작하기' }));
    expect(await screen.findByText('탐방을 개설했어요.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours'));
    expect(posts()).toBe(1);
    const card = (await screen.findByText('01.20 (수) · 0/5명 승인')).closest('article')!;
    expect(within(card).getByRole('heading', { name: GUIDE_TOUR_TITLE })).toBeInTheDocument();
    // 새 탐방은 목업 DB에도 본문 그대로(시각 변환 없음) 들어갔다.
    const created = getDb().tours.at(-1)!;
    expect(created.startsAt).toBe('2027-01-20T14:00:00+09:00');
    expect(created.endsAt).toBe('2027-01-20T16:30:00+09:00');
    expect(created.capacity).toBe(5);
    expect(created.openChatUrl).toBe('https://open.kakao.com/o/x');
  });

  it('방학 밖 날짜는 요청 없이 막고(칩도 없다), 방학 날짜로 고치면 1번 보낸다', async () => {
    const posts = countRequests('POST', '/tours');
    const { user } = await renderApp('/guide/tours/new', { as: 'guide' });
    await screen.findByRole('heading', { name: '어떤 하루를 보여줄까요?' });
    await fillTourForm(user, { 날짜: '2027-03-10' });
    expect(screen.queryByText('방학 기간')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '모집 시작하기' }));
    expect(await screen.findByText('방학 기간 안의 날짜만 고를 수 있어요.')).toBeVisible();
    expect(field('날짜')).toHaveAccessibleDescription('방학 기간 안의 날짜만 고를 수 있어요.');
    expect(posts()).toBe(0);
    // 같은 폼이 방학 날짜로는 요청을 보낸다(0이 "고장나서"가 아님을 보이는 대조)
    fireEvent.change(field('날짜'), { target: { value: '2027-01-20' } });
    await user.click(screen.getByRole('button', { name: '모집 시작하기' }));
    await waitFor(() => expect(posts()).toBe(1));
  });

  it('서버가 날짜 칸 오류를 주면 그 문장이 날짜 칸 아래에 보인다', async () => {
    server.use(
      http.post('/api/tours', () =>
        wireFail('E400', {
          errors: [{ field: 'date', reason: '방학 기간 안의 날짜만 선택할 수 있어요' }],
        }),
      ),
    );
    const { user, router } = await renderApp('/guide/tours/new', { as: 'guide' });
    await screen.findByRole('heading', { name: '어떤 하루를 보여줄까요?' });
    await fillTourForm(user);
    await user.click(screen.getByRole('button', { name: '모집 시작하기' }));
    expect(await screen.findByText('방학 기간 안의 날짜만 선택할 수 있어요')).toBeVisible();
    expect(field('날짜')).toHaveAccessibleDescription('방학 기간 안의 날짜만 선택할 수 있어요');
    expect(router.state.location.pathname).toBe('/guide/tours/new');
    // 칸을 고치면 그 칸의 오류가 사라진다
    fireEvent.change(field('날짜'), { target: { value: '2027-01-21' } });
    expect(screen.queryByText('방학 기간 안의 날짜만 선택할 수 있어요')).not.toBeInTheDocument();
  });

  it.each([
    ['종료가 시작보다 이르면', { '종료 시간': '13:00' }, '종료 시간은 시작 시간보다 늦어야 해요.'],
    ['종료가 시작과 같으면', { '종료 시간': '14:00' }, '종료 시간은 시작 시간보다 늦어야 해요.'],
    [
      '탐방이 4시간을 넘으면',
      { '시작 시간': '09:00', '종료 시간': '20:00' },
      '탐방은 4시간 이내로 잡아 주세요.',
    ],
    ['정원이 11이면', { 정원: '11' }, '모집 정원은 1~10명으로 적어 주세요.'],
    ['정원이 0이면', { 정원: '0' }, '모집 정원은 1~10명으로 적어 주세요.'],
    ['소개가 301자면', { '탐방 소개': 'ㄱ'.repeat(301) }, '300자 이내로 적어 주세요.'],
    ['연락 링크가 http면', { '연락 링크': 'http://x' }, 'https://로 시작하는 링크를 넣어 주세요.'],
  ])('%s 요청 없이 칸 아래에 알린다', async (_name, override, message) => {
    const posts = countRequests('POST', '/tours');
    const { user } = await renderApp('/guide/tours/new', { as: 'guide' });
    await screen.findByRole('heading', { name: '어떤 하루를 보여줄까요?' });
    await fillTourForm(user, override);
    await user.click(screen.getByRole('button', { name: '모집 시작하기' }));
    expect(await screen.findByText(message)).toBeVisible();
    expect(posts()).toBe(0);
  });

  it('딱 4시간은 통과한다 — 서버가 지점 시각을 60분 간격으로 깔아 코스가 탐방 안에 들어온다', async () => {
    const posts = countRequests('POST', '/tours');
    const { user } = await renderApp('/guide/tours/new', { as: 'guide' });
    await screen.findByRole('heading', { name: '어떤 하루를 보여줄까요?' });
    await fillTourForm(user, { '시작 시간': '14:00', '종료 시간': '18:00' });
    await user.click(screen.getByRole('button', { name: '모집 시작하기' }));
    await waitFor(() => expect(posts()).toBe(1));
  });

  it('빈 폼은 칸마다 안내한다(소개 · 연락 링크는 필수, 소개는 10자 하한 없음)', async () => {
    const posts = countRequests('POST', '/tours');
    const { user } = await renderApp('/guide/tours/new', { as: 'guide' });
    await screen.findByRole('heading', { name: '어떤 하루를 보여줄까요?' });
    await user.click(screen.getByRole('button', { name: '모집 시작하기' }));
    for (const message of [
      '방학 날짜를 골라 주세요.',
      '시작 시간을 골라 주세요.',
      '종료 시간을 골라 주세요.',
      '모집 정원은 1~10명으로 적어 주세요.',
      '탐방 소개를 입력해 주세요.',
      '연락 링크를 넣어 주세요.',
    ]) {
      expect(await screen.findByText(message)).toBeVisible();
    }
    expect(posts()).toBe(0);
    // 한 글자 소개도 통과한다
    await fillTourForm(user, { '탐방 소개': '안' });
    await user.click(screen.getByRole('button', { name: '모집 시작하기' }));
    await waitFor(() => expect(posts()).toBe(1));
  });

  it('모집 시작하기 연타는 요청 1번', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const posts = countRequests('POST', '/tours');
    const { user, router } = await renderApp('/guide/tours/new', { as: 'guide' });
    await screen.findByRole('heading', { name: '어떤 하루를 보여줄까요?' });
    await fillTourForm(user);
    await user.dblClick(screen.getByRole('button', { name: '모집 시작하기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours'));
    expect(posts()).toBe(1);
    expect(getDb().tours.filter((t) => t.startsAt.startsWith('2027-01-20'))).toHaveLength(1);
  });

  it('연락 링크 칸에서 한글 조합 중 Enter는 제출하지 않는다', async () => {
    const posts = countRequests('POST', '/tours');
    const { user } = await renderApp('/guide/tours/new', { as: 'guide' });
    await screen.findByRole('heading', { name: '어떤 하루를 보여줄까요?' });
    await fillTourForm(user);
    const link = field('연락 링크');
    const composing = createEvent.keyDown(link, { key: 'Enter', isComposing: true });
    fireEvent(link, composing);
    expect(composing.defaultPrevented).toBe(true);
    // 조합 중이 아닌 Enter는 제출한다(대조)
    await user.type(link, '{Enter}');
    await waitFor(() => expect(posts()).toBe(1));
  });

  it('남은 방학이 없으면 버튼 비활성 + 사유 + 내가 개설한 탐방', async () => {
    // 데이터를 부르지 않는 화면에서 시작해 가이드 학교의 방학을 모두 지난 날짜로 바꾼 뒤 들어온다.
    const { router } = await renderApp('/explore', { as: 'guide' });
    mutate((db) => {
      for (const v of db.vacations.filter((x) => x.universityId === 2)) {
        v.startDate = '2020-01-01';
        v.endDate = '2020-02-01';
      }
    });
    await router.navigate('/guide/tours/new');
    expect(await screen.findByRole('button', { name: '모집 시작하기' })).toBeDisabled();
    expect(
      screen.getByText('앞으로 열리는 방학 기간이 없어 지금은 개설할 수 없어요.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: '내가 개설한 탐방' })).toHaveAttribute(
      'href',
      '/guide/tours',
    );
  });

  it('학교를 모르면(실서버: universityId null) 재학 인증한 학교 · 날짜 안내와 방학 검사가 없고 서버가 판정한다', async () => {
    const posts = countRequests('POST', '/tours');
    const { router, user, queryClient } = await renderApp('/explore', { as: 'guide' });
    mutate((db) => {
      const guideId = db.users.find((u) => u.email === 'guide@demo.kr')!.id;
      db.guideProfiles.find((g) => g.id === guideId)!.universityId = null;
    });
    await switchAccount(queryClient, 'guide'); // 내 정보를 새로 받는다
    const campuses = countRequests('GET', '/campuses');
    await act(() => router.navigate('/guide/tours/new'));
    expect(await screen.findByText('재학 인증한 학교')).toBeVisible();
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
    expect(field('날짜')).not.toHaveAttribute('min');
    expect(field('날짜')).not.toHaveAttribute('max');
    await fillTourForm(user, { 날짜: '2027-03-10' });
    expect(screen.queryByText('방학 기간')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '모집 시작하기' }));
    // 클라이언트 검사 없이 요청이 나가고, 서버가 방학 밖 날짜를 날짜 칸 아래에 알린다.
    expect(await screen.findByText('방학 기간 안의 날짜만 선택할 수 있어요')).toBeVisible();
    expect(posts()).toBe(1);
    expect(campuses()).toBe(0); // 학교를 모르면 캠퍼스 목록을 부르지 않는다
  });

  it('NOT_VERIFIED로 거절되면 토스트 + 내 정보를 다시 읽어 막힌 상태(칩 · 비활성 · 입력 잠금)가 된다', async () => {
    const { user } = await renderApp('/guide/tours/new', { as: 'guide' });
    await screen.findByRole('heading', { name: '어떤 하루를 보여줄까요?' });
    await fillTourForm(user);
    expect(screen.queryByText('재학 인증 승인 필요')).not.toBeInTheDocument();
    // 화면이 열린 뒤 인증이 반려됐다(다른 기기).
    mutate((db) => {
      const id = db.users.find((u) => u.email === 'guide@demo.kr')!.id;
      db.verifications.find((v) => v.id === id)!.status = 'REJECTED';
    });
    server.use(http.post('/api/tours', () => wireFail('E403_VERIFICATION_REQUIRED')));
    await user.click(screen.getByRole('button', { name: '모집 시작하기' }));
    expect(await screen.findByText('재학 인증 승인 필요')).toBeVisible();
    expect(screen.getByText('재학 인증이 승인된 뒤에 할 수 있어요.')).toBeInTheDocument(); // 토스트
    expect(screen.getByRole('button', { name: '모집 시작하기' })).toBeDisabled();
    expect(field('정원')).toBeDisabled();
    expect(screen.getByRole('link', { name: '역할 인증 단계로 이동' })).toHaveAttribute(
      'href',
      '/guide/verify',
    );
  });

  it('막힌 가이드는 캠퍼스 목록을 부르지 않는다(대조: 막히지 않은 가이드는 1번 부른다)', async () => {
    // 데이터를 부르지 않는 화면에서 시작해, 이 화면이 부르는 요청만 센다.
    const blocked = await renderApp('/explore', { as: 'guide-new@demo.kr' });
    const campuses = countRequests('GET', '/campuses');
    await blocked.router.navigate('/guide/tours/new');
    expect(await screen.findByText('재학 인증 승인 필요')).toBeVisible();
    expect(campuses()).toBe(0);
  });

  it('막히지 않은 가이드는 캠퍼스 목록을 1번 부른다(막힌 가이드 테스트의 대조)', async () => {
    const open = await renderApp('/explore', { as: 'guide' });
    const campuses = countRequests('GET', '/campuses');
    await open.router.navigate('/guide/tours/new');
    expect(await screen.findByText('경희대학교 국제캠퍼스')).toBeVisible();
    expect(campuses()).toBe(1);
  });
});

describe('G09 탐방 완료 (guide-s07)', () => {
  it('V2 문구: 카드 · 단계 · 캡션 · 버튼', async () => {
    await renderApp('/guide/tours/1/complete', { as: 'guide', checkpoint: 'CONFIRMED' });
    expect(await screen.findByRole('heading', { name: '탐방을 마쳤나요?' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: '탐방 종료 · 완료 처리' })).toBeVisible();
    expect(screen.getByText('실제 진행이 끝난 후 완료 처리해 주세요.')).toBeVisible();
    expect(screen.getByText('진행 중')).toBeVisible();
    expect(screen.getByText(GUIDE_TOUR_TITLE)).toBeVisible();
    expect(screen.getByText(/^\d\d\.\d\d \([월화수목금토일]\) · 14:00–16:30$/)).toBeVisible();
    const approved = getDb().applications.filter((a) => a.tourId === 1 && a.status === 'APPROVED');
    const stops = getDb().courseStops.filter((c) => c.tourId === 1).length;
    expect(screen.getByText(`참가자 ${approved.length}명 · 코스 ${stops}개 장소`)).toBeVisible();
    expect(screen.getByText('탐방이 실제로 종료됐는지 확인')).toBeVisible();
    expect(screen.getByText('완료 시 참가자에게 리뷰 작성 안내')).toBeVisible();
    expect(screen.getByText('가이드의 지난 탐방 목록에 저장')).toBeVisible();
    expect(screen.getByText('완료 처리 후에는 참가자의 리뷰 작성이 가능해져요.')).toBeVisible();
    expect(screen.getByRole('button', { name: '탐방 완료 처리' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
  });

  it('탐방 1(오늘)을 완료하면 토스트 + 지난 탐방 탭에 그 탐방', async () => {
    const { user, router } = await renderApp('/guide/tours/1/complete', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    await user.click(await screen.findByRole('button', { name: '탐방 완료 처리' }));
    expect(await screen.findByText('탐방을 완료 처리했어요.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours'));
    expect(router.state.location.search).toBe('?tab=past');
    expect(await screen.findByRole('tab', { name: '지난 탐방', selected: true })).toBeVisible();
    const card = (await screen.findAllByRole('article')).find((a) =>
      a.textContent?.includes('완료'),
    )!;
    expect(within(card).getByRole('heading', { name: GUIDE_TOUR_TITLE })).toBeInTheDocument();
    expect(getDb().tours.find((t) => t.id === 1)!.status).toBe('COMPLETED');
  });

  it('탐방 6(날짜 전)은 비활성 + 날짜 사유 + 신청자 관리로 이동', async () => {
    await renderApp('/guide/tours/6/complete', { as: 'guide' });
    const tour6 = getDb().tours.find((t) => t.id === 6)!;
    expect(await screen.findByRole('button', { name: '탐방 완료 처리' })).toBeDisabled();
    expect(
      screen.getByText(`탐방 날짜(${formatShortDate(tour6.startsAt)}) 이후에 완료할 수 있어요.`),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: '신청자 관리로 이동' })).toHaveAttribute(
      'href',
      '/guide/tours/6/applicants',
    );
  });

  it('탐방 7(이미 완료)은 비활성 + 사유 + 내가 개설한 탐방', async () => {
    await renderApp('/guide/tours/7/complete', { as: 'guide' });
    expect(await screen.findByRole('button', { name: '탐방 완료 처리' })).toBeDisabled();
    expect(screen.getByText('이미 완료된 탐방이에요.')).toBeVisible();
    expect(screen.getByRole('link', { name: '내가 개설한 탐방' })).toHaveAttribute(
      'href',
      '/guide/tours',
    );
  });

  it('탐방 완료 처리 연타는 요청 1번', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const posts = countRequests('POST', '/tours/1/complete');
    const { user, router } = await renderApp('/guide/tours/1/complete', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    await user.dblClick(await screen.findByRole('button', { name: '탐방 완료 처리' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours'));
    expect(posts()).toBe(1);
  });

  it('남의 탐방(탐방 3은 다른 가이드)은 안내 + 내가 개설한 탐방', async () => {
    await renderApp('/guide/tours/3/complete', { as: 'guide' });
    expect(await screen.findByText('이 작업을 할 권한이 없어요.')).toBeVisible();
    expect(screen.getByRole('link', { name: '내가 개설한 탐방' })).toHaveAttribute(
      'href',
      '/guide/tours',
    );
    expect(screen.queryByRole('button', { name: '탐방 완료 처리' })).not.toBeInTheDocument();
  });

  it('막힌 상태에서는 `진행 중` 칩 대신 탐방 상태 칩이 보인다', async () => {
    await renderApp('/guide/tours/7/complete', { as: 'guide' });
    await screen.findByRole('button', { name: '탐방 완료 처리' });
    expect(screen.queryByText('진행 중')).not.toBeInTheDocument();
    expect(screen.getByText('완료')).toBeVisible();
  });

  it('날짜 전 탐방(6)의 칩은 `모집 중`이다(`진행 중`이 아니다)', async () => {
    await renderApp('/guide/tours/6/complete', { as: 'guide' });
    await screen.findByRole('button', { name: '탐방 완료 처리' });
    expect(screen.queryByText('진행 중')).not.toBeInTheDocument();
    expect(screen.getByText('모집 중')).toBeVisible();
  });

  it.each([
    ['COMPLETED', '이미 완료된 탐방이에요.', '이미 완료된 탐방이에요.'],
    ['CANCELED', '이미 처리된 요청이에요.', '취소된 탐방은 완료할 수 없어요.'],
  ] as const)(
    '서버가 E409_INVALID_TOUR_STATUS로 거절하고 탐방이 %s이면 세분한 토스트 + 다시 읽은 뒤 비활성 + 사유',
    async (status, toast, reason) => {
      const { user, router } = await renderApp('/guide/tours/1/complete', {
        as: 'guide',
        checkpoint: 'CONFIRMED',
      });
      const done = await screen.findByRole('button', { name: '탐방 완료 처리' });
      expect(done).toBeEnabled();
      mutate((db) => {
        db.tours.find((t) => t.id === 1)!.status = status;
      });
      server.use(
        http.post('/api/tours/:tourId/complete', () => wireFail('E409_INVALID_TOUR_STATUS')),
      );
      await user.click(done);
      // 토스트와 (같은 문장일 수 있는) 사유 줄이 함께 보인다.
      expect((await screen.findAllByText(toast)).length).toBeGreaterThan(0);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '탐방 완료 처리' })).toBeDisabled(),
      );
      expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
      expect(screen.queryByText('진행 중')).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/guide/tours/1/complete');
    },
  );

  it('탐방 날짜 전이면(모집 중) 토스트 `탐방 날짜 이후에 완료할 수 있어요.` + 다시 읽은 뒤 비활성 + 날짜 사유', async () => {
    const { user } = await renderApp('/guide/tours/1/complete', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    const done = await screen.findByRole('button', { name: '탐방 완료 처리' });
    expect(done).toBeEnabled();
    // 화면이 열린 뒤 탐방 날짜가 뒤로 밀렸다(다른 기기에서 고침).
    const later = getDb().tours.find((t) => t.id === 6)!.startsAt;
    mutate((db) => {
      db.tours.find((t) => t.id === 1)!.startsAt = later;
    });
    server.use(
      http.post('/api/tours/:tourId/complete', () => wireFail('E409_INVALID_TOUR_STATUS')),
    );
    await user.click(done);
    expect(await screen.findByText('탐방 날짜 이후에 완료할 수 있어요.')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '탐방 완료 처리' })).toBeDisabled(),
    );
    expect(
      screen.getByText(`탐방 날짜(${formatShortDate(later)}) 이후에 완료할 수 있어요.`),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: '신청자 관리로 이동' })).toHaveAttribute(
      'href',
      '/guide/tours/1/applicants',
    );
  });
});

describe('G10 탐방 취소 (guide-a04)', () => {
  it('V2 문구: 경고 카드 · 취소 대상 카드 · 캡션 · 두 버튼', async () => {
    await renderApp('/guide/tours/1/cancel', { as: 'guide', checkpoint: 'CONFIRMED' });
    expect(await screen.findByRole('heading', { name: '탐방을 취소할까요?' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: '탐방 취소 확인' })).toBeVisible();
    expect(screen.getByText('참가자에게 취소 안내가 전달돼요.')).toBeVisible();
    expect(screen.getByText('탐방 전체가 취소돼요')).toBeVisible();
    expect(screen.getByText('승인된 신청과 발급된 쿠폰도 함께 무효화돼요.')).toBeVisible();
    expect(screen.getByText('취소 대상')).toBeVisible();
    expect(screen.getByText(GUIDE_TOUR_TITLE)).toBeVisible();
    const approved = getDb().applications.filter((a) => a.tourId === 1 && a.status === 'APPROVED');
    expect(
      screen.getByText(
        new RegExp(`^\\d\\d\\.\\d\\d \\([월화수목금토일]\\) · 참가자 ${approved.length}명$`),
      ),
    ).toBeVisible();
    expect(
      screen.getByText('취소 후 같은 일정으로 복구하려면 새 탐방을 개설해야 해요.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '탐방 취소 확정' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '돌아가기' })).toBeEnabled();
  });

  it('돌아가기: 주소로 바로 들어왔으면 내가 개설한 탐방, 이전 화면이 있으면 거기로', async () => {
    const first = await renderApp('/guide/tours/1/cancel', { as: 'guide' });
    await first.user.click(await screen.findByRole('button', { name: '돌아가기' }));
    expect(first.router.state.location.pathname).toBe('/guide/tours');
  });

  it('돌아가기: 이전 화면이 있으면 거기로', async () => {
    const { user, router } = await renderApp('/guide/tours/1/applicants', { as: 'guide' });
    await router.navigate('/guide/tours/1/cancel');
    await user.click(await screen.findByRole('button', { name: '돌아가기' }));
    expect(router.state.location.pathname).toBe('/guide/tours/1/applicants');
  });

  it('CONFIRMED 탐방 1을 취소하면 토스트 + 목록, 학생에게는 취소됨 카드와 만료 쿠폰으로 보인다 (Review Focus 5)', async () => {
    const { user, router, queryClient } = await renderApp('/guide/tours/1/cancel', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    const applicationId = findApplicationId('student@demo.kr', 1);
    await user.click(await screen.findByRole('button', { name: '탐방 취소 확정' }));
    expect(await screen.findByText('탐방을 취소했어요.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours'));
    expect(router.state.location.search).toBe('');

    await switchAccount(queryClient, 'student@demo.kr');
    await act(() => router.navigate('/my-tours?tab=past'));
    const record = await screen.findByRole('link', { name: '탐방 기록 보기' });
    expect(record).toHaveAttribute('href', `/my-tours/${applicationId}`);
    const detail = record.closest('article')!;
    expect(within(detail).getByText('취소됨')).toBeInTheDocument();

    await act(() => router.navigate(`/my-tours/${applicationId}/coupons`));
    const coupons = await screen.findAllByRole('link', { name: /할인/ });
    expect(coupons.length).toBeGreaterThan(0);
    for (const coupon of coupons) {
      expect(within(coupon).getByText(couponStateLabel('EXPIRED', null))).toBeInTheDocument();
    }
  });

  it('완료된 탐방 7은 비활성 + 사유 + 내가 개설한 탐방', async () => {
    await renderApp('/guide/tours/7/cancel', { as: 'guide' });
    expect(await screen.findByRole('button', { name: '탐방 취소 확정' })).toBeDisabled();
    expect(screen.getByText('완료된 탐방은 취소할 수 없습니다.')).toBeVisible();
    expect(screen.getByRole('link', { name: '내가 개설한 탐방' })).toHaveAttribute(
      'href',
      '/guide/tours',
    );
  });

  it('탐방 취소 확정 연타는 요청 1번이고 처리 중에는 돌아가기도 잠긴다', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const posts = countRequests('POST', '/tours/1/cancel');
    const { user, router } = await renderApp('/guide/tours/1/cancel', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    const confirm = await screen.findByRole('button', { name: '탐방 취소 확정' });
    await user.click(confirm);
    expect(screen.getByRole('button', { name: '돌아가기' })).toBeDisabled();
    await user.click(confirm);
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours'));
    expect(posts()).toBe(1);
  });

  it('남의 탐방은 안내 + 내가 개설한 탐방', async () => {
    await renderApp('/guide/tours/3/cancel', { as: 'guide' });
    expect(await screen.findByText('이 작업을 할 권한이 없어요.')).toBeVisible();
    expect(screen.getByRole('link', { name: '내가 개설한 탐방' })).toHaveAttribute(
      'href',
      '/guide/tours',
    );
  });

  it('막힌 상태에서는 `취소 대상` 칩 대신 탐방 상태 칩이 보인다', async () => {
    await renderApp('/guide/tours/7/cancel', { as: 'guide' });
    await screen.findByRole('button', { name: '탐방 취소 확정' });
    expect(screen.queryByText('취소 대상')).not.toBeInTheDocument();
    expect(screen.getByText('완료')).toBeVisible();
  });

  it.each([
    ['COMPLETED', '이미 완료된 탐방이에요.', '완료된 탐방은 취소할 수 없습니다.'],
    ['CANCELED', '이미 처리된 요청이에요.', '이미 취소된 탐방이에요.'],
  ] as const)(
    '서버가 E409_INVALID_TOUR_STATUS로 거절하고 탐방이 %s이면 세분한 토스트 + 다시 읽은 뒤 비활성 + 사유',
    async (status, toast, reason) => {
      const { user, router } = await renderApp('/guide/tours/1/cancel', {
        as: 'guide',
        checkpoint: 'CONFIRMED',
      });
      const confirm = await screen.findByRole('button', { name: '탐방 취소 확정' });
      expect(confirm).toBeEnabled();
      // 다른 기기에서 먼저 처리했다.
      mutate((db) => {
        db.tours.find((t) => t.id === 1)!.status = status;
      });
      server.use(
        http.post('/api/tours/:tourId/cancel', () => wireFail('E409_INVALID_TOUR_STATUS')),
      );
      await user.click(confirm);
      expect((await screen.findAllByText(toast)).length).toBeGreaterThan(0);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '탐방 취소 확정' })).toBeDisabled(),
      );
      expect(screen.getByText(reason)).toBeVisible();
      expect(screen.queryByText('취소 대상')).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/guide/tours/1/cancel');
    },
  );

  it('모집 중인데 409가 오면 `이미 처리된 요청이에요.` 토스트이고 다시 읽어도 서버 기준으로 켜져 있다', async () => {
    const { user } = await renderApp('/guide/tours/1/cancel', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    const confirm = await screen.findByRole('button', { name: '탐방 취소 확정' });
    server.use(http.post('/api/tours/:tourId/cancel', () => wireFail('E409_INVALID_TOUR_STATUS')));
    await user.click(confirm);
    expect(await screen.findByText('이미 처리된 요청이에요.')).toBeInTheDocument();
    // 요청이 끝나면 잠금이 풀린다(버튼이 로딩에 갇히지 않는다).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '탐방 취소 확정' })).toBeEnabled(),
    );
  });
});
