import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fromWishSearch } from './wishSearch';

// 마지막 탐방 찾기 검색(주소의 검색 파라미터 문자열). 탐방 상세의 `다른 탐방 보기`가 이 결과 화면으로 돌아온다.

export const LAST_QUERY_KEY = 'ytt.lastQuery';

interface LastQueryState {
  search: string | null;
  setSearch(search: string): void;
}

export const useLastQuery = create<LastQueryState>()(
  persist(
    (set) => ({
      search: null,
      setSearch: (search) => set({ search }),
    }),
    { name: LAST_QUERY_KEY },
  ),
);

/** 저장된 검색이 탐방 찾기 검색으로 읽히면 그 결과 화면, 아니면(없음 · 옛 추천 검색 `q=`) 홈. */
export function tourResultsPath(): string {
  const { search } = useLastQuery.getState();
  return search !== null && fromWishSearch(search) !== null ? `/tours?${search}` : '/';
}
