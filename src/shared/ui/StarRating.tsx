import { Star } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/shared/lib/cn';
import { FieldMessages } from './FieldMessages';
import { useFieldIds } from './fieldStyles';

const STARS = [1, 2, 3, 4, 5] as const;

export interface StarRatingProps {
  label: string;
  value: number | null;
  onChange(value: number): void;
  name?: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
}

/** 별점 입력: `fieldset`/`legend` 안의 라디오 5개(접근 이름 `별점 1점`…`별점 5점`). 선택된 별까지 brand로 채운다. */
export function StarRating({
  label,
  value,
  onChange,
  name,
  disabled = false,
  error,
  hint,
}: StarRatingProps) {
  const generatedName = useId();
  const { errorId, hintId, describedBy } = useFieldIds(error, hint);
  return (
    <fieldset
      disabled={disabled}
      aria-describedby={describedBy}
      className="m-0 min-w-0 border-0 p-0"
    >
      <legend className="mb-2 px-1 text-[13px] font-bold text-ink">{label}</legend>
      <div className="flex gap-1">
        {STARS.map((n) => (
          <label
            key={n}
            className={cn(
              'flex size-11 items-center justify-center rounded-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            )}
          >
            <input
              type="radio"
              name={name ?? generatedName}
              aria-label={`별점 ${n}점`}
              checked={value === n}
              disabled={disabled}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <StarIcon filled={value !== null && n <= value} className="size-8" />
          </label>
        ))}
      </div>
      <FieldMessages error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </fieldset>
  );
}

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <Star
      aria-hidden
      data-testid={filled ? 'star-filled' : undefined}
      className={cn(className, filled ? 'fill-brand text-brand' : 'text-neutral-300')}
    />
  );
}

/** 읽기 전용 별점(리뷰 목록 등). 화면 낭독기에는 이미지 하나로 `별점 {value}점`이라 읽힌다. */
export function StarDisplay({ value }: { value: number }) {
  // 평균 4.5가 별 5개로 보이지 않게 내림한다.
  const filledCount = Math.floor(value);
  return (
    <span role="img" aria-label={`별점 ${value}점`} className="inline-flex gap-0.5">
      {STARS.map((n) => (
        <StarIcon key={n} filled={n <= filledCount} className="size-4" />
      ))}
    </span>
  );
}
