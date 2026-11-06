import { cn } from '@/shared/lib/cn';
import { handleRovingKeyDown, rovingTabIndex } from './roving';

export interface SegmentedTabsProps {
  // 탭 · 패널 id의 접두사. 한 화면에서 겹치지 않는 값.
  id: string;
  tabs: { value: string; label: string }[];
  value: string;
  onChange(value: string): void;
  label: string;
}

// V2 세그먼트 탭(H06): 흰 트랙(높이 50, 반경 16) 안에 brand 선택 칸(반경 13, 4px 안쪽).
// 눌림 영역은 트랙 높이 전체(50)라 최소 터치 44를 넘는다.
export function SegmentedTabs({ id, tabs, value, onChange, label }: SegmentedTabsProps) {
  const values = tabs.map((t) => t.value);
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => handleRovingKeyDown(e, 'tab', values, value, onChange)}
      className="flex h-[50px] rounded-lg bg-surface"
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.value}`}
            aria-selected={selected}
            // 선택된 탭의 패널만 그려지므로 그 탭만 패널을 가리킨다.
            aria-controls={selected ? `${id}-panel-${tab.value}` : undefined}
            tabIndex={rovingTabIndex(values, value, tab.value)}
            onClick={() => onChange(tab.value)}
            className="min-w-0 flex-1 p-1"
          >
            <span
              className={cn(
                'flex h-full items-center justify-center rounded-[13px] px-2 text-sm transition-colors',
                selected ? 'bg-brand font-bold text-on-primary' : 'font-medium text-muted',
              )}
            >
              <span className="truncate">{tab.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
