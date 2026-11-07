import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { DEMO_BUSINESS } from '@/shared/config/demoAccounts';
import { addDaysKey, seoulDateKey } from '@/shared/lib/date';
import { renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

const OWNER_NEW = 'owner-new@demo.kr';
const OWNER_NOSTORE = 'owner-nostore@demo.kr';

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
  useDemoStore.setState({ enabled: false });
});

/** 이 메서드 · 경로(끝)로 나간 요청 수와 JSON 본문. */
function capture(method: string, pathSuffix: string): { count: () => number; bodies: unknown[] } {
  const bodies: unknown[] = [];
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.method !== method || !new URL(request.url).pathname.endsWith(pathSuffix)) return;
    count += 1;
    void request
      .clone()
      .json()
      .then((body: unknown) => bodies.push(body))
      .catch(() => undefined);
  });
  return { count: () => count, bodies };
}

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function typeInto(user: User, label: string, value: string) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
}

async function search(user: User, keyword: string) {
  await typeInto(user, '가게 이름 검색', keyword);
  await user.click(screen.getByRole('button', { name: '검색' }));
}

describe('/owner/verify 사업자 인증 (owner-s01, U-07)', () => {
  it('owner-new 첫 화면: 제목 · 칩 · 세 칸 · 결과 카드 기본 · 버튼', async () => {
    const { router } = await renderApp('/owner/verify', { as: OWNER_NEW });
    expect(
      await screen.findByRole('heading', { level: 1, name: '사업자 인증' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/owner/verify');
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).not.toBeInTheDocument();
    // 칩과 제출 버튼이 같은 문구다.
    expect(screen.getAllByText('사업자 정보 확인')).toHaveLength(2);
    const number = screen.getByLabelText('사업자등록번호');
    expect(number).toHaveAttribute('inputmode', 'numeric');
    expect(number).toHaveAttribute('maxlength', '12');
    expect(screen.getByText("'-' 없이 숫자 10자리로 적어도 돼요.")).toBeInTheDocument();
    expect(screen.getByLabelText('대표자명')).toBeInTheDocument();
    const opened = screen.getByLabelText('개업일자');
    expect(opened).toHaveAttribute('type', 'date');
    expect(opened).toHaveAttribute('max', seoulDateKey(new Date()));
    expect(screen.getByText('국세청 진위확인 API 연동')).toBeInTheDocument();
    expect(screen.getByText('정보 일치 · 계속사업자 여부 확인')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사업자 정보 확인' })).toBeEnabled();
    // 시연 도구가 꺼져 있으면 채우기 버튼이 없다.
    expect(
      screen.queryByRole('button', { name: '시연 사업자 정보 채우기' }),
    ).not.toBeInTheDocument();
  });

  it('일치하는 정보: 토스트 후 /owner/store/connect(replace) — 후보 카드 없이 검색 안내 카드', async () => {
    const posts = capture('POST', '/verifications/business');
    const { user, router } = await renderApp('/owner/verify', { as: OWNER_NEW });
    const { businessNumber, representativeName, openingDate } = DEMO_BUSINESS.match;
    await user.type(await screen.findByLabelText('사업자등록번호'), businessNumber);
    await user.type(screen.getByLabelText('대표자명'), representativeName);
    fireEvent.change(screen.getByLabelText('개업일자'), { target: { value: openingDate } });
    await user.click(screen.getByRole('button', { name: '사업자 정보 확인' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store/connect'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(await screen.findByText('가게 이름으로 찾아 주세요')).toBeInTheDocument();
    expect(
      screen.getByText('2자 이상 입력하고 검색하면 공공데이터(인허가)에 있는 가게가 보여요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('주변 가게 후보')).not.toBeInTheDocument();
    expect(screen.queryByText(/후보 상점/)).not.toBeInTheDocument();
    expect(document.querySelector('[data-sonner-toast]')).toHaveTextContent(
      '사업자 인증을 마쳤어요.',
    );
    // 본문: 숫자만 10자리 · 개업일은 opened_at
    await waitFor(() => expect(posts.bodies).toHaveLength(1));
    expect(posts.bodies[0]).toEqual({
      business_number: '1234567890',
      representative_name: representativeName,
      opened_at: openingDate,
    });
  });

  it('칸 검증 문구(요청 없음)', async () => {
    const posts = capture('POST', '/verifications/business');
    const { user } = await renderApp('/owner/verify', { as: OWNER_NEW });
    await user.click(await screen.findByRole('button', { name: '사업자 정보 확인' }));
    expect(screen.getByText('사업자등록번호를 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('대표자명을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('개업일자를 입력해 주세요.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('사업자등록번호'), '123-45-6789');
    await user.click(screen.getByRole('button', { name: '사업자 정보 확인' }));
    expect(screen.getByText('사업자등록번호 10자리를 입력해 주세요.')).toBeInTheDocument();
    expect(posts.count()).toBe(0);
  });

  it.each([
    ['불일치', DEMO_BUSINESS.mismatch, '사업자 정보가 일치하지 않아요'],
    ['폐업', DEMO_BUSINESS.closed, '휴업 또는 폐업한 사업자예요'],
  ])(
    '%s: 결과 카드가 안내로 바뀌고 입력값은 남고, 다시 입력하면 기본으로',
    async (_n, biz, title) => {
      const { user, router } = await renderApp('/owner/verify', { as: OWNER_NEW });
      await user.type(await screen.findByLabelText('사업자등록번호'), biz.businessNumber);
      await user.type(screen.getByLabelText('대표자명'), biz.representativeName);
      fireEvent.change(screen.getByLabelText('개업일자'), { target: { value: biz.openingDate } });
      await user.click(screen.getByRole('button', { name: '사업자 정보 확인' }));
      expect(await screen.findByText(title)).toBeInTheDocument();
      expect(screen.queryByText('국세청 진위확인 API 연동')).not.toBeInTheDocument();
      expect(screen.getByLabelText('사업자등록번호')).toHaveValue(biz.businessNumber);
      expect(screen.getByLabelText('대표자명')).toHaveValue(biz.representativeName);
      expect(router.state.location.pathname).toBe('/owner/verify');

      await user.type(screen.getByLabelText('대표자명'), '씨');
      expect(screen.queryByText(title)).not.toBeInTheDocument();
      expect(screen.getByText('국세청 진위확인 API 연동')).toBeInTheDocument();
      // 실패한 뒤에도 다시 낼 수 있다.
      expect(screen.getByRole('button', { name: '사업자 정보 확인' })).toBeEnabled();
    },
  );

  it('시연 도구가 켜지면 시연 사업자 정보 채우기가 DEMO_BUSINESS.match를 채운다', async () => {
    useDemoStore.setState({ enabled: true });
    const { user } = await renderApp('/owner/verify', { as: OWNER_NEW });
    await user.click(await screen.findByRole('button', { name: '시연 사업자 정보 채우기' }));
    expect(screen.getByLabelText('사업자등록번호')).toHaveValue(DEMO_BUSINESS.match.businessNumber);
    expect(screen.getByLabelText('대표자명')).toHaveValue(DEMO_BUSINESS.match.representativeName);
    expect(screen.getByLabelText('개업일자')).toHaveValue(DEMO_BUSINESS.match.openingDate);
  });

  it('제출을 연타해도 요청은 한 번이다', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const posts = capture('POST', '/verifications/business');
    const { user, router } = await renderApp('/owner/verify', { as: OWNER_NEW });
    const { businessNumber, representativeName, openingDate } = DEMO_BUSINESS.match;
    await user.type(await screen.findByLabelText('사업자등록번호'), businessNumber);
    await user.type(screen.getByLabelText('대표자명'), representativeName);
    fireEvent.change(screen.getByLabelText('개업일자'), { target: { value: openingDate } });
    await user.dblClick(screen.getByRole('button', { name: '사업자 정보 확인' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store/connect'));
    expect(posts.count()).toBe(1);
  });

  it('이미 인증된 사업자: 폼 대신 완료 카드 + 가게 연결하기(가게 없음) / 내 가게 보기(가게 있음)', async () => {
    const first = await renderApp('/owner/verify', { as: OWNER_NOSTORE });
    expect(await screen.findByText('사업자 인증 완료')).toBeInTheDocument();
    expect(screen.getByText('국세청 진위확인으로 확인된 사업자예요.')).toBeInTheDocument();
    expect(screen.queryByLabelText('사업자등록번호')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가게 연결하기' })).toHaveAttribute(
      'href',
      '/owner/store/connect',
    );
    expect(first.router.state.location.pathname).toBe('/owner/verify');
  });

  it('이미 인증됐고 가게도 있으면 내 가게 보기', async () => {
    await renderApp('/owner/verify', { as: 'owner' });
    expect(await screen.findByText('사업자 인증 완료')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 가게 보기' })).toHaveAttribute(
      'href',
      '/owner/store',
    );
  });
});

describe('O05 /owner/store/connect 가게 찾기 · 연결 (owner-a01, S-01)', () => {
  it('첫 화면: 후보 없이 검색 폼 + 안내 카드, 직접 등록 행, 다음으로 비활성 + 사유', async () => {
    const searches = capture('GET', '/stores/search');
    await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    expect(
      await screen.findByRole('heading', { level: 1, name: '가게 찾기 · 연결' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '우리 가게를 연결해요.' })).toBeInTheDocument();
    expect(screen.getByText('캠퍼스 주변 가게를 검색하거나 직접 등록해요.')).toBeInTheDocument();
    const form = screen.getByRole('search');
    const input = within(form).getByLabelText('가게 이름 검색');
    expect(input).toHaveAttribute('placeholder', '예: 책방 옆 작은 카페');
    expect(input).toHaveAttribute('maxlength', '50');
    expect(screen.getByText('가게 이름으로 찾아 주세요')).toBeInTheDocument();
    expect(screen.queryByText('주변 가게 후보')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '검색 결과' })).not.toBeInTheDocument();
    expect(
      screen.getByText('검색되지 않는 가게는 상호와 위치를 직접 입력할 수 있어요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('이미 다른 사장님 계정에 연결된 가게는 선택 불가')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /내 가게 직접 등록/ })).toBeInTheDocument();
    expect(screen.getByText('상호명 · 주소 · 업종 입력')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음으로' })).toBeDisabled();
    expect(screen.getByText('연결할 가게를 먼저 골라 주세요.')).toBeInTheDocument();
    expect(searches.count()).toBe(0);
  });

  it('1자를 제출하면 칸 아래 문구 · 요청 없음', async () => {
    const searches = capture('GET', '/stores/search');
    const { user } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    await search(user, '카');
    expect(screen.getByText('가게 이름을 2자 이상 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByLabelText('가게 이름 검색')).toHaveAttribute('aria-invalid', 'true');
    expect(searches.count()).toBe(0);
    // 공백만 넣어도 같다
    await search(user, '   ');
    expect(screen.getByText('가게 이름을 2자 이상 입력해 주세요.')).toBeInTheDocument();
    expect(searches.count()).toBe(0);
  });

  it('카페 검색 → 소제목 · 칩 · 주소 · 업종, 연결된 가게는 비활성 + 사유, 고르면 선택됨', async () => {
    const { user } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    await search(user, '카페');
    expect(await screen.findByRole('heading', { name: '검색 결과' })).toBeInTheDocument();
    expect(screen.queryByText('가게 이름으로 찾아 주세요')).not.toBeInTheDocument();

    const free = (await screen.findByText('카페 단풍')).closest('li')!;
    expect(within(free).getByText('검색 결과')).toBeInTheDocument();
    expect(within(free).getByText('경기도 용인시 수지구 죽전로 160 · 카페')).toBeInTheDocument();
    const taken = screen.getByText('카페 모래시계').closest('li')!;
    const takenButton = within(taken).getByRole('button', {
      name: '카페 모래시계 이 가게 연결하기',
    });
    expect(takenButton).toBeDisabled();
    expect(within(taken).getByText('이미 다른 사장님 계정에 연결된 가게예요.')).toBeInTheDocument();

    const pick = within(free).getByRole('button', { name: '카페 단풍 이 가게 연결하기' });
    expect(pick).toHaveTextContent('이 가게 연결하기');
    expect(pick).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '다음으로' })).toBeDisabled();
    await user.click(pick);
    expect(pick).toHaveTextContent('✓ 선택됨');
    expect(pick).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '다음으로' })).toBeEnabled();
  });

  it('검색 결과가 없으면 안내 카드', async () => {
    const { user } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    await search(user, '없는가게이름');
    expect(await screen.findByText('검색 결과가 없어요')).toBeInTheDocument();
    expect(
      screen.getByText('상호를 다시 확인하거나 아래에서 직접 등록해 주세요.'),
    ).toBeInTheDocument();
  });

  it('검색이 실패하면 목록 자리에 ErrorState, 직접 등록은 쓸 수 있다', async () => {
    const { user } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    server.use(http.get('/api/stores/search', () => wireFail('E400')));
    await search(user, '카페');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /내 가게 직접 등록/ }));
    expect(screen.getByLabelText('상호명 직접 입력')).toBeEnabled();
  });

  it('2자 → 1자로 줄이면 이전 결과는 숨는다(제출하든 입력만 줄이든)', async () => {
    const { user } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    await search(user, '카페');
    expect(await screen.findByText('카페 단풍')).toBeInTheDocument();

    // 입력만 줄여도 숨고, 다시 늘리면 돌아온다
    await user.type(screen.getByLabelText('가게 이름 검색'), '{Backspace}');
    expect(screen.queryByText('카페 단풍')).not.toBeInTheDocument();
    expect(screen.getByText('가게 이름으로 찾아 주세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음으로' })).toBeDisabled();

    // 1자를 제출해도 같다
    await search(user, '카');
    expect(screen.getByText('가게 이름을 2자 이상 입력해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText('카페 단풍')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '검색 결과' })).not.toBeInTheDocument();
  });

  it('고른 가게 → 다음으로 → 확인 창 → O06(연결 완료) → 제휴 저장 → /owner/store에 가게 이름 · 혜택', async () => {
    const posts = capture('POST', '/users/me/store');
    const { user, router } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    await search(user, '카페');
    const free = (await screen.findByText('카페 단풍')).closest('li')!;
    await user.click(within(free).getByRole('button', { name: '카페 단풍 이 가게 연결하기' }));
    await user.click(screen.getByRole('button', { name: '다음으로' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('내 가게로 연결할까요?')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        '카페 단풍 · 경기도 용인시 수지구 죽전로 160 — 계정당 가게는 1개만 연결할 수 있어요.',
      ),
    ).toBeInTheDocument();
    // 확인 전에는 요청이 없다
    expect(posts.count()).toBe(0);
    await user.click(within(dialog).getByRole('button', { name: '연결하기' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store/partnership'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(
      await screen.findByRole('heading', { level: 1, name: '제휴 할인 설정' }),
    ).toBeInTheDocument();
    expect(screen.getByText('연결 완료')).toBeInTheDocument();
    expect(posts.bodies).toEqual([{ store_id: expect.any(Number) }]);

    await user.type(screen.getByLabelText('혜택 이름'), '음료 500원 할인');
    await user.click(screen.getByRole('button', { name: '제휴 혜택 저장' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store'));
    expect(await screen.findByText('카페 단풍')).toBeInTheDocument();
    expect(screen.getByText('음료 500원 할인 운영 중')).toBeInTheDocument();
  });

  it('돌아가기를 누르면 연결하지 않는다', async () => {
    const posts = capture('POST', '/users/me/store');
    const { user, router } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    await search(user, '카페');
    const free = (await screen.findByText('카페 단풍')).closest('li')!;
    await user.click(within(free).getByRole('button', { name: '카페 단풍 이 가게 연결하기' }));
    await user.click(screen.getByRole('button', { name: '다음으로' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: '돌아가기' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(posts.count()).toBe(0);
    expect(router.state.location.pathname).toBe('/owner/store/connect');
  });

  it('연결 확인을 연타해도 요청은 한 번이다', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const posts = capture('POST', '/users/me/store');
    const { user, router } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    await search(user, '카페');
    const free = (await screen.findByText('카페 단풍')).closest('li')!;
    await user.click(within(free).getByRole('button', { name: '카페 단풍 이 가게 연결하기' }));
    await user.click(screen.getByRole('button', { name: '다음으로' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.dblClick(within(dialog).getByRole('button', { name: '연결하기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store/partnership'));
    expect(posts.count()).toBe(1);
  });

  it('고르는 사이 다른 사장님이 먼저 연결하면: 토스트 + 그 카드가 비활성', async () => {
    const { user, router } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    await search(user, '카페');
    const free = (await screen.findByText('카페 단풍')).closest('li')!;
    await user.click(within(free).getByRole('button', { name: '카페 단풍 이 가게 연결하기' }));
    mutate((db) => {
      db.stores.find((s) => s.name === '카페 단풍')!.ownerId = db.users.find(
        (u) => u.email === 'owner2@demo.kr',
      )!.id;
    });
    await user.click(screen.getByRole('button', { name: '다음으로' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '연결하기' }),
    );
    await waitFor(() =>
      expect(document.querySelector('[data-sonner-toast]')).toHaveTextContent(
        '이미 다른 사장님 계정에 연결된 가게예요.',
      ),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/owner/store/connect');
    const card = screen.getByText('카페 단풍').closest('li')!;
    await waitFor(() =>
      expect(
        within(card).getByRole('button', { name: '카페 단풍 이 가게 연결하기' }),
      ).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: '다음으로' })).toBeDisabled();
  });

  it('직접 등록: 가까운 학교의 캠퍼스 중심 좌표를 본문에 싣고 O06으로', async () => {
    const posts = capture('POST', '/users/me/store');
    const { user, router } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    await user.click(screen.getByRole('button', { name: /내 가게 직접 등록/ }));

    expect(screen.getByLabelText('상호명 직접 입력')).toBeInTheDocument();
    expect(screen.getByLabelText('가게 주소')).toBeInTheDocument();
    expect(screen.getByText('도로명 주소로 적어 주세요.')).toBeInTheDocument();
    const school = screen.getByLabelText('가까운 학교');
    expect(
      within(school).getByRole('option', { name: '가게와 가까운 캠퍼스를 골라 주세요' }),
    ).toBeInTheDocument();
    expect(
      await within(school).findByRole('option', { name: '경희대학교 국제캠퍼스' }),
    ).toBeInTheDocument();
    expect(screen.getByText('지도 위치는 이 캠퍼스 근처로 잡혀요.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('상호명 직접 입력'), '  새 책방 카페  ');
    await user.type(screen.getByLabelText('가게 주소'), '경기도 용인시 기흥구 서천로 99');
    await user.selectOptions(screen.getByLabelText('업종'), '카페');
    await user.selectOptions(school, '경희대학교 국제캠퍼스');
    await user.click(screen.getByRole('button', { name: '내 가게 등록하기' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store/partnership'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(await screen.findByText('새 책방 카페')).toBeInTheDocument();
    expect(screen.getByText('경기도 용인시 기흥구 서천로 99 · 카페')).toBeInTheDocument();
    expect(posts.bodies).toEqual([
      {
        name: '새 책방 카페',
        address: '경기도 용인시 기흥구 서천로 99',
        category: '카페',
        latitude: 37.2397,
        longitude: 127.0833,
      },
    ]);
  });

  it('직접 등록 검증 문구(요청 없음)', async () => {
    const posts = capture('POST', '/users/me/store');
    const { user } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    await user.click(screen.getByRole('button', { name: /내 가게 직접 등록/ }));
    await user.click(screen.getByRole('button', { name: '내 가게 등록하기' }));
    expect(screen.getByText('상호명을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('가게 주소를 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('업종을 골라 주세요.')).toBeInTheDocument();
    expect(screen.getByText('가까운 학교를 골라 주세요.')).toBeInTheDocument();
    expect(posts.count()).toBe(0);
  });

  it('주소를 못 찾으면(ADDRESS_NOT_FOUND) 주소 칸 아래 문구', async () => {
    const { user } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    server.use(http.post('/api/users/me/store', () => wireFail('E400_ADDRESS_NOT_FOUND')));
    await user.click(screen.getByRole('button', { name: /내 가게 직접 등록/ }));
    await user.type(screen.getByLabelText('상호명 직접 입력'), '새 가게');
    await user.type(screen.getByLabelText('가게 주소'), '없는 주소');
    await user.selectOptions(screen.getByLabelText('업종'), '카페');
    await user.selectOptions(
      screen.getByLabelText('가까운 학교'),
      await screen.findByRole('option', { name: '경희대학교 국제캠퍼스' }),
    );
    await user.click(screen.getByRole('button', { name: '내 가게 등록하기' }));
    expect(
      await screen.findByText('주소를 찾을 수 없어요. 도로명 주소로 다시 입력해 주세요.'),
    ).toBeInTheDocument();
    // 실패하면 다시 낼 수 있다
    expect(screen.getByRole('button', { name: '내 가게 등록하기' })).toBeEnabled();
  });

  it('등록을 연타해도 요청은 한 번이다', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const posts = capture('POST', '/users/me/store');
    const { user, router } = await renderApp('/owner/store/connect', { as: OWNER_NOSTORE });
    await screen.findByRole('search');
    await user.click(screen.getByRole('button', { name: /내 가게 직접 등록/ }));
    await user.type(screen.getByLabelText('상호명 직접 입력'), '연타 가게');
    await user.type(screen.getByLabelText('가게 주소'), '경기도 용인시 기흥구 서천로 1');
    await user.selectOptions(screen.getByLabelText('업종'), '한식');
    await user.selectOptions(
      screen.getByLabelText('가까운 학교'),
      await screen.findByRole('option', { name: '경희대학교 국제캠퍼스' }),
    );
    await user.dblClick(screen.getByRole('button', { name: '내 가게 등록하기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store/partnership'));
    expect(posts.count()).toBe(1);
  });

  it('사업자 인증 전: 검색 · 등록 비활성, 다음으로 사유 + 사업자 인증하기, 검색 요청 없음', async () => {
    const searches = capture('GET', '/stores/search');
    await renderApp('/owner/store/connect', { as: OWNER_NEW });
    await screen.findByRole('search');
    expect(screen.getByLabelText('가게 이름 검색')).toBeDisabled();
    expect(screen.getByRole('button', { name: '검색' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /내 가게 직접 등록/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음으로' })).toBeDisabled();
    expect(screen.getByText('사업자 인증을 마치면 가게를 연결할 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '사업자 인증하기' })).toHaveAttribute(
      'href',
      '/owner/verify',
    );
    expect(searches.count()).toBe(0);
  });

  it('이미 가게가 있으면 안내 카드 + 내 가게 보기, 검색은 없다', async () => {
    await renderApp('/owner/store/connect', { as: 'owner' });
    expect(await screen.findByText('이미 연결된 가게가 있어요')).toBeInTheDocument();
    expect(screen.getByText('계정당 가게는 1개만 연결할 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 가게 보기' })).toHaveAttribute(
      'href',
      '/owner/store',
    );
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
  });
});

describe('O06 /owner/store/partnership 제휴 설정 (S-03)', () => {
  it('owner1: 기존 값이 채워지고 연결 완료 칩은 없다, 할인 조건 칸은 없다', async () => {
    await renderApp('/owner/store/partnership', { as: 'owner' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '제휴 할인 설정' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '제휴 혜택을 설정해요.' })).toBeInTheDocument();
    expect(screen.getByText('참가자에게 제공할 혜택을 등록해 주세요.')).toBeInTheDocument();
    expect(await screen.findByText('서천 밥상')).toBeInTheDocument();
    expect(screen.getByText('경기도 용인시 기흥구 서천동 서천로 21 · 한식')).toBeInTheDocument();
    expect(screen.queryByText('연결 완료')).not.toBeInTheDocument();
    expect(screen.getByLabelText('혜택 이름')).toHaveValue('식사 금액 10% 할인');
    expect(screen.queryByLabelText('할인 조건')).not.toBeInTheDocument();
    expect(screen.queryByText('할인 조건')).not.toBeInTheDocument();
    expect(
      screen.getByText('제휴 여부 자체가 AI 추천 순위에 영향을 주지는 않아요.'),
    ).toBeInTheDocument();
  });

  it('종료일이 시작일보다 앞서면 칸 아래 문구 · 요청 없음', async () => {
    const puts = capture('PUT', '/users/me/store/partnership');
    const { user } = await renderApp('/owner/store/partnership', { as: 'owner' });
    await screen.findByLabelText('혜택 이름');
    fireEvent.change(screen.getByLabelText('제휴 시작일'), { target: { value: '2030-05-10' } });
    fireEvent.change(screen.getByLabelText('제휴 종료일'), { target: { value: '2030-05-01' } });
    await user.click(screen.getByRole('button', { name: '제휴 혜택 저장' }));
    expect(screen.getByText('종료 날짜는 시작 날짜와 같거나 뒤여야 해요.')).toBeInTheDocument();
    expect(puts.count()).toBe(0);
  });

  it('칸 검증 문구', async () => {
    const puts = capture('PUT', '/users/me/store/partnership');
    const { user } = await renderApp('/owner/store/partnership', { as: 'owner' });
    const name = await screen.findByLabelText('혜택 이름');
    await user.clear(name);
    fireEvent.change(screen.getByLabelText('제휴 시작일'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('제휴 종료일'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: '제휴 혜택 저장' }));
    expect(screen.getByText('제휴 혜택 이름을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('제휴 시작일을 골라 주세요.')).toBeInTheDocument();
    expect(screen.getByText('제휴 종료일을 골라 주세요.')).toBeInTheDocument();
    await user.type(name, 'ㅁ'.repeat(51));
    await user.click(screen.getByRole('button', { name: '제휴 혜택 저장' }));
    expect(screen.getByText('50자 이내로 적어 주세요.')).toBeInTheDocument();
    expect(puts.count()).toBe(0);
  });

  it('저장하면 토스트 + /owner/store(replace)에 새 혜택, 본문은 discount_text · start_date · end_date', async () => {
    const puts = capture('PUT', '/users/me/store/partnership');
    const { user, router } = await renderApp('/owner/store/partnership', { as: 'owner' });
    const name = await screen.findByLabelText('혜택 이름');
    await user.clear(name);
    await user.type(name, '  사이드 메뉴 증정  ');
    fireEvent.change(screen.getByLabelText('제휴 시작일'), { target: { value: '2030-01-01' } });
    fireEvent.change(screen.getByLabelText('제휴 종료일'), { target: { value: '2030-02-01' } });
    await user.click(screen.getByRole('button', { name: '제휴 혜택 저장' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(document.querySelector('[data-sonner-toast]')).toHaveTextContent(
      '제휴 혜택을 저장했어요.',
    );
    expect(await screen.findByText('사이드 메뉴 증정 운영 중')).toBeInTheDocument();
    expect(screen.getByText('제휴 예정')).toBeInTheDocument();
    expect(puts.bodies).toEqual([
      { discount_text: '사이드 메뉴 증정', start_date: '2030-01-01', end_date: '2030-02-01' },
    ]);
  });

  it('서버 칸 오류(discount · startDate · endDate)는 그 칸 아래에', async () => {
    const { user } = await renderApp('/owner/store/partnership', { as: 'owner' });
    await screen.findByLabelText('혜택 이름');
    server.use(
      http.put('/api/users/me/store/partnership', () =>
        wireFail('E400', {
          errors: [
            { field: 'discount_text', reason: '서버: 혜택 문구 오류' },
            { field: 'start_date', reason: '서버: 시작일 오류' },
            { field: 'end_date', reason: '서버: 종료일 오류' },
          ],
        }),
      ),
    );
    await user.click(screen.getByRole('button', { name: '제휴 혜택 저장' }));
    expect(await screen.findByText('서버: 혜택 문구 오류')).toBeInTheDocument();
    expect(screen.getByText('서버: 시작일 오류')).toBeInTheDocument();
    expect(screen.getByText('서버: 종료일 오류')).toBeInTheDocument();
    expect(screen.getByLabelText('혜택 이름')).toHaveAttribute('aria-invalid', 'true');
    // 실패하면 다시 낼 수 있다
    expect(screen.getByRole('button', { name: '제휴 혜택 저장' })).toBeEnabled();
  });

  it('저장을 연타해도 요청은 한 번이다', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const puts = capture('PUT', '/users/me/store/partnership');
    const { user, router } = await renderApp('/owner/store/partnership', { as: 'owner' });
    await screen.findByLabelText('혜택 이름');
    await user.dblClick(screen.getByRole('button', { name: '제휴 혜택 저장' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store'));
    expect(puts.count()).toBe(1);
  });

  it('가게가 없으면 칸 · 버튼 비활성 + 사유 + 가게 연결하기(미인증이면 사업자 인증하기)', async () => {
    await renderApp('/owner/store/partnership', { as: OWNER_NOSTORE });
    expect(await screen.findByLabelText('혜택 이름')).toBeDisabled();
    expect(screen.getByLabelText('제휴 시작일')).toBeDisabled();
    expect(screen.getByRole('button', { name: '제휴 혜택 저장' })).toBeDisabled();
    expect(screen.getByText('가게를 연결하면 제휴 혜택을 설정할 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가게 연결하기' })).toHaveAttribute(
      'href',
      '/owner/store/connect',
    );
  });

  it('미인증 사장님의 가드 행동은 사업자 인증하기', async () => {
    await renderApp('/owner/store/partnership', { as: OWNER_NEW });
    expect(await screen.findByLabelText('혜택 이름')).toBeDisabled();
    expect(screen.getByRole('link', { name: '사업자 인증하기' })).toHaveAttribute(
      'href',
      '/owner/verify',
    );
  });
});

describe('/owner/store/edit 가게 정보 수정 (S-01 PATCH)', () => {
  it('owner1: 머리 · 현재 값이 채워진 칸 셋 · 바뀐 칸이 없으면 저장 비활성 + 사유', async () => {
    const { user, router } = await renderApp('/owner/store/edit', { as: 'owner' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '가게 정보 수정' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '가게 정보를 고쳐요.' })).toBeInTheDocument();
    expect(screen.getByText('학생들이 보는 가게 이름과 주소예요.')).toBeInTheDocument();
    expect(await screen.findByLabelText('상호명')).toHaveValue('서천 밥상');
    expect(screen.getByLabelText('가게 주소')).toHaveValue('경기도 용인시 기흥구 서천동 서천로 21');
    expect(screen.getByLabelText('업종')).toHaveValue('한식');
    const save = screen.getByRole('button', { name: '변경사항 저장' });
    expect(save).toBeDisabled();
    expect(screen.getByText('바뀐 내용이 없어요.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(router.state.location.pathname).toBe('/owner/store');
  });

  it('주소만 바꿔 저장: PATCH 본문 키는 address뿐 → 토스트 + /owner/store(replace), 다시 열면 새 주소', async () => {
    const patches = capture('PATCH', '/users/me/store');
    const { user, router } = await renderApp('/owner/store/edit', { as: 'owner' });
    const address = await screen.findByLabelText('가게 주소');
    await user.clear(address);
    await user.type(address, '경기도 용인시 기흥구 새 주소 5');
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeEnabled();
    expect(screen.queryByText('바뀐 내용이 없어요.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '변경사항 저장' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(document.querySelector('[data-sonner-toast]')).toHaveTextContent(
      '가게 정보를 저장했어요.',
    );
    expect(patches.bodies).toHaveLength(1);
    expect(Object.keys(patches.bodies[0] as object)).toEqual(['address']);
    expect(patches.bodies[0]).toEqual({ address: '경기도 용인시 기흥구 새 주소 5' });
    // O01 갱신: 편집 화면에 다시 들어오면 새 주소
    await user.click(await screen.findByRole('link', { name: '가게 정보 수정' }));
    expect(await screen.findByLabelText('가게 주소')).toHaveValue('경기도 용인시 기흥구 새 주소 5');
  });

  it('앞뒤 공백만 더한 것은 바뀐 것이 아니다 — 저장 비활성, 요청 없음', async () => {
    const patches = capture('PATCH', '/users/me/store');
    const { user } = await renderApp('/owner/store/edit', { as: 'owner' });
    const name = await screen.findByLabelText('상호명');
    await user.type(name, '  ');
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
    expect(screen.getByText('바뀐 내용이 없어요.')).toBeInTheDocument();
    expect(patches.count()).toBe(0);
  });

  it('칸을 비우고 저장하면 검증 문구 · 요청 없음', async () => {
    const patches = capture('PATCH', '/users/me/store');
    const { user } = await renderApp('/owner/store/edit', { as: 'owner' });
    await user.clear(await screen.findByLabelText('상호명'));
    await user.clear(screen.getByLabelText('가게 주소'));
    await user.click(screen.getByRole('button', { name: '변경사항 저장' }));
    expect(screen.getByText('상호명을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('가게 주소를 입력해 주세요.')).toBeInTheDocument();
    expect(patches.count()).toBe(0);
  });

  it('업종 선택지에 없는 지금 값은 맨 앞 선택지로 더한다', async () => {
    const { router } = await renderApp('/owner/store', { as: 'owner' });
    mutate((db) => {
      db.stores.find((s) => s.id === 1)!.category = '독특한업종';
    });
    await router.navigate('/owner/store/edit');
    const select = (await screen.findByLabelText('업종')) as HTMLSelectElement;
    await waitFor(() => expect(select).toHaveValue('독특한업종'));
    expect(select.options[0]).toHaveValue('독특한업종');
    expect(select.options).toHaveLength(11);
    // 값을 바꾸지 않았으니 저장은 잠겨 있다.
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
  });

  it('저장을 연타해도 요청은 한 번이다', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const patches = capture('PATCH', '/users/me/store');
    const { user, router } = await renderApp('/owner/store/edit', { as: 'owner' });
    const name = await screen.findByLabelText('상호명');
    await user.type(name, '2호점');
    await user.dblClick(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store'));
    expect(patches.count()).toBe(1);
  });

  it('서버 칸 오류는 그 칸 아래에', async () => {
    const { user } = await renderApp('/owner/store/edit', { as: 'owner' });
    server.use(
      http.patch('/api/users/me/store', () =>
        wireFail('E400', { errors: [{ field: 'address', reason: '서버: 주소 오류' }] }),
      ),
    );
    await user.type(await screen.findByLabelText('가게 주소'), ' 2');
    await user.click(screen.getByRole('button', { name: '변경사항 저장' }));
    expect(await screen.findByText('서버: 주소 오류')).toBeInTheDocument();
  });

  it('가게가 없으면 칸 · 버튼 비활성 + 사유 + 가게 연결하기', async () => {
    await renderApp('/owner/store/edit', { as: OWNER_NOSTORE });
    expect(await screen.findByLabelText('상호명')).toBeDisabled();
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
    expect(screen.getByText('가게를 연결하면 가게 정보를 고칠 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가게 연결하기' })).toHaveAttribute(
      'href',
      '/owner/store/connect',
    );
  });
});

describe('쿠폰 사용 처리의 가게 없음 가드', () => {
  it('owner-nostore: 가드 카드 + 가게 연결하기, 코드 입력은 없다', async () => {
    await renderApp('/owner/coupons/redeem', { as: OWNER_NOSTORE });
    expect(await screen.findByText('연결된 가게가 없어요')).toBeInTheDocument();
    expect(
      screen.getByText('가게를 연결하면 학생 쿠폰을 사용 처리할 수 있어요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가게 연결하기' })).toHaveAttribute(
      'href',
      '/owner/store/connect',
    );
    expect(screen.queryByLabelText('6자리 쿠폰 코드')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사용 처리하기' })).not.toBeInTheDocument();
  });

  it('owner-new(미인증): 사업자 인증하기', async () => {
    await renderApp('/owner/coupons/redeem', { as: OWNER_NEW });
    expect(await screen.findByText('연결된 가게가 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '사업자 인증하기' })).toHaveAttribute(
      'href',
      '/owner/verify',
    );
  });

  it('가게가 있는 사장님은 그대로 코드 입력 화면', async () => {
    await renderApp('/owner/coupons/redeem', { as: 'owner' });
    expect(await screen.findByLabelText('6자리 쿠폰 코드')).toBeInTheDocument();
    expect(screen.queryByText('연결된 가게가 없어요')).not.toBeInTheDocument();
  });
});

describe('O06 기간 기본값', () => {
  it('제휴가 없는 가게의 O06 기간 기본값은 오늘 ~ 오늘+90일', async () => {
    const { router } = await renderApp('/owner/store', { as: 'owner' });
    mutate((db) => {
      db.partnerships = db.partnerships.filter((p) => p.storeId !== 1);
    });
    await router.navigate('/owner/store/partnership');
    const today = seoulDateKey(new Date());
    await waitFor(() => expect(screen.getByLabelText('제휴 시작일')).toHaveValue(today));
    expect(screen.getByLabelText('제휴 종료일')).toHaveValue(addDaysKey(today, 90));
    expect(screen.getByLabelText('혜택 이름')).toHaveValue('');
    expect(screen.getByText('연결 완료')).toBeInTheDocument();
  });
});
