import { act, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { server } from '@/mocks/node';
import { DEMO_MOTIVATION } from '@/shared/config/demoAccounts';
import { renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

describe('탐방 신청서 (hs-a04)', () => {
  it('신청서 구성: 제목 · 탐방 카드 · 입력 · 안내 · 버튼', async () => {
    await renderApp('/tours/1/apply', { as: 'student' });
    expect(await screen.findByText('탐방을 신청할까요?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '탐방 신청서 · 하고 싶은 것' })).toBeInTheDocument();
    expect(screen.getByText('가이드에게 전할 관심사를 적어 주세요.')).toBeInTheDocument();
    expect(screen.getByText('신청할 탐방')).toBeInTheDocument();
    expect(screen.getByText(/^경희대학교 국제캠퍼스 · \d\d\.\d\d \(.\)$/)).toBeInTheDocument();
    expect(screen.getByLabelText('탐방에서 하고 싶은 것')).toHaveValue('');
    expect(
      screen.getByPlaceholderText('예: 전공 수업을 듣고, 학생 식당도 가보고 싶어요.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('작성한 내용은 승인 후 AI 코스 초안의 추천 기준으로만 활용돼요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신청 완료하기' })).toBeEnabled();
    expect(screen.queryByText(/신청 조건 확인/)).toBeNull();
  });

  it('신청서 5자 미만은 막는다', async () => {
    const { user, router } = await renderApp('/tours/1/apply', { as: 'student' });
    await user.type(await screen.findByLabelText('탐방에서 하고 싶은 것'), '밥');
    await user.click(screen.getByRole('button', { name: '신청 완료하기' }));
    expect(await screen.findByText('하고 싶은 것을 5자 이상 적어 주세요.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tours/1/apply');
  });

  it('공백만 있는 입력은 앞뒤를 잘라 검증한다', async () => {
    const { user } = await renderApp('/tours/1/apply', { as: 'student' });
    await user.type(await screen.findByLabelText('탐방에서 하고 싶은 것'), '   밥집   ');
    await user.click(screen.getByRole('button', { name: '신청 완료하기' }));
    expect(await screen.findByText('하고 싶은 것을 5자 이상 적어 주세요.')).toBeInTheDocument();
  });

  it('100자 초과는 막는다(백엔드 wish 100자 — 2C-R12 ④)', async () => {
    const { user, router } = await renderApp('/tours/1/apply', { as: 'student' });
    const box = await screen.findByLabelText('탐방에서 하고 싶은 것');
    await user.click(box);
    await user.paste('가'.repeat(101));
    await user.click(screen.getByRole('button', { name: '신청 완료하기' }));
    expect(await screen.findByText('100자 이내로 적어 주세요.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tours/1/apply');
  });

  it('시연 도구가 켜졌으면 미리 채운 신청서(100자 안)로 그대로 신청된다', async () => {
    act(() => useDemoStore.setState({ enabled: true }));
    try {
      expect(DEMO_MOTIVATION.length).toBeLessThanOrEqual(100);
      const { user } = await renderApp('/tours/1/apply', { as: 'student' });
      expect(await screen.findByLabelText('탐방에서 하고 싶은 것')).toHaveValue(DEMO_MOTIVATION);
      await user.click(screen.getByRole('button', { name: '신청 완료하기' }));
      expect(await screen.findByText('신청이 접수됐어요!')).toBeInTheDocument();
    } finally {
      act(() => useDemoStore.setState({ enabled: false }));
    }
  });

  it('앞뒤 공백을 자른 내용으로 한 번만 보내고 완료 화면으로 바꿔 이동한다', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/tours/:tourId/applications', async ({ request }) => {
        bodies.push(await request.clone().json());
        await new Promise((r) => setTimeout(r, 30));
        return undefined; // 기본 핸들러로 넘긴다
      }),
    );
    const { user, router } = await renderApp('/tours/1/apply', { as: 'student' });
    await user.type(await screen.findByLabelText('탐방에서 하고 싶은 것'), '  밥집이 궁금해요  ');
    const submit = screen.getByRole('button', { name: '신청 완료하기' });
    await user.dblClick(submit);
    expect(await screen.findByText('신청이 접수됐어요!')).toBeInTheDocument();
    expect(bodies).toEqual([{ wish: '밥집이 궁금해요' }]); // 백엔드 A-01 본문
    expect(router.state.location.pathname).toBe('/tours/1/apply/done');
    await router.navigate(-1);
    // replace로 이동했으므로 신청서로 돌아가지 않는다.
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/tours/1/apply'));
  });

  it('실패하면 토스트를 띄우고 탐방 정보를 다시 불러온다', async () => {
    const { user, router } = await renderApp('/tours/1/apply', { as: 'student' });
    await screen.findByLabelText('탐방에서 하고 싶은 것');
    let tourGets = 0;
    server.use(
      http.post('/api/tours/:tourId/applications', () => wireFail('E409_TOUR_FULL')),
      http.get('/api/tours/1', () => {
        tourGets += 1;
        return undefined; // 기본 핸들러로 넘긴다
      }),
    );
    await user.type(screen.getByLabelText('탐방에서 하고 싶은 것'), '밥집이 궁금해요');
    await user.click(screen.getByRole('button', { name: '신청 완료하기' }));
    // 탐방 1은 모집 중이라 E409_TOUR_FULL은 정원 마감(TOUR_CLOSED) 문구다.
    expect(await screen.findByText('정원이 마감됐어요.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tours/1/apply');
    // 탐방 상세 GET 두 번: 어댑터가 E409_TOUR_FULL을 세분하려고 한 번 다시 읽고(2C-R15), 화면의 실패 처리가 탐방 정보를
    // 다시 불러온다(무효화).
    await waitFor(() => expect(tourGets).toBe(2));
  });

  it('인증 전 학생: 버튼이 잠기고 사유 · 인증 링크가 보인다', async () => {
    await renderApp('/tours/1/apply', { as: 'newbie@demo.kr' });
    expect(await screen.findByRole('button', { name: '신청 완료하기' })).toBeDisabled();
    expect(
      screen.getByText('학생증 승인·보호자 동의 완료 후 신청할 수 있어요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '역할 인증 단계로 이동' })).toHaveAttribute(
      'href',
      '/verify',
    );
  });

  it('마감 탐방: 신청서에서도 잠기고 다른 탐방 보기', async () => {
    await renderApp('/tours/2/apply', { as: 'student' });
    expect(await screen.findByRole('button', { name: '신청 완료하기' })).toBeDisabled();
    expect(screen.getByText('남은 자리가 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '다른 탐방 보기' })).toHaveAttribute('href', '/');
  });
});
