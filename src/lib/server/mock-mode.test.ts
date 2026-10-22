// @vitest-environment node
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROLES, UserSchema } from '@/shared';
import {
  DEMO_PASSWORD,
  DEMO_USERS,
  createMockToken,
  demoUserForToken,
  findDemoUser,
  isMockApi,
} from './mock-mode';

const demoEmails = DEMO_USERS.map((user) => user.email);

describe('mock-mode helpers', () => {
  it('has demo users that pass the shared UserSchema', () => {
    for (const user of DEMO_USERS) {
      expect(UserSchema.safeParse(user).success).toBe(true);
    }
  });

  it('has one demo user per role, each with a unique id and email', () => {
    expect(DEMO_USERS.flatMap((user) => user.roles).sort()).toEqual([...ROLES].sort());
    expect(new Set(DEMO_USERS.map((user) => user.id)).size).toBe(DEMO_USERS.length);
    expect(new Set(demoEmails).size).toBe(DEMO_USERS.length);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Feature: frontend-shell, Property 12: Mock mode is opt-in and narrow
  it('is on only for exactly "true"', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        vi.stubEnv('USE_MOCK_API', value);
        expect(isMockApi()).toBe(value === 'true');
      }),
    );
    vi.stubEnv('USE_MOCK_API', 'true');
    expect(isMockApi()).toBe(true);
  });

  // Feature: frontend-shell, Property 12: Mock mode is opt-in and narrow
  it('accepts a sign-in only for a demo email with the demo password', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (email, password) => {
        const isPair = demoEmails.includes(email) && password === DEMO_PASSWORD;
        expect(findDemoUser(email, password) !== null).toBe(isPair);
      }),
    );
    for (const user of DEMO_USERS) {
      expect(findDemoUser(user.email, DEMO_PASSWORD)?.id).toBe(user.id);
    }
  });

  // Feature: frontend-shell, Property 12: Mock mode is opt-in and narrow
  it('resolves a token only when it is mock.<demo id>.<rest>', () => {
    fc.assert(
      fc.property(fc.string(), (token) => {
        const user = demoUserForToken(token);
        if (user) {
          expect(token.startsWith(`mock.${user.id}.`)).toBe(true);
          expect(demoEmails).toContain(user.email);
        }
      }),
    );
    for (const user of DEMO_USERS) {
      expect(demoUserForToken(createMockToken(user.id))?.id).toBe(user.id);
    }
    expect(demoUserForToken('mock.000000000000000000nosuch.abc')).toBeNull();
    expect(demoUserForToken(`bearer.${DEMO_USERS[0]?.id ?? ''}.abc`)).toBeNull();
  });
});
