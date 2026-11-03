import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLastQuery } from '@/features/tours/lastQuery';
import { renderApp } from '@/test/renderApp';

describe('탐방 상세 (hs-s05 · hs-a06)', () => {
  beforeEach(() => useLastQuery.setState({ search: null }));

  it('인증된 학생: 신청 → 완료 화면 → 상세는 신청됨', async () => {
    const { user, router } = await renderApp('/tours/1', { as: 'student' });
    await user.click(await screen.findByRole('button', { name: '탐방 신청하기' }));
    await user.type(await screen.findByLabelText('하고 싶은 것 입력'), '밥집이 궁금해요');
    await user.click(screen.getByRole('button', { name: '탐방 신청 완료하기' }));
    expect(await screen.findByText('신청이 접수됐어요!')).toBeInTheDocument();
    await router.navigate('/tours/1');
    expect(await screen.findByRole('button', { name: '신청됨' })).toBeDisabled();
    expect(screen.getByRole('link', { name: '내 탐방에서 상태 확인' })).toHaveAttribute(
      'href',
      '/my-tours',
    );
  });

  it('인증 전 학생: 비활성 + 역할 인증 링크', async () => {
    await renderApp('/tours/1', { as: 'newbie@demo.kr' });
    expect(await screen.findByRole('button', { name: '탐방 신청하기' })).toBeDisabled();
    expect(
      screen.getByText('학생증 승인·보호자 동의 완료 후 신청할 수 있어요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '역할 인증 단계로 이동' })).toHaveAttribute(
      'href',
      '/verify',
    );
  });

  it('마감 탐방: 정원 마감 + 다른 추천 보기', async () => {
    await renderApp('/tours/2', { as: 'student' });
    expect(await screen.findByRole('button', { name: '정원 마감' })).toBeDisabled();
    expect(screen.getByText('남은 자리가 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '다른 추천 보기' })).toHaveAttribute('href', '/');
    expect(screen.getByText('마감')).toBeInTheDocument();
  });

  it('마지막 추천 검색이 있으면 다른 추천 보기는 그 목록으로', async () => {
    useLastQuery.setState({ search: 'q=%EB%94%94%EC%9E%90%EC%9D%B8' });
    await renderApp('/tours/2', { as: 'student' });
    expect(await screen.findByRole('link', { name: '다른 추천 보기' })).toHaveAttribute(
      'href',
      '/recommendations?q=%EB%94%94%EC%9E%90%EC%9D%B8',
    );
  });

  it('상세 내용: 칩 · 제목 · 가이드 · 일정 · 소개', async () => {
    await renderApp('/tours/1', { as: 'student' });
    expect(await screen.findByText(/^모집 중 · 남은 자리 \d+명$/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '탐방 상세' })).toBeInTheDocument();
    expect(screen.getByText(/^가이드 .+/)).toBeInTheDocument();
    expect(screen.getByText(/✓ 재학 인증 완료/)).toBeInTheDocument();
    expect(screen.getByText(/· 정원 \d+명$/)).toBeInTheDocument();
    expect(screen.getByText('캠퍼스 소개 → 전공 공간 → 대학가 식사·카페')).toBeInTheDocument();
    expect(screen.getByText('이 탐방에서 만날 수 있는 것')).toBeInTheDocument();
  });

  it('로그인한 가이드는 신청할 수 없다', async () => {
    await renderApp('/tours/1', { as: 'guide' });
    expect(await screen.findByRole('button', { name: '고교생만 신청할 수 있어요' })).toBeDisabled();
  });

  it('없는 탐방은 오류 상태와 다시 시도', async () => {
    await renderApp('/tours/99999', { as: 'student' });
    expect(await screen.findByRole('alert')).toHaveTextContent('찾을 수 없어요.');
    expect(
      within(screen.getByRole('alert')).getByRole('button', { name: '다시 시도' }),
    ).toBeEnabled();
  });
});
