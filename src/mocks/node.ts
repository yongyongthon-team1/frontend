import { setupServer } from 'msw/node';

// 핸들러는 Task 9에서 등록한다. 테스트는 server.use(...)로 케이스별 핸들러를 건다.
export const server = setupServer();
