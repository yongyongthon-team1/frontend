import { EmptyState } from '@/shared/ui/EmptyState';

/** 없는 주소(`*`). 로그인 없이 열린다 — `처음으로`는 로그인 상태 · 역할에 맞는 첫 화면으로 이어진다. */
export function NotFoundPage() {
  return (
    <main className="flex flex-1 flex-col justify-center">
      <EmptyState
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 없는 화면이에요."
        action={{ label: '처음으로', to: '/' }}
      />
    </main>
  );
}
