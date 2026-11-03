// 목업 · 시연 도구 · 화면이 같이 쓰는 시연 설정이다. 화면이 `src/mocks`를 import하지 않도록 여기에 둔다.
export const DEMO_EMAILS = {
  student: 'student@demo.kr',
  guide: 'guide@demo.kr',
  owner: 'owner1@demo.kr',
  admin: 'admin@demo.kr',
  unverified: 'newbie@demo.kr',
} as const;

export type DemoRole = 'student' | 'guide' | 'owner' | 'admin';

export const DEMO_MOTIVATION =
  '실기 준비와 대학에서 배우는 수업이 궁금하고, 학생들이 자주 가는 밥집도 가 보고 싶어요.';

/** storeId → 사장님 이메일 */
export const DEMO_STORE_OWNERS: Record<number, string> = {
  1: 'owner1@demo.kr',
  2: 'owner2@demo.kr',
  3: 'owner3@demo.kr',
  4: 'owner4@demo.kr',
};
