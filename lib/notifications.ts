import * as Notifications from 'expo-notifications';

// Foreground notifications are suppressed by default -- this makes one actually show as a
// banner/list entry while the app is open, which is the only case we can reliably support (iOS
// suspends background JS after ~30s, so a training run that finishes while the app is fully
// backgrounded for minutes won't get a notification -- there's no server-side push wired up for
// that, see hooks/use-manuals-library.ts).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let hasRequestedPermission = false;

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  if (hasRequestedPermission) return false; // don't re-prompt after a denial this session
  hasRequestedPermission = true;
  const { status: requested } = await Notifications.requestPermissionsAsync();
  return requested === 'granted';
}

export async function notifyManualTrainingFinished(displayName: string, ok: boolean) {
  if (!(await ensurePermission())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Workify',
      body: ok ? `"${displayName}" is ready` : `"${displayName}" failed to train`,
    },
    trigger: null,
  });
}
