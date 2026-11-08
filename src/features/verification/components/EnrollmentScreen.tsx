import type { FormEvent, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { FileField } from '@/shared/ui/FileField';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { StepList } from '@/shared/ui/StepList';
import { TopBar } from '@/shared/ui/TopBar';
import { PROOF_ACCEPT, proofFileError } from '../model';
import { FirstEntryLogout } from './FirstEntryLogout';

export interface EnrollmentScreenProps {
  /** FIRST = C03(미제출), RESUBMIT = C08(반려). */
  mode: 'FIRST' | 'RESUBMIT';
  /** 뒤로 가기가 가는 곳: 그 역할의 MY(판정 A8). */
  backTo: string;
  /** RESUBMIT일 때 `반려 사유: …`로 보이는 서버 사유. */
  rejectionReason?: string | null;
  /** 안내 상자 아래 · 업로드 카드 위 칸들(판정 A1 — 학교 · 학년 또는 대학). */
  fields?: ReactNode;
  file: File | null;
  fileError?: string;
  onFileChange(next: { file: File | null; error: string | null }): void;
  pending: boolean;
  onSubmit(event: FormEvent): void;
}

const COPY = {
  FIRST: {
    topBar: '재학 인증 · 학생증 업로드',
    title: '학생증을 인증해 주세요.',
    description: '안전한 탐방을 위해 재학 여부를 확인해요.',
    upload: '학생증 사진 올리기',
    uploadDescription: '이름·학교명·재학 여부를 확인할 수 있게 촬영해 주세요.',
    steps: ['사진 확인 후 운영자가 심사해요', '승인 전에는 탐방 신청·개설이 제한돼요'],
    submit: '인증 요청하기',
  },
  RESUBMIT: {
    topBar: '인증 반려 · 재제출',
    title: '인증을 다시 요청해 주세요.',
    description: '입력 정보가 확인되지 않았어요.',
    upload: '학생증 다시 올리기',
    uploadDescription: '빛 반사 없이 글자가 선명하게 보이도록 촬영해 주세요.',
    // 판정 A5: 심사가 끝나면 사진은 지워지므로 `대체돼요`가 아니라 새 사진으로 다시 내라고 안내한다.
    steps: ['새 사진으로 다시 제출해 주세요.', '재제출 후 인증 상태를 다시 확인할 수 있어요'],
    submit: '재제출하기',
  },
} as const;

/**
 * 재학 인증 · 학생증 업로드(C03)와 반려 · 재제출(C08)의 공용 화면. 고교생 `/verify`와 가이드 `/guide/verify`가 같이 쓴다.
 * 순서: 상단 바(‹) → 제목 · 설명 → 안내 상자(C08은 danger 반려 사유) → 칸(학교 …) → 업로드 카드 → 단계 목록 → 하단 고정 버튼.
 * 제출 처리(잠금 · 검증 · 이동)는 부르는 쪽이 한다 — 이 화면은 모양만 가진다.
 */
export function EnrollmentScreen({
  mode,
  backTo,
  rejectionReason,
  fields,
  file,
  fileError,
  onFileChange,
  pending,
  onSubmit,
}: EnrollmentScreenProps) {
  const copy = COPY[mode];
  return (
    <>
      <TopBar title={copy.topBar} back={backTo} />
      <Page className={cn(BOTTOM_ACTION_PAGE, 'pt-3')}>
        <PageHeading as="h2" title={copy.title} description={copy.description} />
        <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-1 flex-col">
          <div className="flex flex-col gap-3">
            {mode === 'RESUBMIT' ? (
              <Notice tone="danger">
                {rejectionReason
                  ? `반려 사유: ${rejectionReason}`
                  : '반려됐어요. 사진과 입력한 정보를 확인해 주세요.'}
              </Notice>
            ) : (
              <Notice>고교생·대학생 모두 학생증 또는 재학증명서를 제출해요.</Notice>
            )}
            {fields}
            <FileField
              label={copy.upload}
              description={copy.uploadDescription}
              hint="jpg · png, 5MB 이하"
              accept={PROOF_ACCEPT}
              file={file}
              error={fileError}
              disabled={pending}
              validate={proofFileError}
              onChange={onFileChange}
            />
            <StepList steps={[...copy.steps]} current={0} />
          </div>
          <BottomAction>
            <Button type="submit" loading={pending} disabled={pending}>
              {copy.submit}
            </Button>
            <FirstEntryLogout />
          </BottomAction>
        </form>
      </Page>
    </>
  );
}
