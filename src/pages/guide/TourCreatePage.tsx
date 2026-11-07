import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  TOUR_CAPACITY_MAX,
  TOUR_INTRO_MAX,
  type CreateTourInput,
} from '@/features/applications/model';
import { useCreateTour } from '@/features/applications/queries';
import { useMe } from '@/features/auth/queries';
import { tourCreateBlock } from '@/features/auth/guide';
import { isWithinVacation, tourDateBoundsNow } from '@/features/campuses/model';
import { useUniversities } from '@/features/campuses/queries';
import { campusLabel } from '@/features/tours/model';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { Textarea } from '@/shared/ui/Textarea';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

const BACK = '/guide/tours';
const UNKNOWN_SCHOOL = '재학 인증한 학교';
const NO_VACATION_REASON = '앞으로 열리는 방학 기간이 없어 지금은 개설할 수 없어요.';

type Field = 'date' | 'startTime' | 'endTime' | 'capacity' | 'introduction' | 'openChatUrl';
type Errors = Partial<Record<Field, string>>;

interface Values {
  date: string;
  startTime: string;
  endTime: string;
  capacity: string;
  introduction: string;
  openChatUrl: string;
}

const EMPTY: Values = {
  date: '',
  startTime: '',
  endTime: '',
  capacity: '',
  introduction: '',
  openChatUrl: '',
};

const FIELDS: readonly Field[] = [
  'date',
  'startTime',
  'endTime',
  'capacity',
  'introduction',
  'openChatUrl',
];

const isField = (name: string): name is Field => (FIELDS as readonly string[]).includes(name);

/**
 * 폼 검사. 학교를 알면(`vacations` 있음) 날짜가 방학 안인지도 본다 — 서버가 최종 판정이고 이것은 안내다.
 * 위에서부터 칸마다 처음 걸린 문구 하나씩이다.
 */
function validate(
  values: Values,
  vacations: Parameters<typeof isWithinVacation>[0] | null,
): Errors {
  const errors: Errors = {};
  if (values.date === '') {
    errors.date = vacations ? '방학 날짜를 골라 주세요.' : '날짜를 골라 주세요.';
  } else if (vacations && !isWithinVacation(vacations, values.date)) {
    errors.date = errorMessage('OUTSIDE_VACATION');
  }
  if (values.startTime === '') errors.startTime = '시작 시간을 골라 주세요.';
  if (values.endTime === '') errors.endTime = '종료 시간을 골라 주세요.';
  else if (values.startTime !== '' && values.endTime <= values.startTime) {
    errors.endTime = '종료 시간은 시작 시간보다 늦어야 해요.';
  }
  const capacity = Number(values.capacity);
  if (
    values.capacity.trim() === '' ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > TOUR_CAPACITY_MAX
  ) {
    errors.capacity = `모집 정원은 1~${TOUR_CAPACITY_MAX}명으로 적어 주세요.`;
  }
  const intro = values.introduction.trim();
  if (intro === '') errors.introduction = '탐방 소개를 입력해 주세요.';
  else if (intro.length > TOUR_INTRO_MAX)
    errors.introduction = `${TOUR_INTRO_MAX}자 이내로 적어 주세요.`;
  const link = values.openChatUrl.trim();
  if (link === '') errors.openChatUrl = '연락 링크를 넣어 주세요.';
  else if (!/^https:\/\//i.test(link))
    errors.openChatUrl = 'https://로 시작하는 링크를 넣어 주세요.';
  return errors;
}

function toInput(values: Values): CreateTourInput {
  return {
    date: values.date,
    startTime: values.startTime,
    endTime: values.endTime,
    capacity: Number(values.capacity),
    introduction: values.introduction.trim(),
    openChatUrl: values.openChatUrl.trim(),
  };
}

function Card({
  label,
  right,
  children,
}: {
  label: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold text-ink">{label}</h3>
        {right}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * 새 탐방 만들기(G04 · guide-s02, T-03). 본문은 입력 그대로 보낸다(시각 변환 없음 — 서울 날짜 · 시각 문자열).
 * 학교는 `me.guideProfile.universityId`로 찾고, 모르면(실서버) 방학 안내 없이 서버가 판정한다(2B′-R12).
 * 날짜 안내 범위는 `tourDateBoundsNow`가 정한다(화면은 시계를 직접 읽지 않는다).
 */
export function TourCreatePage() {
  const navigate = useNavigate();
  const meQuery = useMe();
  const universityId = meQuery.data?.guideProfile?.universityId ?? null;
  const me = meQuery.data;
  const block = me ? tourCreateBlock(me) : null;
  // 캠퍼스 목록은 방학 안내에만 쓴다 — 학교를 모르거나(universityId null) 개설이 막힌 가이드는 부르지 않는다.
  const needsCampuses = me !== undefined && block === null && universityId !== null;
  const universities = useUniversities({ enabled: needsCampuses });
  const create = useCreateTour();
  const sending = useRef(false);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  const campuses = universities.data;
  const waitingCampuses = needsCampuses && campuses === undefined;

  if (me === undefined || waitingCampuses) {
    const failed = meQuery.isError ? meQuery : universities.isError ? universities : null;
    return (
      <>
        <TopBar title="새 탐방 만들기" back={BACK} />
        <Page>
          {failed ? (
            <ErrorState
              error={failed.error}
              onRetry={() => {
                void failed.refetch();
              }}
            />
          ) : (
            <>
              <Skeleton className="h-[72px] w-3/4" />
              <Skeleton className="mt-5 h-[76px] rounded-xl" />
              <Skeleton className="mt-3 h-[150px] rounded-xl" />
              <Skeleton className="mt-3 h-[76px] rounded-xl" />
            </>
          )}
        </Page>
      </>
    );
  }

  const school =
    needsCampuses && universityId !== null
      ? campuses?.find((u) => u.id === universityId)
      : undefined;
  const vacations = school?.vacations ?? null;
  const bounds = vacations ? tourDateBoundsNow(vacations) : null;
  const noVacation = block === null && vacations !== null && bounds === null;
  const locked = block !== null || noVacation;
  const inVacation =
    vacations !== null && values.date !== '' && isWithinVacation(vacations, values.date);

  function set(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] === undefined ? prev : { ...prev, [field]: undefined }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked || sending.current) return; // 연타해도 요청은 한 번
    const found = validate(values, vacations);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    sending.current = true;
    create.mutate(toInput(values), {
      onSuccess: () => {
        toast('탐방을 개설했어요.');
        void navigate(BACK, { replace: true });
      },
      onError: (error) => {
        const server: Errors = {};
        for (const [name, reason] of Object.entries(error.fieldErrors ?? {})) {
          if (isField(name)) server[name] = reason;
        }
        if (Object.keys(server).length > 0) setErrors(server);
        else toast.error(errorMessage(error.code));
      },
      onSettled: () => {
        sending.current = false;
      },
    });
  }

  const hint = block
    ? { reason: block.reason, action: block.action }
    : noVacation
      ? { reason: NO_VACATION_REASON, action: { label: '내가 개설한 탐방', to: BACK } }
      : undefined;

  return (
    <>
      <TopBar title="새 탐방 만들기" back={BACK} />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="어떤 하루를 보여줄까요?"
          description="방학 중 열 수 있는 작은 캠퍼스 투어를 만들어 봐요."
        />
        {block ? (
          <StatusChip tone="warning" className="mt-3">
            {block.chip}
          </StatusChip>
        ) : null}

        <form
          onSubmit={onSubmit}
          onKeyDown={preventImeEnter}
          noValidate
          className="mt-5 flex flex-1 flex-col"
        >
          <fieldset disabled={locked} className="flex min-w-0 flex-col gap-3">
            <Card label="학교">
              <p className="flex items-center justify-between gap-2 text-[17px] font-bold text-ink">
                <span className="min-w-0 truncate">
                  {school ? campusLabel(school.name, school.campusName) : UNKNOWN_SCHOOL}
                </span>
                {school ? (
                  <span aria-hidden className="shrink-0 text-brand">
                    ✓
                  </span>
                ) : null}
              </p>
            </Card>

            <Card
              label="일정"
              right={inVacation ? <StatusChip tone="success">방학 기간</StatusChip> : undefined}
            >
              <TextField
                label="날짜"
                type="date"
                min={bounds?.min}
                max={bounds?.max}
                value={values.date}
                error={errors.date}
                onChange={(e) => set('date', e.target.value)}
              />
              <div className="mt-3 flex gap-3">
                <TextField
                  label="시작 시간"
                  type="time"
                  value={values.startTime}
                  error={errors.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                />
                <TextField
                  label="종료 시간"
                  type="time"
                  value={values.endTime}
                  error={errors.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                />
              </div>
            </Card>

            <TextField
              showLabel
              label="정원"
              inputMode="numeric"
              placeholder={`최대 ${TOUR_CAPACITY_MAX}명`}
              value={values.capacity}
              error={errors.capacity}
              onChange={(e) => set('capacity', e.target.value)}
            />
            <Textarea
              showLabel
              label="탐방 소개"
              placeholder="전공 선배와 둘러보는 우리 캠퍼스"
              value={values.introduction}
              error={errors.introduction}
              onChange={(e) => set('introduction', e.target.value)}
            />
            <TextField
              showLabel
              label="연락 링크"
              type="url"
              placeholder="https://open.kakao.com/o/…"
              hint="승인된 신청자에게만 공개돼요."
              value={values.openChatUrl}
              error={errors.openChatUrl}
              onChange={(e) => set('openChatUrl', e.target.value)}
            />
          </fieldset>

          <p className="mt-3 rounded-lg bg-brand-soft px-4 py-3 text-[13px] text-muted">
            ⓘ 학교별 방학 기간에만 탐방을 개설할 수 있어요.
          </p>

          <BottomAction>
            <Button type="submit" loading={create.isPending} disabled={locked} hint={hint}>
              모집 시작하기
            </Button>
          </BottomAction>
        </form>
      </Page>
    </>
  );
}
