import React from 'react';
import { act, create } from 'react-test-renderer';

import { AuthProvider, useAuth } from './auth-context';
import { bootstrapOrganization } from './organizations';
import { supabase } from './supabase';

jest.mock('./organizations', () => ({ bootstrapOrganization: jest.fn() }));
jest.mock('./supabase', () => ({
  supabase: { auth: {
    getSession: jest.fn(), onAuthStateChange: jest.fn(), setSession: jest.fn(),
    signUp: jest.fn(), signOut: jest.fn(), signInWithPassword: jest.fn(),
  } },
}));

const session = { access_token: 'test-access', user: { id: 'test-user' } };
const params = { accessToken: 'test-access', refreshToken: 'test-refresh', type: 'signup' };
let auth;
let listener;
let root;

function Probe() {
  auth = useAuth();
  return null;
}

beforeEach(async () => {
  jest.resetAllMocks();
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  supabase.auth.onAuthStateChange.mockImplementation((callback) => {
    listener = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  supabase.auth.setSession.mockImplementation(async () => {
    listener('SIGNED_IN', session);
    return { data: { session }, error: null };
  });
  supabase.auth.signUp.mockImplementation(supabase.auth.setSession);
  supabase.auth.signOut.mockResolvedValue({ error: null });
  bootstrapOrganization.mockResolvedValue({ error: null });
  await act(async () => { root = create(<AuthProvider><Probe /></AuthProvider>); });
});

afterEach(async () => { await act(async () => root.unmount()); });

test('keeps callback publication blocked until provisioning completes, then releases it', async () => {
  let finish;
  bootstrapOrganization.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  let pending;
  await act(async () => { pending = auth.completeAuthCallback(params); });
  expect(bootstrapOrganization).toHaveBeenCalledTimes(1);
  await act(async () => { listener('TOKEN_REFRESHED', session); });
  expect(auth.session).toBeNull();
  await act(async () => { finish({ error: null }); await pending; });
  expect(auth.session).toEqual(session);
  const refreshed = { ...session, access_token: 'refreshed' };
  await act(async () => { listener('TOKEN_REFRESHED', refreshed); });
  expect(auth.session).toEqual(refreshed);
});

describe.each(['callback', 'signup'])('%s provisioning failure', (flow) => {
  test.each(['returned', 'thrown'])('cleans up a %s bootstrap error without publishing a session', async (mode) => {
    const error = new Error('Organization setup failed');
    if (mode === 'returned') bootstrapOrganization.mockResolvedValue({ error });
    else bootstrapOrganization.mockRejectedValue(error);
    let result;
    await act(async () => {
      result = flow === 'callback'
        ? await auth.completeAuthCallback(params)
        : await auth.signUpWithPassword('test@example.com', 'password');
    });
    expect(result.error).toBe(error);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.session).toBeNull();
  });
});

test.each(['returned', 'thrown'])('reports %s cleanup failure and clears the app session', async (mode) => {
  bootstrapOrganization.mockRejectedValue(new Error('Setup failed'));
  const error = new Error('Storage unavailable');
  if (mode === 'returned') supabase.auth.signOut.mockResolvedValue({ error });
  else supabase.auth.signOut.mockRejectedValue(error);
  let result;
  await act(async () => { result = await auth.completeAuthCallback(params); });
  expect(result.error.message).toContain('Setup failed');
  expect(result.error.message).toContain('Local sign-out also failed');
  expect(auth.session).toBeNull();
});

test.each(['recovery', 'invite', 'email', null])('rejects callback type %p before creating a session', async (type) => {
  const result = await auth.completeAuthCallback({ ...params, type });
  expect(result.error.message).toBe('Only signup confirmation links are supported.');
  expect(supabase.auth.setSession).not.toHaveBeenCalled();
  expect(bootstrapOrganization).not.toHaveBeenCalled();
  expect(auth.session).toBeNull();
});

test('password login still publishes auth events without organization provisioning', async () => {
  supabase.auth.signInWithPassword.mockImplementation(async () => {
    listener('SIGNED_IN', session);
    return { error: null };
  });
  await act(async () => { await auth.signInWithPassword('test@example.com', 'password'); });
  expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password' });
  expect(bootstrapOrganization).not.toHaveBeenCalled();
  expect(auth.session).toEqual(session);
});
