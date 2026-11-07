import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { SeedCheckpoint } from '@/mocks/db/seed';
import { getDb, mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { formatDotDateWeekday, formatMonthDay } from '@/shared/lib/date';
import { COURSE_VIEW } from '@/test/fixtures/backend/courses';
import { STORE_REVIEWS } from '@/test/fixtures/backend/reviews';
import { findApplicationId, redeemDemoCoupon, renderApp } from '@/test/renderApp';
import { wireFail, wireOk } from '@/test/wire';

const STUDENT = 'student@demo.kr';
const PENDING_STUDENT = 'yujin@demo.kr';

/** 김민지(시연 학생)의 탐방 1 신청 코스 지도를 연다. `prepare`는 화면을 열기 전에 목업 DB를 고친다. */
async function openCourseMap(
  checkpoint: SeedCheckpoint,
  prepare?: (applicationId: number) => void,
) {
  const result = await renderApp('/my-tours', { as: 'student', checkpoint });
  const id = findApplicationId(STUDENT, 1);
  prepare?.(id);
  await result.router.navigate(`/my-tours/${id}/course`);
  return { ...result, id };
}

describe('코스 보기 V2 (hs-s08 · H04 · H14)', () => {
  it('확정 코스: 단계 막대 · 시간표 3장, 지도는 닫혀 있다', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
    const id = findApplicationId(STUDENT, 1);
    await router.navigate(`/my-tours/${id}/course`);
    expect(await screen.findByRole('heading', { name: '코스 보기' })).toBeInTheDocument();
    expect(await screen.findByText('함께 걸을 캠퍼스와 동네')).toBeInTheDocument();
    expect(screen.getByText('우리의 2시간 30분 코스')).toBeInTheDocument();
    expect(screen.getByText('3개 장소')).toBeInTheDocument();
    expect(screen.getByText('학교에서 동네까지')).toBeInTheDocument();
    expect(screen.getByText('도보로 이어지는 탐방')).toBeInTheDocument();
    expect(screen.getByText('3개 장소 · 일정을 위아래로 스크롤해 확인하세요')).toBeInTheDocument();

    const tour = getDb().tours.find((t) => t.id === 1)!;
    expect(
      screen.getByText(`경희대 국제캠퍼스 산업디자인학과 탐방 · ${formatMonthDay(tour.startsAt)}`),
    ).toBeInTheDocument();

    // 단계 막대: 번호 원 1~3 + 종류 라벨
    const steps = screen.getByTestId('course-step-bar');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(within(steps).getByText('캠퍼스')).toBeInTheDocument();
    expect(within(steps).getByText('식사')).toBeInTheDocument();
    expect(within(steps).getByText('카페')).toBeInTheDocument();

    // 시간표 3장: 시간 알약 · 이름 · 머무는 분(2A-R6)
    const timeline = screen.getByTestId('course-timeline');
    expect(within(timeline).getAllByRole('button')).toHaveLength(3);
    expect(within(timeline).getByText('14:00')).toBeInTheDocument();
    expect(within(timeline).getByText('예술·디자인대학')).toBeInTheDocument();
    expect(within(timeline).getByText(/· 70분$/)).toBeInTheDocument();
    expect(within(timeline).getByText(/· 50분$/)).toBeInTheDocument();
    expect(within(timeline).getByText(/· 30분$/)).toBeInTheDocument();
    expect(
      within(timeline).getByText('산업디자인학과 전공 공간에서 실제 수업 이야기를 들어요. · 70분'),
    ).toBeInTheDocument();
    expect(within(timeline).getAllByText('공공데이터 기반 추천 · 쿠폰 사용 가능')).toHaveLength(2);

    // 지도는 닫혀 있다(카카오 SDK도 부르지 않는다)
    expect(screen.getByRole('button', { name: '지도로 보기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByTestId('schematic-map')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: '내 쿠폰 확인하기' })).toHaveAttribute(
      'href',
      `/my-tours/${id}/coupons`,
    );
  });

  it('지도로 보기를 펼치면 도식 지도 핀 3개(2A-R5), 접으면 사라진다', async () => {
    const { user } = await openCourseMap('CONFIRMED');
    const toggle = await screen.findByRole('button', { name: '지도로 보기' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const map = await screen.findByTestId('schematic-map');
    expect(within(map).getAllByRole('button')).toHaveLength(3);
    // 지도 핀을 눌러도 같은 상점 시트가 열린다
    await user.click(within(map).getByRole('button', { name: '② 서천 밥상' }));
    expect(await screen.findByRole('dialog', { name: '서천 밥상' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('schematic-map')).not.toBeInTheDocument();
  });

  it('제휴 지점 카드는 한줄평(없으면 추천 이유)과 쿠폰 안내를 함께 보인다', async () => {
    await openCourseMap('CONFIRMED', () =>
      mutate((db) => {
        db.courseStops.find((s) => s.tourId === 1 && s.stopOrder === 2)!.description =
          '양이 넉넉한 학생 단골 밥집';
      }),
    );
    const meal = await screen.findByRole('button', { name: /서천 밥상/ });
    expect(within(meal).getByText('양이 넉넉한 학생 단골 밥집 · 50분')).toBeInTheDocument();
    // 가이드 한줄평에는 AI 표시가 없다.
    expect(within(meal).queryByText('AI 추천 이유:')).not.toBeInTheDocument();
    expect(within(meal).getByText('공공데이터 기반 추천 · 쿠폰 사용 가능')).toBeInTheDocument();

    const cafeReason = getDb().courseStops.find(
      (s) => s.tourId === 1 && s.stopOrder === 3,
    )!.recommendationReason!;
    const cafe = screen.getByRole('button', { name: /카페 모래시계/ });
    expect(within(cafe).getByText(`${cafeReason} · 30분`)).toBeInTheDocument();
    // AI 추천 이유에는 ✦(장식)와 화면 낭독기용 표시가 붙는다.
    expect(within(cafe).getByText('AI 추천 이유:')).toBeInTheDocument();
    expect(within(cafe).getByText('✦')).toHaveAttribute('aria-hidden', 'true');
    expect(within(cafe).getByText('공공데이터 기반 추천 · 쿠폰 사용 가능')).toBeInTheDocument();
  });

  it('지점을 누르면 AI 리뷰 요약 시트', async () => {
    const { user, id } = await openCourseMap('CONFIRMED');
    await user.click(await screen.findByRole('button', { name: /서천 밥상/ }));
    expect(await screen.findByText('✦ AI 리뷰 요약')).toBeInTheDocument();
    const sheet = screen.getByRole('dialog', { name: '서천 밥상' });
    expect(within(sheet).getByText('15:10 · 한식')).toBeInTheDocument();
    expect(within(sheet).getByText('추천 이유')).toBeInTheDocument();
    expect(
      within(sheet).getByText(
        '학생들은 양이 넉넉하고 사장님이 친절하다고 해요. 시험 기간엔 줄이 길다는 평이 있어요.',
      ),
    ).toBeInTheDocument();
    expect(within(sheet).getByText('별점 4.6 · 리뷰 5개')).toBeInTheDocument();
    expect(within(sheet).getByText('공공데이터(인허가) 기반')).toBeInTheDocument();
    expect(within(sheet).getByText('제휴 혜택 · 식사 금액 10% 할인')).toBeInTheDocument();
    const coupon = getDb().coupons.find((c) => c.applicationId === id && c.storeId === 1)!;
    expect(within(sheet).getByRole('link', { name: '쿠폰 보기' })).toHaveAttribute(
      'href',
      `/coupons/${coupon.id}`,
    );
  });

  it('목록에서 고른 제휴 상점에 내 쿠폰 · 리뷰가 없으면 혜택만 보인다', async () => {
    const { user } = await openCourseMap('CONFIRMED', (id) =>
      mutate((db) => {
        db.coupons = db.coupons.filter((c) => !(c.applicationId === id && c.storeId === 2));
        db.reviews = db.reviews.filter((r) => r.storeId !== 2);
        db.reviewSummaries = db.reviewSummaries.filter((r) => r.storeId !== 2);
      }),
    );
    await user.click(await screen.findByRole('button', { name: /카페 모래시계/ }));
    const sheet = await screen.findByRole('dialog', { name: '카페 모래시계' });
    expect(within(sheet).getByText('아직 리뷰가 없어요.')).toBeInTheDocument();
    expect(within(sheet).queryByText('✦ AI 리뷰 요약')).not.toBeInTheDocument();
    expect(within(sheet).getByText('제휴 혜택 · 음료 1,000원 할인')).toBeInTheDocument();
    expect(within(sheet).queryByRole('link', { name: '쿠폰 보기' })).not.toBeInTheDocument();
  });

  it('리뷰 수가 없어도 AI 리뷰 요약이 있으면 요약을 보이고, 별점 줄 · 리뷰 없음 문구는 없다 (2C-R12 ⑥)', async () => {
    // 확장 없는 명세 C-04 예시: 상점 지점에 review_summary만 있고 리뷰 평균 · 개수가 없다.
    server.use(http.get('/api/tours/:tourId/course', () => wireOk(COURSE_VIEW.data)));
    const { user } = await openCourseMap('CONFIRMED');
    await user.click(await screen.findByRole('button', { name: /용인 분식/ }));
    const sheet = await screen.findByRole('dialog', { name: '용인 분식' });
    expect(within(sheet).getByText('✦ AI 리뷰 요약')).toBeInTheDocument();
    expect(within(sheet).getByText('양이 많고 가격이 착하다는 평이 많아요')).toBeInTheDocument();
    expect(within(sheet).queryByText(/리뷰 0개/)).not.toBeInTheDocument();
    expect(within(sheet).queryByText('아직 리뷰가 없어요.')).not.toBeInTheDocument();
    expect(within(sheet).getByText('제휴 혜택 · 쿠폰 사용 가능')).toBeInTheDocument();
  });

  it('상점 시트는 R-02 응답의 요약 · 별점 · 리뷰 수와 접힌 최근 리뷰 3개를 보인다 (2B′-R16)', async () => {
    const { user } = await openCourseMap('CONFIRMED');
    await user.click(await screen.findByRole('button', { name: /서천 밥상/ }));
    const sheet = await screen.findByRole('dialog', { name: '서천 밥상' });
    expect(within(sheet).getByText('✦ AI 리뷰 요약')).toBeInTheDocument();
    // 요약 문장은 R-02 응답(가장 최근 요약 행)의 것 — 목업이 코스 지점 값과 같은 행을 준다.
    expect(within(sheet).getByText(/^학생들은 양이 넉넉하고/)).toBeInTheDocument();
    expect(within(sheet).getByText('별점 4.6 · 리뷰 5개')).toBeInTheDocument();
    const toggle = await within(sheet).findByRole('button', { name: '최근 리뷰 3개' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(sheet).queryByText('시험 기간엔 사람이 많지만 음식은 빨리 나와요.'),
    ).not.toBeInTheDocument();
    await user.click(toggle);
    expect(
      within(sheet).getByText('시험 기간엔 사람이 많지만 음식은 빨리 나와요.'),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole('list', { name: '최근 리뷰' })).toBeInTheDocument();
  });

  it('캠퍼스 지점 시트는 상점 리뷰를 부르지 않는다 (상점 시트를 먼저 열어 양성 대조)', async () => {
    const reviewGets: string[] = [];
    const { user } = await openCourseMap('CONFIRMED');
    server.events.on('request:start', ({ request }) => {
      const { pathname } = new URL(request.url);
      if (request.method === 'GET' && pathname.startsWith('/api/stores/')) {
        reviewGets.push(pathname);
      }
    });
    await user.click(await screen.findByRole('button', { name: /서천 밥상/ }));
    await screen.findByRole('button', { name: '최근 리뷰 3개' });
    expect(reviewGets).toEqual(['/api/stores/1/reviews']); // 양성 대조: 상점 지점은 부른다
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: /예술·디자인대학/ }));
    const sheet = await screen.findByRole('dialog', { name: '예술·디자인대학' });
    // 요청이 나갈 시간을 준 뒤 센다.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(within(sheet).queryByRole('button', { name: /최근 리뷰/ })).not.toBeInTheDocument();
    expect(reviewGets).toEqual(['/api/stores/1/reviews']);
  });

  it('R-02 요청이 실패하면 시트는 지점 요약 그대로이고 오류 문구 · 최근 리뷰 버튼이 없다', async () => {
    server.use(http.get('/api/stores/:storeId/reviews', () => wireFail('E500')));
    const { user, queryClient } = await openCourseMap('CONFIRMED');
    await user.click(await screen.findByRole('button', { name: /서천 밥상/ }));
    const sheet = await screen.findByRole('dialog', { name: '서천 밥상' });
    // 5xx는 한 번 더 시도한다 — 오류 상태가 될 때까지 기다린 뒤에 단언해야 실패 처리를 증명한다(PM4).
    await waitFor(
      () => expect(queryClient.getQueryState(qk.storeReviews(1))?.status).toBe('error'),
      {
        timeout: 3000,
      },
    );
    expect(within(sheet).getByText('✦ AI 리뷰 요약')).toBeInTheDocument();
    expect(within(sheet).getByText(/^학생들은 양이 넉넉하고/)).toBeInTheDocument();
    expect(within(sheet).getByText('별점 4.6 · 리뷰 5개')).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: /최근 리뷰/ })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(sheet).queryByText(/오류|실패|다시 시도/)).not.toBeInTheDocument();
  }, 10_000);

  it('실서버 모양(C-04 코스 + R-02 리뷰): 요약 · 별점은 R-02 값, 최근 리뷰는 R-02 항목', async () => {
    server.use(
      http.get('/api/tours/:tourId/course', () => wireOk(COURSE_VIEW.data)),
      http.get('/api/stores/:storeId/reviews', () => wireOk(STORE_REVIEWS.data)),
    );
    const { user } = await openCourseMap('CONFIRMED');
    await user.click(await screen.findByRole('button', { name: /용인 분식/ }));
    const sheet = await screen.findByRole('dialog', { name: '용인 분식' });
    expect(await within(sheet).findByText('별점 4.5 · 리뷰 11개')).toBeInTheDocument();
    expect(within(sheet).getByText('양이 많고 가격이 착하다는 평이 많아요')).toBeInTheDocument();
    const toggle = within(sheet).getByRole('button', { name: '최근 리뷰 1개' });
    await user.click(toggle);
    expect(within(sheet).getByText('양도 많고 맛있었어요')).toBeInTheDocument();
    expect(within(sheet).getByText(/^김\*늘 · /)).toBeInTheDocument();
  });

  it('미확정이면 준비 중', async () => {
    await openCourseMap('APPROVED');
    expect(await screen.findByRole('heading', { name: '코스 준비 중' })).toBeInTheDocument();
    expect(screen.getByText('탐방 코스를 준비하고 있어요.')).toBeInTheDocument();
    expect(screen.getByText('가이드가 신청자들의 관심사를 모으고 있어요.')).toBeInTheDocument();
    expect(screen.getByText('코스 확정을 기다려요')).toBeInTheDocument();
    expect(
      screen.getByText('가이드가 최종 확정하면 지도와 장소별 설명이 열려요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('참여 확정')).toBeInTheDocument();
    const tour = getDb().tours.find((t) => t.id === 1)!;
    expect(
      screen.getByText(`경희대학교 국제캠퍼스 · ${formatDotDateWeekday(tour.startsAt)}`),
    ).toBeInTheDocument();
    const steps = screen.getByRole('list');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(
      within(steps)
        .getByText(/가이드가 코스 초안 검토 · 확정/)
        .closest('li'),
    ).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByTestId('schematic-map')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '내 쿠폰 확인하기' })).not.toBeInTheDocument();
  });

  it('승인 대기 신청은 코스가 확정돼 있어도 코스를 부르지 않고 승인 안내를 보인다', async () => {
    let courseGets = 0;
    server.use(
      http.get('/api/tours/:tourId/course', () => {
        courseGets += 1;
        return undefined; // 기본 핸들러로 넘긴다
      }),
    );
    // 체크포인트 CONFIRMED에서도 최유진의 탐방 1 신청은 승인 대기다(시드).
    const { router } = await renderApp('/my-tours', {
      as: PENDING_STUDENT,
      checkpoint: 'CONFIRMED',
    });
    const id = findApplicationId(PENDING_STUDENT, 1);
    await router.navigate(`/my-tours/${id}/course`);
    expect(await screen.findByText('가이드 승인을 기다리고 있어요')).toBeInTheDocument();
    expect(screen.getByText('승인되면 지도와 쿠폰이 열려요.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '코스 준비 중' })).toBeInTheDocument();
    expect(screen.queryByText('코스 확정을 기다려요')).not.toBeInTheDocument();
    // 요청이 나갔다면 MSW에 닿을 만큼 다른 화면을 한 번 그린 뒤에 센다.
    await router.navigate(`/my-tours/${id}`);
    expect(
      await screen.findByText('가이드가 신청을 승인하면 지도와 쿠폰이 공개돼요.'),
    ).toBeInTheDocument();
    expect(courseGets).toBe(0);
  });

  it.each([
    ['REJECTED', '신청 거절', 'bg-danger-soft'],
    ['CANCELED', '취소됨', 'bg-neutral-100'],
  ] as const)(
    '%s 신청은 참여 확정 · 코스 확정 대기 문구 없이 상태 칩과 신청 내역 링크만',
    async (status, chipLabel, chipBg) => {
      const { id } = await openCourseMap('CONFIRMED', (applicationId) => {
        mutate((db) => {
          db.applications.find((a) => a.id === applicationId)!.status = status;
        });
      });
      expect(await screen.findByText('이 신청으로는 코스를 볼 수 없어요.')).toBeInTheDocument();
      expect(screen.getByText(chipLabel).closest('div')).toHaveClass(chipBg);
      expect(screen.queryByText('참여 확정')).not.toBeInTheDocument();
      expect(screen.queryByText('코스 확정을 기다려요')).not.toBeInTheDocument();
      expect(screen.queryByText('가이드 승인을 기다리고 있어요')).not.toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument(); // 진행 단계 표시 없음
      expect(screen.getByRole('link', { name: '신청 내역 보기' })).toHaveAttribute(
        'href',
        `/my-tours/${id}`,
      );
      expect(screen.queryByRole('link', { name: '내 쿠폰 확인하기' })).not.toBeInTheDocument();
    },
  );

  it('그 밖의 403(FORBIDDEN)은 준비 중', async () => {
    server.use(http.get('/api/tours/:tourId/course', () => wireFail('E403')));
    await openCourseMap('CONFIRMED');
    expect(await screen.findByText('코스 확정을 기다려요')).toBeInTheDocument();
  });

  it('그 밖의 코스 오류는 다시 시도할 수 있다', async () => {
    server.use(http.get('/api/tours/:tourId/course', () => wireFail('E404'), { once: true }));
    const { user } = await openCourseMap('CONFIRMED');
    expect(await screen.findByText('찾을 수 없어요.')).toBeInTheDocument();
    expect(screen.queryByText('코스 확정을 기다려요')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('우리의 2시간 30분 코스')).toBeInTheDocument();
  });

  it('종료 시각이 없으면 소요 시간 없이 제목만', async () => {
    await openCourseMap('CONFIRMED', () =>
      mutate((db) => {
        db.tours.find((t) => t.id === 1)!.endsAt = null;
      }),
    );
    expect(await screen.findByText('우리의 탐방 코스')).toBeInTheDocument();
    // 마지막 지점은 머무는 분을 생략한다(2A-R6)
    expect(screen.queryByText(/· 30분$/)).not.toBeInTheDocument();
    expect(screen.getByText(/· 70분$/)).toBeInTheDocument();
  });

  it('신청을 불러오지 못하면 오류와 다시 시도', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
    await router.navigate('/my-tours/999999/course');
    expect(await screen.findByText('찾을 수 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});

describe('상점 시트의 리뷰 진입 (R-01)', () => {
  it('사용한 쿠폰의 상점 시트는 리뷰 쓰기(주) + 쿠폰 보기(보조)', async () => {
    const { user, id } = await openCourseMap('CONFIRMED', () => {
      redeemDemoCoupon(1);
    });
    await user.click(await screen.findByRole('button', { name: /서천 밥상/ }));
    const sheet = await screen.findByRole('dialog', { name: '서천 밥상' });
    const coupon = getDb().coupons.find((c) => c.applicationId === id && c.storeId === 1)!;
    expect(within(sheet).getByRole('link', { name: '리뷰 쓰기' })).toHaveAttribute(
      'href',
      `/reviews/new?couponId=${coupon.id}`,
    );
    const couponLink = within(sheet).getByRole('link', { name: '쿠폰 보기' });
    expect(couponLink).toHaveAttribute('href', `/coupons/${coupon.id}`);
    expect(couponLink.className).toContain('bg-brand-soft'); // secondary
    expect(within(sheet).getByRole('link', { name: '리뷰 쓰기' }).className).toContain('bg-brand ');
  });

  it('아직 쓰지 않은 쿠폰의 시트에는 리뷰 쓰기가 없고 쿠폰 보기가 주 버튼이다', async () => {
    const { user } = await openCourseMap('CONFIRMED');
    await user.click(await screen.findByRole('button', { name: /서천 밥상/ }));
    const sheet = await screen.findByRole('dialog', { name: '서천 밥상' });
    expect(within(sheet).getByRole('link', { name: '쿠폰 보기' }).className).toContain('bg-brand ');
    expect(within(sheet).queryByRole('link', { name: '리뷰 쓰기' })).not.toBeInTheDocument();
    expect(within(sheet).queryByText('리뷰 작성 완료')).not.toBeInTheDocument();
  });

  it('?storeId=가 있으면 그 상점 시트를 연 채 시작하고, 닫으면 주소에서 storeId가 빠진다', async () => {
    const { router, user, id } = await openCourseMap('CONFIRMED');
    await router.navigate(`/my-tours/${id}/course?storeId=1`);
    const sheet = await screen.findByRole('dialog', { name: '서천 밥상' });
    expect(within(sheet).getByText('✦ AI 리뷰 요약')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe(`/my-tours/${id}/course`);
    expect(router.state.location.search).toBe('');
  });

  it('?storeId=가 이 코스에 없는 상점이면 시트 없이 코스만 보인다', async () => {
    const { router, id } = await openCourseMap('CONFIRMED');
    await router.navigate(`/my-tours/${id}/course?storeId=999`);
    await screen.findByText('함께 걸을 캠퍼스와 동네');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('리뷰를 쓴 상점의 시트는 리뷰 작성 완료를 보인다', async () => {
    const { router, user, id } = await openCourseMap('CONFIRMED', () => {
      redeemDemoCoupon(1);
    });
    const coupon = getDb().coupons.find((c) => c.applicationId === id && c.storeId === 1)!;
    await router.navigate(`/reviews/new?couponId=${coupon.id}`);
    await user.click(await screen.findByRole('radio', { name: '별점 5점' }));
    await user.type(screen.getByLabelText('좋았던 점과 아쉬웠던 점'), '최고예요');
    await user.click(screen.getByRole('button', { name: '리뷰 등록하기' }));
    const sheet = await screen.findByRole('dialog', { name: '서천 밥상' });
    expect(await within(sheet).findByText('리뷰 작성 완료')).toBeInTheDocument();
    expect(within(sheet).queryByRole('link', { name: '리뷰 쓰기' })).not.toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: '쿠폰 보기' })).toBeInTheDocument();
  });
});
