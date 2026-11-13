import { act, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { mutate } from '@/mocks/db/store';
import { nextId } from '@/mocks/db/ids';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { errorMessage } from '@/shared/lib/errors';
import { TOUR_DETAIL } from '@/test/fixtures/backend/tours';
import { renderApp } from '@/test/renderApp';
import { wireFail, wireOk } from '@/test/wire';

afterEach(() => {
  server.events.removeAllListeners('request:start');
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

const G03_TITLE = '코스를 완성해 볼까요?';
const PICK = '/guide/tours/1/course/stops/pick';
const EDIT = '/guide/tours/1/course/edit';
/** 시드 상점 1 · 2의 AI 리뷰 요약(가장 최근 행). */
const SUMMARY_1 =
  '학생들은 양이 넉넉하고 사장님이 친절하다고 해요. 시험 기간엔 줄이 길다는 평이 있어요.';
const SUMMARY_2 = '콘센트 자리가 많아 과제하기 좋다는 평이 많아요. 디저트는 일찍 떨어진대요.';

const stopList = () => screen.getByRole('list', { name: '코스 지점' });

/** G03 지점 카드를 위에서부터 `{시간} {이름}`으로. */
const stopRows = () =>
  within(stopList())
    .getAllByRole('listitem')
    .map((li) => {
      const time = within(li).getByText(/^\d{2}:\d{2}$/).textContent;
      return `${time} ${within(li).getByRole('heading').textContent}`;
    });

/** 후보 목록(상점 · 캠퍼스 장소)의 카드 이름을 위에서부터. */
const candidateNames = (list: HTMLElement) =>
  within(list)
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-labelledby'))
    .map((id) => document.getElementById(id!)!.textContent);

/** 이름이 정확히 그것인 후보 카드(카드 전체가 선택 버튼이고, 이름이 버튼 이름이다). */
const card = (name: string) => screen.getByRole('button', { name });

/** 승인자가 있는 탐방 1(경희대 국제캠퍼스)에서 AI 초안(예술·디자인대학 · 렌토 · 타임리스커피)을 만들어 G03을 연다. */
async function openCourse() {
  const result = await renderApp('/guide/tours/1/course/draft?generate=1', {
    as: 'guide',
    checkpoint: 'APPROVED',
  });
  await screen.findByRole('heading', { name: G03_TITLE });
  return result;
}

/** G03에서 그 지점의 id(`≡` 버튼의 `data-stop-id`). */
const stopIdOf = (name: string) =>
  Number(screen.getByRole('button', { name: `${name} 편집` }).dataset.stopId);

/** 초안을 만든 뒤 G07을 그 검색어로 연다. */
async function openPick(search: string) {
  const result = await openCourse();
  await result.router.navigate(`${PICK}?${search}`);
  return result;
}

/** 초안을 만든 뒤 그 지점의 교체 화면을 연다. */
async function openReplace(name: string) {
  const result = await openCourse();
  await result.router.navigate(`${PICK}?mode=replace&stopId=${stopIdOf(name)}`);
  return result;
}

/** 목업 DB의 탐방 1 코스 끝에 캠퍼스 건물 지점을 더하고(경희대 4 중앙도서관 · 5 학생회관) 가이드 코스를 다시 받는다. */
async function appendCampusStops(
  queryClient: Awaited<ReturnType<typeof openCourse>>['queryClient'],
  buildingIds: number[],
) {
  mutate((db) => {
    for (const campusBuildingId of buildingIds) {
      db.courseStops.push({
        id: nextId(db),
        tourId: 1,
        stopType: 'CAMPUS',
        campusBuildingId,
        storeId: null,
        partnershipId: null,
        stopOrder: db.courseStops.filter((s) => s.tourId === 1).length + 1,
        visitTime: null,
        description: null,
        recommendationReason: null,
      });
    }
  });
  await act(() => queryClient.invalidateQueries({ queryKey: qk.guideCourse(1) }));
}

/** 스팟 PUT(`PUT /tours/{tourId}/course/spots`) 수를 센다. */
function countSpotPuts() {
  const counter = { puts: 0 };
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'PUT' && new URL(request.url).pathname === '/api/tours/1/course/spots') {
      counter.puts++;
    }
  });
  return counter;
}

/** 캠퍼스 장소 목록(`GET /campuses/{id}/places`) 요청 수를 센다. */
function countCampusPlaceGets() {
  const counter = { gets: 0 };
  server.events.on('request:start', ({ request }) => {
    if (/^\/api\/campuses\/[^/]+\/places$/.test(new URL(request.url).pathname)) counter.gets++;
  });
  return counter;
}

describe('코스 장소 고르기 G07 (guide-a03) — 교체', () => {
  it('상점 지점 교체: 탭 없이 가까운 주변 상점, 지금 지점 · 코스에 있음은 고를 수 없고, 고른 상점이 같은 자리 · 같은 시각에 들어간다', async () => {
    const { user, router } = await openReplace('렌토');

    expect(await screen.findByRole('heading', { level: 1, name: '코스 장소 교체' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: '장소를 바꿔볼까요?' })).toBeVisible();
    expect(screen.getByText('학생들의 하고 싶은 것과 연결되는 곳을 골라요.')).toBeVisible();
    // 교체는 그 지점 유형(상점)의 목록만 — 탭이 없다
    expect(screen.queryByRole('tablist')).toBeNull();
    const search = screen.getByRole('searchbox', { name: '주변 상점 검색' });
    expect(search).toHaveAttribute('placeholder', '문화체험 · 동네 카페 · 점심');
    expect(screen.getByRole('heading', { name: '가까운 주변 상점' })).toBeVisible();

    // 캠퍼스 중심에서 가까운 순(2B′-R15), 같은 거리면 이름 순: 캠퍼스 안 매장 14곳(대학 주소의 두 좌표, 186 · 188m) →
    // 타임리스커피 570m · 케이크하리 581m · 천겹의속삭임 584m · 렌토 598m … 땡큐꼬마김밥 791m(31번째)
    const list = await screen.findByRole('list', { name: '후보 상점' });
    const names = candidateNames(list);
    expect(names).toHaveLength(106);
    expect(names.slice(0, 20)).toEqual([
      '뉴욕버거경희대국제캠퍼스점',
      '달콤커피경희대국제캠퍼스점',
      '달콤한위로경희대국제캠퍼스점',
      '미스터라멘경희대국제캠퍼스점',
      '쑝쑝돈까스경희대국제캠퍼스점',
      '카페3',
      '컴포즈커피경희대국제캠퍼스기숙사점',
      '컴포즈커피경희외국어대학관점',
      '컴포즈커피경희전자국제점',
      '콩스',
      '투썸플레이스경희대국제캠퍼스',
      '꾸이한끼경희대국제캠퍼스점',
      '마라중심',
      '청년찌개경희대국제캠퍼스점',
      '타임리스커피',
      '케이크하리',
      '천겹의속삭임',
      '렌토',
      '사르르초코',
      '키친드마망',
    ]);
    expect(names.indexOf('땡큐꼬마김밥')).toBe(30);
    expect(card('렌토')).toBeDisabled();
    expect(card('렌토')).toHaveAccessibleDescription(/지금 지점/);
    expect(card('타임리스커피')).toBeDisabled();
    expect(card('타임리스커피')).toHaveAccessibleDescription(/코스에 있음/);
    expect(card('땡큐꼬마김밥')).toBeEnabled();
    expect(card('땡큐꼬마김밥')).toHaveAttribute('aria-pressed', 'false');
    expect(card('땡큐꼬마김밥')).toHaveAccessibleDescription(/^제휴 상점 도보 약 10분 · 분식$/);

    // 선택 전에는 적용할 수 없다(사유와 함께)
    const apply = screen.getByRole('button', { name: '이 장소로 교체' });
    expect(apply).toBeDisabled();
    expect(apply).toHaveAccessibleDescription('후보를 하나 고르면 적용할 수 있어요.');

    await user.click(card('땡큐꼬마김밥'));
    expect(card('땡큐꼬마김밥')).toHaveAttribute('aria-pressed', 'true');
    // 사유 줄이 사라지면 Button이 감싸개 없이 다시 그려진다 — 다시 찾는다.
    const ready = screen.getByRole('button', { name: '이 장소로 교체' });
    expect(ready).toBeEnabled();
    expect(ready).not.toHaveAccessibleDescription();

    await user.click(ready);
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(EDIT);
    expect(router.state.historyAction).toBe('REPLACE');
    expect(await screen.findByText('코스에 반영했어요.')).toBeInTheDocument();
    expect(stopRows()).toEqual([
      '14:00 예술·디자인대학',
      '15:10 땡큐꼬마김밥',
      '16:00 타임리스커피',
    ]);
  });

  it('상점 카드: 제휴 · 일반 칩, `도보 약 N분 · 업종`, AI 리뷰 요약이 있으면 `✦ {요약}` 한 줄 — 학생 요청 줄은 없다', async () => {
    const { router } = await openCourse();
    // 오늘 유효한 제휴가 없는 상점은 일반 상점이다(상점 4의 제휴를 끝낸다).
    mutate((db) => {
      db.partnerships = db.partnerships.filter((p) => p.storeId !== 4);
    });
    await router.navigate(`${PICK}?mode=replace&stopId=${stopIdOf('렌토')}`);
    const list = await screen.findByRole('list', { name: '후보 상점' });

    const item = (name: string) => card(name).closest('li')!;
    const [cafe, meal, snack, hansik] = ['타임리스커피', '렌토', '땡큐꼬마김밥', '모모식당'].map(
      item,
    );
    expect(cafe).toHaveTextContent('제휴 상점');
    expect(cafe).toHaveTextContent('도보 약 8분 · 카페');
    expect(cafe).toHaveTextContent(`✦ ${SUMMARY_2}`);
    expect(meal).toHaveTextContent('도보 약 8분 · 양식');
    expect(meal).toHaveTextContent(`✦ ${SUMMARY_1}`);
    // 리뷰가 없으면 요약 줄이 없다
    expect(snack).toHaveTextContent('제휴 상점');
    expect(snack).not.toHaveTextContent('✦');
    expect(hansik).toHaveTextContent('일반 상점');
    expect(hansik).toHaveTextContent('도보 약 10분 · 한식');
    // 실데이터 상점(맨 앞, 캠퍼스 안 186m)은 사장님 · 제휴 · 리뷰가 없는 일반 상점이다
    const [first] = within(list).getAllByRole('listitem');
    expect(first).toBe(item('뉴욕버거경희대국제캠퍼스점'));
    expect(first).toHaveTextContent('일반 상점');
    expect(first).toHaveTextContent('도보 약 3분 · 양식');
    expect(first).not.toHaveTextContent('✦');
    // 요약은 화면 낭독기에 AI 결과로 읽힌다
    expect(within(meal).getByText('AI 리뷰 요약:')).toHaveClass('sr-only');
    expect(within(list).queryByText(/학생 요청/)).toBeNull();
    expect(screen.queryByText(/학생 요청/)).toBeNull();
  });

  it('캠퍼스 지점 교체는 캠퍼스 장소 목록만(탭 없음) — 고른 건물이 같은 자리에 들어간다', async () => {
    const { user, router } = await openReplace('예술·디자인대학');
    expect(await screen.findByRole('heading', { level: 1, name: '코스 장소 교체' })).toBeVisible();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('list', { name: '후보 상점' })).toBeNull();
    const search = screen.getByRole('searchbox', { name: '캠퍼스 장소 검색' });
    expect(search).toHaveAttribute('placeholder', '도서관 · 학생회관');
    expect(screen.getByRole('heading', { name: '캠퍼스 장소' })).toBeVisible();

    const list = await screen.findByRole('list', { name: '후보 캠퍼스 장소' });
    expect(candidateNames(list)).toEqual(['예술·디자인대학', '중앙도서관', '학생회관']);
    expect(card('예술·디자인대학')).toBeDisabled();
    expect(card('예술·디자인대학')).toHaveAccessibleDescription(/지금 지점/);
    expect(card('학생회관')).toHaveAccessibleDescription(
      /^캠퍼스 학생식당과 동아리방이 있는 건물$/,
    );

    await user.click(card('학생회관'));
    await user.click(screen.getByRole('button', { name: '이 장소로 교체' }));
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(EDIT);
    expect(stopRows()).toEqual(['14:00 학생회관', '15:10 렌토', '16:00 타임리스커피']);
  });

  it('교체를 연타해도 스팟 PUT은 한 번이고, 적용 중에는 카드 · 버튼이 잠긴다', async () => {
    const { user, router } = await openReplace('렌토');
    await screen.findByRole('list', { name: '후보 상점' });
    setMockLatency({ base: 150, ai: 0 });
    const counter = countSpotPuts();
    await user.click(card('땡큐꼬마김밥'));
    await user.dblClick(screen.getByRole('button', { name: '이 장소로 교체' }));
    expect(screen.getByRole('button', { name: '이 장소로 교체' })).toBeDisabled();
    expect(card('모모식당')).toBeDisabled();
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(EDIT);
    expect(counter.puts).toBe(1);
    expect(stopRows()).toEqual([
      '14:00 예술·디자인대학',
      '15:10 땡큐꼬마김밥',
      '16:00 타임리스커피',
    ]);
  });

  it('교체가 실패하면 오류 토스트, 선택은 남고 화면에 머문다', async () => {
    const { user, router } = await openReplace('렌토');
    await screen.findByRole('list', { name: '후보 상점' });
    const url = router.state.location.pathname + router.state.location.search;
    server.use(http.put('/api/tours/:tourId/course/spots', () => wireFail('E500'), { once: true }));
    await user.click(card('땡큐꼬마김밥'));
    await user.click(screen.getByRole('button', { name: '이 장소로 교체' }));
    expect(await screen.findByText(errorMessage('UNKNOWN'))).toBeInTheDocument();
    expect(router.state.location.pathname + router.state.location.search).toBe(url);
    expect(card('땡큐꼬마김밥')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '이 장소로 교체' })).toBeEnabled(),
    );
  });

  it('코스에 없는 지점 id · stopId 없는 교체 주소는 안내와 코스 편집으로', async () => {
    const { router } = await openPick('mode=replace&stopId=999');
    expect(await screen.findByText('바꿀 지점을 찾을 수 없어요')).toBeVisible();
    expect(screen.getByText('코스 편집에서 다시 골라 주세요.')).toBeVisible();
    expect(screen.getByRole('link', { name: '코스 편집으로 돌아가기' })).toHaveAttribute(
      'href',
      EDIT,
    );
    expect(screen.queryByRole('button', { name: '이 장소로 교체' })).toBeNull();

    await router.navigate(`${PICK}?mode=replace`);
    expect(await screen.findByText('바꿀 지점을 찾을 수 없어요')).toBeVisible();
  });
});

describe('코스 장소 고르기 G07 — 추가', () => {
  it('추가: 주변 상점 · 캠퍼스 장소 탭(주소와 동기) → 중앙도서관 → 이 장소 추가 → 지점 4개 · 끝이 중앙도서관', async () => {
    let nearbyGets = 0;
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/stores/nearby') nearbyGets++;
    });
    const { user, router } = await openPick('mode=add');

    expect(await screen.findByRole('heading', { level: 1, name: '코스 장소 추가' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: '장소를 추가해 볼까요?' })).toBeVisible();
    const tabs = screen.getByRole('tablist', { name: '장소 종류' });
    expect(within(tabs).getByRole('tab', { name: '주변 상점' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('list', { name: '후보 상점' })).toBeVisible();
    // 양성 대조: 학교를 알면 주변 상점을 한 번 부른다(아래 universityId 0 테스트의 0번과 짝)
    expect(nearbyGets).toBe(1);
    expect(screen.getByRole('tabpanel', { name: '주변 상점' })).toBeVisible();

    await user.click(within(tabs).getByRole('tab', { name: '캠퍼스 장소' }));
    expect(router.state.location.search).toBe('?mode=add&tab=campus');
    expect(within(tabs).getByRole('tab', { name: '캠퍼스 장소' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('searchbox', { name: '캠퍼스 장소 검색' })).toBeVisible();
    const list = await screen.findByRole('list', { name: '후보 캠퍼스 장소' });
    expect(candidateNames(list)).toEqual(['예술·디자인대학', '중앙도서관', '학생회관']);
    // 코스에 있는 캠퍼스 건물은 고를 수 없다
    expect(card('예술·디자인대학')).toBeDisabled();
    expect(card('예술·디자인대학')).toHaveAccessibleDescription(/코스에 있음/);

    await user.click(card('중앙도서관'));
    await user.click(screen.getByRole('button', { name: '이 장소 추가' }));
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(EDIT);
    expect(screen.getByRole('heading', { name: '일정 · 4개 장소' })).toBeInTheDocument();
    expect(stopRows()).toEqual([
      '14:00 예술·디자인대학',
      '15:10 렌토',
      '16:00 타임리스커피',
      '16:15 중앙도서관',
    ]);
  });

  it('탭을 바꾸면 고른 후보가 지워져 보이지 않는 장소를 추가하지 못하고, 돌아와도 눌린 카드가 없다', async () => {
    const { user } = await openPick('mode=add');
    await screen.findByRole('list', { name: '후보 상점' });
    await user.click(card('땡큐꼬마김밥'));
    expect(screen.getByRole('button', { name: '이 장소 추가' })).toBeEnabled();

    await user.click(screen.getByRole('tab', { name: '캠퍼스 장소' }));
    const campusList = await screen.findByRole('list', { name: '후보 캠퍼스 장소' });
    expect(within(campusList).queryAllByRole('button', { pressed: true })).toHaveLength(0);
    const add = screen.getByRole('button', { name: '이 장소 추가' });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription('후보를 하나 고르면 적용할 수 있어요.');

    await user.click(screen.getByRole('tab', { name: '주변 상점' }));
    const storeList = await screen.findByRole('list', { name: '후보 상점' });
    expect(within(storeList).queryAllByRole('button', { pressed: true })).toHaveLength(0);
    expect(card('땡큐꼬마김밥')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '이 장소 추가' })).toBeDisabled();
  });

  it('`?tab=campus`로 들어오면 캠퍼스 장소 탭, 모르는 탭 값은 주변 상점', async () => {
    const counter = countCampusPlaceGets();
    const { router } = await openPick('mode=add&tab=campus');
    expect(await screen.findByRole('list', { name: '후보 캠퍼스 장소' })).toBeVisible();
    // 양성 대조: 학교를 알면 캠퍼스 장소를 한 번 부른다(아래 universityId 0 테스트의 0번과 짝)
    expect(counter.gets).toBe(1);
    expect(screen.getByRole('tab', { name: '캠퍼스 장소' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await router.navigate(`${PICK}?mode=add&tab=nope`);
    expect(await screen.findByRole('list', { name: '후보 상점' })).toBeVisible();
    expect(screen.getByRole('tab', { name: '주변 상점' })).toHaveAttribute('aria-selected', 'true');
  });

  it('검색: 이름 · 업종 부분 일치, 0건이면 안내와 `검색어 지우기`, 고른 후보는 검색으로 가려져도 선택이 남는다', async () => {
    const { user } = await openPick('mode=add');
    const list = await screen.findByRole('list', { name: '후보 상점' });
    const search = screen.getByRole('searchbox', { name: '주변 상점 검색' });

    await user.click(card('땡큐꼬마김밥'));
    await user.type(search, '커피'); // 이름에서
    expect(candidateNames(list)).toEqual([
      '달콤커피경희대국제캠퍼스점',
      '컴포즈커피경희대국제캠퍼스기숙사점',
      '컴포즈커피경희외국어대학관점',
      '컴포즈커피경희전자국제점',
      '타임리스커피',
      '서천커피클락',
      '매머드커피익스프레스삼성전자TheuniverSE점',
      '메가엠지씨커피용인서천 파크원점',
      '메가엠지씨커피용인서천 마을점',
      '컴포즈커피용인서천 마을점',
    ]);
    // 고른 꼬마김밥은 가려졌지만 선택은 남아 적용할 수 있다
    expect(screen.getByRole('button', { name: '이 장소 추가' })).toBeEnabled();

    await user.clear(search);
    await user.type(search, '분식'); // 업종에서
    expect(candidateNames(list)).toEqual([
      '땡큐꼬마김밥',
      '하우스크림',
      '김밥엔떡볶이',
      '김밥엔떡볶이',
      '김가네용인서천점',
      '푸드플랙스',
      '봉구스밥버거',
    ]);
    expect(card('땡큐꼬마김밥')).toHaveAttribute('aria-pressed', 'true');

    await user.clear(search);
    await user.type(search, '없는가게');
    expect(screen.queryByRole('list', { name: '후보 상점' })).toBeNull();
    expect(screen.getByText("'없는가게'에 맞는 상점이 없어요")).toBeVisible();
    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(candidateNames(screen.getByRole('list', { name: '후보 상점' }))).toHaveLength(106);
    expect(card('땡큐꼬마김밥')).toHaveAttribute('aria-pressed', 'true');
  });

  it('캠퍼스 장소 검색은 이름 · 설명에서 찾는다', async () => {
    const { user } = await openPick('mode=add&tab=campus');
    const list = await screen.findByRole('list', { name: '후보 캠퍼스 장소' });
    await user.type(screen.getByRole('searchbox', { name: '캠퍼스 장소 검색' }), '스터디');
    expect(candidateNames(list)).toEqual(['중앙도서관']);
    await user.clear(screen.getByRole('searchbox', { name: '캠퍼스 장소 검색' }));
    await user.type(screen.getByRole('searchbox', { name: '캠퍼스 장소 검색' }), '체육관');
    expect(screen.getByText("'체육관'에 맞는 캠퍼스 장소가 없어요")).toBeVisible();
  });

  it('지점이 5곳이면 추가 버튼은 비활성 + 상한 사유 + `코스 편집에서 지점 빼기`', async () => {
    const { user, queryClient, router } = await openCourse();
    await appendCampusStops(queryClient, [4, 5]);
    await router.navigate(`${PICK}?mode=add`);
    await screen.findByRole('list', { name: '후보 상점' });
    await user.click(card('땡큐꼬마김밥'));
    const add = screen.getByRole('button', { name: '이 장소 추가' });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription(errorMessage('COURSE_STOP_LIMIT'));
    const toEdit = screen.getByRole('link', { name: '코스 편집에서 지점 빼기' });
    expect(toEdit).toHaveAttribute('href', EDIT);
  });

  it('고를 후보가 하나도 없으면(모두 코스에 있음 · 지금 지점) 버튼 비활성 + 사유 + 코스 편집으로', async () => {
    const { queryClient, router } = await openCourse();
    const id = stopIdOf('예술·디자인대학');
    await appendCampusStops(queryClient, [4, 5]);
    await router.navigate(`${PICK}?mode=replace&stopId=${id}`);
    await screen.findByRole('list', { name: '후보 캠퍼스 장소' });
    for (const name of ['예술·디자인대학', '중앙도서관', '학생회관']) {
      expect(card(name)).toBeDisabled();
    }
    const apply = screen.getByRole('button', { name: '이 장소로 교체' });
    expect(apply).toBeDisabled();
    expect(apply).toHaveAccessibleDescription('고를 수 있는 후보가 없어요.');
    expect(screen.getByRole('link', { name: '코스 편집으로 돌아가기' })).toHaveAttribute(
      'href',
      EDIT,
    );
  });
});

describe('코스 장소 고르기 G07 — 상태 · 이동', () => {
  it('적용을 연타해도 스팟 PUT은 한 번이고, 적용 중에는 카드 · 버튼이 잠긴다', async () => {
    const { user, router } = await openPick('mode=add');
    await screen.findByRole('list', { name: '후보 상점' });
    // 응답이 늦어야 첫 클릭의 요청이 진행 중인 채로 두 번째 클릭이 들어온다.
    setMockLatency({ base: 150, ai: 0 });
    const counter = countSpotPuts();
    await user.click(card('땡큐꼬마김밥'));
    await user.dblClick(screen.getByRole('button', { name: '이 장소 추가' }));
    expect(screen.getByRole('button', { name: '이 장소 추가' })).toBeDisabled();
    expect(card('모모식당')).toBeDisabled();
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(EDIT);
    expect(counter.puts).toBe(1);
    expect(screen.getByRole('heading', { name: '일정 · 4개 장소' })).toBeInTheDocument();
  });

  it('적용이 실패하면 오류 토스트, 선택은 남고 화면에 머문다', async () => {
    const { user, router } = await openPick('mode=add');
    await screen.findByRole('list', { name: '후보 상점' });
    server.use(http.put('/api/tours/:tourId/course/spots', () => wireFail('E500'), { once: true }));
    await user.click(card('땡큐꼬마김밥'));
    await user.click(screen.getByRole('button', { name: '이 장소 추가' }));
    expect(await screen.findByText(errorMessage('UNKNOWN'))).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(PICK);
    expect(card('땡큐꼬마김밥')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByRole('button', { name: '이 장소 추가' })).toBeEnabled());
  });

  it('그 사이 코스가 확정됐으면(409 COURSE_NOT_DRAFT) 안내 토스트 뒤 다시 읽은 코스의 확정 화면으로', async () => {
    const { user, router } = await openPick('mode=add');
    await screen.findByRole('list', { name: '후보 상점' });
    await user.click(card('땡큐꼬마김밥'));
    mutate((db) => {
      db.courses.find((c) => c.tourId === 1)!.status = 'CONFIRMED';
    });
    await user.click(screen.getByRole('button', { name: '이 장소 추가' }));
    expect(await screen.findByText(errorMessage('COURSE_NOT_DRAFT'))).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm'),
    );
  });

  it('투어 학교를 모르면(universityId 0) 목록 대신 안내 상태, 주변 상점 요청은 0번', async () => {
    let nearbyGets = 0;
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/stores/nearby') nearbyGets++;
    });
    const { queryClient, router } = await openCourse();
    // 시드 캠퍼스에 `단국대학교 죽전캠퍼스`가 있어 픽스처 그대로는 조인된다 — 없는 캠퍼스 이름으로 바꾼다(D14: 탐방 id는 주소 값).
    server.use(
      http.get('/api/tours/:tourId', ({ params }) =>
        wireOk({
          ...TOUR_DETAIL.data,
          tour_id: Number(params.tourId),
          campus_name: '없는대학교 본캠퍼스',
        }),
      ),
    );
    queryClient.removeQueries({ queryKey: qk.guideCourse(1) });
    await router.navigate(`${PICK}?mode=add`);

    expect(
      await screen.findByText('학교 정보를 찾지 못해 주변 장소를 불러올 수 없어요'),
    ).toBeVisible();
    expect(screen.getByText('코스 편집에서 다시 시도해 주세요.')).toBeVisible();
    expect(screen.getByRole('link', { name: '코스 편집으로 돌아가기' })).toHaveAttribute(
      'href',
      EDIT,
    );
    expect(screen.queryByRole('list', { name: '후보 상점' })).toBeNull();
    // 안내가 뜬 직후에는 요청이 아직 안 나간 것과 구별되지 않는다 — 잠시 기다린 뒤 센다(errata PM4).
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(nearbyGets).toBe(0);
  });

  describe('투어 학교를 모르면(universityId 0) 캠퍼스 경로도 목록 대신 안내 상태, 캠퍼스 장소 요청은 0번', () => {
    /** 시드에 없는 캠퍼스 이름으로 바꿔 학교 조인을 실패시키고(D14), 코스를 다시 읽게 한다. */
    function forgetCampus(queryClient: Awaited<ReturnType<typeof openCourse>>['queryClient']) {
      server.use(
        http.get('/api/tours/:tourId', ({ params }) =>
          wireOk({
            ...TOUR_DETAIL.data,
            tour_id: Number(params.tourId),
            campus_name: '없는대학교 본캠퍼스',
          }),
        ),
      );
      queryClient.removeQueries({ queryKey: qk.guideCourse(1) });
    }

    async function expectGuide() {
      expect(
        await screen.findByText('학교 정보를 찾지 못해 주변 장소를 불러올 수 없어요'),
      ).toBeVisible();
      expect(screen.queryByRole('list', { name: '후보 캠퍼스 장소' })).toBeNull();
      // 안내가 뜬 직후에는 요청이 아직 안 나간 것과 구별되지 않는다 — 잠시 기다린 뒤 센다(errata PM4).
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    }

    it('추가 `?mode=add&tab=campus`', async () => {
      const { queryClient, router } = await openCourse();
      const counter = countCampusPlaceGets();
      forgetCampus(queryClient);
      await router.navigate(`${PICK}?mode=add&tab=campus`);
      await expectGuide();
      expect(counter.gets).toBe(0);
    });

    it('캠퍼스 지점 교체', async () => {
      const { queryClient, router } = await openCourse();
      const id = stopIdOf('예술·디자인대학');
      const counter = countCampusPlaceGets();
      forgetCampus(queryClient);
      await router.navigate(`${PICK}?mode=replace&stopId=${id}`);
      await expectGuide();
      expect(counter.gets).toBe(0);
    });
  });

  it('후보를 못 불러오면 목록 자리에만 오류와 다시 시도', async () => {
    server.use(http.get('/api/stores/nearby', () => wireFail('E403'), { once: true }));
    const { user } = await openPick('mode=add');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(errorMessage('FORBIDDEN'));
    // 제목 · 탭 · 검색칸은 그대로다
    expect(screen.getByRole('heading', { level: 2, name: '장소를 추가해 볼까요?' })).toBeVisible();
    expect(screen.getByRole('searchbox', { name: '주변 상점 검색' })).toBeVisible();
    await user.click(within(alert).getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('list', { name: '후보 상점' })).toBeVisible();
  });

  it('AI 초안을 다시 만드는 중이면 카드 · 버튼 비활성 + 사유, 끝나면 풀린다', async () => {
    const { user, router } = await openCourse();
    // AI 응답이 늦어야 다시 만들기가 진행 중인 채로 고르기 화면에 들어올 수 있다.
    setMockLatency({ base: 0, ai: 400 });
    await user.click(screen.getByRole('button', { name: '다시 만들기' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '다시 만들기' }),
    );
    await router.navigate(`${PICK}?mode=add`);
    await screen.findByRole('list', { name: '후보 상점' });
    expect(card('땡큐꼬마김밥')).toBeDisabled();
    const add = screen.getByRole('button', { name: '이 장소 추가' });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription('AI 초안을 만드는 중이에요.');
    await waitFor(() => expect(card('땡큐꼬마김밥')).toBeEnabled());
    expect(screen.getByRole('button', { name: '이 장소 추가' })).toHaveAccessibleDescription(
      '후보를 하나 고르면 적용할 수 있어요.',
    );
  });

  it('확정된 코스로 오면 확정 화면으로 replace', async () => {
    const { router } = await renderApp(`${PICK}?mode=add`, {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    expect(await screen.findByRole('heading', { name: '코스를 확정했어요' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('코스가 없으면 초안 화면으로 replace', async () => {
    const { router } = await renderApp(`${PICK}?mode=add`, {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    expect(await screen.findByText('아직 코스 초안이 없어요')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/guide/tours/1/course/draft');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('뒤로 가기는 코스 편집으로', async () => {
    const { user, router } = await openPick('mode=add');
    await screen.findByRole('list', { name: '후보 상점' });
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(await screen.findByRole('heading', { name: G03_TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(EDIT);
  });
});
