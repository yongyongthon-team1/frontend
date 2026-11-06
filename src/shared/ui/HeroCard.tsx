import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Illustration, type IllustrationKind } from './Illustration';

export interface HeroCardProps {
  eyebrow?: string;
  title: string;
  illustration: IllustrationKind;
  tone?: 'brand' | 'local';
  // 제목 글자색. 기본 ink, 홈(H01)은 brand-strong.
  titleTone?: 'ink' | 'brand-strong';
  children?: ReactNode;
  // 글 · 일러스트 줄 아래에 카드 폭 전체로 놓는 자리(H01의 입력칸).
  footer?: ReactNode;
}

// V2 히어로 카드: 페일 블루(local이면 페일 피치), 왼쪽 글 · 오른쪽 3D 일러스트. 높이는 내용이 정하고
// 일러스트는 max-h로 묶는다(판정 2A-R4: 무대 예산이 모자라면 장식부터 줄인다). 제목의 `\n`은 줄바꿈이다.
export function HeroCard({
  eyebrow,
  title,
  illustration,
  tone = 'brand',
  titleTone = 'ink',
  children,
  footer,
}: HeroCardProps) {
  return (
    <div className={cn('rounded-xl p-5', tone === 'local' ? 'bg-local-soft' : 'bg-brand-soft')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className={cn('text-xs font-bold', tone === 'local' ? 'text-ink' : 'text-brand')}>
              {eyebrow}
            </p>
          ) : null}
          <p
            className={cn(
              'text-xl leading-[1.4] font-bold whitespace-pre-line',
              titleTone === 'brand-strong' ? 'text-brand-strong' : 'text-ink',
              eyebrow && 'mt-2',
            )}
          >
            {title}
          </p>
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
        <Illustration
          kind={illustration}
          className="h-auto max-h-[104px] w-auto max-w-[40%] shrink-0 object-contain"
        />
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}
