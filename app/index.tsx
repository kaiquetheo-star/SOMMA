import { Redirect } from 'expo-router';

import { hasCompletedFoundationScan, useSommaStore } from '@/store/useSommaStore';

/** Entry route — waits for hydration before choosing Home vs Foundation. */
export default function Index() {
  const hasHydrated = useSommaStore((state) => state._hasHydrated);
  const userFoundation = useSommaStore((state) => state.user_foundation);
  const userEnvironment = useSommaStore((state) => state.user_environment);
  const userBiological = useSommaStore((state) => state.user_biological);

  if (!hasHydrated) {
    return null;
  }

  const passportComplete = hasCompletedFoundationScan({
    user_foundation: userFoundation,
    user_environment: userEnvironment,
    user_biological: userBiological,
  });

  return <Redirect href={passportComplete ? '/(tabs)/home' : '/(auth)/foundation'} />;
}
