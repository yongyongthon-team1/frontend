import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { useUniversities } from '@/features/campuses/queries';
import { EXAMPLE_QUERIES } from '@/features/tours/examples';
import { useLastQuery } from '@/features/tours/lastQuery';
import { fromSearch, toSearch } from '@/features/tours/recommendationParams';
import { preventImeEnter } from '@/shared/lib/ime';
import { Button } from '@/shared/ui/Button';
import { Page } from '@/shared/ui/Page';
import { Select } from '@/shared/ui/Select';
import { Textarea } from '@/shared/ui/Textarea';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

const MIN_QUERY_LENGTH = 5;

const homeSchema = z.object({
  q: z.string().trim().min(MIN_QUERY_LENGTH, '하고 싶은 것을 한 문장 이상 적어 주세요.'),
  major: z.string(),
  universityId: z.string(),
  date: z.string(),
});

type HomeValues = z.infer<typeof homeSchema>;

/** 주소의 검색 파라미터(추천 목록에서 돌아온 경우)로 채운 폼 초깃값. */
function defaultValuesOf(search: string): HomeValues {
  const saved = fromSearch(search);
  return {
    q: saved?.q ?? '',
    major: saved?.major ?? '',
    universityId: saved?.universityId === undefined ? '' : String(saved.universityId),
    date: saved?.date ?? '',
  };
}

/** 홈 · AI 탐방 추천(hs-s03). 주소에 검색 파라미터가 있으면(추천 목록에서 돌아온 경우) 폼을 채운다. */
export function HomePage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const setSearch = useLastQuery((s) => s.setSearch);
  const { data: universities = [] } = useUniversities();

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<HomeValues>({
    resolver: zodResolver(homeSchema),
    defaultValues: defaultValuesOf(search),
  });

  const onSubmit = handleSubmit((values) => {
    const major = values.major.trim();
    const next = toSearch({
      q: values.q.trim(),
      ...(major ? { major } : {}),
      ...(values.universityId ? { universityId: Number(values.universityId) } : {}),
      ...(values.date ? { date: values.date } : {}),
    });
    setSearch(next);
    void navigate(`/recommendations?${next}`);
  });

  const schoolOptions = [
    { value: '', label: '전체' },
    ...universities.map((u) => ({
      value: String(u.id),
      label: `${u.shortName} ${u.campusName}`,
    })),
  ];

  return (
    <>
      <TopBar title="어떤 캠퍼스가 궁금해?" />
      <Page>
        <h2 className="mt-2 text-2xl leading-snug font-bold whitespace-pre-line text-ink">
          {'관심사에 맞는\n캠퍼스를 발견해봐요.'}
        </h2>
        <form
          className="mt-5 flex flex-col gap-3"
          onSubmit={onSubmit}
          onKeyDown={preventImeEnter}
          noValidate
        >
          <Textarea
            label="하고 싶은 것"
            placeholder={EXAMPLE_QUERIES[0]}
            hint="하고 싶은 것을 편하게 문장으로 적어 주세요."
            error={errors.q?.message}
            {...register('q')}
          />
          <ul className="flex flex-col items-start gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() =>
                    setValue('q', example, { shouldDirty: true, shouldValidate: true })
                  }
                  className="min-h-11 rounded-full bg-surface px-4 py-2 text-left text-sm font-medium text-ink hover:bg-border"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
          <h3 className="mt-3 text-lg font-bold text-ink">탐방 조건</h3>
          <TextField label="관심 학과 (선택)" {...register('major')} />
          <Controller
            control={control}
            name="universityId"
            render={({ field }) => (
              <Select label="방문할 학교 (선택)" options={schoolOptions} {...field} />
            )}
          />
          <TextField label="방학 중 탐방 날짜 (선택)" type="date" {...register('date')} />
          <Button type="submit" className="mt-3">
            나에게 맞는 탐방 추천받기
          </Button>
          <p className="px-1 text-sm text-muted">
            추천은 가이드 정보와 관심 키워드를 비교해 정렬돼요.
          </p>
        </form>
      </Page>
    </>
  );
}
