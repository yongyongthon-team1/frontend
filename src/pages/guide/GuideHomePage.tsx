import { PlaceholderPage } from '@/pages/PlaceholderPage';

/** 가이드 첫 화면 G01 `/guide`의 자리(Task 9가 홈으로 채운다). 그 전까지는 개설한 탐방 목록으로 가는 링크 하나다. */
export function GuideHomePage() {
  return (
    <PlaceholderPage
      title="내 탐방"
      wireframe="g01"
      action={{ label: '내가 개설한 탐방', to: '/guide/tours' }}
    />
  );
}
