import { describe, expect, it } from 'vitest';

import { isServiceRoleRequest } from './auth';

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (s: string) =>
    Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url(JSON.stringify(payload))}.sig`;
}

const withAuth = (value?: string) =>
  new Request('https://example.test', {
    method: 'POST',
    headers: value === undefined ? {} : { Authorization: value },
  });

describe('isServiceRoleRequest', () => {
  it('accepts a service_role JWT even when it differs from the injected key', () => {
    const token = fakeJwt({ role: 'service_role', ref: 'abc' });
    expect(isServiceRoleRequest(withAuth(`Bearer ${token}`), 'sb_secret_other')).toBe(true);
  });

  it('accepts an exact match with the injected key', () => {
    expect(isServiceRoleRequest(withAuth('Bearer sb_secret_xyz'), 'sb_secret_xyz')).toBe(true);
  });

  it('rejects anon and user JWTs', () => {
    expect(isServiceRoleRequest(withAuth(`Bearer ${fakeJwt({ role: 'anon' })}`), 'k')).toBe(false);
    expect(
      isServiceRoleRequest(withAuth(`Bearer ${fakeJwt({ role: 'authenticated' })}`), 'k'),
    ).toBe(false);
  });

  it('rejects missing or malformed headers', () => {
    expect(isServiceRoleRequest(withAuth(), 'k')).toBe(false);
    expect(isServiceRoleRequest(withAuth('Bearer '), '')).toBe(false);
    expect(isServiceRoleRequest(withAuth('Bearer not.a.jwt'), 'k')).toBe(false);
    expect(isServiceRoleRequest(withAuth(fakeJwt({ role: 'service_role' })), 'k')).toBe(false);
  });
});
