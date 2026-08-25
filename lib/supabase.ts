import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// The Android emulator can't reach the host machine via 127.0.0.1/localhost -- that address
// means "the emulator itself" there, not the host. It maps the host loopback to 10.0.2.2
// instead. Only rewrite in dev, and only when EXPO_PUBLIC_SUPABASE_URL is actually a local
// Supabase URL (a real https:// prod URL is unaffected).
function resolveSupabaseUrl(url: string) {
  if (__DEV__ && Platform.OS === 'android') {
    return url.replace(/127\.0\.0\.1|localhost/, '10.0.2.2');
  }
  return url;
}

const supabaseUrl = resolveSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL!);
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Keeps the session refreshing while the app is foregrounded, and stops while
// backgrounded — without this, `onAuthStateChange` won't fire TOKEN_REFRESHED/
// SIGNED_OUT reliably. Register once.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
