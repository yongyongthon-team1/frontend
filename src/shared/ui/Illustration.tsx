import bookshop from '@/assets/illustrations/bookshop.png';
import cafe from '@/assets/illustrations/cafe.png';
import campus from '@/assets/illustrations/campus.png';
import daily from '@/assets/illustrations/daily.png';
import dining from '@/assets/illustrations/dining.png';
import experience from '@/assets/illustrations/experience.png';
import green from '@/assets/illustrations/green.png';
import play from '@/assets/illustrations/play.png';

const SOURCES = { campus, dining, cafe, bookshop, green, experience, play, daily };

export type IllustrationKind = keyof typeof SOURCES;

// V2의 3D 장소 일러스트(투명 배경 PNG). 기본은 장식이라 alt가 빈 문자열이다.
// 무대 첫 화면에 바로 떠야 하므로 lazy 로딩을 쓰지 않는다. 크기는 className(size-* · h-*)으로 정한다.
export function Illustration({
  kind,
  className,
  alt = '',
}: {
  kind: IllustrationKind;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={SOURCES[kind]}
      alt={alt}
      decoding="async"
      draggable={false}
      className={className ?? 'size-24 object-contain'}
    />
  );
}
