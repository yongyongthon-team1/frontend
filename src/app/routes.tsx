import type { RouteObject } from 'react-router';
import { ApplicantsPage } from '@/pages/guide/ApplicantsPage';
import { GuideToursPage } from '@/pages/guide/GuideToursPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ApplyDonePage } from '@/pages/student/ApplyDonePage';
import { ApplyPage } from '@/pages/student/ApplyPage';
import { CouponDetailPage } from '@/pages/student/CouponDetailPage';
import { CouponListPage } from '@/pages/student/CouponListPage';
import { CourseMapPage } from '@/pages/student/CourseMapPage';
import { HomePage } from '@/pages/student/HomePage';
import { MyTourDetailPage } from '@/pages/student/MyTourDetailPage';
import { MyToursPage } from '@/pages/student/MyToursPage';
import { RecommendationsPage } from '@/pages/student/RecommendationsPage';
import { TourDetailPage } from '@/pages/student/TourDetailPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ErrorPage } from './ErrorPage';
import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { AppShell } from './layouts/AppShell';
import { RoleTabLayout } from './layouts/RoleTabLayout';
import { NotFoundPage } from './NotFoundPage';

/**
 * 설계 5.3의 라우트 전부. 아직 없는 화면은 `PlaceholderPage`(자리)이고, P0 자리는 각 태스크가 실제 화면으로 바꾼다
 * (주석의 Task 번호). 코드 분할(lazy)은 쓰지 않는다(결정 0006).
 * 가드 두 겹(설계 5.4): `RequireAuth`(토큰 → 내 정보) 안에 `RoleTabLayout`(역할별 하단 탭), 그 안에 `RequireRole`.
 */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      // ── 공통 · 공개 ────────────────────────────────────────────────
      { path: '/login', element: <LoginPage /> },
      {
        path: '/signup',
        element: <PlaceholderPage title="회원가입 · 역할 선택" wireframe="hs-a01" />,
      },
      {
        path: '/consent/:token',
        element: <PlaceholderPage title="보호자 동의" wireframe="hs-a02" />,
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RoleTabLayout />,
            children: [
              // ── 모든 역할 ────────────────────────────────────────────
              {
                path: '/tours/:tourId',
                element: <TourDetailPage />,
              },
              {
                path: '/explore',
                element: <PlaceholderPage title="모집 중 탐방 둘러보기" />, // P2 · 가이드 · 사장님 `탐색` 탭
              },

              // ── 고교생 ──────────────────────────────────────────────
              {
                element: <RequireRole role="HIGH_SCHOOL" />,
                children: [
                  {
                    path: '/',
                    element: <HomePage />,
                  },
                  {
                    path: '/recommendations',
                    element: <RecommendationsPage />,
                  },
                  {
                    path: '/tours/:tourId/apply',
                    element: <ApplyPage />,
                  },
                  {
                    path: '/tours/:tourId/apply/done',
                    element: <ApplyDonePage />,
                  },
                  {
                    path: '/my-tours',
                    element: <MyToursPage />,
                  },
                  {
                    path: '/my-tours/:applicationId',
                    element: <MyTourDetailPage />,
                  },
                  {
                    path: '/my-tours/:applicationId/course',
                    element: <CourseMapPage />,
                  },
                  {
                    path: '/my-tours/:applicationId/coupons',
                    element: <CouponListPage />,
                  },
                  {
                    path: '/coupons/:couponId',
                    element: <CouponDetailPage />,
                  },
                  {
                    path: '/reviews/new',
                    element: <PlaceholderPage title="방문 리뷰 작성" wireframe="hs-s10" />,
                  },
                  {
                    path: '/verify',
                    element: <PlaceholderPage title="재학 인증 · 보호자 동의" wireframe="hs-s02" />,
                  },
                  {
                    path: '/me',
                    element: (
                      <PlaceholderPage title="내 정보 · 인증 상태" wireframe="hs-a03" showLogout />
                    ),
                  },
                ],
              },

              // ── 대학생 가이드 ──────────────────────────────────────────
              {
                element: <RequireRole role="UNIVERSITY" />,
                children: [
                  {
                    path: '/guide/tours',
                    element: <GuideToursPage />,
                  },
                  {
                    path: '/guide/tours/new',
                    element: <PlaceholderPage title="탐방 개설" wireframe="guide-s02" />,
                  },
                  {
                    path: '/guide/tours/:tourId/applicants',
                    element: <ApplicantsPage />,
                  },
                  {
                    path: '/guide/tours/:tourId/course',
                    element: <PlaceholderPage title="확정 코스 지도 보기" wireframe="hs-s08" />,
                  },
                  {
                    path: '/guide/tours/:tourId/course/draft',
                    element: <PlaceholderPage title="AI 코스 초안" wireframe="guide-s04" />, // P0 · Task 19
                  },
                  {
                    path: '/guide/tours/:tourId/course/edit',
                    element: <PlaceholderPage title="코스 편집" wireframe="guide-s05" />, // P0 · Task 19
                  },
                  {
                    path: '/guide/tours/:tourId/course/stops/pick',
                    element: <PlaceholderPage title="주변 상점 선택" wireframe="guide-a03" />,
                  },
                  {
                    path: '/guide/tours/:tourId/course/confirmed',
                    element: (
                      <PlaceholderPage title="코스 확정 · 쿠폰 발급" wireframe="guide-s06" />
                    ), // P0 · Task 19
                  },
                  {
                    path: '/guide/tours/:tourId/complete',
                    element: <PlaceholderPage title="탐방 종료 · 완료" wireframe="guide-s07" />,
                  },
                  {
                    path: '/guide/tours/:tourId/cancel',
                    element: <PlaceholderPage title="탐방 취소 확인" wireframe="guide-a04" />,
                  },
                  {
                    path: '/guide/me',
                    element: (
                      <PlaceholderPage title="가이드 프로필" wireframe="guide-s01" showLogout />
                    ),
                  },
                  {
                    path: '/guide/verify',
                    element: <PlaceholderPage title="대학생 재학 인증" wireframe="guide-a01" />,
                  },
                ],
              },

              // ── 사장님 ──────────────────────────────────────────────
              {
                element: <RequireRole role="OWNER" />,
                children: [
                  {
                    path: '/owner/coupons/redeem',
                    element: <PlaceholderPage title="쿠폰 사용 처리" wireframe="owner-s03" />, // P0 · Task 20
                  },
                  {
                    path: '/owner/store',
                    element: (
                      <PlaceholderPage
                        title="내 가게 · 제휴 할인"
                        wireframe="owner-s02"
                        action={{ label: '쿠폰 사용 처리', to: '/owner/coupons/redeem' }}
                      />
                    ),
                  },
                  {
                    path: '/owner/store/connect',
                    element: (
                      <PlaceholderPage title="가게 후보 선택 · 직접 등록" wireframe="owner-a01" />
                    ),
                  },
                  {
                    path: '/owner/verify',
                    element: <PlaceholderPage title="사업자 인증" wireframe="owner-s01" />,
                  },
                  {
                    path: '/owner/report',
                    element: <PlaceholderPage title="방문 · 리뷰 리포트" wireframe="owner-s04" />, // P2
                  },
                  {
                    path: '/owner/me',
                    element: <PlaceholderPage title="내 정보" showLogout />,
                  },
                ],
              },

              // ── 운영자(탭 없음 — 로그아웃은 화면 안에) ─────────────────────
              {
                element: <RequireRole role="ADMIN" />,
                children: [
                  {
                    path: '/admin/verifications',
                    element: (
                      <PlaceholderPage title="인증 요청 목록" wireframe="owner-s06" showLogout />
                    ),
                  },
                  {
                    path: '/admin/verifications/:id',
                    element: <PlaceholderPage title="학생증 상세 심사" wireframe="owner-a02" />,
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
