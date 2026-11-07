import { z } from 'zod';

// T-01 탐방 희망 사항(결정 0011 · 2C-R16). 고교생이 학교 · 학과 · 한두 문장 · 희망 날짜(선택)를 남기면 저장되고,
// 본인(T-07)과 대학생 가이드(T-08)가 원문 그대로 본다. AI는 쓰지 않는다.

export interface TourWish {
  id: number;
  /** 캠퍼스 id. 목록 응답에 `campus_id`가 없고 이름 조인도 못 하면(실서버) null. */
  universityId: number | null;
  /** 학교 줄(`경희대학교 국제캠퍼스`). 등록 응답은 캠퍼스 목록에서 만들고, 목록 · 수정 응답은 `campus_name` 그대로다. */
  campusLabel: string;
  major: string;
  wish: string;
  /** 희망 날짜 `YYYY-MM-DD`. */
  date: string | null;
  createdAt: string | null;
}

export interface TourWishInput {
  universityId: number;
  major: string;
  wish: string;
  date: string | null;
}

/** T-08 가이드의 거르기 조건. 학교를 빼면 서버 기본(내 인증 학교)이고, 학과는 부분 일치다. */
export interface GuideWishFilter {
  universityId?: number;
  major?: string;
}

export const WISH_MAJOR_MAX = 30;
export const WISH_TEXT_MAX = 100;

/** 홈(T-01)과 수정 화면(T-07)의 폼 검사. 칸은 모두 문자열이고 학교는 `<select>` 값(`''`이면 고르지 않음)이다. */
export const wishFormSchema = z.object({
  universityId: z.string().min(1, '학교를 골라 주세요.'),
  major: z
    .string()
    .trim()
    .min(1, '학과를 적어 주세요.')
    .max(WISH_MAJOR_MAX, `학과는 ${WISH_MAJOR_MAX}자 이내로 적어 주세요.`),
  wish: z
    .string()
    .trim()
    .min(1, '하고 싶은 것을 한두 문장으로 적어 주세요.')
    .max(WISH_TEXT_MAX, `${WISH_TEXT_MAX}자 이내로 적어 주세요.`),
  date: z.union([
    z.literal(''),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜를 다시 골라 주세요.'),
  ]),
});

export type WishFormValues = z.input<typeof wishFormSchema>;

/** 폼 값 → 등록 입력. 학과 · 희망 사항은 앞뒤 공백만 뺀다(안쪽 줄바꿈은 그대로), 빈 날짜는 null. */
export function toWishInput(values: WishFormValues): TourWishInput {
  return {
    universityId: Number(values.universityId),
    major: values.major.trim(),
    wish: values.wish.trim(),
    date: values.date === '' ? null : values.date,
  };
}

/**
 * 수정 화면의 변경분(2C-R21): `before`와 값이 다른 칸만 담는다(날짜는 null끼리면 같다). 목록 항목의 학교를 모르면
 * (`before.universityId`가 null) 화면에서 고른 학교를 늘 담는다.
 */
export function diffWishPatch(before: TourWish, after: TourWishInput): Partial<TourWishInput> {
  const patch: Partial<TourWishInput> = {};
  if (before.universityId === null || before.universityId !== after.universityId) {
    patch.universityId = after.universityId;
  }
  if (before.major !== after.major) patch.major = after.major;
  if (before.wish !== after.wish) patch.wish = after.wish;
  if (before.date !== after.date) patch.date = after.date;
  return patch;
}
