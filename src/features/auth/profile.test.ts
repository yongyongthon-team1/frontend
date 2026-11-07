import { describe, expect, it } from 'vitest';
import {
  guideSchoolLine,
  guideVerificationBadge,
  splitInterests,
  verificationBadge,
} from './profile';

describe('splitInterests', () => {
  it('쉼표 · 가운뎃점 · 슬래시로 나눠 다듬고 빈 것은 뺀다', () => {
    expect(splitInterests('디자인 · 산업디자인')).toEqual(['디자인', '산업디자인']);
    expect(splitInterests('경영학, 통번역 / 심리학')).toEqual(['경영학', '통번역', '심리학']);
    expect(splitInterests(' 디자인 ,, · ')).toEqual(['디자인']);
  });

  it('하나뿐이면 한 개, 비었거나 null이면 빈 배열', () => {
    expect(splitInterests('산업디자인')).toEqual(['산업디자인']);
    expect(splitInterests('')).toEqual([]);
    expect(splitInterests('   ')).toEqual([]);
    expect(splitInterests(null)).toEqual([]);
  });
});

describe('verificationBadge (고교생 MY)', () => {
  it('네 갈래의 글자와 톤', () => {
    expect(verificationBadge('APPROVED')).toEqual({ label: '학생증 인증 완료', tone: 'success' });
    expect(verificationBadge('PENDING')).toEqual({ label: '학생증 심사 중', tone: 'info' });
    expect(verificationBadge('REJECTED')).toEqual({ label: '학생증 인증 반려', tone: 'danger' });
    expect(verificationBadge('NONE')).toEqual({ label: '학생증 인증 전', tone: 'neutral' });
  });
});

describe('guideVerificationBadge (가이드 MY)', () => {
  it('네 갈래의 글자와 톤', () => {
    expect(guideVerificationBadge('APPROVED')).toEqual({
      label: '재학 인증 완료',
      tone: 'success',
    });
    expect(guideVerificationBadge('PENDING')).toEqual({ label: '재학 인증 심사 중', tone: 'info' });
    expect(guideVerificationBadge('REJECTED')).toEqual({
      label: '재학 인증 반려',
      tone: 'danger',
    });
    expect(guideVerificationBadge('NONE')).toEqual({ label: '재학 인증 전', tone: 'neutral' });
  });
});

describe('guideSchoolLine (G12 프로필 카드의 학교 줄)', () => {
  it('학교와 학과를 가운뎃점으로 잇는다', () => {
    expect(guideSchoolLine('경희대학교 국제캠퍼스', '산업디자인학과')).toBe(
      '경희대학교 국제캠퍼스 · 산업디자인학과',
    );
  });

  it('대학을 모르면 학과만', () => {
    expect(guideSchoolLine(null, '산업디자인학과')).toBe('산업디자인학과');
  });

  it('학과가 없으면 프로필 등록 안내', () => {
    expect(guideSchoolLine('경희대학교 국제캠퍼스', null)).toBe('가이드 프로필을 등록해 주세요');
    expect(guideSchoolLine('경희대학교 국제캠퍼스', '  ')).toBe('가이드 프로필을 등록해 주세요');
    expect(guideSchoolLine(null, null)).toBe('가이드 프로필을 등록해 주세요');
  });
});
