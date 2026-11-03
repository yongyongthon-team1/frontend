import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';

describe('탐방 신청서 (hs-a04)', () => {
  it('신청서 구성: 칩 · 탐방 카드 · 조건 확인 · 버튼', async () => {
    await renderApp('/tours/1/apply', { as: 'student' });
    expect(await screen.findByText('신청 전 정보 확인')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '탐방 신청서' })).toBeInTheDocument();
    expect(screen.getByText(/· 가이드 재학 인증 완료$/)).toBeInTheDocument();
    expect(screen.getByText('가이드에게 하고 싶은 이야기는?')).toBeInTheDocument();
    expect(screen.getByLabelText('하고 싶은 것 입력')).toHaveValue('');
    expect(
      screen.getByPlaceholderText('실기 준비와 대학에서 배우는 수업이 궁금해요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('예: 전공 수업, 시설, 대학 생활')).toBeInTheDocument();
    expect(screen.getByText('재학 인증 승인 ✓')).toBeInTheDocument();
    expect(screen.getByText('보호자 동의 완료 ✓')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '탐방 신청 완료하기' })).toBeEnabled();
  });

  it('신청서 5자 미만은 막는다', async () => {
    const { user, router } = await renderApp('/tours/1/apply', { as: 'student' });
    await user.type(await screen.findByLabelText('하고 싶은 것 입력'), '밥');
    await user.click(screen.getByRole('button', { name: '탐방 신청 완료하기' }));
    expect(await screen.findByText('하고 싶은 것을 5자 이상 적어 주세요.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tours/1/apply');
  });

  it('공백만 있는 입력은 앞뒤를 잘라 검증한다', async () => {
    const { user } = await renderApp('/tours/1/apply', { as: 'student' });
    await user.type(await screen.findByLabelText('하고 싶은 것 입력'), '   밥집   ');
    await user.click(screen.getByRole('button', { name: '탐방 신청 완료하기' }));
    expect(await screen.findByText('하고 싶은 것을 5자 이상 적어 주세요.')).toBeInTheDocument();
  });

  it('300자 초과는 막는다', async () => {
    const { user } = await renderApp('/tours/1/apply', { as: 'student' });
    const box = await screen.findByLabelText('하고 싶은 것 입력');
    await user.click(box);
    await user.paste('가'.repeat(301));
    await user.click(screen.getByRole('button', { name: '탐방 신청 완료하기' }));
    expect(await screen.findByText('300자 이내로 적어 주세요.')).toBeInTheDocument();
  });

  it('앞뒤 공백을 자른 내용으로 한 번만 보내고 완료 화면으로 바꿔 이동한다', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/tours/:id/applications', async ({ request }) => {
        bodies.push(await request.clone().json());
        await new Promise((r) => setTimeout(r, 30));
        return undefined; // 기본 핸들러로 넘긴다
      }),
    );
    const { user, router } = await renderApp('/tours/1/apply', { as: 'student' });
    await user.type(await screen.findByLabelText('하고 싶은 것 입력'), '  밥집이 궁금해요  ');
    const submit = screen.getByRole('button', { name: '탐방 신청 완료하기' });
    await user.dblClick(submit);
    expect(await screen.findByText('신청이 접수됐어요!')).toBeInTheDocument();
    expect(bodies).toEqual([{ motivation: '밥집이 궁금해요' }]);
    expect(router.state.location.pathname).toBe('/tours/1/apply/done');
    await router.navigate(-1);
    // replace로 이동했으므로 신청서로 돌아가지 않는다.
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/tours/1/apply'));
  });

  it('실패하면 토스트를 띄우고 탐방 정보를 다시 불러온다', async () => {
    const { user, router } = await renderApp('/tours/1/apply', { as: 'student' });
    await screen.findByLabelText('하고 싶은 것 입력');
    let tourGets = 0;
    server.use(
      http.post('/api/tours/:id/applications', () =>
        HttpResponse.json({ code: 'TOUR_CLOSED', message: 'x' }, { status: 409 }),
      ),
      http.get('/api/tours/1', () => {
        tourGets += 1;
        return undefined; // 기본 핸들러로 넘긴다
      }),
    );
    await user.type(screen.getByLabelText('하고 싶은 것 입력'), '밥집이 궁금해요');
    await user.click(screen.getByRole('button', { name: '탐방 신청 완료하기' }));
    expect(await screen.findByText('정원이 마감됐어요.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tours/1/apply');
    await waitFor(() => expect(tourGets).toBe(1));
  });

  it('인증 전 학생: 버튼이 잠기고 사유 · 인증 링크가 보인다', async () => {
    await renderApp('/tours/1/apply', { as: 'newbie@demo.kr' });
    expect(await screen.findByRole('button', { name: '탐방 신청 완료하기' })).toBeDisabled();
    expect(
      screen.getByText('학생증 승인·보호자 동의 완료 후 신청할 수 있어요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '역할 인증 단계로 이동' })).toHaveAttribute(
      'href',
      '/verify',
    );
    expect(screen.getByText('재학 인증 승인 ✗')).toBeInTheDocument();
  });

  it('마감 탐방: 신청서에서도 잠기고 다른 추천 보기', async () => {
    await renderApp('/tours/2/apply', { as: 'student' });
    expect(await screen.findByRole('button', { name: '탐방 신청 완료하기' })).toBeDisabled();
    expect(screen.getByText('남은 자리가 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '다른 추천 보기' })).toBeInTheDocument();
  });
});
