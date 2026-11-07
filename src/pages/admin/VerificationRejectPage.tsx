import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  rejectReasonError,
  SUBJECT_ROLE_LABEL,
  type AdminVerificationDetail,
} from '@/features/admin/model';
import { useAdminVerification, useDecideVerification } from '@/features/admin/queries';
import { errorMessage } from '@/shared/lib/errors';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Textarea } from '@/shared/ui/Textarea';
import { TopBar } from '@/shared/ui/TopBar';
import { ReviewGate } from './ReviewGate';
import { ADMIN_LIST_PATH } from './VerificationListPage';

function RejectForm({ detail }: { detail: AdminVerificationDetail }) {
  const navigate = useNavigate();
  const decide = useDecideVerification(detail.id);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [finished, setFinished] = useState(false);
  const sending = useRef(false);
  const reviewPath = `${ADMIN_LIST_PATH}/${detail.id}`;

  // 이미 처리된 건이면 A02(읽기 전용)로 보낸다. 방금 반려해 목록으로 가는 중에는 낡은 캐시 갱신에 끌려가지 않는다.
  if (detail.status !== 'PENDING' && !finished) return <Navigate to={reviewPath} replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    const problem = rejectReasonError(reason);
    setError(problem ?? undefined);
    if (problem === null) setConfirming(true);
  }

  // 반려는 사진이 지워져 되돌릴 수 없다 — 확인 창 안에서 한 번만 보낸다(연타해도 요청은 1번, 성공하면 이동할 때까지 잠금을 풀지 않는다).
  function reject() {
    if (sending.current) return;
    sending.current = true;
    decide.mutate(
      { decision: 'REJECTED', rejectReason: reason },
      {
        onSuccess: () => {
          setFinished(true);
          toast(`${detail.userName} 님의 인증을 반려했어요.`);
          void navigate(ADMIN_LIST_PATH, { replace: true });
        },
        onError: (e) => {
          sending.current = false;
          setConfirming(false);
          const fieldMessage = e.fieldErrors?.rejectReason;
          if (fieldMessage !== undefined) {
            setError(fieldMessage);
            return;
          }
          toast.error(errorMessage(e.code));
          if (e.code === 'ALREADY_PROCESSED') void navigate(ADMIN_LIST_PATH, { replace: true });
        },
      },
    );
  }

  return (
    <>
      <TopBar title="인증 반려 사유 입력" back={reviewPath} />
      <Page className={BOTTOM_ACTION_PAGE}>
        <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col">
          <PageHeading
            as="h2"
            title="반려 사유를 입력해 주세요."
            description="사용자가 수정해 재제출할 수 있도록 안내해요."
          />

          <section className="mt-5 rounded-lg bg-surface p-4">
            <p className="text-xs font-medium text-muted">심사 대상</p>
            <p className="mt-1 text-[17px] leading-snug font-bold text-ink">
              {`${detail.userName} · ${SUBJECT_ROLE_LABEL[detail.role]}`}
            </p>
            <p className="mt-1 text-[13px] text-muted">학생증 사진 · 재학 확인</p>
          </section>

          <div className="mt-3">
            <Textarea
              label="반려 사유"
              showLabel
              placeholder="학교명과 이름이 선명하게 보이도록 다시 올려 주세요."
              value={reason}
              error={error}
              disabled={decide.isPending}
              onChange={(e) => {
                setReason(e.target.value);
                setError(undefined);
              }}
            />
          </div>

          <div className="mt-3">
            <InfoCard
              tone="brand"
              title="반려 사유가 내 정보 화면에 표시되고, 사용자는 재제출할 수 있어요."
            />
          </div>

          <BottomAction>
            <Button type="submit" variant="danger" disabled={decide.isPending}>
              반려 처리하기
            </Button>
          </BottomAction>
        </form>
      </Page>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="재학 인증을 반려할까요?"
        description="반려 사유가 학생에게 보이고 사진 파일은 바로 삭제돼요."
        confirmLabel="반려하기"
        pending={decide.isPending}
        onConfirm={reject}
      />
    </>
  );
}

/**
 * 인증 반려 사유 입력(owner-a02의 반려, A03). 사유는 공백을 뺀 1~100자이고 제출할 때 검사한다. 확인 창을 거쳐 반려하면 토스트와 함께
 * 목록으로 돌아간다(2B′-R11). 이미 처리된 건의 주소는 A02로 replace한다.
 */
export function VerificationRejectPage() {
  const id = Number(useParams().id);
  const query = useAdminVerification(id);
  return (
    <ReviewGate title="인증 반려 사유 입력" back={`${ADMIN_LIST_PATH}/${id}`} id={id} query={query}>
      {(detail) => <RejectForm detail={detail} />}
    </ReviewGate>
  );
}
