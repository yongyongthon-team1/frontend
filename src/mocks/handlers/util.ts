import { HttpResponse, type HttpResponseResolver, type PathParams } from 'msw';
import type { Role } from '@/features/auth/model';
import type { DB, TourRow, UserRow } from '@/mocks/db/schema';
import { userIdFromToken } from '@/mocks/db/store';
import { MockApiError } from '@/mocks/rules/errors';
import { env } from '@/shared/config/env';

// 핸들러 공통 도구. 핸들러는 얇게 둔다: 인증 → `mutate(db => 규칙(...))` → views로 DTO.

/** HTTP 클라이언트와 같은 방식(`baseUrl + path`)으로 만든 API 경로. 기본 `/api/...`. */
export const api = (path: string) => `${env.apiBaseUrl}${path}`;

/** `Authorization: Bearer <token>`의 토큰. 없으면 null. */
export function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '');
  return match ? match[1].trim() : null;
}

/** 토큰의 사용자. 토큰이 없거나 모르는 토큰이면 null(로그인 없이도 되는 조회용). */
export function currentUser(request: Request, db: DB): UserRow | null {
  const userId = userIdFromToken(db, bearerToken(request));
  return db.users.find((u) => u.id === userId) ?? null;
}

/** 로그인한 사용자. 토큰이 없거나 모르면 401 UNAUTHORIZED, 역할이 다르면 403 FORBIDDEN. */
export function requireUser(request: Request, db: DB, role?: Role): UserRow {
  const user = currentUser(request, db);
  if (!user) throw new MockApiError(401, 'UNAUTHORIZED');
  if (role && user.role !== role) throw new MockApiError(403, 'FORBIDDEN');
  return user;
}

/** 가이드 본인의 탐방(없으면 404 NOT_FOUND, 남의 탐방이면 403 FORBIDDEN). */
export function requireOwnTour(db: DB, guideId: number, tourId: number): TourRow {
  const tour = db.tours.find((t) => t.id === tourId);
  if (!tour) throw new MockApiError(404, 'NOT_FOUND');
  if (tour.guideId !== guideId) throw new MockApiError(403, 'FORBIDDEN');
  return tour;
}

/** JSON 본문(객체). 본문이 없으면 `{}`, JSON 객체가 아니면 400 VALIDATION. 필드 검사는 규칙이 한다. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new MockApiError(400, 'VALIDATION');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new MockApiError(400, 'VALIDATION');
  }
  return parsed as Record<string, unknown>;
}

/** 시작 시각 오름차순(같으면 id). 탐방 목록과 가이드 탐방 목록의 순서다. */
export function byStartsAt(a: TourRow, b: TourRow): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id - b.id;
}

type Resolver = (info: { request: Request; params: PathParams }) => Promise<Response>;

/** 규칙이 던진 `MockApiError`를 `{ code, message, details }` 본문과 그 상태 코드로 바꾼다. 다른 오류는 그대로 던진다. */
export function withErrors(resolver: Resolver): HttpResponseResolver {
  return async ({ request, params }) => {
    try {
      return await resolver({ request, params });
    } catch (error) {
      if (!(error instanceof MockApiError)) throw error;
      return HttpResponse.json(
        { code: error.code, message: error.message, details: error.details },
        { status: error.status },
      );
    }
  };
}
