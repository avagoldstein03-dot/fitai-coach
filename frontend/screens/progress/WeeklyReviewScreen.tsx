import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useUpgradeGate } from "@/contexts/UpgradeGateContext";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;


function ReviewText({ text }: { text: string }) {
  const paragraphs = text.split(/\n+/).filter((p) => p.trim());
  return (
    <View style={s.reviewBody}>
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (/^#{1,3}\s|^\*\*[^*]+\*\*[:\s]*$/.test(trimmed)) {
          return (
            <Text key={i} style={s.reviewSection}>
              {trimmed.replace(/^#{1,3}\s/, "").replace(/^\*\*|\*\*[:\s]*$/g, "")}
            </Text>
          );
        }
        if (/^[-•*]\s/.test(trimmed)) {
          return (
            <View key={i} style={s.reviewBulletRow}>
              <View style={s.reviewBulletDot} />
              <Text style={s.reviewPara}>{trimmed.replace(/^[-•*]\s/, "")}</Text>
            </View>
          );
        }
        return <Text key={i} style={i === 0 ? s.reviewLead : s.reviewPara}>{trimmed}</Text>;
      })}
    </View>
  );
}

const STAT_META: Record<string, { emoji: string; color: string; bg: string }> = {
  meals:    { emoji: "🍽️", color: T.accent,  bg: T.accentDark  },
  workouts: { emoji: "💪", color: T.blue,    bg: T.blueDark    },
  calories: { emoji: "🔥", color: T.amber,   bg: T.amberDark   },
  protein:  { emoji: "⚡", color: T.teal,    bg: T.tealDark    },
};

function StatCard({ label, value, unit, metaKey }: { label: string; value: string | number; unit?: string; metaKey?: string }) {
  const meta = metaKey ? STAT_META[metaKey] : undefined;
  return (
    <View style={[s.statCard, meta && { borderColor: meta.color + "40" }]}>
      {meta && (
        <View style={[s.statIconBadge, { backgroundColor: meta.bg }]}>
          <Text style={s.statIconEmoji}>{meta.emoji}</Text>
        </View>
      )}
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, meta && { color: meta.color }]}>
        {value}
        {unit ? <Text style={s.statUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export default function WeeklyReviewScreen() {
  const navigation = useNavigation() as any;
  const { presentUpgrade } = useUpgradeGate();
  const { t } = useTranslation();
  const LOADING_MSGS = t("weekly_review.loading_msgs", { returnObjects: true }) as string[];
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["progress-review", period],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/progress/review?period=${period}`);
      return res.data.data;
    },
    retry: false,
  });

  useEffect(() => {
    // Resets/cycles a loading-message index in response to query loading state — an
    // interval-based "subscribe to an external system" effect, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isLoading && !isFetching) { setLoadingMsgIdx(0); return; }
    const id = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % LOADING_MSGS.length), 2200);
    return () => clearInterval(id);
  }, [isLoading, isFetching]);

  const isPremiumRequired = (error as any)?.response?.status === 403;

  const shareReview = async () => {
    if (!data?.review) return;
    const period_label = period === "weekly" ? t("pricing.billing_weekly") : t("pricing.billing_monthly");
    await Share.share({ message: t("weekly_review.share_msg", { period: period_label, review: data.review }) });
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t("weekly_review.title")}</Text>
        {data?.review && (
          <TouchableOpacity onPress={shareReview}>
            <Text style={s.shareText}>{t("common.share")}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.periodToggle}>
        {(["weekly", "monthly"] as const).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPeriod(p); }}
            style={[s.periodBtn, period === p && s.periodBtnActive]}
          >
            <Text style={[s.periodBtnText, period === p && s.periodBtnTextActive]}>
              {p === "weekly" ? t("weekly_review.this_week") : t("weekly_review.monthly")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isPremiumRequired ? (
        <View style={s.centeredBox}>
          <Text style={s.gateEmoji}>✨</Text>
          <Text style={s.gateTitle}>{t("weekly_review.premium_title")}</Text>
          <Text style={s.gateSub}>{t("weekly_review.premium_sub")}</Text>
          <TouchableOpacity onPress={presentUpgrade} style={s.upgradeBtn}>
            <Text style={s.upgradeBtnText}>{t("common.upgrade")}</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading || isFetching ? (
        <View style={s.centeredBox}>
          <View style={s.loadingAvatar}>
            <Text style={s.loadingAvatarText}>🤖</Text>
          </View>
          <ActivityIndicator size="large" color={T.accent} style={{ marginBottom: 16 }} />
          <Text style={s.loadingText}>{LOADING_MSGS[loadingMsgIdx]}</Text>
        </View>
      ) : error ? (
        <View style={s.centeredBox}>
          <Text style={s.errorEmoji}>⚠️</Text>
          <Text style={s.errorTitle}>{t("weekly_review.error_load")}</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
            <Text style={s.retryBtnText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={T.accent} />}
        >
          <Text style={s.sectionLabel}>{period === "weekly" ? t("weekly_review.this_week") : t("weekly_review.this_month")}</Text>
          <View style={s.statsRow}>
            <StatCard label={t("weekly_review.meals_logged")} value={data.stats.mealsLogged} metaKey="meals" />
            <StatCard label={t("weekly_review.workouts_completed")} value={data.stats.workoutsCompleted} metaKey="workouts" />
          </View>
          <View style={s.statsRow}>
            <StatCard label={t("weekly_review.avg_calories")} value={data.stats.avgDailyCalories || 0} unit="kcal" metaKey="calories" />
            <StatCard label={t("weekly_review.avg_protein")} value={data.stats.avgDailyProtein || 0} unit="g/day" metaKey="protein" />
          </View>

          <View style={s.reviewCard}>
            <View style={s.reviewCardHeader}>
              <Text style={s.coachEmoji}>🤖</Text>
              <View>
                <Text style={s.coachName}>{t("weekly_review.ai_coach")}</Text>
                <Text style={s.coachSub}>{t("weekly_review.ai_review")}</Text>
              </View>
            </View>
            <ReviewText text={data.review} />
          </View>

          <TouchableOpacity onPress={() => refetch()} style={s.regenerateBtn}>
            <Text style={s.regenerateBtnText}>{t("weekly_review.regenerate")}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12 },
  backBtn: { marginRight: 12 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary, flex: 1 },
  shareText: { color: T.accent, fontWeight: "600", fontSize: 14 },
  periodToggle: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: T.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    padding: 3,
  },
  periodBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  periodBtnActive: { backgroundColor: T.accent },
  periodBtnText: { fontSize: 13, fontWeight: "600", color: T.textSecondary },
  periodBtnTextActive: { color: "#000" },
  centeredBox: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  gateEmoji: { fontSize: 48, marginBottom: 16 },
  gateTitle: { fontSize: 20, fontWeight: "700", color: T.textPrimary, marginBottom: 8, textAlign: "center" },
  gateSub: { fontSize: 14, color: T.textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 20 },
  upgradeBtn: { backgroundColor: T.accentDark, borderWidth: 1, borderColor: T.accent, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14 },
  upgradeBtnText: { color: T.accent, fontWeight: "800", fontSize: 16 },
  loadingAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.accentDark, borderWidth: 2, borderColor: T.accentBorder, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  loadingAvatarText: { fontSize: 32 },
  loadingText: { color: T.textSecondary, textAlign: "center", marginTop: 8, paddingHorizontal: 32, lineHeight: 22, fontSize: 14 },
  reviewBody: { gap: 10 },
  reviewLead: { fontSize: 15, color: T.textPrimary, lineHeight: 24, fontWeight: "600" },
  reviewSection: { fontSize: 13, fontWeight: "800", color: T.accent, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4 },
  reviewPara: { fontSize: 14, color: T.textPrimary, lineHeight: 22, flex: 1 },
  reviewBulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  reviewBulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent, marginTop: 8 },
  errorEmoji: { fontSize: 40, marginBottom: 12 },
  errorTitle: { fontSize: 18, fontWeight: "700", color: T.textPrimary, marginBottom: 16 },
  retryBtn: { backgroundColor: T.accent, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12 },
  retryBtnText: { color: "#000", fontWeight: "700" },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginHorizontal: 20, marginBottom: 10 },
  statsRow: { flexDirection: "row", gap: 12, marginHorizontal: 20, marginBottom: 10 },
  statCard: { flex: 1, backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 16 },
  statIconBadge: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statIconEmoji: { fontSize: 16 },
  statLabel: { fontSize: 11, color: T.textMuted, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: "700", color: T.textPrimary },
  statUnit: { fontSize: 13, color: T.textMuted },
  reviewCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
  },
  reviewCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  coachEmoji: { fontSize: 24, marginRight: 10 },
  coachName: { fontSize: 15, fontWeight: "700", color: T.textPrimary },
  coachSub: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  reviewText: { fontSize: 14, color: T.textPrimary, lineHeight: 22 },
  regenerateBtn: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  regenerateBtnText: { color: T.textSecondary, fontSize: 14 },
});
