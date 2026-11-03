import { delay } from 'msw';

// 목업 응답 지연. 화면이 로딩 상태를 미리 버티게 일반 요청도 조금 늦추고, AI 흉내(추천 · 코스 초안)는 더 늦춘다.
// 테스트는 `setMockLatency({ base: 0, ai: 0 })`로 지연을 없앤다(0이면 타이머를 쓰지 않는다).

export interface MockLatency {
  base: number;
  ai: number;
}

export type AiSpeed = 'normal' | 'slow';

const DEFAULT_LATENCY: MockLatency = { base: 150, ai: 1500 };
/** 시연 패널의 AI 속도 "느리게". 실서버 LLM이 늦어질 때를 미리 보여 준다. */
const SLOW_AI_MS = 10_000;

let fixed: MockLatency | null = null;
let aiSpeedSource: () => AiSpeed = () => 'normal';

/** 지연을 고정한다. `null`이면 기본값(일반 150ms · AI 1500ms, 느리게면 AI 10초)으로 돌아간다. */
export function setMockLatency(ms: MockLatency | null): void {
  fixed = ms;
}

/** AI 속도를 읽을 곳(Task 21이 시연 스토어를 연결한다). 고정 지연이 있으면 쓰지 않는다. */
export function setAiSpeedSource(fn: () => AiSpeed): void {
  aiSpeedSource = fn;
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? delay(ms) : Promise.resolve();
}

export function delayBase(): Promise<void> {
  return wait((fixed ?? DEFAULT_LATENCY).base);
}

export function delayAi(): Promise<void> {
  if (fixed) return wait(fixed.ai);
  return wait(aiSpeedSource() === 'slow' ? SLOW_AI_MS : DEFAULT_LATENCY.ai);
}
