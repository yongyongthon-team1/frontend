import type { Tone } from '@/shared/lib/types';

// 상태 색 점/아이콘 색.
export const toneTextClass: Record<Tone, string> = {
  neutral: 'text-muted',
  info: 'text-brand',
  success: 'text-success',
  warning: 'text-local',
  danger: 'text-danger',
};

export const toneDotClass: Record<Tone, string> = {
  neutral: 'bg-muted',
  info: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-local',
  danger: 'bg-danger',
};

// V2 칩 바탕: 색 이름마다 짝이 되는 -soft 바탕 위에 글자를 얹는다(흰 바탕 위 연한 글자를 피한다).
export const toneBgClass: Record<Tone, string> = {
  neutral: 'bg-neutral-100',
  info: 'bg-brand-soft',
  success: 'bg-success-soft',
  warning: 'bg-local-soft',
  danger: 'bg-danger-soft',
};

// V2 칩 글자색. warning(복숭아)은 연한 바탕 위에서 대비가 낮아 본문색을 쓴다(아이콘 · 점은 tone 색).
export const toneChipTextClass: Record<Tone, string> = {
  neutral: 'text-muted',
  info: 'text-brand',
  success: 'text-success',
  warning: 'text-ink',
  danger: 'text-danger',
};
