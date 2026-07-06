import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useUser } from "@clerk/clerk-expo";

import WelcomeScreen from "@/screens/onboarding/WelcomeScreen";
import OnboardingStep1 from "@/screens/onboarding/Step1Screen";
import OnboardingStep2 from "@/screens/onboarding/Step2Screen";
import OnboardingStep3 from "@/screens/onboarding/Step3Screen";
import OnboardingStep4 from "@/screens/onboarding/Step4Screen";
import OnboardingStep5 from "@/screens/onboarding/Step5Screen";
import OnboardingStep6 from "@/screens/onboarding/Step6Screen";
import OnboardingStep7 from "@/screens/onboarding/Step7Screen";
import OnboardingStep8 from "@/screens/onboarding/Step8Screen";

const Stack = createNativeStackNavigator();

export default function OnboardingNavigator() {
  const { user } = useUser();

  if (!user) return null;

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, gestureEnabled: false }}
      initialRouteName="Welcome"
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Step1"   component={OnboardingStep1} />
      <Stack.Screen name="Step2"   component={OnboardingStep2} />
      <Stack.Screen name="Step3"   component={OnboardingStep3} />
      <Stack.Screen name="Step4"   component={OnboardingStep4} />
      <Stack.Screen name="Step5"   component={OnboardingStep5} />
      <Stack.Screen name="Step6"   component={OnboardingStep6} />
      <Stack.Screen name="Step7"   component={OnboardingStep7} />
      <Stack.Screen name="Step8"   component={OnboardingStep8} />
    </Stack.Navigator>
  );
}
