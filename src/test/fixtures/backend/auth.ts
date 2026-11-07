// `docs/api/backend-spec.md` U-01~U-04(가입 · 로그인 · 로그아웃 · 내 정보 · 내 정보 수정 · 가이드 프로필)의 응답 예시
// (한 글자도 바꾸지 않았다). 명세 예시에는 timestamp가 없다.
export const SIGNUP_OK = {
  code: 'S201',
  message: '회원가입 성공',
  data: {
    id: 1,
    email: 'hs01@example.com',
    name: '김하늘',
    role: 'HIGH_SCHOOL',
    created_at: '2026-11-04T21:00:00+09:00',
  },
};

export const SIGNUP_DUPLICATE = { code: 'E409', message: '이미 가입된 이메일입니다', data: null };

export const LOGIN_OK = {
  code: 'S200',
  message: '로그인 성공',
  data: {
    access_token: 'eyJhbGciOi...',
    user: { id: 1, name: '김하늘', role: 'HIGH_SCHOOL', verification_status: 'NONE' },
  },
};

export const LOGIN_FAILED = {
  code: 'E401_INVALID_CREDENTIALS',
  message: '이메일 또는 비밀번호가 올바르지 않습니다',
  data: null,
};

export const LOGOUT_OK = { code: 'S200', message: '로그아웃 성공', data: null };

export const ME_HIGH_SCHOOL = {
  code: 'S200',
  message: '조회 성공',
  data: {
    id: 1,
    email: 'hs01@example.com',
    name: '김하늘',
    role: 'HIGH_SCHOOL',
    verification_status: 'APPROVED',
    reject_reason: null,
    school_name: '용인고등학교',
    grade: 2,
    interest_major: '컴퓨터공학',
    guardian_consent_status: 'AGREED',
    guide_profile: null,
  },
};

export const ME_UNIVERSITY = {
  code: 'S200',
  message: '조회 성공',
  data: {
    id: 2,
    email: 'univ01@example.com',
    name: '이준호',
    role: 'UNIVERSITY',
    verification_status: 'APPROVED',
    reject_reason: null,
    school_name: '단국대학교 죽전캠퍼스',
    grade: null,
    interest_major: null,
    guardian_consent_status: null,
    guide_profile: { major: '컴퓨터공학과', intro: '신입생 때부터 동아리 활동을 했어요' },
  },
};

export const ME_PATCH_OK = {
  code: 'S200',
  message: '수정 성공',
  data: {
    id: 1,
    name: '김하늘',
    school_name: '용인고등학교',
    grade: 2,
    interest_major: '컴퓨터공학',
  },
};

export const GUIDE_PROFILE_OK = {
  code: 'S200',
  message: '저장 성공',
  data: { major: '컴퓨터공학과', intro: '신입생 때부터 동아리 활동을 했어요' },
};
