import { create } from 'zustand';
import { env, type ApiMode } from '@/shared/config/env';

// 부트스트랩 결과(저장하지 않음). `main.tsx`가 정한 API 모드와 목업 워커 시작 실패를 시연 패널 · 빠른 로그인이 읽는다.

interface BootStatus {
  /** 이번 페이지가 쓰는 API 모드(URL `?mode=` > 시연 패널 저장값 > env). */
  apiMode: ApiMode;
  /** 목업 모드인데 목업 워커를 켜지 못했다(서비스 워커 미지원 등). */
  mockWorkerFailed: boolean;
}

export const useBootStatus = create<BootStatus>()(() => ({
  apiMode: env.apiMode,
  mockWorkerFailed: false,
}));
