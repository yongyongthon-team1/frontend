import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { SeedCheckpoint } from '@/mocks/db/seed';
import { getDb, mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { formatDotDateWeekday, formatMonthDay } from '@/shared/lib/date';
import { findApplicationId, renderApp } from '@/test/renderApp';

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
      }),
    );
    await user.click(await screen.findByRole('button', { name: /카페 모래시계/ }));
    const sheet = await screen.findByRole('dialog', { name: '카페 모래시계' });
    expect(within(sheet).getByText('아직 리뷰가 없어요.')).toBeInTheDocument();
    expect(within(sheet).queryByText('✦ AI 리뷰 요약')).not.toBeInTheDocument();
    expect(within(sheet).getByText('제휴 혜택 · 음료 1,000원 할인')).toBeInTheDocument();
    expect(within(sheet).queryByRole('link', { name: '쿠폰 보기' })).not.toBeInTheDocument();
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
      http.get('/api/tours/:id/course', () => {
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
    server.use(
      http.get('/api/tours/:id/course', () =>
        HttpResponse.json({ code: 'FORBIDDEN', message: 'x' }, { status: 403 }),
      ),
    );
    await openCourseMap('CONFIRMED');
    expect(await screen.findByText('코스 확정을 기다려요')).toBeInTheDocument();
  });

  it('그 밖의 코스 오류는 다시 시도할 수 있다', async () => {
    server.use(
      http.get(
        '/api/tours/:id/course',
        () => HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 }),
        { once: true },
      ),
    );
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
