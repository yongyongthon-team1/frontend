import { act, screen, waitFor, within } from '@testing-library/react';
import { isValidElement, type ReactNode } from 'react';
import { matchRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model';
import { useSession } from '@/features/auth/session';
import { createSession, mutate } from '@/mocks/db/store';
import { qk } from '@/shared/api/queryKeys';
import { renderApp } from '@/test/renderApp';
import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { routes } from './routes';

function sessionTokenOf(email: string): string {
  return mutate((db) => createSession(db, db.users.find((u) => u.email === email)!.id));
}

describe('가드', () => {
  it('로그인 안 하면 /login?next=', async () => {
    const { router } = await renderApp('/my-tours');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fmy-tours');
  });

  it('고교생이 가이드 화면에 가면 자기 첫 화면으로', async () => {
    const { router } = await renderApp('/guide/tours', { as: 'student' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('없는 주소는 404', async () => {
    await renderApp('/nope', { as: 'student' });
    expect(await screen.findByText('페이지를 찾을 수 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '처음으로' })).toHaveAttribute('href', '/');
  });

  it('저장된 토큰만 있으면 내 정보를 불러온 뒤 화면을 그린다', async () => {
    const { router, queryClient } = await renderApp('/login');
    useSession.setState({ token: sessionTokenOf('student@demo.kr') });
    await act(() => router.navigate('/my-tours'));
    expect(await screen.findByRole('link', { name: '내 탐방' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ email: 'student@demo.kr' });
  });

  it('세션이 만료되면(401) 토큰을 비우고 로그인으로', async () => {
    const { router } = await renderApp('/login');
    useSession.setState({ token: 'mock-expired' });
    await act(() => router.navigate('/me'));
    await waitFor(() => expect(router.state.location.search).toBe('?next=%2Fme'));
    expect(router.state.location.pathname).toBe('/login');
    expect(useSession.getState().token).toBeNull();
  });
});

describe('로그아웃', () => {
  it('로그아웃하면 세션·캐시를 비우고 /login', async () => {
    const { user, router, queryClient } = await renderApp('/me', { as: 'student' });
    await user.click(await screen.findByRole('button', { name: /^로그아웃/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('');
    expect(useSession.getState().token).toBeNull();
    expect(queryClient.getQueryData(qk.me)).toBeUndefined();
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .every((q) => q.state.data === undefined),
    ).toBe(true);
  });
});

describe('레이아웃', () => {
  it('고교생 하단 탭 3개', async () => {
    await renderApp('/me', { as: 'student' });
    for (const n of ['탐색', '내 탐방', 'MY']) {
      expect(await screen.findByRole('link', { name: n })).toBeInTheDocument();
    }
  });

  it.each([
    [
      'guide',
      '/guide',
      [
        ['내 탐방', '/guide'],
        ['코스 편집', '/guide/course'],
        ['MY', '/guide/me'],
      ],
    ],
    [
      'owner',
      '/owner/store',
      [
        ['내 가게', '/owner/store'],
        ['쿠폰', '/owner/coupons/redeem'],
      ],
    ],
  ])('%s 하단 탭', async (as, path, tabs) => {
    await renderApp(path, { as });
    const nav = await screen.findByRole('navigation', { name: '주요 메뉴' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual(tabs);
  });

  it('가이드 첫 화면 자리: 내가 개설한 탐방 링크, 코스 편집 탭 아님', async () => {
    await renderApp('/guide', { as: 'guide' });
    expect(await screen.findByRole('link', { name: '내가 개설한 탐방' })).toHaveAttribute(
      'href',
      '/guide/tours',
    );
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getByRole('link', { name: '내 탐방' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: '코스 편집' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it.each([
    ['student', '/verify', 'MY', ['탐색', '내 탐방']],
    ['guide', '/guide/verify', 'MY', ['내 탐방', '코스 편집']],
    ['guide', '/guide/wishes', '내 탐방', ['코스 편집', 'MY']],
    ['student', '/me/wishes', 'MY', ['탐색', '내 탐방']],
    ['student', '/me/wishes/1/edit', 'MY', ['탐색', '내 탐방']],
    ['owner', '/owner/verify', '내 가게', ['쿠폰']],
    ['owner', '/owner/report', '내 가게', ['쿠폰']],
  ])('%s 인증 화면(%s)에서 %s 탭만 활성', async (as, path, tab, others) => {
    await renderApp(path, { as });
    const nav = await screen.findByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
    for (const other of others) {
      expect(within(nav).getByRole('link', { name: other })).not.toHaveAttribute('aria-current');
    }
  });

  it('운영자는 탭 없이 로그아웃 버튼', async () => {
    await renderApp('/admin/verifications', { as: 'admin' });
    expect(await screen.findByRole('button', { name: '로그아웃' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).toBeNull();
  });

  it('사장님이 /owner/me로 가면 /owner/store(replace) — 사장님 MY는 없다(2B-R4)', async () => {
    const { router } = await renderApp('/owner/me', { as: 'owner' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(await screen.findByText('서천 밥상')).toBeInTheDocument();
  });

  it('자리 화면: /explore만 남는다(2B′-R24)', async () => {
    await renderApp('/explore', { as: 'owner' });
    expect(await screen.findByText('곧 열려요.')).toBeInTheDocument();
    expect(screen.queryByText(/^와이어프레임:/)).not.toBeInTheDocument();
  });
});

// 설계 5.3의 라우트 표. 화면 구현과 무관하게 라우트 등록과 가드만 확인한다(각 태스크가 자리 화면을 교체해도 유지).
type Access = Role | 'PUBLIC' | 'ANY';
const SPEC_ROUTES: Array<[path: string, access: Access]> = [
  ['/login', 'PUBLIC'],
  ['/signup', 'PUBLIC'],
  ['/consent/abc', 'PUBLIC'],
  ['/', 'HIGH_SCHOOL'],
  ['/tours', 'HIGH_SCHOOL'],
  ['/tours/1', 'ANY'],
  ['/tours/1/apply', 'HIGH_SCHOOL'],
  ['/tours/1/apply/done', 'HIGH_SCHOOL'],
  ['/my-tours', 'HIGH_SCHOOL'],
  ['/my-tours/1', 'HIGH_SCHOOL'],
  ['/my-tours/1/course', 'HIGH_SCHOOL'],
  ['/my-tours/1/coupons', 'HIGH_SCHOOL'],
  ['/coupons/1', 'HIGH_SCHOOL'],
  ['/reviews/new', 'HIGH_SCHOOL'],
  ['/verify', 'HIGH_SCHOOL'],
  ['/me', 'HIGH_SCHOOL'],
  ['/me/edit', 'HIGH_SCHOOL'],
  ['/me/wishes', 'HIGH_SCHOOL'],
  ['/me/wishes/1/edit', 'HIGH_SCHOOL'],
  ['/guide', 'UNIVERSITY'],
  ['/guide/course', 'UNIVERSITY'],
  ['/guide/tours/1/course/confirm', 'UNIVERSITY'],
  ['/my-tours/1/cancel', 'HIGH_SCHOOL'],
  ['/guide/tours', 'UNIVERSITY'],
  ['/guide/tours/1/applicants', 'UNIVERSITY'],
  ['/guide/tours/1/course/draft', 'UNIVERSITY'],
  ['/guide/tours/1/course/edit', 'UNIVERSITY'],
  ['/guide/tours/1/course/stops/pick', 'UNIVERSITY'],
  ['/guide/tours/1/course/confirmed', 'UNIVERSITY'],
  ['/guide/tours/1/course', 'UNIVERSITY'],
  ['/guide/tours/new', 'UNIVERSITY'],
  ['/guide/tours/1/complete', 'UNIVERSITY'],
  ['/guide/tours/1/cancel', 'UNIVERSITY'],
  ['/guide/me', 'UNIVERSITY'],
  ['/guide/me/profile', 'UNIVERSITY'],
  ['/guide/verify', 'UNIVERSITY'],
  ['/guide/wishes', 'UNIVERSITY'],
  ['/explore', 'ANY'],
  ['/owner/coupons/redeem', 'OWNER'],
  ['/owner/store', 'OWNER'],
  ['/owner/verify', 'OWNER'],
  ['/owner/store/connect', 'OWNER'],
  ['/owner/store/partnership', 'OWNER'],
  ['/owner/store/edit', 'OWNER'],
  ['/owner/me', 'OWNER'],
  ['/owner/report', 'OWNER'],
  ['/admin/verifications', 'ADMIN'],
  ['/admin/verifications/1', 'ADMIN'],
  ['/admin/verifications/1/reject', 'ADMIN'],
];

function accessOf(elements: ReactNode[]): Access {
  for (const el of elements) {
    if (isValidElement<{ role: Role }>(el) && el.type === RequireRole) return el.props.role;
  }
  return elements.some((el) => isValidElement(el) && el.type === RequireAuth) ? 'ANY' : 'PUBLIC';
}

describe('라우트 표 (설계 5.3)', () => {
  it.each(SPEC_ROUTES)('%s → %s', (path, access) => {
    const matches = matchRoutes(routes, path);
    expect(matches?.at(-1)?.route.path).not.toBe('*');
    expect(accessOf(matches!.map((m) => m.route.element))).toBe(access);
  });

  it('없는 주소는 * 로 간다', () => {
    expect(matchRoutes(routes, '/nope')?.at(-1)?.route.path).toBe('*');
  });
});
