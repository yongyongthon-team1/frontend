// 눈에 보이는 높이가 44px보다 낮은 칩 · 작은 버튼의 눌림 영역을 위아래로 넓힌다(최소 터치 44).
// 대상 요소에 `relative`가 함께 있어야 한다. 보이는 모양은 그대로다.
export const touchExpandClass =
  'relative before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-[""]';
