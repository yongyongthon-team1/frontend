// 입력창 아래의 오류(role="alert")와 도움말 문구.
export function FieldMessages({
  error,
  hint,
  errorId,
  hintId,
}: {
  error?: string;
  hint?: string;
  errorId: string;
  hintId: string;
}) {
  return (
    <>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 px-1 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="mt-1.5 px-1 text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </>
  );
}
