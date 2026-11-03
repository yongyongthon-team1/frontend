import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { SeedCheckpoint } from '@/mocks/db/seed';
import { getDb, mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { formatTourDate } from '@/shared/lib/date';
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

describe('탐방 코스 지도 (hs-s08)', () => {
  it('확정 코스: 도식 지도 핀 3개와 지점 목록', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
    const id = findApplicationId(STUDENT, 1);
    await router.navigate(`/my-tours/${id}/course`);
    expect(await screen.findByText('오늘의 탐방 코스')).toBeInTheDocument();
    expect(await screen.findByText('학교에서 동네까지, 2시간 30분')).toBeInTheDocument();
    const map = await screen.findByTestId('schematic-map');
    expect(within(map).getAllByRole('button')).toHaveLength(3);
    expect(within(map).getByRole('button', { name: '② 서천 밥상' })).toBeInTheDocument();

    const startsAt = getDb().tours.find((t) => t.id === 1)!.startsAt;
    expect(screen.getByText(`${formatTourDate(startsAt)} · 경희대 국제캠퍼스`)).toBeInTheDocument();
    expect(screen.getByText('① 예술·디자인대학 · 14:00')).toBeInTheDocument();
    expect(
      screen.getByText('산업디자인학과 전공 공간에서 실제 수업 이야기를 들어요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('② 서천 밥상 · 15:10')).toBeInTheDocument();
    expect(screen.getByText('③ 카페 모래시계 · 16:00')).toBeInTheDocument();
    expect(screen.getAllByText('공공데이터 기반 추천 · 쿠폰 사용 가능')).toHaveLength(2);
    expect(screen.getByRole('link', { name: '제휴 상점 쿠폰 확인' })).toHaveAttribute(
      'href',
      `/my-tours/${id}/coupons`,
    );
  });

  it('제휴 지점 카드는 한줄평(없으면 추천 이유)과 쿠폰 안내를 함께 보인다', async () => {
    await openCourseMap('CONFIRMED', () =>
      mutate((db) => {
        db.courseStops.find((s) => s.tourId === 1 && s.stopOrder === 2)!.description =
          '양이 넉넉한 학생 단골 밥집';
      }),
    );
    const meal = await screen.findByRole('button', { name: /② 서천 밥상 · 15:10/ });
    expect(within(meal).getByText('양이 넉넉한 학생 단골 밥집')).toBeInTheDocument();
    expect(within(meal).getByText('공공데이터 기반 추천 · 쿠폰 사용 가능')).toBeInTheDocument();

    const cafeReason = getDb().courseStops.find(
      (s) => s.tourId === 1 && s.stopOrder === 3,
    )!.recommendationReason!;
    const cafe = screen.getByRole('button', { name: /③ 카페 모래시계 · 16:00/ });
    expect(within(cafe).getByText(cafeReason)).toBeInTheDocument();
    expect(within(cafe).getByText('공공데이터 기반 추천 · 쿠폰 사용 가능')).toBeInTheDocument();
  });

  it('지점을 누르면 AI 리뷰 요약 시트', async () => {
    const { user, id } = await openCourseMap('CONFIRMED');
    await user.click(await screen.findByRole('button', { name: '② 서천 밥상' }));
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
    await user.click(await screen.findByRole('button', { name: /③ 카페 모래시계 · 16:00/ }));
    const sheet = await screen.findByRole('dialog', { name: '카페 모래시계' });
    expect(within(sheet).getByText('아직 리뷰가 없어요.')).toBeInTheDocument();
    expect(within(sheet).queryByText('✦ AI 리뷰 요약')).not.toBeInTheDocument();
    expect(within(sheet).getByText('제휴 혜택 · 음료 1,000원 할인')).toBeInTheDocument();
    expect(within(sheet).queryByRole('link', { name: '쿠폰 보기' })).not.toBeInTheDocument();
  });

  it('미확정이면 준비 중', async () => {
    await openCourseMap('APPROVED');
    expect(await screen.findByText('가이드가 코스를 준비 중이에요')).toBeInTheDocument();
    expect(screen.getByText('확정되면 지도와 쿠폰이 열려요.')).toBeInTheDocument();
    expect(screen.queryByTestId('schematic-map')).not.toBeInTheDocument();
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
    expect(screen.queryByText('가이드가 코스를 준비 중이에요')).not.toBeInTheDocument();
    // 요청이 나갔다면 MSW에 닿을 만큼 다른 화면을 한 번 그린 뒤에 센다.
    await router.navigate(`/my-tours/${id}`);
    expect(
      await screen.findByText('가이드가 신청을 승인하면 지도와 쿠폰이 공개돼요.'),
    ).toBeInTheDocument();
    expect(courseGets).toBe(0);
  });

  it('그 밖의 403(FORBIDDEN)은 준비 중', async () => {
    server.use(
      http.get('/api/tours/:id/course', () =>
        HttpResponse.json({ code: 'FORBIDDEN', message: 'x' }, { status: 403 }),
      ),
    );
    await openCourseMap('CONFIRMED');
    expect(await screen.findByText('가이드가 코스를 준비 중이에요')).toBeInTheDocument();
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
    expect(screen.queryByText('가이드가 코스를 준비 중이에요')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('학교에서 동네까지, 2시간 30분')).toBeInTheDocument();
  });

  it('종료 시각이 없으면 소요 시간 없이 제목만', async () => {
    await openCourseMap('CONFIRMED', () =>
      mutate((db) => {
        db.tours.find((t) => t.id === 1)!.endsAt = null;
      }),
    );
    expect(await screen.findByText('학교에서 동네까지')).toBeInTheDocument();
  });

  it('신청을 불러오지 못하면 오류와 다시 시도', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
    await router.navigate('/my-tours/999999/course');
    expect(await screen.findByText('찾을 수 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});
