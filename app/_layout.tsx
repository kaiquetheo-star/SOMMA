import 'react-native-gesture-handler';
import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import 'react-native-reanimated';

import { FontFamily } from '@/constants/typography';
import { PerformanceSyncBridge } from '@/components/routing/PerformanceSyncBridge';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

SplashScreen.preventAutoHideAsync();

const SommaDarkTheme = {
  dark: true,
  colors: {
    primary: '#BFA06A',
    background: '#0F1512',
    card: '#0F1512',
    text: '#E8E4DC',
    border: 'rgba(191, 160, 106, 0.2)',
    notification: '#BFA06A',
  },
  fonts: {
    regular: { fontFamily: FontFamily.body, fontWeight: '400' as const },
    medium: { fontFamily: FontFamily.bodyMedium, fontWeight: '500' as const },
    bold: { fontFamily: FontFamily.displayBold, fontWeight: '700' as const },
    heavy: { fontFamily: FontFamily.displayBold, fontWeight: '700' as const },
  },
};

/** Hide splash once fonts are ready and auth bootstrap has finished (or failed). */
function SplashGate({ fontsReady, children }: { fontsReady: boolean; children: ReactNode }) {
  const { isLoading, isConfigured } = useAuth();
  const authReady = !isConfigured || !isLoading;
  const appReady = fontsReady && authReady;

  useEffect(() => {
    if (!fontsReady) return;

    const hideSplash = async () => {
      try {
        if (appReady) {
          await SplashScreen.hideAsync();
        }
      } finally {
        if (authReady) {
          await SplashScreen.hideAsync().catch(() => undefined);
        }
      }
    };

    void hideSplash();
  }, [fontsReady, authReady, appReady]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) {
      void SplashScreen.hideAsync().catch(() => undefined);
      throw error;
    }
  }, [error]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <SplashGate fontsReady={loaded}>
        <PerformanceSyncBridge />
        <ThemeProvider value={SommaDarkTheme}>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F1512' } }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(workout)" />
          </Stack>
        </ThemeProvider>
      </SplashGate>
    </AuthProvider>
  );
}
