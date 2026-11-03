import type { Tone } from '@/shared/lib/types';

// 상태 색 점/아이콘 색. 글자는 항상 본문색을 써서 대비를 지킨다.
export const toneTextClass: Record<Tone, string> = {
  neutral: 'text-muted',
  info: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export const toneDotClass: Record<Tone, string> = {
  neutral: 'bg-muted',
  info: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export const toneBgClass: Record<Tone, string> = {
  neutral: 'bg-surface',
  info: 'bg-accent/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
};
