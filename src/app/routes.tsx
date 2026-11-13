import { Navigate, type RouteObject } from 'react-router';
import { VerificationListPage } from '@/pages/admin/VerificationListPage';
import { VerificationRejectPage } from '@/pages/admin/VerificationRejectPage';
import { VerificationReviewPage } from '@/pages/admin/VerificationReviewPage';
import { ApplicantsPage } from '@/pages/guide/ApplicantsPage';
import { CourseConfirmPage } from '@/pages/guide/CourseConfirmPage';
import { CourseDraftPage } from '@/pages/guide/CourseDraftPage';
import { CourseEditPage } from '@/pages/guide/CourseEditPage';
import { CoursePickPage } from '@/pages/guide/CoursePickPage';
import { GuideCourseMapPage } from '@/pages/guide/GuideCourseMapPage';
import { GuideCourseRedirect } from '@/pages/guide/GuideCourseRedirect';
import { GuideMyPage } from '@/pages/guide/GuideMyPage';
import { GuideMyStatusPage } from '@/pages/guide/GuideMyStatusPage';
import { GuideProfilePage } from '@/pages/guide/GuideProfilePage';
import { GuideHomePage } from '@/pages/guide/GuideHomePage';
import { GuideToursPage } from '@/pages/guide/GuideToursPage';
import { GuideVerifyPage } from '@/pages/guide/GuideVerifyPage';
import { GuideWishesPage } from '@/pages/guide/GuideWishesPage';
import { TourCancelPage } from '@/pages/guide/TourCancelPage';
import { TourCompletePage } from '@/pages/guide/TourCompletePage';
import { TourCreatePage } from '@/pages/guide/TourCreatePage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { ConsentPage } from '@/pages/public/ConsentPage';
import { BusinessVerifyPage } from '@/pages/owner/BusinessVerifyPage';
import { CouponRedeemPage } from '@/pages/owner/CouponRedeemPage';
import { MyStorePage } from '@/pages/owner/MyStorePage';
import { PartnershipPage } from '@/pages/owner/PartnershipPage';
import { StoreConnectPage } from '@/pages/owner/StoreConnectPage';
import { StoreEditPage } from '@/pages/owner/StoreEditPage';
import { StoreReportPage } from '@/pages/owner/StoreReportPage';
import { CancelApplicationPage } from '@/pages/student/CancelApplicationPage';
import { ApplyDonePage } from '@/pages/student/ApplyDonePage';
import { ApplyPage } from '@/pages/student/ApplyPage';
import { CouponDetailPage } from '@/pages/student/CouponDetailPage';
import { CouponListPage } from '@/pages/student/CouponListPage';
import { CourseMapPage } from '@/pages/student/CourseMapPage';
import { EditWishPage } from '@/pages/student/EditWishPage';
import { HomePage } from '@/pages/student/HomePage';
import { MeEditPage } from '@/pages/student/MeEditPage';
import { GuardianRequestPage } from '@/pages/student/GuardianRequestPage';
import { MePage } from '@/pages/student/MePage';
import { MyStatusPage } from '@/pages/student/MyStatusPage';
import { MyTourDetailPage } from '@/pages/student/MyTourDetailPage';
import { MyToursPage } from '@/pages/student/MyToursPage';
import { MyWishesPage } from '@/pages/student/MyWishesPage';
import { ReviewNewPage } from '@/pages/student/ReviewNewPage';
import { TourDetailPage } from '@/pages/student/TourDetailPage';
import { TourResultsPage } from '@/pages/student/TourResultsPage';
import { VerifyPage } from '@/pages/student/VerifyPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ErrorPage, RouteErrorPage } from './ErrorPage';
import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { AppShell } from './layouts/AppShell';
import { RoleTabLayout } from './layouts/RoleTabLayout';
import { NotFoundPage } from './NotFoundPage';

/**
 * 설계 5.3의 라우트 전부. 화면이 아직 없는 곳은 `/explore`(P2)뿐이고 `PlaceholderPage`(자리)로 둔다.
 * 코드 분할(lazy)은 쓰지 않는다(결정 0006).
 * 가드 두 겹(설계 5.4): `RequireAuth`(토큰 → 내 정보) 안에 `RoleTabLayout`(역할별 하단 탭), 그 안에 `RequireRole`.
 * 재학 인증 · 보호자 동의 요청 화면(C03 · C04 · C06 · C08)만 탭이 없는 `RoleTabLayout tabs={false}` 묶음이다(판정 A8).
 * 에러 경계 두 겹(설계 5.10): 로그인한 화면의 렌더 오류는 같은 탭 레이아웃 안의 `RouteErrorPage`가 받아 프레임 ·
 * 하단 탭 · 시연 패널이 남는다. 그 밖(공개 화면 · 레이아웃 자체)은 루트의 `ErrorPage`.
 */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      // ── 공통 · 공개 ────────────────────────────────────────────────
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> }, // U-01 hs-a01
      { path: '/consent/:token', element: <ConsentPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            // 인증 화면(C03 · C04 · C06 · C08): 상단 바 뒤로 가기만 있고 하단 탭이 없다(판정 A8). 뒤로 가기는 그 역할의 MY(사장님은 내 가게)로 간다.
            element: <RoleTabLayout tabs={false} />,
            errorElement: (
              <RoleTabLayout tabs={false}>
                <RouteErrorPage withLogout />
              </RoleTabLayout>
            ),
            children: [
              {
                element: <RequireRole role="HIGH_SCHOOL" />,
                children: [
                  { path: '/verify', element: <VerifyPage /> }, // C03 · C08 · 상태
                  { path: '/verify/guardian', element: <GuardianRequestPage /> }, // C04
                ],
              },
              {
                element: <RequireRole role="UNIVERSITY" />,
                children: [
                  { path: '/guide/verify', element: <GuideVerifyPage /> }, // C03 · C08 · 상태 (U-05 guide-a01)
                ],
              },
              {
                element: <RequireRole role="OWNER" />,
                children: [
                  { path: '/owner/verify', element: <BusinessVerifyPage /> }, // C06 (U-07 owner-s01)
                ],
              },
            ],
          },
          {
            element: <RoleTabLayout />,
            errorElement: (
              <RoleTabLayout>
                <RouteErrorPage />
              </RoleTabLayout>
            ),
            children: [
              // ── 모든 역할 ────────────────────────────────────────────
              {
                path: '/tours/:tourId',
                element: <TourDetailPage />,
              },
              {
                path: '/explore',
                element: <PlaceholderPage title="모집 중 투어 둘러보기" />, // P2 · 가이드 · 사장님 `탐색` 탭
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
                    path: '/tours',
                    element: <TourResultsPage />, // T-01 탐방 찾기 결과(2C-R18)
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
                    path: '/my-tours/:applicationId/cancel',
                    element: <CancelApplicationPage />,
                  },
                  {
                    path: '/coupons/:couponId',
                    element: <CouponDetailPage />,
                  },
                  {
                    path: '/reviews/new',
                    element: <ReviewNewPage />,
                  },
                  {
                    path: '/me',
                    element: <MePage />, // H16 hs-a03
                  },
                  {
                    path: '/me/status',
                    element: <MyStatusPage />, // C07 내 정보 · 인증 상태
                  },
                  {
                    path: '/me/edit',
                    element: <MeEditPage />, // H17
                  },
                  {
                    path: '/me/wishes',
                    element: <MyWishesPage />, // T-07 내 희망 사항
                  },
                  {
                    path: '/me/wishes/:wishId/edit',
                    element: <EditWishPage />, // T-07 희망 사항 고치기
                  },
                ],
              },

              // ── 대학생 가이드 ──────────────────────────────────────────
              {
                element: <RequireRole role="UNIVERSITY" />,
                children: [
                  {
                    path: '/guide',
                    element: <GuideHomePage />, // Task 9가 G01 홈으로 채운다
                  },
                  {
                    path: '/guide/course',
                    element: <GuideCourseRedirect />, // `코스 편집` 탭 → 다가오는 탐방의 코스
                  },
                  {
                    path: '/guide/tours',
                    element: <GuideToursPage />,
                  },
                  {
                    path: '/guide/wishes',
                    element: <GuideWishesPage />, // T-08 고교생 희망 사항
                  },
                  {
                    path: '/guide/tours/new',
                    element: <TourCreatePage />, // T-03 G04
                  },
                  {
                    path: '/guide/tours/:tourId/applicants',
                    element: <ApplicantsPage />,
                  },
                  {
                    path: '/guide/tours/:tourId/course',
                    element: <GuideCourseMapPage />, // 확정 코스 지도 보기(고교생 H04 재사용)
                  },
                  {
                    path: '/guide/tours/:tourId/course/draft',
                    element: <CourseDraftPage />,
                  },
                  {
                    path: '/guide/tours/:tourId/course/edit',
                    element: <CourseEditPage />,
                  },
                  {
                    path: '/guide/tours/:tourId/course/stops/pick',
                    element: <CoursePickPage />, // C-02 G07 장소 추가 · 교체
                  },
                  {
                    path: '/guide/tours/:tourId/course/confirm',
                    element: <CourseConfirmPage />, // G08 확정 전 점검 · 완료
                  },
                  {
                    // 1단계 확정 결과 주소 — 완료 상태는 이제 확정 점검 주소에 있다(판정 2A-R10).
                    path: '/guide/tours/:tourId/course/confirmed',
                    element: <Navigate to="../confirm" relative="path" replace />,
                  },
                  {
                    path: '/guide/tours/:tourId/complete',
                    element: <TourCompletePage />, // T-06 G09
                  },
                  {
                    path: '/guide/tours/:tourId/cancel',
                    element: <TourCancelPage />, // T-05 G10
                  },
                  {
                    path: '/guide/me',
                    element: <GuideMyPage />, // G12 guide-s01
                  },
                  {
                    path: '/guide/me/profile',
                    element: <GuideProfilePage />, // U-04 G05
                  },
                  {
                    path: '/guide/me/status',
                    element: <GuideMyStatusPage />, // C07 내 정보 · 인증 상태(가이드)
                  },
                ],
              },

              // ── 사장님 ──────────────────────────────────────────────
              {
                element: <RequireRole role="OWNER" />,
                children: [
                  {
                    path: '/owner/coupons/redeem',
                    element: <CouponRedeemPage />,
                  },
                  {
                    path: '/owner/store',
                    element: <MyStorePage />,
                  },
                  {
                    path: '/owner/store/connect',
                    element: <StoreConnectPage />, // S-01 owner-a01 (O05)
                  },
                  {
                    path: '/owner/store/partnership',
                    element: <PartnershipPage />, // S-03 (O06)
                  },
                  {
                    path: '/owner/store/edit',
                    element: <StoreEditPage />, // S-01 PATCH
                  },
                  {
                    path: '/owner/report',
                    element: <StoreReportPage />,
                  },
                  {
                    path: '/owner/me',
                    element: <Navigate to="/owner/store" replace />, // 사장님 MY는 없다(2B-R4)
                  },
                ],
              },

              // ── 운영자(탭 없음 — 로그아웃은 화면 안에) ─────────────────────
              {
                element: <RequireRole role="ADMIN" />,
                children: [
                  { path: '/admin/verifications', element: <VerificationListPage /> },
                  { path: '/admin/verifications/:id', element: <VerificationReviewPage /> },
                  { path: '/admin/verifications/:id/reject', element: <VerificationRejectPage /> },
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
