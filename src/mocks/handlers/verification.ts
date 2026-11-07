import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import { getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import {
  decideConsent,
  findConsent,
  requestGuardianConsent,
  submitEnrollment,
} from '@/mocks/rules/verification';
import { ok, withWire } from '@/mocks/wire/envelope';
import {
  toWireConsentDecided,
  toWireConsentRequested,
  toWireConsentView,
  toWireEnrollment,
} from '@/mocks/wire/verification';
import { api, formFile, readBody, readForm, requireUser } from './util';

// 재학 인증 제출(U-05, multipart)과 보호자 동의(U-06). 보호자 조회 · 결정은 로그인 없이 토큰만으로 부른다(명세).

const textField = (form: FormData, name: string): string | null => {
  const value = form.get(name);
  return typeof value === 'string' ? value : null;
};

const tokenOf = (params: Record<string, string | readonly string[] | undefined>) =>
  String(params.consentToken ?? '');

export const verificationHandlers = [
  http.post(
    api('/verifications/enrollment'),
    withWire(async ({ request }) => {
      await delayBase();
      const form = await readForm(request);
      const now = mockNow();
      const row = mutate((db) => {
        const user = requireUser(request, db);
        return submitEnrollment(
          db,
          user.id,
          { campusId: textField(form, 'campus_id'), schoolName: textField(form, 'school_name') },
          formFile(form, 'document'),
          now,
        );
      });
      return ok(toWireEnrollment(row), 201);
    }),
  ),

  http.post(
    api('/guardian-consents'),
    withWire(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const row = mutate((db) => {
        const user = requireUser(request, db);
        return requestGuardianConsent(db, user.id, body, now);
      });
      return ok(toWireConsentRequested(row), 201);
    }),
  ),

  http.get(
    api('/guardian-consents/:consentToken'),
    withWire(async ({ params }) => {
      await delayBase();
      const db = getDb();
      return ok(toWireConsentView(db, findConsent(db, tokenOf(params), mockNow())));
    }),
  ),

  http.patch(
    api('/guardian-consents/:consentToken'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const row = mutate((db) => decideConsent(db, tokenOf(params), body.agree, now));
      return ok(toWireConsentDecided(row));
    }),
  ),
];
