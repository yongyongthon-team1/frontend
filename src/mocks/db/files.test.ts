import { afterEach, describe, expect, it, vi } from 'vitest';
import { testImage } from '@/test/files';
import {
  clearMockFiles,
  deleteMockFile,
  getMockFile,
  MOCK_FILE_PREFIX,
  mockFileUrl,
  putMockFile,
} from './files';

afterEach(() => {
  clearMockFiles();
  // jsdom의 URL에는 원래 이 두 함수가 없다 — 시험이 붙인 것을 걷어 다른 시험에 새지 않게 한다.
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('목업 파일 보관', () => {
  it('넣으면 mock-file: 참조를 주고, 꺼내고, 지우면 사라진다', () => {
    const file = testImage();
    const ref = putMockFile(file);
    expect(ref.startsWith(MOCK_FILE_PREFIX)).toBe(true);
    expect(ref).toMatch(/^mock-file:[0-9a-z]+-\d+$/);
    expect(getMockFile(ref)).toBe(file);

    deleteMockFile(ref);
    expect(getMockFile(ref)).toBeNull();
  });

  it('넣을 때마다 다른 참조', () => {
    expect(putMockFile(testImage())).not.toBe(putMockFile(testImage()));
  });

  it('모르는 참조는 null이고 지워도 오류가 없다', () => {
    expect(getMockFile('mock-file:none')).toBeNull();
    expect(mockFileUrl('mock-file:none')).toBeNull();
    expect(() => deleteMockFile('mock-file:none')).not.toThrow();
  });

  it('jsdom에는 URL.createObjectURL이 없어 주소는 null', () => {
    expect(mockFileUrl(putMockFile(testImage()))).toBeNull();
  });

  it('clearMockFiles 뒤에는 모두 null', () => {
    const a = putMockFile(testImage());
    const b = putMockFile(testImage());
    clearMockFiles();
    expect(getMockFile(a)).toBeNull();
    expect(getMockFile(b)).toBeNull();
  });

  describe('object URL이 있는 환경', () => {
    function stubObjectUrl() {
      let n = 0;
      const create = vi.fn(() => `blob:mock/${++n}`);
      const revoke = vi.fn();
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
      return { create, revoke };
    }

    it('같은 참조는 같은 주소를 주고, 지우면 주소도 revoke한다', () => {
      const { create, revoke } = stubObjectUrl();
      const ref = putMockFile(testImage());
      const url = mockFileUrl(ref);
      expect(url).toBe('blob:mock/1');
      expect(mockFileUrl(ref)).toBe(url);
      expect(create).toHaveBeenCalledTimes(1);

      deleteMockFile(ref);
      expect(revoke).toHaveBeenCalledWith(url);
      expect(mockFileUrl(ref)).toBeNull();
    });

    it('clearMockFiles도 만든 주소를 모두 revoke한다', () => {
      const { revoke } = stubObjectUrl();
      mockFileUrl(putMockFile(testImage()));
      mockFileUrl(putMockFile(testImage()));
      clearMockFiles();
      expect(revoke).toHaveBeenCalledTimes(2);
    });
  });
});
