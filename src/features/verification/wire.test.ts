import { describe, expect, it } from 'vitest';
import { toCamel } from '@/shared/lib/caseKeys';
import { CONSENT_VIEW } from '@/test/fixtures/backend/verification';
import { fromWireConsentView, type WireConsentView } from './wire';

describe('fromWireConsentView (명세 U-06 예시)', () => {
  it('보호자 안내 조회를 도메인 모양으로 읽는다', () => {
    expect(fromWireConsentView(toCamel<WireConsentView>(CONSENT_VIEW.data))).toEqual({
      studentName: '김하늘',
      schoolName: '용인고등학교',
      guideText: '용용톤은 방학 중 대학생 가이드와 캠퍼스를 둘러보는 서비스입니다 ...',
      status: 'PENDING',
      expiresAt: '2026-11-11T21:00:00+09:00',
    });
  });

  it('학교 · 기한이 null이면 그대로 null', () => {
    expect(
      fromWireConsentView({
        studentName: '김하늘',
        schoolName: null,
        guideText: '안내',
        status: 'AGREED',
        expiresAt: null,
      }),
    ).toEqual({
      studentName: '김하늘',
      schoolName: null,
      guideText: '안내',
      status: 'AGREED',
      expiresAt: null,
    });
  });
});
