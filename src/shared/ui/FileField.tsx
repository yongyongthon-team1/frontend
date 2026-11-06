import { useRef, type ChangeEvent } from 'react';
import { cn } from '@/shared/lib/cn';
import { FieldMessages } from './FieldMessages';
import { useFieldIds } from './fieldStyles';

export interface FileFieldProps {
  label: string;
  description?: string;
  hint?: string;
  accept: string;
  file: File | null;
  error?: string;
  disabled?: boolean;
  // 검사 함수는 받기만 한다(업로드 규칙은 features/verification이 가진다). 문자열을 주면 그 파일을 버린다.
  validate?(file: File): string | null;
  onChange(next: { file: File | null; error: string | null }): void;
}

const MB = 1024 * 1024;

/** 1MB 미만은 `820KB`, 이상은 `2.4MB`. */
function formatFileSize(bytes: number): string {
  return bytes < MB ? `${Math.round(bytes / 1024)}KB` : `${(bytes / MB).toFixed(1)}MB`;
}

/**
 * V2 파일 칸 카드(brand-soft 사각 아이콘 `↑` + 제목 17/Bold + 설명 13). 숨긴 `<input type="file">`의 접근 이름은 `label`이고,
 * 카드(label 요소)를 누르면 파일 선택창이 열린다. 파일을 고르는 즉시 `validate`로 검사해 틀린 파일은 버린다.
 */
export function FileField({
  label,
  description,
  hint,
  accept,
  file,
  error,
  disabled = false,
  validate,
  onChange,
}: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { errorId, hintId, inputId, describedBy } = useFieldIds(error, hint);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    // 같은 파일을 다시 골라도 change가 오도록 비운다. 대화상자 취소(파일 없음)는 알리지 않는다.
    event.target.value = '';
    if (!picked) return;
    const problem = validate?.(picked) ?? null;
    onChange(problem === null ? { file: picked, error: null } : { file: null, error: problem });
  }

  return (
    <div className="w-full">
      <div
        className={cn(
          'rounded-lg bg-surface p-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent',
          error && 'ring-1 ring-danger',
        )}
      >
        <label
          htmlFor={inputId}
          className={cn(
            'flex items-center gap-3',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[22px] font-bold text-brand"
          >
            ↑
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-bold text-ink">{label}</span>
            {description ? (
              <span className="mt-0.5 block text-[13px] text-muted">{description}</span>
            ) : null}
          </span>
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          onChange={handleChange}
          className="sr-only"
        />
        {file ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-neutral-100 px-3 py-1">
            <p className="min-w-0 truncate text-[13px] font-medium text-ink">
              {`${file.name} · ${formatFileSize(file.size)}`}
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="min-h-11 shrink-0 px-1 text-[13px] font-bold text-brand disabled:text-muted"
            >
              다시 고르기
            </button>
          </div>
        ) : null}
      </div>
      <FieldMessages error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  );
}
