export interface TestImageOptions {
  /** 기본 `image/jpeg`. 형식 오류 시험에는 `application/pdf` 같은 값을 준다. */
  type?: string;
  /** 주면 파일이 이 크기인 것처럼 보인다(내용은 작게 둔다). 10MB 경계 시험용. */
  size?: number;
}

/** 업로드 시험용 이미지 파일. 크기를 주면 `size`만 그 값으로 보이게 해 큰 버퍼를 만들지 않는다. */
export function testImage(name = 'student-id.jpg', opts: TestImageOptions = {}): File {
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], name, {
    type: opts.type ?? 'image/jpeg',
  });
  if (opts.size !== undefined) Object.defineProperty(file, 'size', { value: opts.size });
  return file;
}
