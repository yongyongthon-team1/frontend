import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  DECISION_RESULT,
  documentView,
  SUBJECT_ROLE_LABEL,
  type AdminVerificationDetail,
} from '@/features/admin/model';
import { useAdminVerification, useDecideVerification } from '@/features/admin/queries';
import { formatShortDate } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';
import { ReviewGate } from './ReviewGate';
import { ADMIN_LIST_PATH } from './VerificationListPage';

/** 증빙 사진 자리: 사진 · 안 열림(다시 불러오기) · 사진 없음 · 파일 삭제됨. 어느 쪽이든 승인은 잠기지 않는다(2B-R9). */
function Evidence({ detail }: { detail: AdminVerificationDetail }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const view = documentView(detail);

  let body;
  if (view === 'IMAGE' && !failed) {
    body = (
      <img
        key={attempt}
        src={detail.documentUrl ?? undefined}
        alt={`${detail.userName} 님이 올린 학생증 사진`}
        onError={() => setFailed(true)}
        className="mt-3 max-h-60 w-full rounded-md bg-neutral-100 object-contain"
      />
    );
  } else if (view === 'IMAGE') {
    body = (
      <div className="mt-3 flex flex-col items-start gap-2 rounded-md bg-neutral-100 p-3">
        <p className="text-[13px] text-muted">사진을 불러오지 못했어요.</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          다시 불러오기
        </Button>
      </div>
    );
  } else {
    body = (
      <p className="mt-3 rounded-md bg-neutral-100 px-3 py-4 text-center text-[13px] text-muted">
        {view === 'MISSING' ? '제출된 사진이 없어요.' : '파일 삭제됨'}
      </p>
    );
  }

  return (
    <section className="rounded-lg bg-surface p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[22px] font-bold text-brand"
        >
          ↑
        </span>
        <p className="min-w-0 flex-1 truncate text-[17px] font-bold text-ink">제출된 증빙 자료</p>
      </div>
      {body}
    </section>
  );
}

function Review({ detail }: { detail: AdminVerificationDetail }) {
  const navigate = useNavigate();
  const decide = useDecideVerification(detail.id);
  const [confirming, setConfirming] = useState(false);
  const sending = useRef(false);
  const pending = detail.status === 'PENDING';
  const result = detail.status === 'PENDING' ? null : DECISION_RESULT[detail.status];

  // 승인은 사진이 지워져 되돌릴 수 없다 — 확인 창 안에서 한 번만 보낸다(연타해도 요청은 1번, 성공하면 이동할 때까지 잠금을 풀지 않는다).
  function approve() {
    if (sending.current) return;
    sending.current = true;
    decide.mutate(
      { decision: 'APPROVED' },
      {
        onSuccess: () => {
          toast(`${detail.userName} 님을 승인했어요.`);
          void navigate(ADMIN_LIST_PATH, { replace: true });
        },
        onError: (error) => {
          sending.current = false;
          setConfirming(false);
          toast.error(errorMessage(error.code));
          // 다른 곳에서 먼저 처리했다: 낡은 상세 대신 목록으로.
          if (error.code === 'ALREADY_PROCESSED') void navigate(ADMIN_LIST_PATH, { replace: true });
        },
      },
    );
  }

  return (
    <>
      <TopBar title="인증 상세 · 승인/반려" back={ADMIN_LIST_PATH} />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="제출 자료 확인"
          description="이름과 재학 정보를 확인해 주세요."
        />

        <section className="mt-5 rounded-lg bg-surface p-4">
          <div className="flex flex-wrap gap-2">
            {pending ? (
              <StatusChip tone="info">학생증 심사</StatusChip>
            ) : (
              <>
                <StatusChip tone="neutral">심사 완료</StatusChip>
                {result ? <StatusChip tone={result.tone}>{result.label}</StatusChip> : null}
              </>
            )}
          </div>
          <p className="mt-3 text-[17px] leading-snug font-bold text-ink">
            {`${detail.userName} · ${SUBJECT_ROLE_LABEL[detail.role]}`}
          </p>
          <p className="mt-1 text-[13px] text-muted">{detail.schoolName}</p>
          <p className="mt-1 text-xs text-muted">
            {`제출 일시 ${formatShortDate(detail.submittedAt)} · 학교명·이름 확인 필요`}
          </p>
        </section>

        <div className="mt-3">
          <Evidence key={detail.documentUrl ?? ''} detail={detail} />
        </div>

        {pending ? (
          <div className="mt-3">
            <InfoCard tone="brand" title="인증 완료 후에는 원본 증빙 사진을 삭제하도록 처리해요." />
          </div>
        ) : null}

        <BottomAction>
          {pending ? (
            <div className="flex flex-col gap-2">
              <Button onClick={() => setConfirming(true)}>승인 처리하기</Button>
              <Link
                to={`${ADMIN_LIST_PATH}/${detail.id}/reject`}
                className={buttonClass('dangerSoft')}
              >
                반려 사유 입력
              </Link>
            </div>
          ) : (
            <Link to={ADMIN_LIST_PATH} className={buttonClass('primary')}>
              목록으로
            </Link>
          )}
        </BottomAction>
      </Page>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`${detail.userName} 님의 재학 인증을 승인할까요?`}
        description="승인하면 인증 배지가 표시되고 사진 파일은 바로 삭제돼요."
        confirmLabel="승인하기"
        pending={decide.isPending}
        onConfirm={approve}
      />
    </>
  );
}

/**
 * 학생증 상세 심사(owner-a02, A02). 대기 건은 사진 · 승인 · 반려 사유 입력(A03)이고, 처리가 끝난 건(주소로)은 읽기 전용이다:
 * `심사 완료` + 결과 칩 + `파일 삭제됨` + `목록으로`. 승인은 확인 창을 거쳐 토스트와 함께 목록으로 돌아간다(2B′-R11).
 */
export function VerificationReviewPage() {
  const id = Number(useParams().id);
  const query = useAdminVerification(id);
  return (
    <ReviewGate title="인증 상세 · 승인/반려" back={ADMIN_LIST_PATH} id={id} query={query}>
      {(detail) => <Review detail={detail} />}
    </ReviewGate>
  );
}
