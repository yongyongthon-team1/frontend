// 거리 계산은 화면도 쓰는 공용이라 `shared/lib/geo.ts`로 옮겼다(2B′-R26). 목업 쪽 import는 이 다시 내보내기로 그대로 쓴다.
export { distanceMeters, type LatLng } from '@/shared/lib/geo';
