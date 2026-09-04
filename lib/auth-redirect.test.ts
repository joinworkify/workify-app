import { AUTH_CALLBACK_URL, parseAuthRedirect } from './auth-redirect';

describe('parseAuthRedirect', () => {
  it('parses an implicit-flow signup callback fragment', () => {
    expect(
      parseAuthRedirect(
        `${AUTH_CALLBACK_URL}#access_token=access-123&refresh_token=refresh-456&type=signup`
      )
    ).toEqual({
      ok: true,
      params: {
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        type: 'signup',
      },
    });
  });

  it('merges query and fragment parameters with fragment values taking precedence', () => {
    expect(
      parseAuthRedirect(
        `${AUTH_CALLBACK_URL}?type=email&access_token=old#access_token=new&refresh_token=refresh&type=signup`
      )
    ).toEqual({
      ok: true,
      params: { accessToken: 'new', refreshToken: 'refresh', type: 'signup' },
    });
  });

  it('returns Supabase callback errors without requiring session tokens', () => {
    expect(
      parseAuthRedirect(
        `${AUTH_CALLBACK_URL}?type=signup#error=access_denied&error_code=otp_expired&error_description=Link%20expired`
      )
    ).toEqual({
      ok: false,
      error: 'Link expired',
      errorCode: 'otp_expired',
      errorDescription: 'Link expired',
      type: 'signup',
    });
  });

  it.each(['recovery', 'email', 'invite', '', null])('rejects unsupported callback type %p', (type) => {
    const suffix = type === null ? '' : `&type=${type}`;
    expect(parseAuthRedirect(`${AUTH_CALLBACK_URL}#access_token=a&refresh_token=r${suffix}`)).toMatchObject({
      ok: false,
      error: 'Only signup confirmation links are supported.',
    });
  });

  it.each([
    ['', 'The confirmation link is malformed.'],
    ['https://example.com/auth/callback#access_token=a&refresh_token=r', 'This link is not a Workify authentication callback.'],
    ['workifyapp://profile#access_token=a&refresh_token=r', 'This link is not a Workify authentication callback.'],
    [`${AUTH_CALLBACK_URL}?type=signup`, 'The confirmation link is missing session information.'],
  ])('rejects malformed or unrelated URL %p', (url, message) => {
    const result = parseAuthRedirect(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(message);
  });
});
