import uniroIcon from '@/assets/brand/uniro-icon.png';
import uniroWordmark from '@/assets/brand/uniro-wordmark.svg';

// UNIRO 브랜드 표식. wordmark는 탭 첫 화면 왼쪽 위(높이 24), icon은 로그인 화면(페일 블루 둥근 사각형 위의 3D 핀).
export function BrandMark({ variant }: { variant: 'wordmark' | 'icon' }) {
  if (variant === 'wordmark') {
    return (
      <img
        src={uniroWordmark}
        alt="UNIRO"
        height={24}
        draggable={false}
        className="block h-6 w-auto"
      />
    );
  }
  return (
    <span
      role="img"
      aria-label="UNIRO"
      className="flex size-20 items-center justify-center rounded-xl bg-brand-soft"
    >
      <img
        src={uniroIcon}
        alt=""
        decoding="async"
        draggable={false}
        className="size-16 object-contain"
      />
    </span>
  );
}
