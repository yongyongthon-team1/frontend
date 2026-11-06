import { cn } from '@/shared/lib/cn';
import { handleRovingKeyDown, rovingTabIndex } from './roving';
import { touchExpandClass } from './touch';

export interface FilterChip {
  value: string;
  label: string;
  // 선택 전 모양: keyword(기본) = brand-soft, school = neutral-100. 선택되면 둘 다 brand.
  kind?: 'keyword' | 'school';
}

export interface FilterChipsProps {
  chips: FilterChip[];
  value: string;
  onChange(value: string): void;
  label: string;
}

// V2 필터 칩 줄(H02): 알약(높이 31). 하나만 고르는 줄이라 radiogroup이다.
export function FilterChips({ chips, value, onChange, label }: FilterChipsProps) {
  const values = chips.map((c) => c.value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => handleRovingKeyDown(e, 'radio', values, value, onChange)}
      className="flex flex-wrap gap-2"
    >
      {chips.map((chip) => {
        const checked = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={rovingTabIndex(values, value, chip.value)}
            onClick={() => onChange(chip.value)}
            className={cn(
              touchExpandClass,
              'inline-flex h-[31px] max-w-full items-center rounded-pill px-4 text-xs font-bold whitespace-nowrap transition-colors',
              checked
                ? 'bg-brand text-on-primary'
                : chip.kind === 'school'
                  ? 'bg-neutral-100 text-muted'
                  : 'bg-brand-soft text-brand',
            )}
          >
            <span className="truncate">{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}
