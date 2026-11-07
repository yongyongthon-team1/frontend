import { describe, expect, it } from 'vitest';
import { toCamel } from '@/shared/lib/caseKeys';
import { ADMIN_VERIFICATION, ADMIN_VERIFICATIONS } from '@/test/fixtures/backend/admin';
import {
  fromWireAdminDetail,
  fromWireAdminItem,
  type WireAdminDetail,
  type WireAdminItem,
} from './wire';

describe('운영자 심사 어댑터 (명세 U-08 예시)', () => {
  it('목록 항목: verificationId → id', () => {
    const wire = toCamel<{ items: WireAdminItem[] }>(ADMIN_VERIFICATIONS.data).items[0]!;
    expect(fromWireAdminItem(wire)).toEqual({
      id: 10,
      userName: '김하늘',
      role: 'HIGH_SCHOOL',
      schoolName: '용인고등학교',
      submittedAt: '2026-11-04T21:00:00+09:00',
    });
  });

  it('상세: 항목 + documentUrl · status', () => {
    expect(fromWireAdminDetail(toCamel<WireAdminDetail>(ADMIN_VERIFICATION.data))).toEqual({
      id: 10,
      userName: '김하늘',
      role: 'HIGH_SCHOOL',
      schoolName: '용인고등학교',
      submittedAt: '2026-11-04T21:00:00+09:00',
      documentUrl: 'https://.../temp-signed-url',
      status: 'PENDING',
    });
  });

  it('documentUrl이 null이면 그대로 null', () => {
    const wire = toCamel<WireAdminDetail>({ ...ADMIN_VERIFICATION.data, document_url: null });
    expect(fromWireAdminDetail(wire).documentUrl).toBeNull();
  });
});
