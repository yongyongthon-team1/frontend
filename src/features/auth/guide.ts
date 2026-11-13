import { errorMessage } from '@/shared/lib/errors';
import type { ActionLink } from '@/shared/lib/types';
import type { Me } from './model';

/** 가이드 프로필이 작성됐는지(학과가 공백뿐이면 아직이다). 첫 화면 판정(`getLandingPath`)도 같은 기준을 쓴다. */
export function hasGuideProfile(me: Me): boolean {
  return (me.guideProfile?.major ?? '').trim() !== '';
}

export interface TourCreateBlock {
  code: 'NOT_VERIFIED' | 'GUIDE_PROFILE_REQUIRED';
  chip: string;
  reason: string;
  action: ActionLink;
}

const NOT_VERIFIED_CHIP = '재학 인증 승인 필요';
const PROFILE_LINK: ActionLink = { label: '가이드 프로필 작성하기', to: '/guide/me/profile' };

/**
 * 가이드가 탐방을 개설하지 못하는 이유. 막히지 않았으면 null.
 * 위에서부터 첫 조건이다: 인증 전 · 반려 → 심사 중(학과 없음 · 있음) → 승인됐지만 학과 없음.
 */
export function tourCreateBlock(me: Me): TourCreateBlock | null {
  const profile = hasGuideProfile(me);
  switch (me.verificationStatus) {
    case 'NONE':
    case 'REJECTED':
      return {
        code: 'NOT_VERIFIED',
        chip: NOT_VERIFIED_CHIP,
        reason: '학생증 또는 재학증명서 인증 후에만 투어를 개설할 수 있어요.',
        action: { label: '역할 인증 단계로 이동', to: '/guide/verify' },
      };
    case 'PENDING':
      return {
        code: 'NOT_VERIFIED',
        chip: NOT_VERIFIED_CHIP,
        reason: '승인 전에는 투어를 개설할 수 없습니다.',
        action: profile ? { label: '인증 상태 보기', to: '/guide/verify' } : PROFILE_LINK,
      };
    case 'APPROVED':
      return profile
        ? null
        : {
            code: 'GUIDE_PROFILE_REQUIRED',
            chip: '가이드 프로필 작성 필요',
            reason: errorMessage('GUIDE_PROFILE_REQUIRED'),
            action: PROFILE_LINK,
          };
  }
}
