import { ApiError, request } from '@/shared/lib/http';
import type { MyStore } from './model';

/** 내 가게(사장님). 연결된 가게가 없으면(404 `STORE_NOT_LINKED`) 오류가 아니라 null이다. */
export async function getMyStore(): Promise<MyStore | null> {
  try {
    return await request<MyStore>('/owner/store');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.code === 'STORE_NOT_LINKED') {
      return null;
    }
    throw error;
  }
}
