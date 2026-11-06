import { approveApplication, applyToTour } from '@/mocks/rules/applications';
import { confirmCourse, createDraft } from '@/mocks/rules/courses';
import {
  DEMO_MOTIVATION,
  DEMO_SEED_PASSWORD,
  type SeedCheckpoint,
} from '@/shared/config/demoAccounts';
import { addDaysKey, endOfSeoulDay, seoulDateAt, seoulDateKey } from '@/shared/lib/date';
import {
  MOCK_DB_VERSION,
  type ApplicationRow,
  type CouponRow,
  type DB,
  type ReviewRow,
  type TourRow,
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
  const student = (
    email: string,
    name: string,
    school: string,
    grade: number,
    major: string | null,
    verification: 'APPROVED' | 'PENDING' | 'NONE',
    consent: 'AGREED' | 'NONE',
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
      });
    }
    if (consent === 'AGREED') {
      db.guardianConsents.push({
        id: u.id,
        guardianName: `${name} 보호자`,
        guardianEmail: `guardian-${u.id}@demo.kr`,
        tokenHash: null,
        status: 'AGREED',
        expiresAt: stamp(-50),
        agreedAt: stamp(-54, '12:00'),
        createdAt: stamp(-55),
        updatedAt: stamp(-54, '12:00'),
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
  student('pending@demo.kr', '오지호', '수원영통고등학교', 1, '사회복지', 'PENDING', 'AGREED');

  const guide = (
    email: string,
    name: string,
    universityId: number,
    major: string,
    introduction: string,
  ) => {
    const u = add(db.users, {
      email,
      password: DEMO_SEED_PASSWORD,
      name,
      role: 'UNIVERSITY',
      createdAt: created,
      updatedAt: created,
    });
    db.guideProfiles.push({
      id: u.id,
      universityId,
      major,
      introduction,
      createdAt: created,
      updatedAt: created,
    });
    db.verifications.push({
      id: u.id,
      highSchoolName: null,
      universityId,
      documentUrl: null,
      status: 'APPROVED',
      rejectionReason: null,
      submittedAt: stamp(-58),
      reviewedAt: stamp(-57),
      reviewedBy: ADMIN_ID,
    });
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
  const storeSeeds = [
    {
      owner: owners[0],
      name: '서천 밥상',
      category: '한식',
      address: '경기도 용인시 기흥구 서천동 서천로 21',
      lat: 37.2417,
      lng: 127.0848,
      dong: '서천동',
      discount: '식사 금액 10% 할인',
    },
    {
      owner: owners[1],
      name: '카페 모래시계',
      category: '카페',
      address: '경기도 용인시 기흥구 서천동 서천로 8',
      lat: 37.2405,
      lng: 127.0821,
      dong: '서천동',
      discount: '음료 1,000원 할인',
    },
    {
      owner: owners[2],
      name: '영통 분식집',
      category: '분식',
      address: '경기도 용인시 기흥구 서천동 덕영대로 1701',
      lat: 37.237,
      lng: 127.087,
      dong: '서천동',
      discount: '떡볶이 세트 1,500원 할인',
    },
    {
      owner: owners[3],
      name: '보드게임 카페 다이스',
      category: '보드게임카페',
      address: '경기도 용인시 기흥구 서천동 서천로 45',
      lat: 37.244,
      lng: 127.079,
      dong: '서천동',
      discount: '1시간 무료 연장',
    },
  ];
  for (const s of storeSeeds) {
    const store = add(db.stores, {
      ownerId: s.owner.id,
      name: s.name,
      address: s.address,
      category: s.category,
      administrativeDong: s.dong,
      latitude: s.lat,
      longitude: s.lng,
      createdAt: created,
      updatedAt: created,
    });
    add(db.partnerships, {
      storeId: store.id,
      discountDescription: s.discount,
      startDate: rel(-30),
      endDate: rel(90),
      createdAt: created,
      updatedAt: created,
    });
  }
  // 경희대 밖의 비제휴 상점(단국대 근처)
  add(db.stores, {
    ownerId: null,
    name: '죽전 돼지국밥',
    address: '경기도 용인시 수지구 죽전로 144',
    category: '한식',
    administrativeDong: '죽전1동',
    latitude: 37.3231,
    longitude: 127.1262,
    createdAt: created,
    updatedAt: created,
  });
  add(db.stores, {
    ownerId: null,
    name: '카페 단풍',
    address: '경기도 용인시 수지구 죽전로 160',
    category: '카페',
    administrativeDong: '죽전1동',
    latitude: 37.3212,
    longitude: 127.1241,
    createdAt: created,
    updatedAt: created,
  });

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
        '된장찌개가 집밥 같아요.',
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
