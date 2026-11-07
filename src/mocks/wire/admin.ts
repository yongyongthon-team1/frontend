import { campusLabel } from '@/features/tours/model';
import type { WireAdminDetail, WireAdminItem } from '@/features/admin/wire';
import { MOCK_DOC_SAMPLE, MOCK_FILE_PREFIX, mockFileUrl } from '@/mocks/db/files';
import type { DB, VerificationRow } from '@/mocks/db/schema';

// 인증 행 → 운영자 심사 와이어 객체(`ok`가 키를 snake로 바꾼다). 확장 필드는 없다(U-08 명세 그대로).

type Subject = Pick<WireAdminItem, 'userName' | 'role' | 'schoolName'>;

/** 제출자의 이름 · 역할 · 학교. 고교생은 행의 고교 이름, 대학생은 그 대학의 `campusLabel`이다. */
function subjectOf(db: DB, row: VerificationRow): Subject {
  const user = db.users.find((u) => u.id === row.id);
  const role = user?.role === 'UNIVERSITY' ? 'UNIVERSITY' : 'HIGH_SCHOOL';
  const university =
    role === 'UNIVERSITY' ? db.universities.find((u) => u.id === row.universityId) : undefined;
  return {
    userName: user?.name ?? '',
    role,
    schoolName:
      role === 'HIGH_SCHOOL'
        ? (row.highSchoolName ?? '')
        : university
          ? campusLabel(university.name, university.campusName)
          : '',
  };
}

export function toWireAdminItem(db: DB, row: VerificationRow): WireAdminItem {
  return { verificationId: row.id, ...subjectOf(db, row), submittedAt: row.submittedAt };
}

/**
 * 사진 주소는 대기 중일 때만 준다(처리하면 파일이 지워진다). `mock-file:` 참조는 object URL로, 파일이 사라졌거나(새로고침 ·
 * jsdom) 주소를 못 만들면 정적 견본으로 대신한다(2B-R9). 정적 경로는 그대로, 없으면 null.
 */
export function toWireAdminDetail(db: DB, row: VerificationRow): WireAdminDetail {
  const item = toWireAdminItem(db, row);
  let documentUrl: string | null = null;
  if (row.status === 'PENDING' && row.documentUrl !== null) {
    documentUrl = row.documentUrl.startsWith(MOCK_FILE_PREFIX)
      ? (mockFileUrl(row.documentUrl) ?? MOCK_DOC_SAMPLE[item.role])
      : row.documentUrl;
  }
  return { ...item, documentUrl, status: row.status };
}
