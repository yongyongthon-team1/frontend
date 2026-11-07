import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLastQuery } from '@/features/tours/lastQuery';
import { renderApp } from '@/test/renderApp';

describe('탐방 상세 (hs-s05 · hs-a06 · V2 H03 · H13)', () => {
  beforeEach(() => useLastQuery.setState({ search: null }));

  it('인증된 학생: 신청 → 완료 화면 → 상세는 신청됨 + 이미 신청 카드', async () => {
    const { user, router } = await renderApp('/tours/1', { as: 'student' });
    await user.click(await screen.findByRole('button', { name: '이 탐방 신청하기' }));
    await user.type(await screen.findByLabelText('탐방에서 하고 싶은 것'), '밥집이 궁금해요');
    await user.click(screen.getByRole('button', { name: '신청 완료하기' }));
    expect(await screen.findByText('신청이 접수됐어요!')).toBeInTheDocument();
    await router.navigate('/tours/1');
    expect(await screen.findByRole('button', { name: '신청됨' })).toBeDisabled();
    expect(screen.getByText('이미 신청한 탐방이에요')).toBeInTheDocument();
    expect(screen.getByText('중복 신청')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 탐방 확인 ›' })).toHaveAttribute(
      'href',
      '/my-tours',
    );
  });

  it('인증 전 학생: 비활성 + 함수가 정한 사유 · 역할 인증 링크(문구 그대로)', async () => {
    await renderApp('/tours/1', { as: 'newbie@demo.kr' });
    expect(await screen.findByRole('button', { name: '이 탐방 신청하기' })).toBeDisabled();
    expect(
      screen.getByText('학생증 승인·보호자 동의 완료 후 신청할 수 있어요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '역할 인증 단계로 이동' })).toHaveAttribute(
      'href',
      '/verify',
    );
  });

  it('마감 탐방: 정원 마감 버튼 + V2 마감 카드 + 다른 탐방 보기', async () => {
    await renderApp('/tours/2', { as: 'student' });
    expect(await screen.findByRole('button', { name: '정원 마감' })).toBeDisabled();
    expect(screen.getByText('모집 마감')).toBeInTheDocument();
    expect(screen.getByText('이번 탐방은 자리가 없어요')).toBeInTheDocument();
    expect(screen.getByText('비슷한 전공의 다른 일정을 확인해요.')).toBeInTheDocument();
    expect(screen.queryByText('남은 자리가 없어요.')).toBeNull();
    expect(screen.getByRole('link', { name: '다른 탐방 보기 ›' })).toHaveAttribute('href', '/');
  });

  it('마지막 탐방 찾기 검색이 있으면 다른 탐방 보기는 그 결과 화면으로', async () => {
    useLastQuery.setState({ search: 'school=2&major=%EB%94%94%EC%9E%90%EC%9D%B8&wish=a' });
    await renderApp('/tours/2', { as: 'student' });
    expect(await screen.findByRole('link', { name: '다른 탐방 보기 ›' })).toHaveAttribute(
      'href',
      '/tours?school=2&major=%EB%94%94%EC%9E%90%EC%9D%B8&wish=a',
    );
  });

  it('저장된 검색이 옛 추천 검색(q=)이면 다른 탐방 보기는 홈으로', async () => {
    useLastQuery.setState({ search: 'q=%EB%94%94%EC%9E%90%EC%9D%B8' });
    await renderApp('/tours/2', { as: 'student' });
    expect(await screen.findByRole('link', { name: '다른 탐방 보기 ›' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('상세 내용: 히어로 · 제목 · 일정 · 가이드 · 경험 · 캡션', async () => {
    await renderApp('/tours/1', { as: 'student' });
    expect(await screen.findByText('전공자와 함께 캠퍼스를 걸어요')).toBeInTheDocument();
    expect(screen.getByText('경희대학교 국제캠퍼스')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '탐방 상세' })).toBeInTheDocument();
    expect(
      screen.getByText(/^\d\d\.\d\d \(.\) \d\d:\d\d~\d\d:\d\d · 5명 정원$/),
    ).toBeInTheDocument();
    expect(screen.getByText(/^.+ 가이드$/)).toBeInTheDocument();
    expect(screen.getByText(/^재학 인증 완료 · .+/)).toBeInTheDocument();
    expect(screen.getByText('이런 경험을 해요')).toBeInTheDocument();
    expect(screen.getByText('학교가 운영하는 공식 프로그램은 아니에요.')).toBeInTheDocument();
    // 소개를 줄 단위로 나눈 번호 목록(데모 탐방 소개는 2줄).
    expect(within(screen.getByRole('list')).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^모집 중 · 남은 자리/)).toBeNull();
  });

  it('로그인한 가이드는 신청할 수 없다(사유 · 카드 없음)', async () => {
    await renderApp('/tours/1', { as: 'guide' });
    expect(await screen.findByRole('button', { name: '고교생만 신청할 수 있어요' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /›$/ })).toBeNull();
    expect(screen.queryByText('이미 신청한 탐방이에요')).toBeNull();
  });

  it('없는 탐방은 오류 상태와 다시 시도', async () => {
    await renderApp('/tours/99999', { as: 'student' });
    expect(await screen.findByRole('alert')).toHaveTextContent('찾을 수 없어요.');
    expect(
      within(screen.getByRole('alert')).getByRole('button', { name: '다시 시도' }),
    ).toBeEnabled();
  });
});
