import type { Tone } from '@/shared/lib/types';
import type { VerificationStatus } from './model';

/** 관심 전공 글을 `,` `·` `/` 기준으로 나눠 다듬는다(빈 것은 뺀다). H16 `관심 전공` 개수. */
export function splitInterests(text: string | null): string[] {
  if (text === null) return [];
  return text
    .split(/[,·/]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

export interface Badge {
  label: string;
  tone: Tone;
}

/** 고교생 MY(H16) 프로필 카드의 인증 배지. 승인 문구는 V2, 나머지 셋은 제안 문구. */
export function verificationBadge(status: VerificationStatus): Badge {
  switch (status) {
    case 'APPROVED':
      return { label: '학생증 인증 완료', tone: 'success' };
    case 'PENDING':
      return { label: '학생증 심사 중', tone: 'info' };
    case 'REJECTED':
      return { label: '학생증 인증 반려', tone: 'danger' };
    case 'NONE':
      return { label: '학생증 인증 전', tone: 'neutral' };
  }
}

/** 가이드 MY(G12) 프로필 카드의 재학 인증 배지. 승인 문구는 V2, 나머지 셋은 제안 문구. */
export function guideVerificationBadge(status: VerificationStatus): Badge {
  switch (status) {
    case 'APPROVED':
      return { label: '재학 인증 완료', tone: 'success' };
    case 'PENDING':
      return { label: '재학 인증 심사 중', tone: 'info' };
    case 'REJECTED':
      return { label: '재학 인증 반려', tone: 'danger' };
    case 'NONE':
      return { label: '재학 인증 전', tone: 'neutral' };
  }
}

/**
 * G12 프로필 카드의 학교 줄: `{학교 · 캠퍼스} · {학과}`. 대학을 모르면 학과만, 학과가 없으면 프로필 등록 안내다.
 * `campus`는 `campusLabel(...)`로 만든 글이다.
 */
export function guideSchoolLine(campus: string | null, major: string | null): string {
  const trimmed = (major ?? '').trim();
  if (trimmed === '') return '가이드 프로필을 등록해 주세요';
  return campus === null ? trimmed : `${campus} · ${trimmed}`;
}
