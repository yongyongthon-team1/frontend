import { afterEach, describe, expect, it, vi } from 'vitest';
import { delayAi, delayBase, setAiSpeedSource, setMockLatency } from './latency';

afterEach(() => {
  vi.useRealTimers();
  setAiSpeedSource(() => 'normal');
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

/** `promise`가 `ms` 밀리초가 되기 전에는 끝나지 않고, `ms`가 되면 끝나는지 본다. */
async function expectSettlesAt(promise: Promise<void>, ms: number) {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  await vi.advanceTimersByTimeAsync(ms - 1);
  expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(done).toBe(true);
}

describe('목업 지연', () => {
  it('기본은 일반 150ms, AI 1500ms', async () => {
    vi.useFakeTimers();
    setMockLatency(null);
    await expectSettlesAt(delayBase(), 150);
    await expectSettlesAt(delayAi(), 1500);
  });

  it('시연 AI 속도가 느리게면 AI만 10초', async () => {
    vi.useFakeTimers();
    setMockLatency(null);
    setAiSpeedSource(() => 'slow');
    await expectSettlesAt(delayAi(), 10_000);
    await expectSettlesAt(delayBase(), 150);
  });

  it('지연을 정해 주면 그 값을 쓰고, 0이면 타이머 없이 바로 끝난다', async () => {
    vi.useFakeTimers();
    setMockLatency({ base: 20, ai: 40 });
    setAiSpeedSource(() => 'slow');
    await expectSettlesAt(delayBase(), 20);
    await expectSettlesAt(delayAi(), 40);
    setMockLatency({ base: 0, ai: 0 });
    await delayBase(); // 가짜 타이머를 진행하지 않아도 끝나야 한다
    await delayAi();
  });
});
