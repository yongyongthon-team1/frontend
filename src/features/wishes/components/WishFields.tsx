import { useController, useFormState, type UseFormReturn } from 'react-hook-form';
import type { University } from '@/features/campuses/model';
import { campusLabel } from '@/features/tours/model';
import { Select } from '@/shared/ui/Select';
import { Textarea } from '@/shared/ui/Textarea';
import { TextField } from '@/shared/ui/TextField';
import { WISH_MAJOR_MAX, WISH_TEXT_MAX, type WishFormValues } from '../model';

/**
 * T-01 희망 사항 칸 넷(학교 · 학과 · 탐방 희망 사항 · 희망 날짜). 홈(T-01)과 수정 화면(T-07)이 같이 쓴다. 칸 오류는 폼의 RHF 오류
 * (스키마 검사 · 서버 `fieldErrors`를 `setError`로 넣은 것)를 그 칸 아래에 보인다.
 * 학교는 제어 칸이다 — 캠퍼스 목록이 늦게 와도(선택지가 나중에 생겨도) 폼 값의 학교가 골라진 채 보이게.
 */
export function WishFields({
  form,
  campuses,
  disabled,
}: {
  form: UseFormReturn<WishFormValues>;
  campuses: University[] | undefined;
  disabled?: boolean;
}) {
  // 학교를 먼저 등록한다 — 제출 검사에 걸리면 RHF가 등록 순서상 첫 오류 칸(위에서부터)에 포커스를 준다.
  const school = useController({ control: form.control, name: 'universityId' });
  const { errors } = useFormState({ control: form.control });
  const schoolOptions = [
    { value: '', label: '학교를 골라 주세요' },
    ...(campuses ?? []).map((u) => ({
      value: String(u.id),
      label: campusLabel(u.name, u.campusName),
    })),
  ];
  return (
    <div className="flex flex-col gap-3">
      <Select
        {...school.field}
        label="학교"
        showLabel
        options={schoolOptions}
        disabled={disabled}
        error={school.fieldState.error?.message}
      />
      <TextField
        {...form.register('major')}
        label="학과"
        showLabel
        placeholder="예: 산업디자인"
        maxLength={WISH_MAJOR_MAX}
        autoComplete="off"
        disabled={disabled}
        error={errors.major?.message}
      />
      <Textarea
        {...form.register('wish')}
        label="탐방 희망 사항"
        showLabel
        placeholder="예: 디자인 작업실을 구경하고 학생 식당에도 가 보고 싶어요."
        hint="한두 문장 · 100자 이내"
        maxLength={WISH_TEXT_MAX}
        disabled={disabled}
        error={errors.wish?.message}
      />
      <TextField
        {...form.register('date')}
        type="date"
        label="희망 날짜 (선택)"
        showLabel
        disabled={disabled}
        error={errors.date?.message}
      />
    </div>
  );
}
