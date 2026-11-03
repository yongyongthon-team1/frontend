import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';

afterEach(() => {
  server.events.removeAllListeners('request:start');
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

// 승인 토스트에도 이름이 들어가므로 카드 제목(heading)으로 찾는다.
const minjiCard = () => screen.getByRole('heading', { name: /김민지/ }).closest('article')!;

describe('신청자 관리 (guide-s03)', () => {
  it('승인하면 요약 숫자가 바뀐다', async () => {
    const { user } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    expect(await screen.findByText('대기 2명 · 승인 2명 · 남은 자리 3명')).toBeInTheDocument();
    const card = minjiCard();
    await user.click(within(card).getByRole('button', { name: '승인' }));
    expect(await screen.findByText('대기 1명 · 승인 3명 · 남은 자리 2명')).toBeInTheDocument();
    expect(await screen.findByText('김민지 님을 승인했어요.')).toBeInTheDocument();
    expect(within(card).getByText('오픈채팅 링크가 공개된 상태예요.')).toBeInTheDocument();
  });

  it('승인 버튼 연타는 요청 1번 (Review Focus 6)', async () => {
    // 응답이 늦어야 첫 클릭의 요청이 진행 중인 채로 두 번째 클릭이 들어온다(지연이 0이면 연타를 못 가린다).
    setMockLatency({ base: 150, ai: 0 });
    let count = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/approve')) count++;
    });
    const { user } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    await screen.findByText('대기 2명 · 승인 2명 · 남은 자리 3명');
    const card = minjiCard();
    await user.dblClick(within(card).getByRole('button', { name: '승인' }));
    await waitFor(() =>
      expect(screen.getByText('대기 1명 · 승인 3명 · 남은 자리 2명')).toBeInTheDocument(),
    );
    expect(count).toBe(1);
  });

  it('거절은 확인창을 거쳐 거절됨으로 바뀐다', async () => {
    const { user } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    await screen.findByText('대기 2명 · 승인 2명 · 남은 자리 3명');
    const card = minjiCard();
    await user.click(within(card).getByRole('button', { name: '거절' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('이 신청을 거절할까요?')).toBeInTheDocument();
    expect(within(dialog).getByText('거절하면 학생에게 거절로 표시돼요.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '거절' }));
    expect(await screen.findByText('대기 1명 · 승인 2명 · 남은 자리 3명')).toBeInTheDocument();
    expect(card).toHaveTextContent('거절됨');
    expect(within(card).queryByRole('button', { name: '승인' })).not.toBeInTheDocument();
  });

  it('승인 0명이면 AI 코스 만들기 비활성 + 사유', async () => {
    await renderApp('/guide/tours/6/applicants', { as: 'guide' });
    const button = await screen.findByRole('button', { name: 'AI 코스 만들기' });
    expect(button).toBeDisabled();
    expect(screen.getByText('승인한 신청자가 있어야 코스를 만들 수 있어요.')).toBeInTheDocument();
  });

  it('승인자가 있고 코스가 없으면 AI 코스 만들기로 초안 생성 화면에 간다', async () => {
    const { user, router } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    // 초안 화면은 생성에 성공하면 주소에서 ?generate=1을 지우므로(Task 19) 거쳐 간 주소를 모두 모은다.
    const visited: string[] = [];
    router.subscribe(({ location }) => visited.push(location.pathname + location.search));
    await user.click(await screen.findByRole('button', { name: 'AI 코스 만들기' }));
    await waitFor(() => expect(visited).toContain('/guide/tours/1/course/draft?generate=1'));
  });

  it('남은 자리가 없으면 승인은 비활성 + 사유, 거절은 활성', async () => {
    const { router } = await renderApp('/guide/tours/6/applicants', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    await screen.findByRole('button', { name: 'AI 코스 만들기' });
    mutate((db) => {
      db.tours.find((t) => t.id === 1)!.capacity = 2; // 승인 2명 = 정원
    });
    await router.navigate('/guide/tours/1/applicants');
    expect(await screen.findByText('대기 2명 · 승인 2명 · 남은 자리 0명')).toBeInTheDocument();
    const card = minjiCard();
    expect(within(card).getByRole('button', { name: '승인' })).toBeDisabled();
    expect(within(card).getByText('남은 자리가 없어요.')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: '거절' })).toBeEnabled();
  });
});
