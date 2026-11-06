import type { Me } from './model';

/** 로그인 직후(또는 `/`) 역할과 인증 상태에 따라 처음 보여줄 화면. */
export function getLandingPath(me: Me): string {
  switch (me.role) {
    case 'HIGH_SCHOOL': {
      const studentUnverified =
        me.verificationStatus === 'NONE' || me.verificationStatus === 'REJECTED';
      const guardianPending =
        me.guardianStatus === 'NONE' ||
        me.guardianStatus === 'REJECTED' ||
        me.guardianStatus === 'EXPIRED';
      return studentUnverified || guardianPending ? '/verify' : '/';
    }
    case 'UNIVERSITY':
      if (me.verificationStatus === 'NONE' || me.verificationStatus === 'REJECTED') {
        return '/guide/verify';
      }
      if (!me.guideProfile?.major) return '/guide/me';
      return '/guide';
    case 'OWNER':
      if (!me.businessVerified) return '/owner/verify';
      if (me.storeId === null) return '/owner/store/connect';
      return '/owner/store';
    case 'ADMIN':
      return '/admin/verifications';
  }
}
