import { describe, expect, it } from 'vitest';
import { expectWireShape } from './wire';

describe('expectWireShape', () => {
  it('같은 키면 통과', () => {
    expect(() => expectWireShape({ a: 1, b: 'x' }, { a: 2, b: 'y' })).not.toThrow();
  });

  it('명세 키가 빠지면 실패하고 메시지에 경로가 있다', () => {
    expect(() =>
      expectWireShape(
        { data: { items: [{ id: 1 }] } },
        { data: { items: [{ id: 1, guide: {} }] } },
      ),
    ).toThrow(/data\.items\[0\]\.guide/);
  });

  it('확장이 아닌 키가 더 있으면 실패하고 경로가 있다', () => {
    expect(() => expectWireShape({ a: 1, extra: 2 }, { a: 1 })).toThrow(/extra/);
    expect(() => expectWireShape({ data: { a: 1, extra: 2 } }, { data: { a: 1 } })).toThrow(
      /data\.extra/,
    );
  });

  it('ext에 든 키는 통과', () => {
    expect(() => expectWireShape({ a: 1, extra: 2 }, { a: 1 }, ['extra'])).not.toThrow();
  });

  it('배열은 둘 다 비어 있지 않으면 첫 원소끼리 본다', () => {
    expect(() => expectWireShape({ xs: [{ a: 1 }, { zzz: 1 }] }, { xs: [{ a: 1 }] })).not.toThrow();
    expect(() => expectWireShape({ xs: [{ a: 1 }] }, { xs: [{ b: 1 }] })).toThrow(/xs\[0\]/);
  });

  it('배열이 한쪽이라도 비면 넘어간다', () => {
    expect(() => expectWireShape({ xs: [] }, { xs: [{ a: 1 }] })).not.toThrow();
    expect(() => expectWireShape({ xs: [{ a: 1 }] }, { xs: [] })).not.toThrow();
  });

  it('중첩 객체까지 본다', () => {
    expect(() => expectWireShape({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } })).not.toThrow();
    expect(() => expectWireShape({ a: { b: {} } }, { a: { b: { c: 1 } } })).toThrow(/a\.b\.c/);
  });

  it('한쪽이 null이면 그 키는 넘어간다', () => {
    expect(() => expectWireShape({ a: null }, { a: { x: 1 } })).not.toThrow();
    expect(() => expectWireShape({ a: { x: 1 } }, { a: null })).not.toThrow();
  });

  it('확장 키 목록은 경로 끝 이름으로 맞춘다(중첩에서도)', () => {
    expect(() =>
      expectWireShape(
        { data: { items: [{ id: 1, spot_id: 3 }] } },
        { data: { items: [{ id: 1 }] } },
        ['spot_id'],
      ),
    ).not.toThrow();
  });
});
