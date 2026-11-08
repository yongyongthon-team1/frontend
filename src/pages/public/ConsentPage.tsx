import { useRef, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { useSession } from '@/features/auth/session';
import type { ConsentDecision, ConsentView } from '@/features/verification/model';
import { useConsent, useDecideConsent } from '@/features/verification/queries';
import { formatMonthDay, formatTime } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

const TITLE = '보호자 동의 페이지';
const LINK_CODES = new Set(['CONSENT_LINK_EXPIRED', 'CONSENT_LINK_INVALID']);

function Header() {
  return (
    <>
      <TopBar title={TITLE} />
      <div className="px-[var(--gutter)] pt-3">
        <StatusChip tone="info">고교생 보호자 전용 링크</StatusChip>
      </div>
    </>
  );
}

/** 링크를 열 수 없을 때(만료 · 잘못된 링크): 사유 카드만, 버튼 없음. */
function LinkProblem({ code }: { code: 'CONSENT_LINK_EXPIRED' | 'CONSENT_LINK_INVALID' }) {
  return (
    <InfoCard
      muted
      title={errorMessage(code)}
      description={
        code === 'CONSENT_LINK_INVALID'
          ? '메일의 링크를 다시 눌러 보거나, 학생에게 새 링크를 요청해 주세요.'
          : undefined
      }
    />
  );
}

/** 처리 결과(방금 · 이미 처리됨 모두 같은 카드). 토큰 세션이 있으면 학생 화면으로 돌아가는 링크를 붙인다. */
function DecidedCard({ agreed, signedIn }: { agreed: boolean; signedIn: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <InfoCard
        tone={agreed ? 'brand' : 'default'}
        title={agreed ? '동의를 마쳤어요' : '동의하지 않았어요'}
        description={
          agreed
            ? '학생이 탐방을 신청할 수 있어요.'
            : '마음이 바뀌면 학생에게 다시 요청해 달라고 해 주세요.'
        }
      />
      {signedIn ? (
        <Link to="/verify/guardian" className={buttonClass('secondary')}>
          학생 화면으로 돌아가기
        </Link>
      ) : null}
    </div>
  );
}

/**
 * 보호자 동의 페이지(hs-a02, 공개). 로그인 없이 링크 토큰만으로 안내를 보고 동의 · 거부한다 — 모든 요청이 `auth: false`라 401이어도
 * 지금 세션을 끊지 않는다. 동의 · 거부는 되돌릴 수 없으므로 처리 중에는 두 버튼이 모두 잠기고 연타해도 요청은 한 번이다(확인 창은 없다).
 * 이미 처리된 링크는 같은 결과 카드로 그리고, 만료(조회 · 결정 모두 410)와 잘못된 링크는 사유 카드만 보인다.
 */
export function ConsentPage() {
  const token = useParams().token ?? '';
  const query = useConsent(token);
  const decide = useDecideConsent(token);
  const signedIn = useSession((s) => s.token) !== null;
  const sending = useRef(false);

  // 조회가 410 · 404로 끝났거나 결정이 그렇게 거절됐다면 링크 문제다(받아 둔 안내가 있어도).
  const linkError = [query.error, decide.error].find((e) => e !== null && LINK_CODES.has(e.code));
  const view = query.data;

  function onDecide(decision: ConsentDecision) {
    if (sending.current) return; // 연타해도 요청은 한 번
    sending.current = true;
    decide.mutate(decision, {
      onError: (error) => {
        // 링크 문제는 카드로 보이고 잠금도 그대로, 그 밖의 오류는 토스트 + 버튼이 다시 열린다.
        if (LINK_CODES.has(error.code)) return;
        sending.current = false;
        toast.error(errorMessage(error.code));
      },
    });
  }

  // 폼(대기 중)은 아래에 붙는 버튼 영역이 있는 자기 `Page`를 그리고, 나머지는 같은 `Page` 안의 카드 하나다.
  let card: ReactNode = null;
  let pendingView: ConsentView | null = null;
  if (linkError) {
    card = <LinkProblem code={linkError.code as 'CONSENT_LINK_EXPIRED' | 'CONSENT_LINK_INVALID'} />;
  } else if (view === undefined && query.isError) {
    card = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  } else if (view === undefined) {
    card = (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[120px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
      </div>
    );
  } else {
    // 결정이 막 성공했으면 다시 조회가 끝나기 전에도 그 결과를 보인다.
    const status = decide.isSuccess ? decide.data : view.status;
    if (status === 'AGREED' || status === 'REJECTED') {
      card = <DecidedCard agreed={status === 'AGREED'} signedIn={signedIn} />;
    } else if (status === 'EXPIRED') {
      card = <LinkProblem code="CONSENT_LINK_EXPIRED" />;
    } else {
      pendingView = view;
    }
  }

  return (
    <>
      <Header />
      {pendingView !== null ? (
        <PendingBody
          view={pendingView}
          pending={decide.isPending}
          pendingDecision={decide.variables}
          onDecide={onDecide}
        />
      ) : (
        <Page className="mt-3">{card}</Page>
      )}
    </>
  );
}

function PendingBody({
  view,
  pending,
  pendingDecision,
  onDecide,
}: {
  view: ConsentView;
  pending: boolean;
  pendingDecision: ConsentDecision | undefined;
  onDecide(decision: ConsentDecision): void;
}) {
  return (
    <Page className={BOTTOM_ACTION_PAGE}>
      <div className="mt-3 flex flex-col gap-3">
        <InfoCard
          title="캠퍼스 탐방 참여 동의"
          description={<span className="whitespace-pre-wrap">{view.guideText}</span>}
        />
        <InfoCard
          title="탐방 방식 및 안전 안내"
          description="참가 신청 후 가이드 승인 · 오픈채팅 연결 · 캠퍼스와 주변 상점 방문"
        />
      </div>

      <h2 className="mt-5 mb-2 text-[15px] font-bold text-ink">동의 대상</h2>
      <InfoCard
        muted
        title={`학생: ${view.studentName}${view.schoolName ? ` · ${view.schoolName}` : ''}`}
        description="탐방 신청 및 관련 정보 제공에 동의합니다."
      />

      {view.expiresAt ? (
        <p className="mt-4 text-[13px] text-muted">
          {`${formatMonthDay(view.expiresAt)} ${formatTime(view.expiresAt)}까지 응답할 수 있어요.`}
        </p>
      ) : null}
      <p className={view.expiresAt ? 'mt-1 text-[13px] text-muted' : 'mt-4 text-[13px] text-muted'}>
        링크 만료 시 학생에게 재요청을 안내합니다.
      </p>

      <BottomAction>
        <div className="flex flex-col gap-2">
          <Button
            loading={pending && pendingDecision === 'AGREED'}
            disabled={pending}
            onClick={() => onDecide('AGREED')}
          >
            안내 확인 후 동의하기
          </Button>
          <Button
            variant="secondary"
            loading={pending && pendingDecision === 'REJECTED'}
            disabled={pending}
            onClick={() => onDecide('REJECTED')}
          >
            동의하지 않기
          </Button>
        </div>
      </BottomAction>
    </Page>
  );
}
