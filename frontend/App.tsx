import "./global.css";
import "@/lib/i18n";
import * as SecureStore from "expo-secure-store";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Navigation, { navigationRef } from "@/navigation/RootNavigator";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { DisclaimerGate } from "@/components/DisclaimerGate";
import {
  registerForPushNotifications,
  registerTokenWithBackend,
  setupNotificationHandler,
} from "@/services/notifications";
import { configurePurchases } from "@/lib/purchases";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import i18n, { LANGUAGE_CODES } from "@/lib/i18n";
import { PostHogProvider } from "posthog-react-native";
import { identifyUser, resetAnalytics } from "@/lib/analytics";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

try { SplashScreen.preventAutoHideAsync(); } catch (_) {}

const queryClient = new QueryClient();

const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch {
      return;
    }
  },
};

function LanguageSyncer() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  useEffect(() => {
    if (profile?.language) {
      const code = LANGUAGE_CODES[profile.language] ?? "en";
      if (i18n.language !== code) {
        i18n.changeLanguage(code);
      }
    }
  }, [profile?.language]);

  return null;
}

// Inner component so we can access Clerk auth state
function AppShell() {
  const { isSignedIn, userId } = useAuth();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  // navigationRef is accessed via the global navigator reference in RootNavigator

  useEffect(() => {
    setupNotificationHandler();
    try { SplashScreen.hideAsync(); } catch (_) {}
  }, []);

  useEffect(() => {
    if (isSignedIn && userId && Platform.OS !== "web") {
      configurePurchases(userId);
    }
    if (isSignedIn && userId) {
      identifyUser(userId);
    } else if (!isSignedIn) {
      resetAnalytics();
    }
  }, [isSignedIn, userId]);

  // Register for push notifications once the user is signed in
  useEffect(() => {
    if (!isSignedIn) return;

    registerForPushNotifications().then((token) => {
      if (token) registerTokenWithBackend(token);
    });

    // Listen for notifications received while the app is in the foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // no-op: foreground notification display is handled by setupNotificationHandler
      }
    );

    // Handle taps on notifications (foreground + background)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, string>;
        const screen = data?.screen;
        if (screen && navigationRef.current?.isReady()) {
          navigationRef.current.navigate(screen as never);
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isSignedIn]);

  return (
    <DisclaimerGate>
      <LanguageSyncer />
      <OfflineBanner />
      <Navigation />
    </DisclaimerGate>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PostHogProvider
        apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "phc_placeholder"}
        options={{ host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com", disabled: !process.env.EXPO_PUBLIC_POSTHOG_KEY }}
      >
        <ErrorBoundary>
          <SafeAreaProvider>
            <ClerkProvider
              publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
              tokenCache={tokenCache}
            >
              <QueryClientProvider client={queryClient}>
                <AppShell />
              </QueryClientProvider>
            </ClerkProvider>
          </SafeAreaProvider>
        </ErrorBoundary>
      </PostHogProvider>
    </GestureHandlerRootView>
  );
}
