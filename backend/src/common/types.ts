import { AccountRole } from '@prisma/client';

export interface SessionPayload {
  /** id строки AuthSession — по нему сессию можно отозвать */
  sid: string;
  sub: string;
  role: AccountRole;
}

export interface RequestAccount {
  id: string;
  login: string;
  fullName: string;
  role: AccountRole;
  sessionId: string;
  mustChangePassword: boolean;
  totpEnabled: boolean;
  hasPin: boolean;
  /** true, если пора спросить ПИН */
  locked: boolean;
}

export const SESSION_COOKIE = 'psy_session';
