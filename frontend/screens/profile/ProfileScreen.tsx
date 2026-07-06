import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { formatWeight, formatHeight } from "@/lib/units";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ProfileScreen() {
  const { user } = useUser();
  const { t, i18n } = useTranslation();
  const navigation = useNavigation() as any;

  const { data: subscriptionData, isLoading: loadingSub, refetch: refetchSub, isRefetching } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/subscriptions/status`);
      return res.data;
    },
  });

  const { data: dashData, refetch: refetchDash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/analytics/dashboard`);
      return res.data.data;
    },
    staleTime: 60_000,
  });

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  const subscription = subscriptionData?.subscription;
  const isPremium = subscription?.plan === "premium" && subscription?.status === "active";
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(i18n.language, { month: "short", day: "numeric", year: "numeric" })
    : null;

  const displayName = profile?.name ?? user?.firstName ?? t("profile.default_name");
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(i18n.language, { month: "short", year: "numeric" })
    : null;
  const goalLabel = profile?.goal
    ? profile.goal.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : null;

  return (
    <ScrollView
      style={s.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => { refetchSub(); refetchDash(); refetchProfile(); }}
          tintColor={T.accent}
        />
      }
    >
      <View style={s.container}>
        {/* Header */}
        <Text style={s.pageTitle}>{t("profile.title")}</Text>

        {/* User Card */}
        <View style={s.userCard}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarLetter}>{displayName[0]?.toUpperCase() ?? "A"}</Text>
          </View>
          <View style={s.userInfo}>
            <Text style={s.userName}>{displayName}</Text>
            <Text style={s.userEmail}>{email}</Text>
            <View style={s.userMetaRow}>
              {goalLabel && (
                <View style={s.goalChip}>
                  <Text style={s.goalChipText}>🎯 {goalLabel}</Text>
                </View>
              )}
              {joinedDate && (
                <Text style={s.joinedText}>{t("profile.joined_since", { date: joinedDate })}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={s.statsRow}>
          {[
            { label: t("profile.height"), value: formatHeight(profile?.height, profile?.unitSystem) },
            { label: t("profile.weight"), value: formatWeight(profile?.weight, profile?.unitSystem) },
            { label: t("profile.age"),    value: profile?.age ? t("profile.age_value", { age: profile.age }) : "—" },
          ].map((stat) => (
            <View key={stat.label} style={s.statItem}>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Subscription Card */}
        {loadingSub ? (
          <View style={s.loadingCard}>
            <ActivityIndicator color={T.accent} />
          </View>
        ) : (
          <View style={[s.subCard, isPremium ? s.subCardPremium : s.subCardFree]}>
            <View style={s.subCardTop}>
              <View>
                <Text style={[s.subPlanLabel, isPremium ? s.subPlanLabelPremium : s.subPlanLabelFree]}>
                  {t("profile.current_plan")}
                </Text>
                <Text style={s.subPlanName}>
                  {isPremium ? t("profile.plan_premium") : t("profile.plan_free")}
                </Text>
              </View>
              {isPremium && (
                <View style={s.activeBadge}>
                  <Text style={s.activeBadgeText}>{t("profile.active_badge")}</Text>
                </View>
              )}
            </View>
            {isPremium && periodEnd && (
              <Text style={s.renewsText}>{t("profile.renews", { date: periodEnd })}</Text>
            )}
            {!isPremium && (
              <Text style={s.upgradeTeaser}>{t("profile.upgrade_teaser")}</Text>
            )}
            <TouchableOpacity
              style={[s.subBtn, isPremium ? s.subBtnManage : s.subBtnUpgrade]}
              onPress={() => navigation.navigate(isPremium ? "SubscriptionManagement" : "Pricing")}
              activeOpacity={0.8}
            >
              <Text style={[s.subBtnText, !isPremium && s.subBtnTextAccent]}>
                {isPremium ? t("profile.manage_subscription") : t("profile.upgrade_cta")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* This Week */}
        <Text style={s.sectionTitle}>{t("profile.this_week")}</Text>
        <View style={s.weekRow}>
          {[
            { label: t("profile.workouts"),    value: dashData?.thisWeek?.workoutsCompleted ?? "—", emoji: "🏋️" },
            { label: t("profile.meals_logged"), value: dashData?.thisWeek?.mealsLogged ?? "—", emoji: "🍽️" },
            { label: t("profile.avg_calories"), value: dashData?.thisWeek?.avgDailyCalories ?? "—", emoji: "🔥" },
            { label: t("profile.best_streak"), value: Math.max(dashData?.streaks?.workouts ?? 0, dashData?.streaks?.meals ?? 0) || "—", emoji: "🔥" },
          ].map((item) => (
            <View key={item.label} style={s.weekItem}>
              <Text style={s.weekEmoji}>{item.emoji}</Text>
              <Text style={s.weekValue}>{item.value}</Text>
              <Text style={s.weekLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Achievements */}
        {dashData && (() => {
          const streak = Math.max(dashData?.streaks?.workouts ?? 0, dashData?.streaks?.meals ?? 0);
          const totalWorkouts = dashData?.thisWeek?.workoutsCompleted ?? 0;
          const totalMeals = dashData?.thisWeek?.mealsLogged ?? 0;
          const badges = [
            { emoji: "🏋️", label: t("profile.badge_first_workout"),  earned: totalWorkouts >= 1 },
            { emoji: "🍽️", label: t("profile.badge_meal_tracker"),    earned: totalMeals >= 1 },
            { emoji: "🔥", label: t("profile.badge_3_day_streak"),    earned: streak >= 3 },
            { emoji: "🏆", label: t("profile.badge_week_champion"),   earned: streak >= 7 },
            { emoji: "💧", label: t("profile.badge_stay_hydrated"),   earned: (dashData?.thisWeek?.avgDailyCalories ?? 0) > 0 },
            { emoji: "📸", label: t("profile.badge_body_scan"),       earned: !!profile?.lastAssessmentDate },
          ];
          const earned = badges.filter((b) => b.earned).length;
          return (
            <>
              <Text style={s.sectionTitle}>{t("profile.achievements", { earned, total: badges.length })}</Text>
              <View style={s.badgesRow}>
                {badges.map((b) => (
                  <View key={b.label} style={[s.badge, !b.earned && s.badgeLocked]}>
                    <Text style={[s.badgeEmoji, !b.earned && s.badgeEmojiLocked]}>{b.emoji}</Text>
                    <Text style={[s.badgeLabel, !b.earned && s.badgeLabelLocked]}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </>
          );
        })()}

        {/* Navigation Links */}
        <Text style={s.sectionTitle}>{t("profile.more")}</Text>
        <View style={s.navList}>
          {[
            { label: t("profile.progress_reviews"),  emoji: "📈", screen: "Progress" },
            { label: t("profile.progress_photos"),   emoji: "🖼️", screen: "ProgressPhotos" },
            { label: t("profile.food_diary"),        emoji: "📔", screen: "FoodDiary" },
            { label: t("profile.supplement_stack"),  emoji: "💊", screen: "Supplements" },
            { label: t("profile.body_scan"),         emoji: "📸", screen: "BodyScan" },
            { label: t("profile.measurements"),      emoji: "📏", screen: "ManualMeasurements" },
            { label: t("profile.settings"),          emoji: "⚙️", screen: "Settings" },
          ].map((item) => (
            <TouchableOpacity
              key={item.screen}
              style={s.navRow}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.75}
            >
              <Text style={s.navEmoji}>{item.emoji}</Text>
              <Text style={s.navLabel}>{item.label}</Text>
              <Text style={s.navArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48 },

  pageTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: T.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 24,
  },

  // User card
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: T.accentDark,
    borderWidth: 2,
    borderColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 22, fontWeight: "800", color: T.accent },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: "800", color: T.textPrimary, marginBottom: 2 },
  userEmail: { fontSize: 13, color: T.textSecondary, marginBottom: 8 },
  userMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  goalChip: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  goalChipText: { fontSize: 11, fontWeight: "700", color: T.accentMuted },
  joinedText: { fontSize: 11, color: T.textMuted, fontWeight: "600" },

  // Stats row
  statsRow: {
    flexDirection: "row",
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 16,
    overflow: "hidden",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRightWidth: 1,
    borderColor: T.border,
  },
  statValue: { fontSize: 17, fontWeight: "800", color: T.textPrimary, marginBottom: 3 },
  statLabel: { fontSize: 11, color: T.textSecondary, fontWeight: "600" },

  // Subscription
  loadingCard: {
    height: 80,
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  subCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  subCardPremium: { backgroundColor: T.accentDark, borderColor: T.accentBorder },
  subCardFree:    { backgroundColor: T.surface,    borderColor: T.border },
  subCardTop:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  subPlanLabel:   { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  subPlanLabelPremium: { color: T.accentMuted },
  subPlanLabelFree:    { color: T.textMuted },
  subPlanName:    { fontSize: 22, fontWeight: "800", color: T.textPrimary },
  activeBadge:    { backgroundColor: T.accent, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText:{ color: T.black, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  renewsText:     { fontSize: 12, color: T.accentMuted, marginBottom: 14 },
  upgradeTeaser:  { fontSize: 13, color: T.textSecondary, marginBottom: 14, lineHeight: 19 },
  subBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  subBtnManage:   { backgroundColor: T.surface2,   borderColor: T.border },
  subBtnUpgrade:  { backgroundColor: T.accentDark, borderColor: T.accent },
  subBtnText:     { fontSize: 15, fontWeight: "700", color: T.textSecondary },
  subBtnTextAccent: { color: T.accent },

  // Section title
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: T.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Week stats
  weekRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  weekItem: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
  },
  weekEmoji: { fontSize: 20, marginBottom: 4 },
  weekValue: { fontSize: 18, fontWeight: "800", color: T.textPrimary },
  weekLabel: { fontSize: 10, color: T.textSecondary, fontWeight: "600", textAlign: "center" },

  // Achievements
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  badge: {
    width: "30%",
    backgroundColor: T.accentDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.accentBorder,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
  },
  badgeLocked: { backgroundColor: T.surface, borderColor: T.border, opacity: 0.45 },
  badgeEmoji: { fontSize: 24 },
  badgeEmojiLocked: {},
  badgeLabel: { fontSize: 10, fontWeight: "700", color: T.accent, textAlign: "center", paddingHorizontal: 4 },
  badgeLabelLocked: { color: T.textMuted },

  // Nav list
  navList: { gap: 8 },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  navEmoji: { fontSize: 20 },
  navLabel: { flex: 1, fontSize: 15, color: T.textPrimary, fontWeight: "600" },
  navArrow: { fontSize: 20, color: T.textMuted },
});
