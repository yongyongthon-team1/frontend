import { errorMessage } from '@/shared/lib/errors';
import { Button } from './Button';

// features를 import하지 않으므로 ApiError 대신 error.code를 방어적으로 읽는다.
function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error as { code: unknown };
    if (typeof code === 'string') return code;
  }
  return undefined;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?(): void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl bg-surface px-5 py-8 text-center"
    >
      <p className="text-[15px] font-bold text-ink">{errorMessage(errorCode(error))}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </div>
  );
}
