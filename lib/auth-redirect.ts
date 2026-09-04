export const AUTH_CALLBACK_URL = 'workifyapp://auth/callback';

export type AuthRedirectParams = {
  accessToken: string;
  refreshToken: string;
  type: string | null;
};

export type AuthRedirectParseResult =
  | { ok: true; params: AuthRedirectParams }
  | {
      ok: false;
      error: string;
      errorCode: string | null;
      errorDescription: string | null;
      type: string | null;
    };

function rejected(
  error: string,
  options: { errorCode?: string | null; errorDescription?: string | null; type?: string | null } = {}
): AuthRedirectParseResult {
  return {
    ok: false,
    error,
    errorCode: options.errorCode ?? null,
    errorDescription: options.errorDescription ?? null,
    type: options.type ?? null,
  };
}

export function parseAuthRedirect(url: string): AuthRedirectParseResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return rejected('The confirmation link is malformed.');
  }

  if (
    parsed.protocol !== 'workifyapp:' ||
    parsed.hostname !== 'auth' ||
    parsed.pathname !== '/callback' ||
    parsed.port !== '' ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    return rejected('This link is not a Workify authentication callback.');
  }

  // Supabase implicit-flow tokens normally arrive in the fragment. Merge both locations so
  // callback errors or future server configuration that uses the query string are handled too.
  // Fragment values take precedence because they are the final auth response from Supabase.
  const parameters = new URLSearchParams(parsed.search);
  const fragment = new URLSearchParams(
    parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
  );
  fragment.forEach((value, key) => parameters.set(key, value));

  const type = parameters.get('type');
  const authError = parameters.get('error');
  const errorCode = parameters.get('error_code');
  const errorDescription = parameters.get('error_description');

  if (authError || errorCode || errorDescription) {
    return rejected(errorDescription ?? authError ?? 'Authentication failed.', {
      errorCode,
      errorDescription,
      type,
    });
  }

  const accessToken = parameters.get('access_token');
  const refreshToken = parameters.get('refresh_token');
  if (!accessToken || !refreshToken) {
    return rejected('The confirmation link is missing session information.', { type });
  }

  if (type !== 'signup') {
    return rejected('Only signup confirmation links are supported.', { type });
  }

  return { ok: true, params: { accessToken, refreshToken, type } };
}
