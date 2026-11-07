import type { Me } from '@/features/auth/model';
import type { ActionLink } from '@/shared/lib/types';

/**
 * 연결된 가게가 없는 사장님의 다음 행동(쿠폰 사용 · 제휴 · 가게 수정 가드 공통). 사업자 인증을 마쳤으면 가게 연결,
 * 아니면 사업자 인증부터다. 내 정보를 아직 모르면(`undefined`) 인증 전으로 본다.
 */
export function connectActionFor(me: Pick<Me, 'businessVerified'> | undefined): ActionLink {
  return me?.businessVerified
    ? { label: '가게 연결하기', to: '/owner/store/connect' }
    : { label: '사업자 인증하기', to: '/owner/verify' };
}
