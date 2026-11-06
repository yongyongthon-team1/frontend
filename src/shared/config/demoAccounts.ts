// 목업 · 시연 도구 · 화면이 같이 쓰는 시연 설정이다. 화면과 시연 도구가 `src/mocks`를 import하지 않도록 여기에 둔다
// (목업 코드는 실서버 모드 번들에 들어가면 안 된다).
export const DEMO_EMAILS = {
  student: 'student@demo.kr',
  guide: 'guide@demo.kr',
  owner: 'owner1@demo.kr',
  admin: 'admin@demo.kr',
  unverified: 'newbie@demo.kr',
  unverifiedGuide: 'guide-new@demo.kr',
  ownerUnverified: 'owner-new@demo.kr',
  ownerNoStore: 'owner-nostore@demo.kr',
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

/** 시연 패널 `P1 계정` 선택지: 인증 · 동의 · 가게 연결의 각 상태에 놓인 시드 계정(Task 3 패널이 쓴다). */
export const DEMO_P1_ACCOUNTS: readonly { email: string; label: string }[] = [
  { email: 'newbie@demo.kr', label: '고교생 · 인증 전 (최하늘)' },
  { email: 'waiting@demo.kr', label: '고교생 · 심사 중 · 동의 대기 (강하린)' },
  { email: 'rejected@demo.kr', label: '고교생 · 반려 · 동의 거부 (윤서아)' },
  { email: 'expired@demo.kr', label: '고교생 · 동의 링크 만료 (임채원)' },
  { email: 'pending@demo.kr', label: '고교생 · 심사 중 · 동의 완료 (오지호)' },
  { email: 'guide-new@demo.kr', label: '가이드 · 인증 전 (윤가온)' },
  { email: 'guide-pending@demo.kr', label: '가이드 · 심사 중 (한도윤)' },
  { email: 'guide-rejected@demo.kr', label: '가이드 · 반려 (서지안)' },
  { email: 'owner-new@demo.kr', label: '사장님 · 사업자 인증 전 (정해린)' },
  { email: 'owner-nostore@demo.kr', label: '사장님 · 가게 연결 전 (윤가람)' },
];

/**
 * 고정 보호자 동의 링크(`/consent/{토큰}`). 그 밖의 문자열은 404다.
 * `valid`는 유효, `expired`는 410(만료), `rejected` · `agreed`는 이미 처리된 링크다.
 */
export const DEMO_CONSENT_TOKENS = {
  valid: 'demo-consent-valid',
  expired: 'demo-consent-expired',
  rejected: 'demo-consent-rejected',
  agreed: 'demo-consent-agreed',
} as const;

export interface DemoBusiness {
  businessNumber: string;
  representativeName: string;
  /** `YYYY-MM-DD` */
  openingDate: string;
}

/**
 * 데모 사업자 번호. 각 항목은 그 번호의 등록 정보(번호 · 대표자명 · 개업일)다.
 * - `match`: 이 값을 그대로 넣으면 인증되고, 후보 상점 5 · 6이 뜬다.
 * - `mismatch`: 번호는 등록돼 있지만 대표자명 · 개업일이 `match`와 다르다. `match`의 대표자명 · 개업일을 넣으면 불일치 오류.
 * - `closed`: 번호만으로 폐업(`BIZ_CLOSED`)이다. 대표자명 · 개업일은 보지 않는다.
 */
export const DEMO_BUSINESS: Record<'match' | 'mismatch' | 'closed', DemoBusiness> = {
  match: {
    businessNumber: '123-45-67890',
    representativeName: '정해린',
    openingDate: '2021-03-02',
  },
  mismatch: {
    businessNumber: '111-11-11111',
    representativeName: '박도윤',
    openingDate: '2018-07-15',
  },
  closed: {
    businessNumber: '999-99-99999',
    representativeName: '최민호',
    openingDate: '2015-09-01',
  },
};
