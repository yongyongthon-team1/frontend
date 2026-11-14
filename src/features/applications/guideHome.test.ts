import { describe, expect, it } from 'vitest';
import type { TourSummary } from '@/features/tours/model';
import { guideTodos } from './guideHome';
import type { GuideTourSummary } from './model';

const base: TourSummary = {
  id: 7,
  title: '경희대 컴퓨터공학과 탐방',
  universityId: 1,
  universityName: '경희대학교',
  universityShortName: '경희대',
  campusName: '국제캠퍼스',
  major: '컴퓨터공학과',
  guideName: '박가이드',
  guideVerified: true,
  startsAt: '2026-11-12T14:00:00+09:00',
  endsAt: '2026-11-12T16:30:00+09:00',
  capacity: 5,
  approvedCount: 0,
  remainingSeats: 5,
  status: 'RECRUITING',
};

const tour = (
  counts: { total: number; pending: number; approved: number },
  courseStatus: GuideTourSummary['courseStatus'] = null,
): GuideTourSummary => ({ ...base, counts, courseStatus });

describe('guideTodos', () => {
  it('대기가 있으면 신청자 확인 카드(→ 신청자 화면)', () => {
    const [todo] = guideTodos(tour({ total: 3, pending: 3, approved: 0 }));
    expect(todo).toEqual({
      title: '대기 중인 신청자 3명 확인',
      description: '학생들의 관심사를 확인하고 승인해요.',
      action: { label: '신청자 확인하기', to: '/guide/tours/7/applicants' },
    });
  });

  it('코스 없음 + 승인 1명 이상이면 코스 초안 만들기(→ 초안 생성)', () => {
    const todos = guideTodos(tour({ total: 3, pending: 1, approved: 2 }));
    expect(todos.map((t) => t.action.label)).toEqual(['신청자 확인하기', '코스 초안 만들기']);
    expect(todos[1]!.action.to).toBe('/guide/tours/7/course/draft?generate=1');
  });

  it('코스 초안이면 코스 이어서 편집(→ edit)', () => {
    const todos = guideTodos(tour({ total: 2, pending: 0, approved: 2 }, 'DRAFT'));
    expect(todos).toHaveLength(1);
    expect(todos[0]!.action).toEqual({
      label: '코스 이어서 편집',
      to: '/guide/tours/7/course/edit',
    });
  });

  it('코스가 확정이면 확정 코스 보기(→ confirm)', () => {
    const todos = guideTodos(tour({ total: 2, pending: 0, approved: 2 }, 'CONFIRMED'));
    expect(todos).toHaveLength(1);
    expect(todos[0]!.action).toEqual({
      label: '확정 코스 보기',
      to: '/guide/tours/7/course/confirm',
    });
  });

  it('코스가 확정이어도 대기가 남았으면 신청자 확인이 먼저, 확정 코스 보기가 다음', () => {
    const todos = guideTodos(tour({ total: 3, pending: 1, approved: 2 }, 'CONFIRMED'));
    expect(todos.map((t) => t.action.label)).toEqual(['신청자 확인하기', '확정 코스 보기']);
    expect(todos[1]!.action.to).toBe('/guide/tours/7/course/confirm');
  });

  it('대기도 승인도 없고 코스도 없으면 할 일이 없다', () => {
    expect(guideTodos(tour({ total: 1, pending: 0, approved: 0 }))).toEqual([]);
  });
});
