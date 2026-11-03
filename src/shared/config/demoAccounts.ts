// 목업 · 시연 도구 · 화면이 같이 쓰는 시연 설정이다. 화면과 시연 도구가 `src/mocks`를 import하지 않도록 여기에 둔다
// (목업 코드는 실서버 모드 번들에 들어가면 안 된다).
export const DEMO_EMAILS = {
  student: 'student@demo.kr',
  guide: 'guide@demo.kr',
  owner: 'owner1@demo.kr',
  admin: 'admin@demo.kr',
  unverified: 'newbie@demo.kr',
} as const;

export type DemoRole = 'student' | 'guide' | 'owner' | 'admin';

/** 시연 패널의 역할 전환 순서(원클릭 링크 `?as=`가 받는 값). */
export const DEMO_ROLES: readonly DemoRole[] = ['student', 'guide', 'owner', 'admin'];

/** 목업 시드 계정의 비밀번호. 실서버 시연 계정은 env `VITE_DEMO_PASSWORD`를 쓴다(판정 10). */
export const DEMO_SEED_PASSWORD = 'demo1234';

/** 시연 데이터 체크포인트: 골든 패스를 그 단계까지 진행한 시드(목업 시드 · 시연 초기화 `{ checkpoint }`). */
export type SeedCheckpoint = 'START' | 'APPLIED' | 'APPROVED' | 'CONFIRMED';
export const SEED_CHECKPOINTS: readonly SeedCheckpoint[] = [
  'START',
  'APPLIED',
  'APPROVED',
  'CONFIRMED',
];

export const DEMO_MOTIVATION =
  '실기 준비와 대학에서 배우는 수업이 궁금하고, 학생들이 자주 가는 밥집도 가 보고 싶어요.';

/** storeId → 사장님 이메일 */
export const DEMO_STORE_OWNERS: Record<number, string> = {
  1: 'owner1@demo.kr',
  2: 'owner2@demo.kr',
  3: 'owner3@demo.kr',
  4: 'owner4@demo.kr',
};
