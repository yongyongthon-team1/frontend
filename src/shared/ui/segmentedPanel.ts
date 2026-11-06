/** 선택된 탭의 패널에 펼쳐 주는 속성: `SegmentedTabs`의 같은 `id`와 탭 값으로 서로 이어진다. */
export function segmentedPanelProps(id: string, value: string) {
  return {
    id: `${id}-panel-${value}`,
    role: 'tabpanel' as const,
    'aria-labelledby': `${id}-tab-${value}`,
  };
}
