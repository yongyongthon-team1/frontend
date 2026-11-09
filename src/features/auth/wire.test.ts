import { describe, expect, it } from 'vitest';
import { toCamel } from '@/shared/lib/caseKeys';
import { ME_HIGH_SCHOOL, ME_UNIVERSITY } from '@/test/fixtures/backend/auth';
import { fromWireMe, type WireMe } from './wire';

const wire = (data: unknown) => toCamel<WireMe>(data);

describe('fromWireMe', () => {
  it('고교생 명세 예시: 학교 · 학년 · 관심 학과가 studentProfile로, 보호자 동의 상태가 guardianStatus로', () => {
    expect(fromWireMe(wire(ME_HIGH_SCHOOL.data), null)).toEqual({
      id: 1,
      email: 'hs01@example.com',
      name: '김하늘',
      role: 'HIGH_SCHOOL',
      verificationStatus: 'APPROVED',
      rejectionReason: null,
      guardianStatus: 'AGREED',
      studentProfile: { highSchoolName: '용인고등학교', grade: 2, interestedMajor: '컴퓨터공학' },
      guideProfile: null,
      businessVerified: false,
      storeId: null,
    });
  });

  it('대학생 명세 예시(university_id 없음): 보호자 동의 NONE · 학생 프로필 없음 · 가이드 학교는 null', () => {
    expect(fromWireMe(wire(ME_UNIVERSITY.data), null)).toEqual({
      id: 2,
      email: 'univ01@example.com',
      name: '이준호',
      role: 'UNIVERSITY',
      verificationStatus: 'APPROVED',
      rejectionReason: null,
      guardianStatus: 'NONE',
      studentProfile: null,
      guideProfile: {
        universityId: null,
        major: '컴퓨터공학과',
        introduction: '신입생 때부터 동아리 활동을 했어요',
      },
      businessVerified: false,
      storeId: null,
    });
  });

  it('배포 백엔드의 university_id가 guideProfile.universityId가 된다', () => {
    const me = fromWireMe(wire({ ...ME_UNIVERSITY.data, university_id: 3 }), null);
    expect(me.guideProfile?.universityId).toBe(3);
  });

  it('11/9 배포 백엔드 실응답(인증 전 대학생): 모든 프로필 칸 null · 보호자 동의 null은 NONE', () => {
    const me = fromWireMe(
      wire({
        id: 2,
        email: 'smoke-university@uniro.test',
        name: '점검UN',
        role: 'UNIVERSITY',
        verification_status: 'NONE',
        reject_reason: null,
        school_name: null,
        university_id: null,
        grade: null,
        interest_major: null,
        guardian_consent_status: null,
        guide_profile: null,
      }),
      null,
    );
    expect(me).toMatchObject({
      verificationStatus: 'NONE',
      guardianStatus: 'NONE',
      studentProfile: null,
      guideProfile: null,
    });
  });

  it('가이드 프로필이 없으면(null) guideProfile도 null', () => {
    const me = fromWireMe(wire({ ...ME_UNIVERSITY.data, guide_profile: null }), null);
    expect(me.guideProfile).toBeNull();
  });

  it('반려 사유는 rejectionReason으로', () => {
    const me = fromWireMe(
      wire({ ...ME_HIGH_SCHOOL.data, verification_status: 'REJECTED', reject_reason: '흐려요' }),
      null,
    );
    expect(me).toMatchObject({ verificationStatus: 'REJECTED', rejectionReason: '흐려요' });
  });

  it('사장님: 인증이 APPROVED면 businessVerified, 가게 id는 인자 그대로', () => {
    const owner = { ...ME_HIGH_SCHOOL.data, role: 'OWNER', school_name: null, grade: null };
    const approved = fromWireMe(
      wire({ ...owner, interest_major: null, guardian_consent_status: null }),
      201,
    );
    expect(approved).toMatchObject({
      role: 'OWNER',
      businessVerified: true,
      storeId: 201,
      studentProfile: null,
      guideProfile: null,
      guardianStatus: 'NONE',
    });
    const none = fromWireMe(wire({ ...owner, verification_status: 'NONE' }), null);
    expect(none).toMatchObject({ businessVerified: false, storeId: null });
  });
});
