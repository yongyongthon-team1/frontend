import { describe, expect, it } from 'vitest';
import {
  documentView,
  REJECT_REASON_MAX,
  rejectReasonError,
  SUBJECT_CHECK_LABEL,
  SUBJECT_ROLE_LABEL,
} from './model';

describe('documentView (처리된 건은 사진이 지워진 상태)', () => {
  it('대기 + 주소 있음 → IMAGE, 대기 + 주소 없음 → MISSING', () => {
    expect(documentView({ status: 'PENDING', documentUrl: '/mock-docs/student-id-hs.svg' })).toBe(
      'IMAGE',
    );
    expect(documentView({ status: 'PENDING', documentUrl: null })).toBe('MISSING');
  });

  it('승인 · 반려는 주소가 와도 DELETED', () => {
    expect(documentView({ status: 'APPROVED', documentUrl: null })).toBe('DELETED');
    expect(documentView({ status: 'REJECTED', documentUrl: 'https://x/y.png' })).toBe('DELETED');
  });
});

describe('상수', () => {
  it('반려 사유는 100자, 역할 문구', () => {
    expect(REJECT_REASON_MAX).toBe(100);
    expect(SUBJECT_ROLE_LABEL).toEqual({ HIGH_SCHOOL: '고교생', UNIVERSITY: '대학생' });
    expect(SUBJECT_CHECK_LABEL).toEqual({ HIGH_SCHOOL: '재학 확인', UNIVERSITY: '학교 확인' });
  });
});

describe('rejectReasonError', () => {
  it('공백만 · 빈 문자열은 입력 요청 문구', () => {
    expect(rejectReasonError('')).toBe('반려 사유를 입력해 주세요.');
    expect(rejectReasonError('  \n ')).toBe('반려 사유를 입력해 주세요.');
  });

  it('공백을 뺀 100자는 통과, 101자는 초과 문구', () => {
    expect(rejectReasonError(` ${'가'.repeat(100)} `)).toBeNull();
    expect(rejectReasonError('가'.repeat(101))).toBe('100자 이내로 적어 주세요.');
  });
});
