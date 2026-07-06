import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "FitAI Coach",
  slug: "fitai-coach",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0f172a",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.fitaicoach.app",
    infoPlist: {
      NSCameraUsageDescription: "FitAI Coach needs camera access for body scanning and food recognition.",
      NSPhotoLibraryUsageDescription: "FitAI Coach needs photo library access for uploading body scan photos.",
      NSPhotoLibraryAddUsageDescription: "FitAI Coach saves progress photos to your library.",
    },
  },
  android: {
    package: "com.fitaicoach.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0f172a",
    },
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
    ],
    googleServicesFile: "./google-services.json",
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-camera",
      { cameraPermission: "Allow FitAI Coach to access your camera." },
    ],
    [
      "expo-image-picker",
      { photosPermission: "Allow FitAI Coach to access your photos." },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#22c55e",
      },
    ],
  ],
  scheme: "fitai",
  extra: {
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
