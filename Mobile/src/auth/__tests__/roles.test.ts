import { getRolesFromToken } from '../roles';

function base64UrlEncode(json: object): string {
  return Buffer.from(JSON.stringify(json))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildFakeToken(payload: object): string {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlEncode(payload);
  return `${header}.${body}.fake-signature`;
}

describe('getRolesFromToken', () => {
  it('returns the roles claim from a valid token', () => {
    const token = buildFakeToken({ sub: 'user-1', roles: ['Coach', 'ClubMember'] });

    expect(getRolesFromToken(token)).toEqual(['Coach', 'ClubMember']);
  });

  it('returns an empty array when the token has no roles claim', () => {
    const token = buildFakeToken({ sub: 'user-1' });

    expect(getRolesFromToken(token)).toEqual([]);
  });

  it('returns an empty array for a malformed token', () => {
    expect(getRolesFromToken('not-a-real-token')).toEqual([]);
  });

  it('returns an empty array when the token is null', () => {
    expect(getRolesFromToken(null)).toEqual([]);
  });
});
