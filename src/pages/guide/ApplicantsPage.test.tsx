import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { approveApplication } from '@/mocks/rules/applications';
import { createDraft } from '@/mocks/rules/courses';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { findApplicationId, renderApp } from '@/test/renderApp';

afterEach(() => {
  server.events.removeAllListeners('request:start');
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

// 승인 토스트에도 이름이 들어가므로 카드 제목(heading)으로 찾는다.
const minjiCard = () => screen.getByRole('heading', { name: /김민지/ }).closest('article')!;

// V2 제목: `학생 N명이\n승인을 기다려요.` — 대기 수가 바뀌는 것으로 숫자 변화를 본다.
const waiting = (n: number) => ({
  level: 2,
  name: new RegExp(`학생 ${n}명이\\s*승인을 기다려요\\.`),
});

describe('신청자 관리 (guide-s03)', () => {
  it('승인하면 요약 숫자가 바뀐다', async () => {
    const { user } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    expect(await screen.findByRole('heading', waiting(2))).toBeInTheDocument();
    expect(screen.getByText('참가 이유를 읽고 함께할 학생을 선택해요.')).toBeInTheDocument();
    expect(screen.getByText('승인하면 학생에게 오픈채팅 링크가 공개돼요.')).toBeInTheDocument();
    const card = minjiCard();
    expect(within(card).getByText(/^“ 고\d · .+ ”$/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: '승인하기' }));
    expect(await screen.findByRole('heading', waiting(1))).toBeInTheDocument();
    expect(await screen.findByText('김민지 님을 승인했어요.')).toBeInTheDocument();
    // 승인된 카드는 버튼 대신 상태 칩
    expect(within(card).getByText('승인됨')).toBeInTheDocument();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('신청자는 모두 `인증` 칩이 이름 옆에 붙는다 — 신청은 재학 인증 APPROVED만 받는다(A-01, 2C-R27)', async () => {
    const { router } = await renderApp('/explore', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    // 신청한 뒤 인증 상태가 바뀌어도 신청자 목록(A-04)에는 인증 칸이 없어 합성 값은 늘 인증이다.
    mutate((db) => {
      const yujinId = db.users.find((u) => u.name === '최유진')!.id;
      db.verifications.find((v) => v.id === yujinId)!.status = 'PENDING';
    });
    await router.navigate('/guide/tours/1/applicants');
    await screen.findByRole('heading', waiting(2));
    const minji = minjiCard();
    expect(within(minji).getByText('인증')).toBeInTheDocument();
    // 이름 제목의 글자는 그대로다.
    expect(within(minji).getByRole('heading', { name: '김민지' })).toBeInTheDocument();
    const yujin = screen.getByRole('heading', { name: '최유진' }).closest('article')!;
    expect(within(yujin).getByText('인증')).toBeInTheDocument();
  });

  it('학년이 없으면 따옴표 줄에 `고N · ` 없이 동기만 나온다', async () => {
    const { router } = await renderApp('/explore', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    mutate((db) => {
      const userId = db.users.find((u) => u.name === '김민지')!.id;
      db.studentProfiles.find((p) => p.id === userId)!.grade = null;
    });
    await router.navigate('/guide/tours/1/applicants');
    await screen.findByRole('heading', waiting(2));
    const quote = within(minjiCard()).getByText(/^“ .+ ”$/);
    expect(quote.textContent).not.toMatch(/고\d/);
    expect(quote.textContent).toMatch(/^“ \S/);
  });

  it('대기가 없으면 제목이 `신청자를 모두 확인했어요.`', async () => {
    await renderApp('/guide/tours/7/applicants', { as: 'guide' });
    expect(
      await screen.findByRole('heading', { level: 2, name: '신청자를 모두 확인했어요.' }),
    ).toBeInTheDocument();
  });

  it('뒤로 가기는 가이드 홈으로 간다', async () => {
    const { user, router } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    await screen.findByRole('heading', waiting(2));
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(router.state.location.pathname).toBe('/guide');
  });

  it('승인 버튼 연타는 요청 1번 (Review Focus 6)', async () => {
    // 응답이 늦어야 첫 클릭의 요청이 진행 중인 채로 두 번째 클릭이 들어온다(지연이 0이면 연타를 못 가린다).
    setMockLatency({ base: 150, ai: 0 });
    let count = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'PATCH' && request.url.includes('/decision')) count++;
    });
    const { user } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    await screen.findByRole('heading', waiting(2));
    const card = minjiCard();
    await user.dblClick(within(card).getByRole('button', { name: '승인하기' }));
    await waitFor(() => expect(screen.getByRole('heading', waiting(1))).toBeInTheDocument());
    expect(count).toBe(1);
  });

  it('거절 확인 버튼 연타도 요청 1번', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const bodies: unknown[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'PATCH' && request.url.includes('/decision')) {
        void request
          .clone()
          .json()
          .then((b: unknown) => bodies.push(b));
      }
    });
    const { user } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    await screen.findByRole('heading', waiting(2));
    const card = minjiCard();
    await user.click(within(card).getByRole('button', { name: '거절하기' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.dblClick(within(dialog).getByRole('button', { name: '거절' }));
    await waitFor(() => expect(card).toHaveTextContent('거절됨'));
    expect(bodies).toEqual([{ decision: 'REJECTED' }]);
  });

  it('거절은 확인창을 거쳐 거절됨으로 바뀐다', async () => {
    const { user } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    await screen.findByRole('heading', waiting(2));
    const card = minjiCard();
    await user.click(within(card).getByRole('button', { name: '거절하기' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('이 신청을 거절할까요?')).toBeInTheDocument();
    expect(within(dialog).getByText('거절하면 학생에게 거절로 표시돼요.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '거절' }));
    expect(await screen.findByRole('heading', waiting(1))).toBeInTheDocument();
    expect(card).toHaveTextContent('거절됨');
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('승인 0명이면 코스 만들기 비활성 + 사유', async () => {
    await renderApp('/guide/tours/6/applicants', { as: 'guide' });
    const button = await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' });
    expect(button).toBeDisabled();
    expect(screen.getByText('승인한 신청자가 있어야 코스를 만들 수 있어요.')).toBeInTheDocument();
  });

  it('승인자가 있고 코스가 없으면 코스 만들기로 초안 생성 화면에 간다', async () => {
    const { user, router } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    // 초안 화면은 생성에 성공하면 주소에서 ?generate=1을 지우므로(Task 19) 거쳐 간 주소를 모두 모은다.
    const visited: string[] = [];
    router.subscribe(({ location }) => visited.push(location.pathname + location.search));
    await user.click(await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' }));
    await waitFor(() => expect(visited).toContain('/guide/tours/1/course/draft?generate=1'));
  });

  it('코스 초안이 있으면 `코스 이어서 편집`(→ edit)', async () => {
    const { user, router } = await renderApp('/guide/tours/6/applicants', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' });
    mutate((db) => {
      const guide = db.users.find((u) => u.email === DEMO_EMAILS.guide)!;
      createDraft(db, guide.id, 1, new Date());
    });
    await router.navigate('/guide/tours/1/applicants');
    await user.click(await screen.findByRole('button', { name: '코스 이어서 편집' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours/1/course/edit'));
  });

  it('코스가 확정이면 `확정 코스 보기`(→ confirm)', async () => {
    const { user, router } = await renderApp('/guide/tours/1/applicants', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    await user.click(await screen.findByRole('button', { name: '확정 코스 보기' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm'),
    );
  });

  it.each([
    [
      '승인',
      async (user: UserEvent, card: HTMLElement) =>
        user.click(within(card).getByRole('button', { name: '승인하기' })),
    ],
    [
      '거절',
      async (user: UserEvent, card: HTMLElement) => {
        await user.click(within(card).getByRole('button', { name: '거절하기' }));
        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: '거절' }));
      },
    ],
  ])(
    '%s이 실패하면(다른 곳에서 이미 처리 — 409) 토스트를 보이고 보드를 다시 불러온다 (설계 5.5)',
    async (_, attempt) => {
      const { user } = await renderApp('/guide/tours/1/applicants', {
        as: 'guide',
        checkpoint: 'APPLIED',
      });
      await screen.findByRole('heading', waiting(2));
      // 같은 가이드가 다른 기기에서 김민지를 먼저 승인했다 — 이 화면의 보드는 아직 승인 대기다.
      mutate((db) => {
        const guide = db.users.find((u) => u.email === DEMO_EMAILS.guide)!;
        approveApplication(db, guide.id, findApplicationId(DEMO_EMAILS.student, 1), new Date());
      });

      await attempt(user, minjiCard());
      expect(await screen.findByText('이미 처리된 요청이에요.')).toBeInTheDocument();
      expect(await screen.findByRole('heading', waiting(1))).toBeInTheDocument();
      expect(minjiCard()).toHaveTextContent('승인됨');
    },
  );

  it('남은 자리가 없으면 승인은 비활성 + 사유, 거절은 활성', async () => {
    const { router } = await renderApp('/guide/tours/6/applicants', {
      as: 'guide',
      checkpoint: 'APPLIED',
    });
    await screen.findByRole('button', { name: '승인 완료 후 코스 만들기' });
    mutate((db) => {
      db.tours.find((t) => t.id === 1)!.capacity = 2; // 승인 2명 = 정원
    });
    await router.navigate('/guide/tours/1/applicants');
    expect(await screen.findByRole('heading', waiting(2))).toBeInTheDocument();
    const card = minjiCard();
    const approve = within(card).getByRole('button', { name: '승인하기' });
    expect(approve).toBeDisabled();
    expect(within(card).getByText('남은 자리가 없어요.')).toBeInTheDocument();
    expect(approve).toHaveAccessibleDescription('남은 자리가 없어요.');
    expect(within(card).getByRole('button', { name: '거절하기' })).toBeEnabled();
  });

  describe('탐방 완료 · 탐방 취소 진입 링크 (T-05 · T-06)', () => {
    it('모집 중 탐방의 하단 링크 줄에 `탐방 완료` · `탐방 취소`가 있다(승인 버튼 로케이터는 그대로)', async () => {
      await renderApp('/guide/tours/1/applicants', { as: 'guide', checkpoint: 'APPLIED' });
      await screen.findByRole('heading', waiting(2));
      expect(screen.getByRole('link', { name: '탐방 완료' })).toHaveAttribute(
        'href',
        '/guide/tours/1/complete',
      );
      expect(screen.getByRole('link', { name: '탐방 취소' })).toHaveAttribute(
        'href',
        '/guide/tours/1/cancel',
      );
      // 골든 패스가 지나는 버튼은 이름 그대로 대기 신청마다 하나씩이다.
      expect(screen.getAllByRole('button', { name: '승인하기' })).toHaveLength(2);
      expect(screen.getByRole('button', { name: '승인 완료 후 코스 만들기' })).toBeInTheDocument();
    });

    it('마감된 탐방에도 링크가 있다', async () => {
      const { router } = await renderApp('/explore', { as: 'guide', checkpoint: 'APPLIED' });
      mutate((db) => {
        db.tours.find((t) => t.id === 1)!.status = 'CLOSED';
      });
      await router.navigate('/guide/tours/1/applicants');
      await screen.findByRole('heading', waiting(2));
      expect(screen.getByRole('link', { name: '탐방 완료' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '탐방 취소' })).toBeInTheDocument();
    });

    it('완료된 탐방(7)은 링크 줄이 없다', async () => {
      await renderApp('/guide/tours/7/applicants', { as: 'guide' });
      await screen.findByRole('heading', { level: 2, name: '신청자를 모두 확인했어요.' });
      expect(screen.queryByRole('link', { name: '탐방 완료' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: '탐방 취소' })).not.toBeInTheDocument();
    });

    it.each(['COMPLETED', 'CANCELED'] as const)(
      '%s 탐방은 대기 신청에도 승인하기 · 거절하기가 없고 상태만 보인다',
      async (status) => {
        const { router } = await renderApp('/explore', { as: 'guide', checkpoint: 'APPLIED' });
        mutate((db) => {
          db.tours.find((t) => t.id === 1)!.status = status;
        });
        await router.navigate('/guide/tours/1/applicants');
        const yujin = (await screen.findByRole('heading', { name: '최유진' })).closest('article')!;
        expect(within(yujin).getByText('승인 대기')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '승인하기' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '거절하기' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: '탐방 완료' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: '탐방 취소' })).not.toBeInTheDocument();
      },
    );
  });
});
