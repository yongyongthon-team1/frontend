import type { ActionLink } from '@/shared/lib/types';
import { coursePathFor, type GuideTourSummary } from './model';

export interface GuideTodo {
  title: string;
  description: string;
  action: ActionLink;
}

/**
 * 가이드 홈(G01)의 `오늘 해야 할 일`: 지금 집중하는 탐방에서 다음에 할 일을 위에서부터 늘어놓는다.
 * 대기 신청이 있으면 신청자 확인, 그리고 코스 단계(없음 + 승인자 있음 · 초안 · 확정)에 따른 한 가지.
 */
export function guideTodos(tour: GuideTourSummary): GuideTodo[] {
  const { counts, courseStatus } = tour;
  const todos: GuideTodo[] = [];
  if (counts.pending > 0) {
    todos.push({
      title: `대기 중인 신청자 ${counts.pending}명 확인`,
      description: '학생들의 관심사를 확인하고 승인해요.',
      action: { label: '신청자 확인하기', to: `/guide/tours/${tour.id}/applicants` },
    });
  }
  const coursePath = coursePathFor(tour.id, courseStatus, counts.approved);
  if (courseStatus === 'CONFIRMED') {
    todos.push({
      title: '코스를 확정했어요',
      description: '확정한 코스와 쿠폰 발급 현황을 확인해요.',
      action: { label: '확정 코스 보기', to: coursePath },
    });
  } else if (courseStatus === 'DRAFT') {
    todos.push({
      title: '코스 초안을 편집하고 있어요',
      description: '장소를 다듬고 코스를 확정해요.',
      action: { label: '코스 이어서 편집', to: coursePath },
    });
  } else if (counts.approved > 0) {
    todos.push({
      title: `승인한 학생 ${counts.approved}명의 코스 준비`,
      description: '승인한 학생들의 관심사로 AI 코스 초안을 만들어요.',
      action: { label: '코스 초안 만들기', to: coursePath },
    });
  }
  return todos;
}
