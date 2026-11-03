import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Compass, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameProvider } from '@/app/layouts/FrameContext';
import { AiBadge } from './AiBadge';
import { AiLoading } from './AiLoading';
import { Badge } from './Badge';
import { BottomSheet } from './BottomSheet';
import { BottomTabBar } from './BottomTabBar';
import { Button } from './Button';
import { CodeInput } from './CodeInput';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { InfoCard } from './InfoCard';
import { KeywordChips } from './KeywordChips';
import { Page } from './Page';
import { Select } from './Select';
import { Skeleton } from './Skeleton';
import { StatusChip } from './StatusChip';
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
});
