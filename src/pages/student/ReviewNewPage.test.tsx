import { act, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { getDb, mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { findApplicationId, redeemDemoCoupon, renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

const STUDENT = 'student@demo.kr';

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

/** 리뷰 쓰기 요청(`POST /stores/:storeId/reviews`)의 받은 본문을 모은다. */
function captureReviewPosts(): unknown[] {
  const bodies: unknown[] = [];
  server.events.on('request:start', ({ request }) => {
    const { pathname } = new URL(request.url);
    if (request.method === 'POST' && /^\/api\/stores\/\d+\/reviews$/.test(pathname)) {
      void request
        .clone()
        .json()
        .then((body: unknown) => bodies.push(body));
    }
  });
  return bodies;
}

/** 김민지(시연 학생)의 상점 1 쿠폰을 사용 처리한 뒤 리뷰 쓰기 화면을 연다. */
async function openReviewForm(prepare: 'USED' | 'ISSUED' = 'USED') {
  const result = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
  const couponId =
    prepare === 'USED'
      ? redeemDemoCoupon(1)
      : getDb().coupons.find(
          (c) => c.applicationId === findApplicationId(STUDENT, 1) && c.storeId === 1,
        )!.id;
  await result.router.navigate(`/reviews/new?couponId=${couponId}`);
  await screen.findByRole('heading', { name: '오늘 탐방은 어땠나요?' });
  return { ...result, couponId };
}

const submit = () => screen.getByRole('button', { name: '리뷰 등록하기' });

describe('H12 방문 리뷰 쓰기', () => {
  it('별 4점 + 앞뒤 공백 있는 내용 → 등록하면 코스 지도가 그 상점 시트를 연 채 새 AI 요약을 보인다', async () => {
    const posts = captureReviewPosts();
    const { user, router } = await openReviewForm();

    expect(screen.getByRole('heading', { level: 1, name: '방문 리뷰 작성' })).toBeInTheDocument();
    expect(screen.getByText('경험을 남기면 다른 학생에게도 도움이 돼요.')).toBeInTheDocument();
    expect(screen.getByText('참여 완료')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '렌토' })).toBeInTheDocument();
    expect(await screen.findByText('경희대학교 국제캠퍼스 주변')).toBeInTheDocument();
    expect(screen.getByText('방문 경험을 평가해 주세요')).toBeInTheDocument();
    expect(
      screen.getByText('리뷰는 개인 정보 없이 가게의 경험 요약에 활용될 수 있어요.'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('방문한 가게나 코스에서 느낀 점을 적어 주세요.')).toBe(
      screen.getByLabelText('좋았던 점과 아쉬웠던 점'),
    );

    await user.click(screen.getByRole('radio', { name: '별점 4점' }));
    await user.type(screen.getByLabelText('좋았던 점과 아쉬웠던 점'), '  양이 많아요  ');
    await user.click(submit());

    const applicationId = findApplicationId(STUDENT, 1);
    await waitFor(() =>
      expect(router.state.location.pathname + router.state.location.search).toBe(
        `/my-tours/${applicationId}/course?storeId=1`,
      ),
    );
    expect(posts).toEqual([{ coupon_id: expect.any(Number), rating: 4, content: '양이 많아요' }]);
    expect(await screen.findByText('리뷰를 등록했어요.')).toBeInTheDocument();
    const sheet = await screen.findByRole('dialog', { name: '렌토' });
    const summary = within(sheet).getByText('✦ AI 리뷰 요약').nextElementSibling;
    await waitFor(() => expect(summary).toHaveTextContent(/^학생 6명이 평균 4\.5점/));
    expect(summary).toHaveTextContent('"양이 많아요"');
  });

  it('별점을 안 고르면 오류, 요청 없음', async () => {
    const posts = captureReviewPosts();
    const { user } = await openReviewForm();
    await user.type(screen.getByLabelText('좋았던 점과 아쉬웠던 점'), '양이 많아요');
    await user.click(submit());
    expect(await screen.findByText('별점을 선택해 주세요.')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('공백뿐인 내용은 오류, 한 글자는 통과한다', async () => {
    const posts = captureReviewPosts();
    const { user } = await openReviewForm();
    await user.click(screen.getByRole('radio', { name: '별점 5점' }));
    await user.type(screen.getByLabelText('좋았던 점과 아쉬웠던 점'), '     ');
    await user.click(submit());
    expect(await screen.findByText('한 줄 평을 입력해 주세요.')).toBeInTheDocument();
    expect(posts).toHaveLength(0);

    // 양성 대조: 한 글자면 요청이 간다(최소 글자수는 서버 판정에 맡긴다).
    await user.clear(screen.getByLabelText('좋았던 점과 아쉬웠던 점'));
    await user.type(screen.getByLabelText('좋았던 점과 아쉬웠던 점'), '굿');
    await user.click(submit());
    await waitFor(() => expect(posts).toHaveLength(1));
  });

  it('101자는 오류, 100자는 통과한다', async () => {
    const posts = captureReviewPosts();
    const { user } = await openReviewForm();
    await user.click(screen.getByRole('radio', { name: '별점 3점' }));
    const box = screen.getByLabelText('좋았던 점과 아쉬웠던 점');
    await user.click(box);
    await user.paste('가'.repeat(101));
    await user.click(submit());
    expect(await screen.findByText('100자 이내로 적어 주세요.')).toBeInTheDocument();
    expect(posts).toHaveLength(0);

    await user.clear(box);
    await user.paste('가'.repeat(100));
    await user.click(submit());
    await waitFor(() => expect(posts).toHaveLength(1));
  });

  it('저장 중에는 버튼이 로딩이고 입력이 잠기며, 연타해도 요청은 한 번이다', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const posts = captureReviewPosts();
    const { user, router } = await openReviewForm();
    await user.click(screen.getByRole('radio', { name: '별점 4점' }));
    await user.type(screen.getByLabelText('좋았던 점과 아쉬웠던 점'), '양이 많아요');

    await user.dblClick(submit());
    expect(submit()).toHaveAttribute('aria-busy', 'true');
    expect(submit()).toBeDisabled();
    expect(screen.getByLabelText('좋았던 점과 아쉬웠던 점')).toBeDisabled();
    expect(screen.getByRole('radio', { name: '별점 4점' })).toBeDisabled();
    expect(screen.getByLabelText('좋았던 점과 아쉬웠던 점').closest('fieldset')).toBeDisabled();

    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/course$/));
    expect(posts).toHaveLength(1);
    expect(getDb().reviews.filter((r) => r.storeId === 1)).toHaveLength(6);
  });

  it('쿠폰을 아직 안 쓴 상태(USABLE)는 입력과 버튼이 잠기고 사유 + 쿠폰 보기', async () => {
    const posts = captureReviewPosts();
    const { couponId } = await openReviewForm('ISSUED');
    expect(await screen.findByText('쿠폰을 사용한 상점에만 리뷰를 쓸 수 있어요.')).toBeVisible();
    expect(submit()).toBeDisabled();
    expect(screen.getByLabelText('좋았던 점과 아쉬웠던 점')).toBeDisabled();
    expect(screen.getByRole('link', { name: '쿠폰 보기' })).toHaveAttribute(
      'href',
      `/coupons/${couponId}`,
    );
    expect(posts).toHaveLength(0);
  });

  it('이미 쓴 쿠폰(두 번째 시도)은 잠기고 사유 + 코스 지도 보기', async () => {
    const { user, router, couponId } = await openReviewForm();
    await user.click(screen.getByRole('radio', { name: '별점 5점' }));
    await user.type(screen.getByLabelText('좋았던 점과 아쉬웠던 점'), '또 가고 싶어요');
    await user.click(submit());
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/course$/));

    await router.navigate(`/reviews/new?couponId=${couponId}`);
    expect(await screen.findByText('이미 리뷰를 작성했어요.')).toBeVisible();
    expect(submit()).toBeDisabled();
    expect(screen.getByLabelText('좋았던 점과 아쉬웠던 점')).toBeDisabled();
    expect(screen.getByRole('link', { name: '코스 지도 보기' })).toHaveAttribute(
      'href',
      `/my-tours/${findApplicationId(STUDENT, 1)}/course?storeId=1`,
    );
  });

  it('잘못된 couponId는 요청 없이 EmptyState', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
    await screen.findByRole('heading', { name: '내 탐방' });
    const couponGets: string[] = [];
    server.events.on('request:start', ({ request }) => {
      const { pathname } = new URL(request.url);
      if (pathname === '/api/users/me/coupons') couponGets.push(pathname);
    });
    await router.navigate('/reviews/new?couponId=abc');
    expect(await screen.findByText('리뷰를 쓸 쿠폰을 찾을 수 없어요.')).toBeVisible();
    expect(screen.getByRole('link', { name: '내 탐방 확인하기' })).toHaveAttribute(
      'href',
      '/my-tours',
    );
    expect(screen.queryByRole('button', { name: '리뷰 등록하기' })).not.toBeInTheDocument();
    // 요청이 나갈 시간을 준 뒤 센다.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(couponGets).toHaveLength(0);

    // 양성 대조: 정상 주소에서는 같은 요청이 실제로 간다.
    await router.navigate('/reviews/new?couponId=1');
    await waitFor(() => expect(couponGets.length).toBeGreaterThan(0));
  });

  it('남의 쿠폰이면 EmptyState', async () => {
    const { router } = await renderApp('/my-tours', {
      as: 'yujin@demo.kr',
      checkpoint: 'CONFIRMED',
    });
    const others = getDb().coupons.find((c) => c.applicationId === findApplicationId(STUDENT, 1))!;
    await router.navigate(`/reviews/new?couponId=${others.id}`);
    expect(await screen.findByText('리뷰를 쓸 쿠폰을 찾을 수 없어요.')).toBeVisible();
    expect(screen.queryByRole('button', { name: '리뷰 등록하기' })).not.toBeInTheDocument();
  });

  it('성공한 저장 뒤 이동하기 전에는 폼이 잠겨 있어 다시 눌러도 요청이 늘지 않는다', async () => {
    const posts = captureReviewPosts();
    const { user, router, queryClient } = await openReviewForm();
    await user.click(screen.getByRole('radio', { name: '별점 4점' }));
    await user.type(screen.getByLabelText('좋았던 점과 아쉬웠던 점'), '양이 많아요');

    // 신청을 다시 받아 오는 응답을 붙들어, 저장은 끝났지만 아직 이동하지 못한 틈을 만든다.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/users/me/tours', async () => {
        await gate; // 값을 돌려주지 않으면 다음(기본) 핸들러가 답한다
      }),
    );
    await act(async () => {
      void queryClient.resetQueries({ queryKey: ['myApplications'] }); // 붙들린 응답을 기다리지 않는다
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await user.click(submit());
    await screen.findByText('리뷰를 등록했어요.');
    expect(router.state.location.pathname).toBe('/reviews/new'); // 아직 이동하지 못했다
    expect(submit()).toBeDisabled();
    expect(screen.getByLabelText('좋았던 점과 아쉬웠던 점')).toBeDisabled();
    await user.click(submit());
    expect(posts).toHaveLength(1);

    release();
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/course$/));
    expect(posts).toHaveLength(1);
  });
});

describe('H12 저장 때 서버 오류', () => {
  /** 사유 줄(`hint`)에도 같은 글이 있어 토스트 안에서 찾는다. */
  async function expectToast(message: string) {
    await waitFor(() =>
      expect(document.querySelector('[data-sonner-toast]')).toHaveTextContent(message),
    );
  }

  async function fillAndSubmit(user: Awaited<ReturnType<typeof openReviewForm>>['user']) {
    await user.click(screen.getByRole('radio', { name: '별점 4점' }));
    await user.type(screen.getByLabelText('좋았던 점과 아쉬웠던 점'), '양이 많아요');
    await user.click(submit());
  }

  it('REVIEW_NOT_ALLOWED: 토스트 뒤 쿠폰을 다시 읽으면 폼이 사유와 함께 잠긴다', async () => {
    const { user, couponId } = await openReviewForm();
    server.use(
      http.post('/api/stores/:storeId/reviews', () => {
        // 서버가 쿠폰이 더는 쓸 수 없는 상태라고 판단한 때: 만료된 것으로 바꾼다.
        mutate((db) => {
          db.coupons.find((c) => c.id === couponId)!.status = 'EXPIRED';
        });
        return wireFail('E403_COUPON_NOT_USED');
      }),
    );
    await fillAndSubmit(user);
    await expectToast('쿠폰을 사용한 상점에만 리뷰를 쓸 수 있어요.');
    await waitFor(() => expect(submit()).toBeDisabled());
    expect(submit()).toHaveAccessibleDescription('쿠폰을 사용한 상점에만 리뷰를 쓸 수 있어요.');
    expect(screen.getByLabelText('좋았던 점과 아쉬웠던 점')).toBeDisabled();
    expect(screen.getByRole('link', { name: '쿠폰 보기' })).toHaveAttribute(
      'href',
      `/coupons/${couponId}`,
    );
  });

  it('REVIEW_DUPLICATE: 토스트 뒤 쿠폰을 다시 읽으면 폼이 사유 + 코스 지도 보기로 잠긴다', async () => {
    const { user, couponId } = await openReviewForm();
    server.use(
      http.post('/api/stores/:storeId/reviews', () => {
        // 다른 기기에서 먼저 쓴 것처럼 리뷰 행을 더한다.
        mutate((db) => {
          const coupon = db.coupons.find((c) => c.id === couponId)!;
          db.reviews.push({
            id: 9999,
            userId: db.users.find((u) => u.email === STUDENT)!.id,
            tourId: 1,
            storeId: coupon.storeId,
            couponId,
            rating: 5,
            content: '먼저 쓴 리뷰',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });
        return wireFail('E409_ALREADY_REVIEWED');
      }),
    );
    await fillAndSubmit(user);
    await expectToast('이미 리뷰를 작성했어요.');
    await waitFor(() => expect(submit()).toBeDisabled());
    expect(submit()).toHaveAccessibleDescription('이미 리뷰를 작성했어요.');
    expect(screen.getByLabelText('좋았던 점과 아쉬웠던 점')).toBeDisabled();
    expect(screen.getByRole('link', { name: '코스 지도 보기' })).toHaveAttribute(
      'href',
      `/my-tours/${findApplicationId(STUDENT, 1)}/course?storeId=1`,
    );
  });

  it('NOT_FOUND: 받아 둔 쿠폰이 있어도 쿠폰을 찾을 수 없다는 EmptyState로 끝난다', async () => {
    const { user } = await openReviewForm();
    server.use(http.post('/api/stores/:storeId/reviews', () => wireFail('E404')));
    await fillAndSubmit(user);
    expect(await screen.findByText('리뷰를 쓸 쿠폰을 찾을 수 없어요.')).toBeVisible();
    expect(screen.getByRole('link', { name: '내 탐방 확인하기' })).toHaveAttribute(
      'href',
      '/my-tours',
    );
    expect(screen.queryByRole('button', { name: '리뷰 등록하기' })).not.toBeInTheDocument();
  });

  it('쿠폰을 다시 읽다가 없어졌다고 하면(받아 둔 쿠폰이 있어도) EmptyState', async () => {
    const { queryClient } = await openReviewForm();
    // 쿠폰이 목록에서 사라진 뒤 다시 읽는다 — 받아 둔 값이 남아 있어도 폼을 닫는다.
    mutate((db) => {
      db.coupons = db.coupons.filter((c) => c.storeId !== 1);
    });
    await queryClient.refetchQueries({ queryKey: ['myCoupons'] });
    expect(await screen.findByText('리뷰를 쓸 쿠폰을 찾을 수 없어요.')).toBeVisible();
    expect(screen.queryByRole('button', { name: '리뷰 등록하기' })).not.toBeInTheDocument();
  });

  it('서버 VALIDATION 칸 오류(content)는 입력 칸 아래에 보이고 폼은 그대로 쓸 수 있다', async () => {
    const { user } = await openReviewForm();
    server.use(
      http.post('/api/stores/:storeId/reviews', () =>
        wireFail('E400', { errors: [{ field: 'content', reason: '내용이 너무 짧아요.' }] }),
      ),
    );
    await fillAndSubmit(user);
    const box = screen.getByLabelText('좋았던 점과 아쉬웠던 점');
    expect(await screen.findByText('내용이 너무 짧아요.')).toBeVisible();
    expect(box).toHaveAccessibleDescription('내용이 너무 짧아요.');
    expect(box).toBeEnabled();
    expect(submit()).toBeEnabled();
  });
});
