// 목업의 "지금". 테스트가 시각을 고정할 수 있게 한 곳에서만 만든다.
let override: Date | null = null;

export function mockNow(): Date {
  return override ?? new Date();
}

/** 테스트 전용. `null`이면 실제 시각으로 돌아간다. */
export function setMockNow(date: Date | null): void {
  override = date;
}
