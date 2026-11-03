import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 마지막으로 추천받은 검색(주소의 검색 파라미터 문자열). 탐방 상세의 `다른 추천 보기`가 이 추천 목록으로 돌아온다.

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

/** 저장된 검색이 있으면 그 추천 목록, 없으면 홈. */
export function recommendationsPath(): string {
  const { search } = useLastQuery.getState();
  return search ? `/recommendations?${search}` : '/';
}
