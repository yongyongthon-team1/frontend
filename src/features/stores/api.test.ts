import { beforeEach, describe, expect, it } from 'vitest';
import { mutate, resetDb } from '@/mocks/db/store';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { loginAs } from '@/test/loginAs';
import { getMyStore } from './api';

describe('내 가게 API (MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
  });

  it('연결된 가게가 있으면 MyStore', async () => {
    loginAs(DEMO_EMAILS.owner);
    expect(await getMyStore()).toMatchObject({
      id: 1,
      name: '서천 밥상',
      partnership: { state: 'ACTIVE' },
    });
  });

  it('404 STORE_NOT_LINKED는 오류가 아니라 null', async () => {
    mutate((db) => {
      db.stores.find((s) => s.id === 1)!.ownerId = null;
    });
    loginAs(DEMO_EMAILS.owner);
    expect(await getMyStore()).toBeNull();
  });

  it('다른 오류(403)는 그대로 던진다', async () => {
    loginAs(DEMO_EMAILS.student);
    await expect(getMyStore()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});
