import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Compass, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameProvider } from './FrameContext';
import { AiBadge } from './AiBadge';
import { AiLoading } from './AiLoading';
import { Badge } from './Badge';
import { BrandMark } from './BrandMark';
import { BottomSheet } from './BottomSheet';
import { BottomTabBar } from './BottomTabBar';
import { TABS } from '@/app/tabs';
import { isTabActive } from './tabActive';
import { Button } from './Button';
import { CodeInput } from './CodeInput';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { FilterChips } from './FilterChips';
import { HeroCard } from './HeroCard';
import { Illustration } from './Illustration';
import { InfoCard } from './InfoCard';
import { KeywordChips } from './KeywordChips';
import { ListRow } from './ListRow';
import { NumberedList } from './NumberedList';
import { Page } from './Page';
import { PageHeading } from './PageHeading';
import { SegmentedTabs } from './SegmentedTabs';
import { segmentedPanelProps } from './segmentedPanel';
import { Select } from './Select';
import { Skeleton } from './Skeleton';
import { StatusChip } from './StatusChip';
import { StepList } from './StepList';
import { Textarea } from './Textarea';
import { TextField } from './TextField';
import { TopBar } from './TopBar';

afterEach(() => {
  vi.useRealTimers();
});

describe('Button', () => {
  it('hint: 사유와 다음 행동 링크', () => {
    render(
      <MemoryRouter>
        <Button
          disabled
          hint={{ reason: '사유', action: { label: '인증하러 가기', to: '/verify' } }}
        >
          탐방 신청하기
        </Button>
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: '탐방 신청하기' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('사유');
    expect(screen.getByRole('link', { name: '인증하러 가기' })).toHaveAttribute('href', '/verify');
  });

  it('hint.reason이 null이면 사유 줄을 그리지 않고 행동 링크만 보인다', () => {
    render(
      <MemoryRouter>
        <Button hint={{ reason: null, action: { label: '다음 행동', to: '/next' } }}>확인</Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: '확인' })).not.toHaveAttribute('aria-describedby');
    expect(screen.getByRole('link', { name: '다음 행동' })).toHaveAttribute('href', '/next');
  });

  it('hint에 action이 없으면 링크를 그리지 않는다', () => {
    render(
      <MemoryRouter>
        <Button disabled hint={{ reason: '정원이 찼어요' }}>
          신청
        </Button>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신청' })).toHaveAccessibleDescription(
      '정원이 찼어요',
    );
  });

  it('loading이면 비활성이고 aria-busy이며 클릭해도 onClick이 불리지 않는다', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        저장
      </Button>,
    );
    const button = screen.getByRole('button', { name: '저장' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('기본은 type="button"이라 폼을 실수로 제출하지 않는다', () => {
    render(<Button>확인</Button>);
    expect(screen.getByRole('button', { name: '확인' })).toHaveAttribute('type', 'button');
  });

  it('클릭하면 onClick이 불린다', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>확인</Button>);
    await userEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('TextField · Textarea · Select', () => {
  it('TextField: 라벨로 찾고 placeholder 기본값은 라벨, error는 alert', () => {
    render(<TextField label="이메일" error="형식이 맞지 않아요" hint="학교 메일" />);
    const input = screen.getByLabelText('이메일');
    expect(input).toHaveAttribute('placeholder', '이메일');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('형식이 맞지 않아요');
    expect(input).toHaveAccessibleDescription(/형식이 맞지 않아요/);
  });

  it('TextField: hint만 있으면 설명으로 연결된다', () => {
    render(<TextField label="학교" hint="재학 중인 학교" />);
    expect(screen.getByLabelText('학교')).toHaveAccessibleDescription('재학 중인 학교');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('TextField: 입력과 placeholder 덮어쓰기', async () => {
    render(<TextField label="이름" placeholder="홍길동" />);
    const input = screen.getByLabelText('이름');
    expect(input).toHaveAttribute('placeholder', '홍길동');
    await userEvent.type(input, '철수');
    expect(input).toHaveValue('철수');
  });

  it('Textarea: 라벨 · error', () => {
    render(<Textarea label="하고 싶은 것" error="비어 있어요" />);
    expect(screen.getByLabelText('하고 싶은 것')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('비어 있어요');
  });

  it('Select: 옵션을 고르면 값이 바뀐다', async () => {
    render(
      <Select
        label="학교"
        defaultValue=""
        options={[
          { value: '', label: '선택 안 함' },
          { value: 'khu', label: '경희대' },
        ]}
      />,
    );
    const select = screen.getByLabelText('학교');
    await userEvent.selectOptions(select, '경희대');
    expect(select).toHaveValue('khu');
  });
});

describe('TopBar', () => {
  function Where() {
    return <p data-testid="where">{useLocation().pathname}</p>;
  }

  it('제목을 heading으로 보여 주고 back이 없으면 뒤로 버튼이 없다', () => {
    render(
      <MemoryRouter>
        <TopBar title="신청서 작성하기" right={<button>도움말</button>} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '신청서 작성하기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '도움말' })).toBeInTheDocument();
  });

  it('back={true}이면 이전 화면으로(navigate(-1))', async () => {
    render(
      <MemoryRouter initialEntries={['/a', '/b']} initialIndex={1}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <TopBar title="B" back />
                <Where />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('where')).toHaveTextContent('/b');
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/a');
  });

  it('back이 문자열이면 그 경로로', async () => {
    render(
      <MemoryRouter initialEntries={['/x']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <TopBar title="X" back="/home" />
                <Where />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/home');
  });
});

describe('BottomTabBar', () => {
  const tabs = [
    { to: '/', label: '탐색', icon: Compass, end: true },
    { to: '/my-tours', label: '내 탐방', icon: ListChecks },
  ];

  it('현재 경로 탭에 aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/my-tours']}>
        <BottomTabBar tabs={tabs} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '내 탐방' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '탐색' })).not.toHaveAttribute('aria-current');
  });

  it('end 탭은 하위 경로에서 활성이 아니고, 아닌 탭은 하위 경로에서도 활성', () => {
    render(
      <MemoryRouter initialEntries={['/my-tours/3']}>
        <BottomTabBar tabs={tabs} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '내 탐방' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '탐색' })).not.toHaveAttribute('aria-current');
  });

  it('match: 하위 화면에서도 탭이 활성', () => {
    const matchTabs = [
      {
        to: '/',
        label: '탐색',
        icon: Compass,
        end: true,
        match: ['/', '/recommendations', '/tours'],
      },
      { to: '/my-tours', label: '내 탐방', icon: ListChecks, match: ['/my-tours', '/coupons'] },
    ];
    render(
      <MemoryRouter initialEntries={['/tours/3/apply']}>
        <BottomTabBar tabs={matchTabs} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '탐색' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '내 탐방' })).not.toHaveAttribute('aria-current');
  });
});

describe('isTabActive', () => {
  const tab = (to: string, match?: string[], end?: boolean) => ({
    to,
    label: 'x',
    icon: Compass,
    end,
    match,
  });

  it('to와 같으면 활성', () => {
    expect(isTabActive('/my-tours', tab('/my-tours'))).toBe(true);
    expect(isTabActive('/my-tours/3', tab('/my-tours'))).toBe(true);
    expect(isTabActive('/my-toursx', tab('/my-tours'))).toBe(false);
  });

  it('match 접두사: 같거나 접두사 + /로 시작하면 활성', () => {
    const t = tab('/', ['/', '/recommendations', '/tours'], true);
    expect(isTabActive('/', t)).toBe(true);
    expect(isTabActive('/recommendations', t)).toBe(true);
    expect(isTabActive('/tours/3/apply', t)).toBe(true);
    expect(isTabActive('/tourists', t)).toBe(false);
    expect(isTabActive('/my-tours', t)).toBe(false);
  });

  it("접두사 '/'는 정확히 /만 맞는다", () => {
    const t = tab('/home', ['/']);
    expect(isTabActive('/', t)).toBe(true);
    expect(isTabActive('/anything', t)).toBe(false);
  });
});

describe('isTabActive: RegExp · exclude · 가이드/사장님 탭', () => {
  const tab = (to: string, extra: object = {}) => ({ to, label: 'x', icon: Compass, ...extra });

  it('match의 RegExp는 경로 전체에 test한다', () => {
    const t = tab('/a', { match: [/^\/b\/\d+\/c(\/|$)/] });
    expect(isTabActive('/b/3/c', t)).toBe(true);
    expect(isTabActive('/b/3/c/d', t)).toBe(true);
    expect(isTabActive('/b/x/c', t)).toBe(false);
  });

  it('exclude에 맞으면 다른 규칙과 상관없이 비활성', () => {
    const t = tab('/a', { match: ['/a'], exclude: [/^\/a\/hidden/] });
    expect(isTabActive('/a/shown', t)).toBe(true);
    expect(isTabActive('/a/hidden', t)).toBe(false);
  });

  const activeOf = (role: 'UNIVERSITY' | 'OWNER' | 'HIGH_SCHOOL', pathname: string) =>
    TABS[role].filter((t) => isTabActive(pathname, t)).map((t) => t.label);

  it.each([
    ['/guide', ['내 탐방']],
    ['/guide/tours', ['내 탐방']],
    ['/guide/tours/1/applicants', ['내 탐방']],
    ['/guide/tours/1/course', ['코스 편집']],
    ['/guide/tours/1/course/edit', ['코스 편집']],
    ['/guide/tours/1/course/confirm', ['코스 편집']],
    ['/guide/course', ['코스 편집']],
    ['/guide/me', ['MY']],
    ['/guide/verify', ['MY']],
  ])('가이드 %s → %j만 활성', (pathname, labels) => {
    expect(activeOf('UNIVERSITY', pathname)).toEqual(labels);
  });

  it.each([
    ['/owner/store', ['내 가게']],
    ['/owner/coupons/redeem', ['쿠폰']],
  ])('사장님 %s → %j만 활성', (pathname, labels) => {
    expect(activeOf('OWNER', pathname)).toEqual(labels);
  });

  it('고교생 탭 라벨은 그대로', () => {
    expect(TABS.HIGH_SCHOOL.map((t) => t.label)).toEqual(['탐색', '내 탐방', 'MY']);
  });
});

describe('StatusChip · InfoCard · Badge · AiBadge · KeywordChips', () => {
  it('StatusChip은 아이콘과 내용을 보여 준다', () => {
    render(<StatusChip icon={<span data-testid="ic" />}>모집 중 · 남은 자리 3명</StatusChip>);
    expect(screen.getByText('모집 중 · 남은 자리 3명')).toBeInTheDocument();
    expect(screen.getByTestId('ic')).toBeInTheDocument();
  });

  it('InfoCard는 제목 · 설명 · 본문 · 푸터를 보여 준다', () => {
    render(
      <InfoCard title="가이드 정다은" description="재학 인증 완료" footer={<span>푸터</span>}>
        <p>본문</p>
      </InfoCard>,
    );
    expect(screen.getByText('가이드 정다은')).toBeInTheDocument();
    expect(screen.getByText('재학 인증 완료')).toBeInTheDocument();
    expect(screen.getByText('본문')).toBeInTheDocument();
    expect(screen.getByText('푸터')).toBeInTheDocument();
  });

  it('Badge는 내용을 보여 준다', () => {
    render(<Badge tone="success">승인</Badge>);
    expect(screen.getByText('승인')).toBeInTheDocument();
  });

  it('AiBadge는 AI 결과 라벨과 ✦를 가진다', () => {
    render(<AiBadge>추천 이유</AiBadge>);
    const badge = screen.getByLabelText('AI 결과');
    expect(badge).toHaveTextContent('✦');
    expect(badge).toHaveTextContent('추천 이유');
  });

  it('AiBadge는 children 없이도 그려진다', () => {
    render(<AiBadge />);
    expect(screen.getByLabelText('AI 결과')).toHaveTextContent('✦');
  });

  it('KeywordChips는 키워드마다 칩을 그린다', () => {
    render(<KeywordChips keywords={['산업디자인', '캠퍼스 생활']} />);
    expect(screen.getByText('산업디자인')).toBeInTheDocument();
    expect(screen.getByText('캠퍼스 생활')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('AiLoading', () => {
  it('시간이 지나면 다음 문구, 마지막에서 멈춘다', () => {
    vi.useFakeTimers();
    render(<AiLoading steps={['관심사를 읽는 중', '탐방을 고르는 중']} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('관심사를 읽는 중');
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(status).toHaveTextContent('탐방을 고르는 중');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(status).toHaveTextContent('탐방을 고르는 중');
  });

  it('intervalMs로 간격을 바꾼다', () => {
    vi.useFakeTimers();
    render(<AiLoading steps={['하나', '둘']} intervalMs={300} />);
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.getByRole('status')).toHaveTextContent('하나');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('status')).toHaveTextContent('둘');
  });
});

describe('CodeInput', () => {
  function W({ onComplete }: { onComplete?: (v: string) => void }) {
    const [v, setV] = useState('');
    return <CodeInput value={v} onChange={setV} onComplete={onComplete} />;
  }

  it('숫자만 6자리, 다 차면 onComplete', async () => {
    const onComplete = vi.fn();
    render(<W onComplete={onComplete} />);
    await userEvent.type(screen.getByLabelText('6자리 쿠폰 코드'), 'a1b2c3d4e5f6g7');
    expect(screen.getByLabelText('6자리 쿠폰 코드')).toHaveValue('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('6자리가 안 되면 onComplete가 불리지 않는다', async () => {
    const onComplete = vi.fn();
    render(<W onComplete={onComplete} />);
    await userEvent.type(screen.getByLabelText('6자리 쿠폰 코드'), '123');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('numeric · one-time-code 속성을 가진다', () => {
    render(<W />);
    const input = screen.getByLabelText('6자리 쿠폰 코드');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
  });

  it('붙여넣기도 숫자만 남기고 길이를 자른다', async () => {
    render(<W />);
    await userEvent.click(screen.getByLabelText('6자리 쿠폰 코드'));
    await userEvent.paste('12-34 56789');
    expect(screen.getByLabelText('6자리 쿠폰 코드')).toHaveValue('123456');
  });

  it('입력한 자리는 칸 하나씩 보이고, 입력할 칸이 강조된다', async () => {
    const { container } = render(<W />);
    const cells = () => Array.from(container.querySelectorAll('[aria-hidden] > div'));
    expect(cells()).toHaveLength(6);
    await userEvent.type(screen.getByLabelText('6자리 쿠폰 코드'), '4826');
    expect(cells().map((c) => c.textContent)).toEqual(['4', '8', '2', '6', '', '']);
    expect(cells()[4]).toHaveClass('border-brand');
    expect(cells()[0]).not.toHaveClass('border-brand');
    await userEvent.type(screen.getByLabelText('6자리 쿠폰 코드'), '19');
    expect(cells().map((c) => c.textContent)).toEqual(['4', '8', '2', '6', '1', '9']);
    expect(cells()[5]).toHaveClass('border-brand'); // 다 차면 마지막 칸
  });

  it('length와 label을 바꿀 수 있다', async () => {
    const onComplete = vi.fn();
    function W4() {
      const [v, setV] = useState('');
      return (
        <CodeInput value={v} onChange={setV} onComplete={onComplete} length={4} label="인증 코드" />
      );
    }
    render(<W4 />);
    await userEvent.type(screen.getByLabelText('인증 코드'), '98765');
    expect(screen.getByLabelText('인증 코드')).toHaveValue('9876');
    expect(onComplete).toHaveBeenCalledWith('9876');
  });
});

describe('EmptyState · ErrorState · Skeleton · Page', () => {
  it('EmptyState: 제목 · 설명 · 행동 링크', () => {
    render(
      <MemoryRouter>
        <EmptyState
          title="아직 신청한 탐방이 없어요"
          description="탐방을 찾아보세요"
          action={{ label: '탐방 찾기', to: '/' }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('아직 신청한 탐방이 없어요')).toBeInTheDocument();
    expect(screen.getByText('탐방을 찾아보세요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '탐방 찾기' })).toHaveAttribute('href', '/');
  });

  it('ErrorState: 에러 코드를 한국어 문구로, 다시 시도', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={{ code: 'NETWORK' }} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('네트워크 연결을 확인해 주세요.');
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ErrorState: 코드가 없는 에러는 알 수 없음 문구, onRetry 없으면 버튼 없음', () => {
    render(<ErrorState error={new Error('boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('Skeleton은 장식이라 스크린리더에서 숨긴다', () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstChild).toHaveClass('h-4');
  });

  it('Page는 자식을 감싼다', () => {
    render(<Page className="extra">내용</Page>);
    expect(screen.getByText('내용')).toHaveClass('extra');
  });
});

describe('BottomSheet', () => {
  it('열리면 제목과 내용을 보여 주고 Esc로 닫힌다', async () => {
    const onOpenChange = vi.fn();
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="상점 정보">
        <p>시나몬 카페</p>
      </BottomSheet>,
    );
    expect(screen.getByRole('dialog', { name: '상점 정보' })).toBeInTheDocument();
    expect(screen.getByText('시나몬 카페')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    render(
      <BottomSheet open={false} onOpenChange={() => {}} title="상점 정보">
        <p>시나몬 카페</p>
      </BottomSheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('FrameProvider의 컨테이너 안에 그려진다', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      <FrameProvider container={container}>
        <BottomSheet open onOpenChange={() => {}} title="상점 정보">
          <p>시나몬 카페</p>
        </BottomSheet>
      </FrameProvider>,
    );
    expect(container).toContainElement(screen.getByRole('dialog'));
    container.remove();
  });
});

describe('ConfirmDialog', () => {
  function setup(extra: { pending?: boolean } = {}) {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="코스를 확정할까요?"
        description="확정하면 수정할 수 없어요."
        confirmLabel="확정하기"
        onConfirm={onConfirm}
        {...extra}
      />,
    );
    return { onConfirm, onOpenChange };
  }

  it('확인은 onConfirm, 돌아가기는 닫기', async () => {
    const { onConfirm, onOpenChange } = setup();
    expect(
      screen.getByRole('alertdialog', { name: '코스를 확정할까요?' }),
    ).toHaveAccessibleDescription('확정하면 수정할 수 없어요.');
    await userEvent.click(screen.getByRole('button', { name: '확정하기' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: '돌아가기' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('pending이면 확인 버튼이 비활성이라 연타해도 한 번도 부르지 않는다', async () => {
    const { onConfirm } = setup({ pending: true });
    const confirm = screen.getByRole('button', { name: '확정하기' });
    expect(confirm).toBeDisabled();
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('pending이 아니면 Esc로 닫는다', async () => {
    const { onOpenChange } = setup();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('pending이면 닫히지 않는다: Esc를 무시하고 돌아가기도 비활성', async () => {
    const { onOpenChange } = setup({ pending: true });
    expect(screen.getByRole('button', { name: '돌아가기' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('Illustration', () => {
  const kinds = [
    'campus',
    'dining',
    'cafe',
    'bookshop',
    'green',
    'experience',
    'play',
    'daily',
  ] as const;

  it.each(kinds)('%s: 장식 이미지(alt 빈 문자열)를 바로 불러 그린다', (kind) => {
    const { container } = render(<Illustration kind={kind} className="size-20" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('src');
    expect(img?.getAttribute('src')).toContain(kind);
    expect(img).toHaveClass('size-20');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).not.toHaveAttribute('loading', 'lazy');
  });

  it('alt를 주면 접근 이름이 된다', () => {
    render(<Illustration kind="cafe" alt="동네 카페" />);
    expect(screen.getByRole('img', { name: '동네 카페' })).toBeInTheDocument();
  });
});

describe('BrandMark', () => {
  it('wordmark: 접근 이름 UNIRO인 이미지', () => {
    render(<BrandMark variant="wordmark" />);
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();
  });

  it('icon: 접근 이름 UNIRO인 이미지', () => {
    render(<BrandMark variant="icon" />);
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();
  });
});

describe('Button V2 변형', () => {
  it('danger: 위험 색 버튼으로 그려지고 클릭된다', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="danger" onClick={onClick}>
        신청 취소 확정
      </Button>,
    );
    const button = screen.getByRole('button', { name: '신청 취소 확정' });
    expect(button).toHaveClass('bg-danger');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('soft: 카드 안 작은 버튼. 접근 이름에 화살표가 섞이지 않는다', () => {
    render(<Button variant="soft">코스 확인하기</Button>);
    const button = screen.getByRole('button', { name: '코스 확인하기' });
    expect(button).toHaveClass('bg-brand-soft');
    expect(button).toHaveClass('h-9');
  });

  it('primary는 brand 배경 · 높이 56 토큰', () => {
    render(<Button>다음</Button>);
    const button = screen.getByRole('button', { name: '다음' });
    expect(button).toHaveClass('bg-brand');
    expect(button.className).toContain('h-[var(--btn-h)]');
  });

  it('size="sm"은 높이 44(min-h-11)', () => {
    render(
      <Button size="sm" variant="secondary">
        다시 시도
      </Button>,
    );
    expect(screen.getByRole('button', { name: '다시 시도' })).toHaveClass('min-h-11');
  });
});

describe('V2 StatusChip · InfoCard tone · TextField label', () => {
  it('StatusChip tone: success는 success-soft 바탕, neutral은 neutral-100 바탕', () => {
    const { rerender } = render(<StatusChip tone="success">참여 확정</StatusChip>);
    expect(screen.getByText('참여 확정').closest('div')).toHaveClass('bg-success-soft');
    rerender(<StatusChip>승인 대기</StatusChip>);
    expect(screen.getByText('승인 대기').closest('div')).toHaveClass('bg-neutral-100');
  });

  it('InfoCard tone: brand는 brand-soft, local은 local-soft, muted는 neutral-100', () => {
    const { container, rerender } = render(<InfoCard title="왜 추천했나요?" tone="brand" />);
    expect(container.firstChild).toHaveClass('bg-brand-soft');
    rerender(<InfoCard title="동네" tone="local" />);
    expect(container.firstChild).toHaveClass('bg-local-soft');
    rerender(<InfoCard title="흐린" muted />);
    expect(container.firstChild).toHaveClass('bg-neutral-100');
    rerender(<InfoCard title="기본" />);
    expect(container.firstChild).toHaveClass('bg-surface');
    expect(container.firstChild).not.toHaveClass('border');
  });

  it('TextField showLabel: 보이는 라벨이 입력에 연결된다', () => {
    render(<TextField label="이메일" showLabel />);
    expect(screen.getByText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toBeInstanceOf(HTMLInputElement);
  });
});

describe('ListRow', () => {
  it('to가 있으면 행 전체가 링크 하나', () => {
    render(
      <MemoryRouter>
        <ListRow
          to="/tours/1"
          eyebrow="경희대학교 국제캠퍼스"
          title="디자인 전공자의 하루"
          meta="11.12 · 나와 잘 맞아요"
          metaTone="brand"
        />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/tours/1');
    expect(links[0]).toHaveTextContent('디자인 전공자의 하루');
    expect(screen.getByText('11.12 · 나와 잘 맞아요')).toHaveClass('text-brand');
  });

  it('to가 없으면 링크 없이 내용만, right가 오른쪽에 온다', () => {
    render(
      <MemoryRouter>
        <ListRow title="소프트웨어 전공 탐방" right={<span>승인 대기</span>} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('소프트웨어 전공 탐방')).toBeInTheDocument();
    expect(screen.getByText('승인 대기')).toBeInTheDocument();
  });
});

function StatefulTabs({ onChange }: { onChange(value: string): void }) {
  const [value, setValue] = useState('upcoming');
  return (
    <SegmentedTabs
      id="t"
      label="탐방 구분"
      tabs={[
        { value: 'upcoming', label: '예정된 탐방' },
        { value: 'past', label: '지난 탐방' },
      ]}
      value={value}
      onChange={(v) => {
        onChange(v);
        setValue(v);
      }}
    />
  );
}

function StatefulChips({ onChange }: { onChange(value: string): void }) {
  const [value, setValue] = useState('all');
  return (
    <FilterChips
      label="추천 필터"
      chips={[
        { value: 'all', label: '전체' },
        { value: 'design', label: '디자인' },
        { value: 'khu', label: '경희대', kind: 'school' },
      ]}
      value={value}
      onChange={(v) => {
        onChange(v);
        setValue(v);
      }}
    />
  );
}

describe('SegmentedTabs', () => {
  const tabs = [
    { value: 'upcoming', label: '예정된 탐방' },
    { value: 'past', label: '지난 탐방' },
  ];

  it('tablist · tab · aria-selected', () => {
    render(
      <SegmentedTabs id="t" label="탐방 구분" tabs={tabs} value="upcoming" onChange={() => {}} />,
    );
    expect(screen.getByRole('tablist', { name: '탐방 구분' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: '예정된 탐방' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: '지난 탐방' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('탭을 누르면 onChange(value)', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedTabs id="t" label="탐방 구분" tabs={tabs} value="upcoming" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('tab', { name: '지난 탐방' }));
    expect(onChange).toHaveBeenLastCalledWith('past');
  });

  it('방향키로 이웃 탭을 고르고 초점을 옮긴다(양 끝에서 감긴다)', async () => {
    const onChange = vi.fn();
    render(<StatefulTabs onChange={onChange} />);
    screen.getByRole('tab', { name: '예정된 탐방' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('past');
    expect(screen.getByRole('tab', { name: '지난 탐방' })).toHaveFocus();
    onChange.mockClear();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('upcoming');
    expect(screen.getByRole('tab', { name: '예정된 탐방' })).toHaveFocus();
    onChange.mockClear();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('past');
    expect(screen.getByRole('tab', { name: '지난 탐방' })).toHaveFocus();
  });

  it('value가 어느 탭에도 없으면 첫 탭이 Tab 정지점이다', () => {
    render(<SegmentedTabs id="t" label="탐방 구분" tabs={tabs} value="none" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: '예정된 탐방' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: '지난 탐방' })).toHaveAttribute('tabindex', '-1');
  });

  it('선택된 탭만 패널을 가리키고, 패널은 그 탭이 이름이 된다', () => {
    render(
      <>
        <SegmentedTabs id="t" label="탐방 구분" tabs={tabs} value="past" onChange={() => {}} />
        <div {...segmentedPanelProps('t', 'past')}>지난 목록</div>
      </>,
    );
    const past = screen.getByRole('tab', { name: '지난 탐방' });
    expect(past).toHaveAttribute('id', 't-tab-past');
    expect(past).toHaveAttribute('aria-controls', 't-panel-past');
    expect(screen.getByRole('tab', { name: '예정된 탐방' })).not.toHaveAttribute('aria-controls');
    const panel = screen.getByRole('tabpanel', { name: '지난 탐방' });
    expect(panel).toHaveAttribute('id', 't-panel-past');
    expect(panel).toHaveTextContent('지난 목록');
  });

  it('긴 라벨의 말줄임은 안쪽 span에서 일어난다', () => {
    render(
      <SegmentedTabs id="t" label="탐방 구분" tabs={tabs} value="upcoming" onChange={() => {}} />,
    );
    const tab = screen.getByRole('tab', { name: '예정된 탐방' });
    expect(tab.querySelector('span > span')).toHaveClass('truncate');
    expect(tab.querySelector('span')).not.toHaveClass('truncate');
  });
});

describe('FilterChips', () => {
  const chips = [
    { value: 'all', label: '전체' },
    { value: 'design', label: '디자인' },
    { value: 'khu', label: '경희대', kind: 'school' as const },
  ];

  it('radiogroup · radio, 선택된 칩은 aria-checked', () => {
    render(<FilterChips label="추천 필터" chips={chips} value="all" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: '추천 필터' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: '전체' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '디자인' })).not.toBeChecked();
  });

  it('칩을 누르면 onChange(value)', async () => {
    const onChange = vi.fn();
    render(<FilterChips label="추천 필터" chips={chips} value="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '경희대' }));
    expect(onChange).toHaveBeenCalledWith('khu');
  });

  it('방향키로 이웃 칩을 고르고 초점을 옮긴다(양 끝에서 감긴다)', async () => {
    const onChange = vi.fn();
    render(<StatefulChips onChange={onChange} />);
    screen.getByRole('radio', { name: '전체' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('design');
    expect(screen.getByRole('radio', { name: '디자인' })).toHaveFocus();
    onChange.mockClear();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('all');
    onChange.mockClear();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('khu');
    expect(screen.getByRole('radio', { name: '경희대' })).toHaveFocus();
  });

  it('value가 어느 칩에도 없으면 첫 칩이 Tab 정지점이다', () => {
    render(<FilterChips label="추천 필터" chips={chips} value="none" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: '전체' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: '경희대' })).toHaveAttribute('tabindex', '-1');
  });
});

describe('StepList · NumberedList', () => {
  it('StepList: 번호 붙은 단계, 현재 단계만 aria-current="step"', () => {
    render(<StepList steps={['신청 접수', '가이드 승인 대기', '승인 후 코스 확인']} current={0} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('01 신청 접수');
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    expect(items[1]).not.toHaveAttribute('aria-current');
    expect(items[2]).toHaveTextContent('03');
  });

  it('StepList · NumberedList: ol에 list 역할이 명시된다', () => {
    const { container } = render(
      <>
        <StepList steps={['하나', '둘']} />
        <NumberedList items={['하나', '둘']} />
      </>,
    );
    const lists = container.querySelectorAll('ol');
    expect(lists).toHaveLength(2);
    lists.forEach((ol) => expect(ol).toHaveAttribute('role', 'list'));
  });

  it('StepList · NumberedList: 같은 문구가 겹쳐도 경고 없이 그린다', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <StepList steps={['같음', '같음']} />
        <NumberedList items={['같음', '같음']} />
      </>,
    );
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('StepList: current가 없으면 aria-current가 없다', () => {
    render(<StepList steps={['하나', '둘']} />);
    expect(document.querySelector('[aria-current]')).toBeNull();
  });

  it('NumberedList: 항목 수만큼, 마지막은 local 색', () => {
    render(<NumberedList items={['캠퍼스 둘러보기', '전공 수업 이야기', '동네 카페 질문']} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('1');
    expect(items[2]).toHaveTextContent('동네 카페 질문');
    expect(items[2].querySelector('span')).toHaveClass('bg-local-soft', 'text-ink');
    expect(items[0].querySelector('span')).toHaveClass('bg-brand-soft');
  });
});

describe('HeroCard · PageHeading', () => {
  it('HeroCard: eyebrow · 제목 · 일러스트 · 자식', () => {
    const { container } = render(
      <HeroCard
        eyebrow="경희대학교 국제캠퍼스"
        title={'전공자와 함께\n캠퍼스를 걸어요'}
        illustration="campus"
      >
        <p>자식</p>
      </HeroCard>,
    );
    expect(screen.getByText('경희대학교 국제캠퍼스')).toBeInTheDocument();
    expect(screen.getByText(/전공자와 함께/)).toBeInTheDocument();
    expect(screen.getByText('자식')).toBeInTheDocument();
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toContain('campus');
    expect(container.firstChild).toHaveClass('bg-brand-soft');
  });

  it('HeroCard: footer는 글 · 일러스트 줄 밖, 카드 폭 전체', () => {
    const { container } = render(
      <HeroCard title="제목" illustration="campus" footer={<p>아래 칸</p>} />,
    );
    const footer = screen.getByText('아래 칸').parentElement!;
    expect(footer.parentElement).toBe(container.firstChild);
    expect(container.querySelector('img')!.parentElement).not.toBe(container.firstChild);
  });

  it('HeroCard: titleTone 기본은 ink, brand-strong을 고를 수 있다', () => {
    const { rerender } = render(<HeroCard title="제목" illustration="campus" />);
    expect(screen.getByText('제목')).toHaveClass('text-ink');
    rerender(<HeroCard title="제목" illustration="campus" titleTone="brand-strong" />);
    expect(screen.getByText('제목')).toHaveClass('text-brand-strong');
  });

  it('HeroCard tone local은 local-soft 바탕', () => {
    const { container } = render(<HeroCard title="동네" illustration="cafe" tone="local" />);
    expect(container.firstChild).toHaveClass('bg-local-soft');
  });

  it('PageHeading: h1과 설명', () => {
    render(<PageHeading title={'내 탐방'} description="신청한 탐방을 확인해요." />);
    expect(screen.getByRole('heading', { level: 1, name: '내 탐방' })).toBeInTheDocument();
    expect(screen.getByText('신청한 탐방을 확인해요.')).toBeInTheDocument();
  });

  it('PageHeading: 줄바꿈 문자를 보존하고 설명은 선택', () => {
    render(<PageHeading title={'3개의 탐방을\n추천해요.'} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('whitespace-pre-line');
  });

  it('PageHeading: as="h2"면 h2로 그린다(TopBar가 h1인 화면)', () => {
    render(<PageHeading as="h2" title="탐방을 신청할까요?" />);
    expect(
      screen.getByRole('heading', { level: 2, name: '탐방을 신청할까요?' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});
