import { approveApplication, applyToTour } from '@/mocks/rules/applications';
import { confirmCourse, createDraft } from '@/mocks/rules/courses';
import {
  DEMO_CONSENT_TOKENS,
  DEMO_MOTIVATION,
  DEMO_SEED_PASSWORD,
  type SeedCheckpoint,
} from '@/shared/config/demoAccounts';
import { addDaysKey, endOfSeoulDay, seoulDateAt, seoulDateKey } from '@/shared/lib/date';
import yonginStores from './data/yonginStores.json';
import { MOCK_DOC_SAMPLE } from './files';
import {
  MOCK_DB_VERSION,
  type ApplicationRow,
  type CouponRow,
  type DB,
  type GuardianConsentRow,
  type ReviewRow,
  type StoreRow,
  type TourRow,
  type VerificationRow,
} from './schema';

// 체크포인트 타입은 시연 도구와 같이 쓰려고 공용 설정에 있다(기존 import 경로를 위해 다시 내보낸다).
export type { SeedCheckpoint };

export const DEMO_TOUR_ID = 1;
export const DEMO_UNIVERSITY_ID = 2;

/** 시드 이후 규칙이 만드는 행의 ID는 여기서부터 시작한다. */
const FIRST_RUNTIME_ID = 1000;
/** 운영자(admin@demo.kr)는 사용자 목록의 마지막(18번)이다. 심사자 ID로 쓴다. */
const ADMIN_ID = 18;
const USED_TIMES = ['15:10', '15:20', '15:30', '15:40', '15:50'];

/** 용인시 상가정보 한 행(`data/yonginStores.json` — 출처 · 거른 조건은 `docs/reference/store-data.md`). */
type SourceStore = (typeof yonginStores.stores)[number];

/**
 * 시연 상점 1~6이 될 원본 행의 상가업소번호(이 순서가 상점 id다). 1~4는 경희대 국제캠퍼스 근처 제휴 상점(사장님 owner1~4),
 * 5 · 6은 단국대 죽전캠퍼스 근처 비제휴 상점이고 6이 사장님 가게 찾기 · 연결 시연 대상이다. 나머지 행은 7번부터 원본 순서로 붙는다.
 * 상호 · 업종 · 주소 · 좌표만 실데이터이고 제휴 · 리뷰 · 별점 · AI 요약 · 사장님 계정은 시연용으로 지어낸 값이다.
 */
export const DEMO_STORE_SOURCE_IDS = [
  'MA0101202307A0047445', // 1 렌토(양식) — 코스 초안의 식사 상점
  'MA0101202601A0003455', // 2 타임리스커피(카페) — 코스 초안의 카페
  'MA010120220803865506', // 3 땡큐꼬마김밥(분식)
  'MA010120220809860057', // 4 모모식당(한식)
  'MA0101202512A0040156', // 5 단(한식)
  'MA010120220813455695', // 6 일삼일구(카페) — 가게 찾기 · 연결 시연
] as const;

/** 원본 행 → 상점 행의 데이터 칸. */
function storeFields(source: SourceStore) {
  return {
    name: source.name,
    address: source.address,
    category: source.category,
    administrativeDong: source.administrativeDong,
    latitude: source.lat,
    longitude: source.lng,
  } satisfies Partial<StoreRow>;
}

function sourceStore(sourceId: string): SourceStore {
  const row = yonginStores.stores.find((s) => s.sourceId === sourceId);
  if (!row) throw new Error(`상점 데이터에 상가업소번호 ${sourceId}가 없다`);
  return row;
}

/** 테이블마다 1부터 순서대로 id를 붙여 넣는다(같은 입력이면 항상 같은 id). */
function add<T extends { id: number }>(rows: T[], row: Omit<T, 'id'>): T {
  const full = { ...row, id: rows.length + 1 } as T;
  rows.push(full);
  return full;
}

/**
 * 오늘(Asia/Seoul) 기준 상대 날짜로 시연용 DB를 만든다. 기본 시드(START)는 검증 규칙을 거치지 않고 직접 넣는다.
 * 체크포인트는 시연 골든 패스를 그 단계까지 진행한 DB다. 화면에서 하는 것과 같은 규칙 함수를 시드 날 10:00(KST)에
 * 차례로 불러 만든다(새 행 id는 `nextId`라 결정적, 쿠폰 코드만 매번 다르다).
 * - APPLIED: 김민지가 탐방 1에 `DEMO_MOTIVATION`으로 신청(승인 대기)
 * - APPROVED: + 정다은이 그 신청을 승인(승인 3명)
 * - CONFIRMED: + AI 코스 초안 생성 → 확정(승인자마다 제휴 상점 쿠폰 발급)
 */
export function createSeed(today: Date, checkpoint: SeedCheckpoint = 'START'): DB {
  const day = seoulDateKey(today);
  const rel = (days: number) => addDaysKey(day, days);
  const stamp = (days: number, hhmm = '09:00') => seoulDateAt(rel(days), hhmm);
  const created = stamp(-60);

  const db: DB = {
    version: MOCK_DB_VERSION,
    seedDay: day,
    users: [],
    studentProfiles: [],
    guideProfiles: [],
    verifications: [],
    guardianConsents: [],
    businessVerifications: [],
    universities: [],
    vacations: [],
    campusPlaces: [],
    tours: [],
    applications: [],
    courses: [],
    courseStops: [],
    stores: [],
    partnerships: [],
    coupons: [],
    reviews: [],
    reviewSummaries: [],
    tourWishes: [],
    sessions: [],
    nextId: FIRST_RUNTIME_ID,
  };

  // ── 대학 · 방학 · 캠퍼스 장소 ─────────────────────────────────────────
  const campuses = [
    {
      name: '강남대학교',
      campusName: '본교',
      address: '경기도 용인시 기흥구 강남로 40',
      lat: 37.2754,
      lng: 127.1315,
      dong: '구갈동',
    },
    {
      name: '경희대학교',
      campusName: '국제캠퍼스',
      address: '경기도 용인시 기흥구 덕영대로 1732',
      lat: 37.2397,
      lng: 127.0833,
      dong: '서천동',
    },
    {
      name: '단국대학교',
      campusName: '죽전캠퍼스',
      address: '경기도 용인시 수지구 죽전로 152',
      lat: 37.322,
      lng: 127.1253,
      dong: '죽전1동',
    },
    {
      name: '명지대학교',
      campusName: '자연캠퍼스',
      address: '경기도 용인시 처인구 명지로 116',
      lat: 37.2224,
      lng: 127.1903,
      dong: '역북동',
    },
    {
      name: '한국외국어대학교',
      campusName: '글로벌캠퍼스',
      address: '경기도 용인시 처인구 모현읍 외대로 81',
      lat: 37.3398,
      lng: 127.2655,
      dong: '모현읍',
    },
  ];
  for (const c of campuses) {
    const u = add(db.universities, {
      name: c.name,
      campusName: c.campusName,
      address: c.address,
      latitude: c.lat,
      longitude: c.lng,
      administrativeDong: c.dong,
    });
    add(db.vacations, {
      universityId: u.id,
      startDate: '2026-12-21',
      endDate: '2027-02-28',
      label: '2026 겨울방학',
    });
    add(db.vacations, {
      universityId: u.id,
      startDate: '2027-06-21',
      endDate: '2027-08-31',
      label: '2027 여름방학',
    });
  }

  const places: [number, string, string, number, number][] = [
    [1, '중앙도서관', '열람실과 스터디룸이 모여 있는 도서관', 37.2758, 127.1309],
    [1, '학생회관', '학생식당과 동아리방이 있는 건물', 37.2749, 127.1322],
    [2, '예술·디자인대학', '산업디자인 · 시각디자인 작업실과 전시 공간', 37.2411, 127.0815],
    [2, '중앙도서관', '열람실과 스터디룸이 모여 있는 도서관', 37.2405, 127.0838],
    [2, '학생회관', '학생식당과 동아리방이 있는 건물', 37.2392, 127.0829],
    [3, '소프트웨어융합대학', '컴퓨터 실습실과 프로젝트룸', 37.3226, 127.1247],
    [3, '중앙도서관', '열람실과 스터디룸이 모여 있는 도서관', 37.3216, 127.1259],
    [4, '공과대학', '실험실과 제작 공간이 있는 건물', 37.2229, 127.1897],
    [4, '학생회관', '학생식당과 동아리방이 있는 건물', 37.2219, 127.1909],
    [5, '글로벌센터', '통번역 실습실과 외국어 학습 공간', 37.3402, 127.2649],
    [5, '중앙도서관', '열람실과 스터디룸이 모여 있는 도서관', 37.3393, 127.2661],
  ];
  for (const [universityId, name, description, latitude, longitude] of places) {
    db.campusPlaces.push({
      campusBuildingId: db.campusPlaces.length + 1,
      universityId,
      name,
      description,
      latitude,
      longitude,
    });
  }

  // ── 사용자와 역할별 프로필 ─────────────────────────────────────────────
  /** 재학 인증 · 보호자 동의 행의 기본값에 덮어쓸 칸(P1 상태 계정이 쓴다). */
  interface SeedExtras {
    verification?: Partial<Omit<VerificationRow, 'id'>>;
    consent?: Partial<Omit<GuardianConsentRow, 'id'>>;
  }
  const student = (
    email: string,
    name: string,
    school: string,
    grade: number,
    major: string | null,
    verification: 'APPROVED' | 'PENDING' | 'REJECTED' | 'NONE',
    consent: 'AGREED' | 'PENDING' | 'REJECTED' | 'NONE',
    extras: SeedExtras = {},
  ) => {
    const u = add(db.users, {
      email,
      password: DEMO_SEED_PASSWORD,
      name,
      role: 'HIGH_SCHOOL',
      createdAt: created,
      updatedAt: created,
    });
    db.studentProfiles.push({
      id: u.id,
      highSchoolName: school,
      grade,
      interestedMajor: major,
      createdAt: created,
      updatedAt: created,
    });
    if (verification !== 'NONE') {
      db.verifications.push({
        id: u.id,
        highSchoolName: school,
        universityId: null,
        documentUrl: null,
        status: verification,
        rejectionReason: null,
        submittedAt: stamp(-55),
        reviewedAt: verification === 'APPROVED' ? stamp(-54) : null,
        reviewedBy: verification === 'APPROVED' ? ADMIN_ID : null,
        ...extras.verification,
      });
    }
    if (consent !== 'NONE') {
      db.guardianConsents.push({
        id: u.id,
        guardianName: `${name} 보호자`,
        guardianEmail: `guardian-${u.id}@demo.kr`,
        tokenHash: null,
        status: consent,
        expiresAt: stamp(-50),
        agreedAt: consent === 'AGREED' ? stamp(-54, '12:00') : null,
        createdAt: stamp(-55),
        updatedAt: stamp(-54, '12:00'),
        ...extras.consent,
      });
    }
    return u;
  };
  const minji = student(
    'student@demo.kr',
    '김민지',
    '수원영통고등학교',
    2,
    '산업디자인',
    'APPROVED',
    'AGREED',
  );
  student('newbie@demo.kr', '최하늘', '수원영통고등학교', 1, null, 'NONE', 'NONE');
  const seojun = student(
    'seojun@demo.kr',
    '박서준',
    '수원영통고등학교',
    3,
    '컴퓨터공학',
    'APPROVED',
    'AGREED',
  );
  const haeun = student(
    'haeun@demo.kr',
    '이하은',
    '용인홍천고등학교',
    3,
    '시각디자인',
    'APPROVED',
    'AGREED',
  );
  const yujin = student(
    'yujin@demo.kr',
    '최유진',
    '용인홍천고등학교',
    2,
    '통번역',
    'APPROVED',
    'AGREED',
  );
  const past1 = student(
    'past1@demo.kr',
    '정우진',
    '수원영통고등학교',
    3,
    '산업디자인',
    'APPROVED',
    'AGREED',
  );
  const past2 = student(
    'past2@demo.kr',
    '한소영',
    '용인홍천고등학교',
    3,
    '커뮤니케이션디자인',
    'APPROVED',
    'AGREED',
  );
  student('pending@demo.kr', '오지호', '수원영통고등학교', 1, '사회복지', 'PENDING', 'AGREED', {
    verification: { documentUrl: MOCK_DOC_SAMPLE.HIGH_SCHOOL, submittedAt: stamp(-1, '21:30') },
    consent: {
      tokenHash: DEMO_CONSENT_TOKENS.agreed,
      createdAt: stamp(-1, '21:35'),
      expiresAt: stamp(6, '21:35'),
      agreedAt: stamp(-1, '21:50'),
      updatedAt: stamp(-1, '21:50'),
    },
  });

  const guide = (
    email: string,
    name: string,
    universityId: number,
    major: string | null,
    introduction: string | null,
    verification: 'APPROVED' | 'PENDING' | 'REJECTED' | 'NONE' = 'APPROVED',
    extras: { verification?: SeedExtras['verification']; profile?: boolean } = {},
  ) => {
    const u = add(db.users, {
      email,
      password: DEMO_SEED_PASSWORD,
      name,
      role: 'UNIVERSITY',
      createdAt: created,
      updatedAt: created,
    });
    if (extras.profile !== false) {
      db.guideProfiles.push({
        id: u.id,
        universityId,
        major,
        introduction,
        createdAt: created,
        updatedAt: created,
      });
    }
    if (verification !== 'NONE') {
      db.verifications.push({
        id: u.id,
        highSchoolName: null,
        universityId,
        documentUrl: null,
        status: verification,
        rejectionReason: null,
        submittedAt: stamp(-58),
        reviewedAt: verification === 'APPROVED' ? stamp(-57) : null,
        reviewedBy: verification === 'APPROVED' ? ADMIN_ID : null,
        ...extras.verification,
      });
    }
    return u;
  };
  const guideKhu = guide(
    'guide@demo.kr',
    '정다은',
    2,
    '산업디자인학과',
    '디자인 공부와 캠퍼스 생활이 궁금한 학생들에게 실제 작업실과 수업 이야기를 들려줄게요.',
  );
  const guideDku = guide(
    'guide-dku@demo.kr',
    '이도현',
    3,
    '커뮤니케이션디자인학과',
    '시각 디자인 수업과 팀 프로젝트 경험을 편하게 이야기해 드릴게요.',
  );
  const guideMju = guide(
    'guide-mju@demo.kr',
    '김서연',
    4,
    '컴퓨터공학과',
    '코딩 수업과 동아리 활동이 어떤지 솔직하게 알려 드릴게요.',
  );
  const guideHufs = guide(
    'guide-hufs@demo.kr',
    '박지우',
    5,
    '통번역학과',
    '통번역 실습 수업과 어학 공부 방법을 같이 나눠요.',
  );
  const guideKnu = guide(
    'guide-knu@demo.kr',
    '최민호',
    1,
    '사회복지학부',
    '사회복지 현장 실습과 학과 분위기를 궁금한 만큼 알려 드릴게요.',
  );

  const owners = [
    ['owner1@demo.kr', '김순옥'],
    ['owner2@demo.kr', '이재훈'],
    ['owner3@demo.kr', '박미경'],
    ['owner4@demo.kr', '최동혁'],
  ].map(([email, name]) => {
    const u = add(db.users, {
      email,
      password: DEMO_SEED_PASSWORD,
      name,
      role: 'OWNER',
      createdAt: created,
      updatedAt: created,
    });
    db.businessVerifications.push({
      id: u.id,
      isVerified: true,
      verifiedAt: stamp(-56),
      updatedAt: stamp(-56),
    });
    return u;
  });
  const admin = add(db.users, {
    email: 'admin@demo.kr',
    password: DEMO_SEED_PASSWORD,
    name: '운영자',
    role: 'ADMIN',
    createdAt: created,
    updatedAt: created,
  });

  if (admin.id !== ADMIN_ID)
    throw new Error('시드 사용자 순서가 바뀌었다: 운영자 ID가 ADMIN_ID와 다르다');

  // ── P1 상태 계정 8명(운영자 뒤, 이 순서). 인증 · 동의 · 가게 연결의 각 상태를 보여 준다 ───────────
  student(
    'rejected@demo.kr',
    '윤서아',
    '수원영통고등학교',
    2,
    '시각디자인',
    'REJECTED',
    'REJECTED',
    {
      verification: {
        rejectionReason: '학생증 사진이 흐려서 학교 이름을 읽을 수 없어요.',
        submittedAt: stamp(-3, '20:00'),
        reviewedAt: stamp(-2, '10:00'),
        reviewedBy: ADMIN_ID,
      },
      consent: {
        tokenHash: DEMO_CONSENT_TOKENS.rejected,
        createdAt: stamp(-3, '20:05'),
        expiresAt: stamp(4, '20:05'),
        updatedAt: stamp(-3, '21:00'),
      },
    },
  );
  student('waiting@demo.kr', '강하린', '수원영통고등학교', 2, '경영학', 'PENDING', 'PENDING', {
    verification: { documentUrl: MOCK_DOC_SAMPLE.HIGH_SCHOOL, submittedAt: stamp(-1, '22:40') },
    consent: {
      tokenHash: DEMO_CONSENT_TOKENS.valid,
      createdAt: stamp(-1, '22:45'),
      expiresAt: stamp(6, '22:45'),
      updatedAt: stamp(-1, '22:45'),
    },
  });
  student('expired@demo.kr', '임채원', '용인홍천고등학교', 3, '통번역', 'APPROVED', 'PENDING', {
    verification: { submittedAt: stamp(-10), reviewedAt: stamp(-9) },
    consent: {
      tokenHash: DEMO_CONSENT_TOKENS.expired,
      createdAt: stamp(-8),
      expiresAt: stamp(-1),
      updatedAt: stamp(-8),
    },
  });
  guide('guide-new@demo.kr', '윤가온', 2, null, null, 'NONE', { profile: false });
  guide('guide-pending@demo.kr', '한도윤', 3, null, null, 'PENDING', {
    verification: { documentUrl: MOCK_DOC_SAMPLE.UNIVERSITY, submittedAt: stamp(-1, '18:05') },
  });
  guide(
    'guide-rejected@demo.kr',
    '서지안',
    4,
    '기계공학과',
    '기계공학과 실험 수업과 동아리 생활을 편하게 이야기해 드릴게요.',
    'REJECTED',
    {
      verification: {
        rejectionReason:
          '학생증 사진이 흐려 학교 이름을 확인할 수 없어요. 밝은 곳에서 다시 찍어 올려 주세요.',
        submittedAt: stamp(-3, '14:00'),
        reviewedAt: stamp(-1, '16:00'),
        reviewedBy: ADMIN_ID,
      },
    },
  );
  add(db.users, {
    email: 'owner-new@demo.kr',
    password: DEMO_SEED_PASSWORD,
    name: '정해린',
    role: 'OWNER',
    createdAt: created,
    updatedAt: created,
  });
  const ownerNoStore = add(db.users, {
    email: 'owner-nostore@demo.kr',
    password: DEMO_SEED_PASSWORD,
    name: '윤가람',
    role: 'OWNER',
    createdAt: created,
    updatedAt: created,
  });
  db.businessVerifications.push({
    id: ownerNoStore.id,
    isVerified: true,
    verifiedAt: stamp(-1),
    updatedAt: stamp(-1),
  });

  // ── 탐방 ────────────────────────────────────────────────────────────
  const tour = (
    guideId: number,
    universityId: number,
    startDay: string,
    from: string,
    to: string,
    capacity: number,
    introduction: string,
    openChatUrl: string,
    status: TourRow['status'],
    createdAt: string,
  ) =>
    add(db.tours, {
      guideId,
      universityId,
      title: null,
      startsAt: seoulDateAt(startDay, from),
      endsAt: seoulDateAt(startDay, to),
      capacity,
      introduction,
      openChatUrl,
      status,
      createdAt,
      updatedAt: createdAt,
    });
  const demoIntro =
    '산업디자인 작업실과 수업 이야기\n학생들이 자주 가는 대학가 식당과 카페까지 함께 둘러봐요.';
  const t1 = tour(
    guideKhu.id,
    2,
    day,
    '14:00',
    '16:30',
    5,
    demoIntro,
    'https://open.kakao.com/o/demo-khu-design',
    'RECRUITING',
    stamp(-14),
  );
  const t2 = tour(
    guideDku.id,
    3,
    rel(40),
    '10:00',
    '12:30',
    3,
    '시각 디자인 작업실과 팀 프로젝트 수업을 보고, 죽전 캠퍼스 주변 맛집도 함께 걸어봐요.',
    'https://open.kakao.com/o/demo-dku-design',
    'CLOSED',
    stamp(-14),
  );
  tour(
    guideMju.id,
    4,
    rel(45),
    '10:00',
    '12:30',
    5,
    '코딩 실습실과 동아리방을 둘러보고, 컴퓨터공학 수업이 어떤지 직접 들어봐요.',
    'https://open.kakao.com/o/demo-mju-cs',
    'RECRUITING',
    stamp(-14),
  );
  tour(
    guideHufs.id,
    5,
    rel(47),
    '10:00',
    '12:30',
    5,
    '통번역 실습실에서 수업 이야기를 듣고, 어학 공부 방법을 같이 나눠요.',
    'https://open.kakao.com/o/demo-hufs-interp',
    'RECRUITING',
    stamp(-14),
  );
  tour(
    guideKnu.id,
    1,
    rel(52),
    '10:00',
    '12:30',
    5,
    '사회복지 수업과 현장 실습 이야기를 듣고, 학과 분위기를 직접 느껴봐요.',
    'https://open.kakao.com/o/demo-knu-welfare',
    'RECRUITING',
    stamp(-14),
  );
  tour(
    guideKhu.id,
    2,
    rel(60),
    '14:00',
    '16:30',
    5,
    '겨울방학 캠퍼스 생활과 동아리 이야기를 나눠요.',
    'https://open.kakao.com/o/demo-khu-design-2',
    'RECRUITING',
    stamp(-14),
  );
  const t7 = tour(
    guideKhu.id,
    2,
    rel(-30),
    '14:00',
    '16:30',
    5,
    '산업디자인 작업실과 수업 이야기를 듣고, 대학가 식당과 카페도 함께 다녀왔어요.',
    'https://open.kakao.com/o/demo-khu-design-past',
    'COMPLETED',
    stamp(-45),
  );

  // ── 신청 ────────────────────────────────────────────────────────────
  const apply = (
    tourId: number,
    userId: number,
    motivation: string,
    status: ApplicationRow['status'],
    createdAt: string,
  ) =>
    add(db.applications, {
      tourId,
      userId,
      motivation,
      status,
      activeUserId: status === 'PENDING' || status === 'APPROVED' ? userId : null,
      createdAt,
      updatedAt: createdAt,
    });
  apply(t1.id, seojun.id, '학생들이 자주 가는 밥집이 궁금해요', 'APPROVED', stamp(-3));
  apply(t1.id, haeun.id, '카페에서 과제하는 분위기를 보고 싶어요', 'APPROVED', stamp(-3));
  apply(t1.id, yujin.id, '실기 준비 이야기를 듣고 싶어요', 'PENDING', stamp(-2));
  for (const u of [seojun, haeun, yujin]) {
    apply(t2.id, u.id, '커뮤니케이션디자인 수업이 어떤지 궁금해요', 'APPROVED', stamp(-5));
  }

  // ── 상점 · 제휴 ─────────────────────────────────────────────────────
  // 상점은 모두 용인시 상가정보 실데이터다. 1~4(경희대 근처)에만 사장님 · 제휴(시연 값)가 있다.
  const [partnerIds, otherDemoIds] = [
    DEMO_STORE_SOURCE_IDS.slice(0, 4),
    DEMO_STORE_SOURCE_IDS.slice(4),
  ];
  const discounts = [
    '식사 금액 10% 할인',
    '음료 1,000원 할인',
    '김밥 세트 1,500원 할인',
    '공깃밥 무료 추가',
  ];
  partnerIds.forEach((sourceId, i) => {
    const store = add(db.stores, {
      ownerId: owners[i].id,
      ...storeFields(sourceStore(sourceId)),
      createdAt: created,
      updatedAt: created,
    });
    add(db.partnerships, {
      storeId: store.id,
      discountDescription: discounts[i],
      condition: '투어 당일 · 1회 사용 가능',
      startDate: rel(-30),
      endDate: rel(90),
      createdAt: created,
      updatedAt: created,
    });
  });
  // 경희대 밖의 비제휴 상점(단국대 근처) 5 · 6, 그다음 나머지 실데이터 상점(사장님 · 제휴 · 리뷰 없음)
  const demoIds = new Set<string>(DEMO_STORE_SOURCE_IDS);
  for (const source of [
    ...otherDemoIds.map(sourceStore),
    ...yonginStores.stores.filter((s) => !demoIds.has(s.sourceId)),
  ]) {
    add(db.stores, {
      ownerId: null,
      ...storeFields(source),
      createdAt: created,
      updatedAt: created,
    });
  }
  if (db.stores.length >= FIRST_RUNTIME_ID)
    throw new Error('시드 상점 id가 런타임 id(FIRST_RUNTIME_ID)와 겹친다');

  // ── 지난 탐방(7)의 승인 신청 · 사용 쿠폰 · 리뷰 ────────────────────────
  const authors = [seojun, haeun, yujin, past1, past2];
  const t7Apps = authors.map((u) =>
    apply(t7.id, u.id, '대학 수업과 캠퍼스 분위기가 궁금했어요', 'APPROVED', stamp(-40)),
  );
  const reviewPlan: Record<number, { ratings: number[]; contents: string[]; codes: string[] }> = {
    1: {
      ratings: [5, 5, 4, 5, 4],
      contents: [
        '양이 푸짐하고 사장님이 친절하세요.',
        '가격 대비 정말 만족스러웠어요.',
        '맛있는데 점심시간엔 줄이 길어요.',
        '혼자 와서 먹기에도 편해요.',
        '시험 기간엔 사람이 많지만 음식은 빨리 나와요.',
      ],
      codes: ['381204', '552917', '207735', '694418', '130862'],
    },
    2: {
      ratings: [5, 4, 4, 5, 4],
      contents: [
        '콘센트 자리가 많아서 과제하기 좋았어요.',
        '조용해서 오래 앉아 있기 편해요.',
        '음료가 맛있는데 디저트는 일찍 떨어져요.',
        '분위기가 아늑하고 사장님이 친절해요.',
        '자리가 넉넉해서 팀 과제하기 좋아요.',
      ],
      codes: ['846051', '273396', '915540', '468127', '702683'],
    },
  };
  const partnershipOf = (storeId: number) => db.partnerships.find((p) => p.storeId === storeId)!;
  for (const storeId of [1, 2]) {
    const plan = reviewPlan[storeId];
    const partnership = partnershipOf(storeId);
    authors.forEach((author, i) => {
      const coupon: CouponRow = add(db.coupons, {
        applicationId: t7Apps[i].id,
        storeId,
        partnershipId: partnership.id,
        code: plan.codes[i],
        status: 'USED',
        discountSnapshot: partnership.discountDescription,
        issuedAt: stamp(-33, '10:00'),
        expiresAt: endOfSeoulDay(rel(-30)),
        usedAt: seoulDateAt(rel(-30), USED_TIMES[i]),
      });
      const review: Omit<ReviewRow, 'id'> = {
        userId: author.id,
        tourId: t7.id,
        storeId,
        couponId: coupon.id,
        rating: plan.ratings[i],
        content: plan.contents[i],
        createdAt: stamp(-29, '10:00'),
        updatedAt: stamp(-29, '10:00'),
      };
      add(db.reviews, review);
    });
  }
  add(db.reviewSummaries, {
    storeId: 1,
    summary:
      '학생들은 양이 넉넉하고 사장님이 친절하다고 해요. 시험 기간엔 줄이 길다는 평이 있어요.',
    reviewCount: 5,
    generatedAt: stamp(-28),
  });
  add(db.reviewSummaries, {
    storeId: 2,
    summary: '콘센트 자리가 많아 과제하기 좋다는 평이 많아요. 디저트는 일찍 떨어진대요.',
    reviewCount: 5,
    generatedAt: stamp(-28),
  });

  // 탐방 희망 사항(T-01) 시드: 가이드 화면(T-08)이 비지 않게 학생 넷의 글을 둔다(제안 문구, 가상의 글). 김민지는 시연에서 처음 남긴다.
  const wishRows = [
    [
      haeun,
      2,
      '시각디자인',
      '디자인 작업실에서 선배들이 과제하는 모습을 보고, 학생 식당도 가 보고 싶어요.',
      null,
      stamp(-3, '19:20'),
    ],
    [
      past1,
      2,
      '산업디자인',
      '제품 디자인 수업에서 무엇을 만드는지 궁금해요.\n실기 준비 이야기도 듣고 싶어요.',
      null,
      stamp(-6, '21:05'),
    ],
    [
      seojun,
      4,
      '컴퓨터공학',
      '코딩 동아리가 어떤 프로젝트를 하는지 보고 싶어요.',
      rel(45),
      stamp(-4, '20:10'),
    ],
    [
      yujin,
      5,
      '통번역',
      '통역 실습실을 구경하고 선배에게 어학 공부법을 묻고 싶어요.',
      null,
      stamp(-2, '18:40'),
    ],
  ] as const;
  for (const [author, universityId, major, content, preferredDate, at] of wishRows) {
    add(db.tourWishes, {
      userId: author.id,
      universityId,
      major,
      content,
      preferredDate,
      createdAt: at,
      updatedAt: at,
    });
  }

  // 김민지(student@demo.kr)는 시연에서 직접 신청하는 학생이라 START에는 신청 · 쿠폰이 없다.
  if (checkpoint === 'START') return db;

  // ── 체크포인트: 시연 순서 그대로 규칙 함수를 거친다 ────────────────────────
  const at = new Date(seoulDateAt(day, '10:00'));
  const application = applyToTour(db, minji.id, t1.id, DEMO_MOTIVATION, at);
  if (checkpoint === 'APPLIED') return db;
  approveApplication(db, guideKhu.id, application.id, at);
  if (checkpoint === 'APPROVED') return db;
  createDraft(db, guideKhu.id, t1.id, at);
  confirmCourse(db, guideKhu.id, t1.id, at);
  return db;
}
