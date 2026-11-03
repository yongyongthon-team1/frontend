import { setupServer } from 'msw/node';
import { selectHandlers } from './registry';

// 테스트(Vitest)용 MSW 서버. 계약의 모든 핸들러를 건다. 테스트는 server.use(...)로 케이스별 핸들러를 앞에 덧붙인다.
export const server = setupServer(...selectHandlers('all'));
