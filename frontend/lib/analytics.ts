import PostHog from "posthog-react-native";
import type { PostHogEventProperties } from "@posthog/core";

export const posthog = new PostHog(
  process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "phc_placeholder",
  {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    disabled: !process.env.EXPO_PUBLIC_POSTHOG_KEY,
    personProfiles: "identified_only",
  }
);

export function identifyUser(userId: string, traits?: PostHogEventProperties) {
  posthog.identify(userId, traits);
}

export function resetAnalytics() {
  posthog.reset();
}

// Event names as constants to avoid typos across screens
export const Events = {
  // Food
  FOOD_SCAN_STARTED: "food_scan_started",
  FOOD_SCAN_COMPLETED: "food_scan_completed",
  FOOD_LOGGED_MANUAL: "food_logged_manual",

  // Workouts
  WORKOUT_GENERATED: "workout_generated",
  WORKOUT_SESSION_STARTED: "workout_session_started",
  WORKOUT_SESSION_COMPLETED: "workout_session_completed",

  // Nutrition
  MEAL_PLAN_GENERATED: "meal_plan_generated",
  SHOPPING_LIST_VIEWED: "shopping_list_viewed",

  // Body assessment
  BODY_SCAN_STARTED: "body_scan_started",
  BODY_SCAN_ANALYZED: "body_scan_analyzed",

  // AI Coach
  COACH_MESSAGE_SENT: "coach_message_sent",
  COACH_CONVERSATION_CLEARED: "coach_conversation_cleared",

  // Subscriptions
  UPGRADE_PROMPT_SHOWN: "upgrade_prompt_shown",
  CHECKOUT_STARTED: "checkout_started",

  // Onboarding
  ONBOARDING_STEP_COMPLETED: "onboarding_step_completed",
  ONBOARDING_COMPLETED: "onboarding_completed",
} as const;
