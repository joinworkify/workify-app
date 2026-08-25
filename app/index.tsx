import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth-context';

// Neither (app) nor (auth) has an index.tsx of its own, so "/" has no match without this --
// RootLayout already blocks rendering the Stack until isLoading resolves, so by the time this
// mounts `session` is settled and this redirect fires once, synchronously.
export default function RootIndex() {
  const { session } = useAuth();
  return <Redirect href={session ? '/(app)/chats' : '/(auth)/welcome'} />;
}
