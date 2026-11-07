import { errorMessage } from '@/shared/lib/errors';
import { ApiError, recode, request, withQuery } from '@/shared/lib/http';
import { getStoreReviews } from '@/features/reviews/api';
import {
  normalizeBusinessNumber,
  type BusinessVerificationInput,
  type MyStore,
  type PartnershipInput,
  type StoreEditInput,
  type StoreRegistrationInput,
  type StoreReport,
  type StoreReportView,
  type StoreSearchItem,
} from './model';
import {
  fromWireMyStore,
  fromWireStoreReport,
  fromWireStoreSearchItem,
  type WireMyStore,
  type WirePartnershipSaved,
  type WireRegisteredStore,
  type WireStoreReport,
  type WireStoreSearchItem,
} from './wire';

/**
 * S-01 보완 `GET /users/me/store`(사장님). 연결된 가게가 없으면(`E404` → `STORE_NOT_LINKED`, 봉투 없는 404도) 오류가 아니라 null이다. 5xx는 그대로 던진다.
 * `token`을 주면 세션 토큰 대신 그 토큰으로 부르고 401이어도 세션 만료 처리를 하지 않는다(로그인 직후 합성용).
 * 제휴 `state`의 기준 시각은 어댑터의 `new Date()`다.
 */
export async function getMyStore(token?: string): Promise<MyStore | null> {
  try {
    const wire = await request<WireMyStore>('/users/me/store', {
      errorMap: { E404: 'STORE_NOT_LINKED' },
      ...(token !== undefined
        ? { headers: { Authorization: `Bearer ${token}` }, auth: false }
        : {}),
    });
    return fromWireMyStore(wire, new Date());
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * S-07 `GET /users/me/store/report`(사장님). 쿼리 없이 부른다 — 기간은 서버 기본(최근 30일)이다. 연결된 가게가 없으면
 * `E404` → `STORE_NOT_LINKED`.
 */
export async function getStoreReport(): Promise<StoreReport> {
  const wire = await request<WireStoreReport>('/users/me/store/report', {
    errorMap: { E404: 'STORE_NOT_LINKED' },
  });
  return fromWireStoreReport(wire);
}

/**
 * 리포트 화면의 값(2B′-R2 · R19). 리포트 응답에는 AI 요약 · 최근 리뷰 · 가게 id가 없어 내 가게(`GET /users/me/store`)로 가게 id를
 * 얻고 `GET /stores/{storeId}/reviews`로 요약 · 최근 리뷰를 읽는다(내 가게 → 리뷰는 차례, 리포트는 나란히). 가게가 없거나
 * 리포트가 `STORE_NOT_LINKED`면 null이다. 그 밖의 오류는 던진다.
 */
export async function getStoreReportView(): Promise<StoreReportView | null> {
  try {
    const [report, composed] = await Promise.all([
      getStoreReport(),
      getMyStore().then((store) =>
        store ? getStoreReviews(store.id).then((reviews) => ({ store, reviews })) : null,
      ),
    ]);
    return composed ? { report, ...composed } : null;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'STORE_NOT_LINKED') return null;
    throw error;
  }
}

const notLinked = () => new ApiError(404, 'STORE_NOT_LINKED', errorMessage('STORE_NOT_LINKED'));

/** 쓰기 뒤 내 가게를 다시 읽는다. 읽히는 가게가 없으면(`GET`이 null) `STORE_NOT_LINKED`. */
async function reloadMyStore(): Promise<MyStore> {
  return (await getMyStore()) ?? Promise.reject(notLinked());
}

/**
 * U-07 `POST /verifications/business`(사장님). 본문은 숫자만 남긴 번호 · 공백 뗀 대표자명 · 개업일. 일치하면 바로 APPROVED(운영자 심사
 * 없음)라 응답 본문은 쓰지 않는다 — 훅이 `GET /users/me`를 다시 읽는다. 422 `E422_BUSINESS_INVALID`는 `errors[business_number].reason`이
 * `CLOSED`면 `BIZ_CLOSED`, 그 밖은 `BIZ_MISMATCH`(2B′-R20)이고 둘 다 `fieldErrors.businessNumber`에 코드 문구가 든다.
 */
export async function postBusinessVerification(input: BusinessVerificationInput): Promise<void> {
  try {
    await request<{ status: string }>('/verifications/business', {
      method: 'POST',
      body: {
        businessNumber: normalizeBusinessNumber(input.businessNumber),
        representativeName: input.representativeName.trim(),
        openedAt: input.openedAt,
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.backendCode === 'E422_BUSINESS_INVALID') {
      const code = error.fieldReasons?.businessNumber === 'CLOSED' ? 'BIZ_CLOSED' : 'BIZ_MISMATCH';
      throw recode(error, code, { fieldErrors: { businessNumber: errorMessage(code) } });
    }
    throw error;
  }
}

/** S-01 `GET /stores/search`(사장님). 상호 검색 한 쪽(page 1 · size 20). 2자 미만은 서버가 400 `fieldErrors.keyword`로 막는다. */
export async function getStoreSearch(keyword: string): Promise<StoreSearchItem[]> {
  const data = await request<{ items: WireStoreSearchItem[] }>(
    withQuery('/stores/search', { keyword: keyword.trim(), page: 1, size: 20 }),
  );
  return data.items.map(fromWireStoreSearchItem);
}

/**
 * S-01 `POST /users/me/store`(사장님). 검색에서 고르면 `{ storeId }`, 직접 등록은 이름 · 주소 · 업종 · 좌표. 응답(201)의 값 대신 성공하면 내 가게를
 * 다시 읽는다. `E403_VERIFICATION_REQUIRED`는 `BIZ_NOT_VERIFIED`, `E409_STORE_UNAVAILABLE`은 내 가게를 읽어 있으면 `STORE_LIMIT`(2B′-R21),
 * 없으면 `STORE_ALREADY_LINKED`(다른 사장님이 연결한 상점)다.
 */
export async function postStore(input: StoreRegistrationInput): Promise<MyStore> {
  const body =
    'storeId' in input
      ? { storeId: input.storeId }
      : {
          name: input.name.trim(),
          address: input.address.trim(),
          category: input.category,
          latitude: input.latitude,
          longitude: input.longitude,
        };
  try {
    await request<WireRegisteredStore>('/users/me/store', {
      method: 'POST',
      body,
      errorMap: { E403_VERIFICATION_REQUIRED: 'BIZ_NOT_VERIFIED' },
    });
  } catch (error) {
    if (error instanceof ApiError && error.backendCode === 'E409_STORE_UNAVAILABLE') {
      const mine = await getMyStore().catch(() => null);
      throw mine ? recode(error, 'STORE_LIMIT') : recode(error, 'STORE_ALREADY_LINKED');
    }
    throw error;
  }
  return reloadMyStore();
}

/** S-01 `PATCH /users/me/store`(사장님). 보낸 칸만 고치고 응답(내 가게 조회와 같은 모양)을 그대로 읽는다. 가게가 없으면 `STORE_NOT_LINKED`. */
export async function patchMyStore(patch: StoreEditInput): Promise<MyStore> {
  const wire = await request<WireMyStore>('/users/me/store', {
    method: 'PATCH',
    body: patch,
    errorMap: { E404: 'STORE_NOT_LINKED' },
  });
  return fromWireMyStore(wire, new Date());
}

/**
 * S-03 `PUT /users/me/store/partnership`(사장님). 없으면 만들고 있으면 덮어쓴다. 응답에는 제휴 기간뿐이라 저장 뒤 내 가게를 다시 읽는다.
 * 칸 오류 `discount_text`는 `fieldErrors.discount`로 읽는다. 가게가 없으면 `STORE_NOT_LINKED`.
 */
export async function putPartnership(input: PartnershipInput): Promise<MyStore> {
  await request<WirePartnershipSaved>('/users/me/store/partnership', {
    method: 'PUT',
    body: {
      discountText: input.discount.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
    },
    errorMap: { E404: 'STORE_NOT_LINKED' },
    fieldMap: { discount_text: 'discount' },
  });
  return reloadMyStore();
}
