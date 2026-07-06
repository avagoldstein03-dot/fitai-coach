import React, { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { NavigationContainer, NavigationContainerRef, CommonActions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";
import * as Notifications from "expo-notifications";

import { useAxiosAuth } from "@/hooks/useAxiosAuth";
import { UpgradeGateProvider } from "@/contexts/UpgradeGateContext";

// Auth
import SignInScreen from "@/screens/auth/SignInScreen";
import SignUpScreen from "@/screens/auth/SignUpScreen";
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";
import OnboardingNavigator from "./OnboardingNavigator";

// Main tabs
import DashboardScreen from "@/screens/dashboard/DashboardScreen";
import FoodScannerScreen from "@/screens/food/FoodScannerScreen";
import BodyScanScreen from "@/screens/assessment/BodyScanScreen";
import LiveBodyScanScreen from "@/screens/assessment/LiveBodyScanScreen";
import WorkoutsScreen from "@/screens/workouts/WorkoutsScreen";
import NutritionScreen from "@/screens/nutrition/NutritionScreen";
import CoachChatScreen from "@/screens/coach/CoachChatScreen";
import ProfileScreen from "@/screens/profile/ProfileScreen";

// Stack-only screens
import AssessmentResultsScreen from "@/screens/assessment/AssessmentResultsScreen";
import ManualMeasurementsScreen from "@/screens/assessment/ManualMeasurementsScreen";
import FoodDiaryScreen from "@/screens/food/FoodDiaryScreen";
import ShoppingListScreen from "@/screens/nutrition/ShoppingListScreen";
import SupplementsScreen from "@/screens/supplements/SupplementsScreen";
import ProgressScreen from "@/screens/progress/ProgressScreen";
import ProgressPhotosScreen from "@/screens/progress/ProgressPhotosScreen";
import WeeklyReviewScreen from "@/screens/progress/WeeklyReviewScreen";
import SettingsScreen from "@/screens/settings/SettingsScreen";
import NotificationsScreen from "@/screens/settings/NotificationsScreen";
import PricingScreen from "@/screens/subscription/PricingScreen";
import SubscriptionManagementScreen from "@/screens/subscription/SubscriptionManagementScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const API_URL = process.env.EXPO_PUBLIC_API_URL;

function DashboardTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, [string, string]> = {
            Dashboard:   ["home",       "home-outline"],
            FoodScanner: ["restaurant", "restaurant-outline"],
            Workouts:    ["barbell",    "barbell-outline"],
            Nutrition:   ["leaf",       "leaf-outline"],
            Coach:       ["chatbox",    "chatbox-outline"],
            Profile:     ["person",     "person-outline"],
          };
          const [active, inactive] = icons[route.name] ?? ["ellipse", "ellipse-outline"];
          return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.textSecondary,
        tabBarStyle: {
          backgroundColor: T.surface,
          borderTopColor: T.border,
          borderTopWidth: 1,
          paddingBottom: 4,
        },
        tabBarLabelStyle: { fontSize: 11 },
      })}
    >
      <Tab.Screen name="Dashboard"   component={DashboardScreen}   options={{ title: t("navigation.home") }} />
      <Tab.Screen name="FoodScanner" component={FoodScannerScreen} options={{ title: t("navigation.food") }} />
      <Tab.Screen name="Workouts"    component={WorkoutsScreen}    options={{ title: t("navigation.workouts") }} />
      <Tab.Screen name="Nutrition"   component={NutritionScreen}   options={{ title: t("navigation.nutrition") }} />
      <Tab.Screen name="Coach"       component={CoachChatScreen}   options={{ title: t("navigation.coach") }} />
      <Tab.Screen name="Profile"     component={ProfileScreen}     options={{ title: t("navigation.profile") }} />
    </Tab.Navigator>
  );
}

// Exported so App.tsx notification handler can navigate
export const navigationRef = React.createRef<NavigationContainerRef<any>>();

export default function RootNavigator() {
  const { isSignedIn, isLoaded } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  // Wire Clerk JWT to every outgoing axios request
  useAxiosAuth();

  // Once signed in, check whether the user has already completed onboarding
  useEffect(() => {
    if (!isSignedIn) {
      setOnboardingCompleted(null);
      return;
    }

    axios
      .get(`${API_URL}/api/auth/profile`)
      .then((res) => setOnboardingCompleted(res.data.data?.onboardingCompleted ?? false))
      .catch(() => setOnboardingCompleted(false)); // fall back to showing onboarding
  }, [isSignedIn]);

  // Still loading Clerk session
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  // Signed in but waiting on profile fetch
  if (isSignedIn && onboardingCompleted === null) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <UpgradeGateProvider>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isSignedIn ? (
          <Stack.Group screenOptions={{ animationEnabled: false }}>
            <Stack.Screen name="SignIn"          component={SignInScreen}          />
            <Stack.Screen name="SignUp"          component={SignUpScreen}          />
            <Stack.Screen name="ForgotPassword"  component={ForgotPasswordScreen}  options={{ animation: "slide_from_right" }} />
          </Stack.Group>
        ) : onboardingCompleted ? (
          // User has completed onboarding — go straight to the main app
          <Stack.Group screenOptions={{ animationEnabled: false }}>
            <Stack.Screen name="Main"                  component={DashboardTabs}               />
            <Stack.Screen name="BodyScan"              component={BodyScanScreen}              options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="LiveBodyScan"          component={LiveBodyScanScreen}          options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="ManualMeasurements"    component={ManualMeasurementsScreen}    options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="AssessmentResults"     component={AssessmentResultsScreen}     options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Supplements"           component={SupplementsScreen}           options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Progress"              component={ProgressScreen}              options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="ProgressPhotos"       component={ProgressPhotosScreen}        options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="FoodDiary"            component={FoodDiaryScreen}             options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="ShoppingList"         component={ShoppingListScreen}          options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Settings"              component={SettingsScreen}              options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="Notifications"         component={NotificationsScreen}         options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Pricing"               component={PricingScreen}               options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="SubscriptionManagement" component={SubscriptionManagementScreen} options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="WeeklyReview"          component={WeeklyReviewScreen}          options={{ animation: "slide_from_right" }} />
          </Stack.Group>
        ) : (
          // Onboarding not complete — run the onboarding flow then go to Main
          <Stack.Group screenOptions={{ animationEnabled: false }}>
            <Stack.Screen name="Onboarding"            component={OnboardingNavigator} />
            <Stack.Screen name="Main"                  component={DashboardTabs}               />
            <Stack.Screen name="BodyScan"              component={BodyScanScreen}              options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="LiveBodyScan"          component={LiveBodyScanScreen}          options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="ManualMeasurements"    component={ManualMeasurementsScreen}    options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="AssessmentResults"     component={AssessmentResultsScreen}     options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Supplements"           component={SupplementsScreen}           options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Progress"              component={ProgressScreen}              options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="ProgressPhotos"       component={ProgressPhotosScreen}        options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="FoodDiary"            component={FoodDiaryScreen}             options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="ShoppingList"         component={ShoppingListScreen}          options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Settings"              component={SettingsScreen}              options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="Notifications"         component={NotificationsScreen}         options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Pricing"               component={PricingScreen}               options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="SubscriptionManagement" component={SubscriptionManagementScreen} options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="WeeklyReview"          component={WeeklyReviewScreen}          options={{ animation: "slide_from_right" }} />
          </Stack.Group>
        )}
      </Stack.Navigator>
      </UpgradeGateProvider>
    </NavigationContainer>
  );
}
