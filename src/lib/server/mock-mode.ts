import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  ROLE_LABELS,
  legacyPermissionsOf,
  type CurrentUser,
  type LegacyRole,
  type User,
} from '@/shared';

/**
 * Mock API mode, server only. With USE_MOCK_API=true the BFF signs in the demo users and never
 * calls Fiducial_backend. Anything other than exactly "true", including unset, means real mode,
 * so public demo credentials can never reach real data.
 */
export function isMockApi(): boolean {
  return process.env.USE_MOCK_API === 'true';
}

/** The shared password for every demo user. */
export const DEMO_PASSWORD = 'Fiducial-demo-2026';

/**
 * Demo users. Ids are 24-character hex (not real ObjectIds, but they pass ObjectIdSchema) and
 * dates are ISO strings, so these pass the shared UserSchema exactly as a real user would.
 * Names and emails are fictional. A mock-mode test checks the schema.
 */
export const DEMO_USERS: readonly User[] = [
  {
    id: 'de300000000000000000ad01',
    email: 'demo.admin@example.com',
    name: 'Asha Menon',
    roles: ['ADMIN'],
    roleNames: [ROLE_LABELS.ADMIN],
    active: true,
    lockedUntil: null,
    lastLoginAt: '2026-10-05T09:30:00.000Z',
    createdAt: '2026-01-02T05:00:00.000Z',
    updatedAt: '2026-10-05T09:30:00.000Z',
  },
  {
    // Relationship Manager (the email predates the role names in the plan).
    id: 'de300000000000000000ac02',
    email: 'demo.manager@example.com',
    name: 'Rahul Iyer',
    roles: ['ACCOUNT_MANAGER'],
    roleNames: [ROLE_LABELS.ACCOUNT_MANAGER],
    active: true,
    lockedUntil: null,
    lastLoginAt: '2026-10-04T11:15:00.000Z',
    createdAt: '2026-01-02T05:00:00.000Z',
    updatedAt: '2026-10-04T11:15:00.000Z',
  },
  {
    id: 'de300000000000000000ae03',
    email: 'demo.approver@example.com',
    name: 'Vikram Shah',
    roles: ['MANAGER'],
    roleNames: [ROLE_LABELS.MANAGER],
    active: true,
    lockedUntil: null,
    lastLoginAt: '2026-10-04T10:05:00.000Z',
    createdAt: '2026-01-02T05:00:00.000Z',
    updatedAt: '2026-10-04T10:05:00.000Z',
  },
  {
    id: 'de300000000000000000bc04',
    email: 'demo.placement@example.com',
    name: 'Priya Nair',
    roles: ['PLACEMENT_EXEC'],
    roleNames: [ROLE_LABELS.PLACEMENT_EXEC],
    active: true,
    lockedUntil: null,
    lastLoginAt: '2026-10-05T08:40:00.000Z',
    createdAt: '2026-01-02T05:00:00.000Z',
    updatedAt: '2026-10-05T08:40:00.000Z',
  },
  {
    id: 'de300000000000000000cd05',
    email: 'demo.readonly@example.com',
    name: 'Kavita Rao',
    roles: ['READ_ONLY'],
    roleNames: [ROLE_LABELS.READ_ONLY],
    active: true,
    lockedUntil: null,
    lastLoginAt: '2026-10-03T12:20:00.000Z',
    createdAt: '2026-01-02T05:00:00.000Z',
    updatedAt: '2026-10-03T12:20:00.000Z',
  },
];

const MOCK_TOKEN_PREFIX = 'mock.';

/** Constant-time string comparison on SHA-256 digests, so lengths do not leak. */
function safeEqual(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest();
  const digestB = createHash('sha256').update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/** The demo user for an email and password, or null when they do not match a demo pair. */
export function findDemoUser(email: string, password: string): User | null {
  const user = DEMO_USERS.find((candidate) => candidate.email === email);
  // Compare the password even when the email is unknown, so timing does not reveal valid emails.
  const passwordOk = safeEqual(password, DEMO_PASSWORD);
  return user && passwordOk ? user : null;
}

/** A session token for a demo user: mock.<user id>.<random UUID>. */
export function createMockToken(userId: string): string {
  return `${MOCK_TOKEN_PREFIX}${userId}.${randomUUID()}`;
}

/** The demo user a mock token belongs to, or null for any other token. */
/**
 * A demo user as /auth/me returns it: with the permissions their legacy role is migrated to (the
 * same as a real user holding that system role).
 */
export function demoCurrentUser(user: User): CurrentUser {
  return { ...user, permissions: legacyPermissionsOf(user.roles as LegacyRole[]) };
}

export function demoUserForToken(token: string): User | null {
  if (!token.startsWith(MOCK_TOKEN_PREFIX)) return null;
  const [, userId] = token.split('.');
  return DEMO_USERS.find((user) => user.id === userId) ?? null;
}
