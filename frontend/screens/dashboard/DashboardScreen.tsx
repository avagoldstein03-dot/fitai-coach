import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  StyleSheet,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { formatWeight } from "@/lib/units";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";
import { syncHealthData } from "@/lib/health";
import { useUpgradeGate } from "@/contexts/UpgradeGateContext";
import { posthog, Events } from "@/lib/analytics";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const W = Dimensions.get("window").width;

interface DashboardData {
  currentWeight: number | null;
  physiqueNote: string | null;
  lastAssessmentDate: string | null;
  thisWeek: {
    mealsLogged: number;
    workoutsCompleted: number;
    avgDailyCalories: number;
    avgDailyProtein: number;
  };
  streaks: { workouts: number; meals: number };
  charts: { daily: Array<{ date: string; calories: number; protein: number }> };
  subscription: { plan: "free" | "premium"; status: string };
}

function MiniBarChart({
  data,
  valueKey,
  color,
}: {
  data: Array<Record<string, any>>;
  valueKey: string;
  color: string;
}) {
  const max = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  const barW = (W - 80) / data.length - 5;
  return (
    <View style={s.chartRow}>
      {data.map((d, i) => {
        const pct = d[valueKey] / max;
        return (
          <View key={i} style={s.barWrapper}>
            <View
              style={[
                s.bar,
                {
                  width: barW,
                  height: Math.max(4, pct * 48),
                  backgroundColor: color,
                  opacity: 0.3 + pct * 0.7,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const ACTION_KEYS = [
  { labelKey: "dashboard.action_log_meal",      subKey: "dashboard.action_log_meal_sub",      emoji: "🍽", screen: "FoodScanner"  },
  { labelKey: "dashboard.action_workout",       subKey: "dashboard.action_workout_sub",       emoji: "💪", screen: "Workouts"     },
  { labelKey: "dashboard.action_body_scan",     subKey: "dashboard.action_body_scan_sub",     emoji: "📸", screen: "BodyScan"     },
  { labelKey: "dashboard.action_coach",         subKey: "dashboard.action_coach_sub",         emoji: "🤖", screen: "Coach"        },
  { labelKey: "dashboard.action_supplements",   subKey: "dashboard.action_supplements_sub",   emoji: "💊", screen: "Supplements"  },
  { labelKey: "dashboard.action_weekly_review", subKey: "dashboard.action_weekly_review_sub", emoji: "📊", screen: "WeeklyReview" },
  { labelKey: "dashboard.action_advanced_analytics", subKey: "dashboard.action_advanced_analytics_sub", emoji: "📈", screen: "AdvancedAnalytics" },
  { labelKey: "dashboard.action_product_scan", subKey: "dashboard.action_product_scan_sub", emoji: "🔍", screen: "ProductScan" },
];

const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);

const TODAY = new Date().toISOString().split("T")[0];
const WATER_KEY = `water_${TODAY}`;
const WATER_GOAL = 8;

export default function DashboardScreen() {
  const navigation = useNavigation() as any;
  const { t, i18n } = useTranslation();
  const { presentUpgrade } = useUpgradeGate();
  const quotes = t("dashboard.quotes", { returnObjects: true }) as { text: string; author: string }[];
  const dailyQuote = quotes[dayOfYear % quotes.length];
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [celebrationMilestone, setCelebrationMilestone] = useState<number | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(WATER_KEY).then((v) => {
      if (v !== null) setWaterGlasses(Number(v));
    });
    AsyncStorage.getItem("onboarding_dismissed").then((v) => {
      if (v) setOnboardingDismissed(true);
    });
    // Best-effort — a failed health sync should never block the dashboard.
    AsyncStorage.getItem("health_connected").then((connected) => {
      if (connected) syncHealthData().catch(() => {});
    });
  }, []);

  const dismissOnboarding = useCallback(() => {
    setOnboardingDismissed(true);
    AsyncStorage.setItem("onboarding_dismissed", "1");
  }, []);

  const setWater = useCallback((n: number) => {
    const clamped = Math.max(0, Math.min(WATER_GOAL, n));
    setWaterGlasses(clamped);
    AsyncStorage.setItem(WATER_KEY, String(clamped));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/analytics/dashboard`);
      return res.data.data;
    },
    staleTime: 60_000,
  });

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), syncHealthData().catch(() => {})]);
  }, [refetch]);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  const { data: workoutData } = useQuery<{
    activeProgram: {
      name: string;
      startDate: string;
      weeks: Array<{ days: Array<{ dayOfWeek: number; exercises: Array<{ exerciseName: string; sets: number; reps: string }> }> }>;
    } | null;
  }>({
    queryKey: ["workouts"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/workouts/history`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  // Hoisted out of JSX so this recomputes once per relevant data change, not once per render.
  // Date.now() is intentional — this derives a display-only "which week/day is today" and
  // "how stale is the last scan" indicator, not something requiring pure/idempotent output.
  const activeProgram = workoutData?.activeProgram;
  const todayWorkout = useMemo(() => {
    if (!activeProgram) return null;
    // eslint-disable-next-line react-hooks/purity
    const msSinceStart = Date.now() - new Date(activeProgram.startDate).getTime();
    const weekIndex = Math.min(
      Math.max(0, Math.floor(msSinceStart / (7 * 24 * 60 * 60 * 1000))),
      activeProgram.weeks.length - 1
    );
    const todayIndex = (new Date().getDay() + 6) % 7; // Mon=0…Sun=6
    return { weekIndex, todayIndex };
  }, [activeProgram]);

  const isAssessmentStale = useMemo(() => {
    const last = data?.lastAssessmentDate;
    // eslint-disable-next-line react-hooks/purity
    return !last || Date.now() - new Date(last).getTime() > 7 * 24 * 60 * 60 * 1000;
  }, [data?.lastAssessmentDate]);

  const { data: targets } = useQuery<{ dailyCaloricTarget: number; proteinTarget: number }>({
    queryKey: ["nutritionTargets"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/nutrition/targets`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  const { data: weeklyInsights, error: weeklyInsightsError } = useQuery<{
    weekOf: string | null;
    insights: string[] | null;
  }>({
    queryKey: ["weeklyInsights"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/analytics/insights`);
      return res.data.data;
    },
    staleTime: 300_000,
    retry: false,
  });
  const weeklyInsightsGated = (weeklyInsightsError as any)?.response?.status === 403;

  useEffect(() => {
    if (!data?.streaks) return;
    const streak = Math.max(data.streaks.workouts ?? 0, data.streaks.meals ?? 0);
    const milestones = [30, 14, 7, 3];
    const hit = milestones.find((m) => streak === m);
    if (!hit) return;
    const key = `celebrated_streak_${hit}`;
    AsyncStorage.getItem(key).then((done) => {
      if (!done) {
        setCelebrationMilestone(hit);
        AsyncStorage.setItem(key, "1");
      }
    });
  }, [data?.streaks?.workouts, data?.streaks?.meals]);

  if (isLoading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={s.loader}>
        <Text style={s.errorText}>⚠️ {t("common.error")}</Text>
        <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
          <Text style={s.retryBtnText}>{t("common.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const daily = data?.charts?.daily ?? [];

  return (
    <>
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={T.accent} />
      }
    >
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.greet}>
            {new Date().getHours() < 12
              ? t("dashboard.greeting_morning")
              : new Date().getHours() < 17
              ? t("dashboard.greeting_afternoon")
              : t("dashboard.greeting_evening")}
          </Text>
          <Text style={s.name}>{profile?.name ?? t("dashboard.default_name")}</Text>
        </View>
        {data?.subscription.plan === "premium" && (
          <View style={s.premiumBadge}>
            <Text style={s.premiumBadgeText}>{t("dashboard.premium_badge")}</Text>
          </View>
        )}
      </View>

      {/* ── Today's Macro Progress ── */}
      {targets && (() => {
        const todayData = data?.charts?.daily?.slice(-1)[0];
        const cal = todayData?.calories ?? 0;
        const pro = todayData?.protein ?? 0;
        const calTarget = targets.dailyCaloricTarget;
        const proTarget = targets.proteinTarget;
        const calPct = Math.min((cal / calTarget) * 100, 100);
        const proPct = Math.min((pro / proTarget) * 100, 100);
        return (
          <View style={s.macroCard}>
            <Text style={s.macroCardTitle}>{t("dashboard.today")}</Text>
            {[
              { label: t("dashboard.calories"), current: cal, target: calTarget, pct: calPct, color: T.accent, unit: t("nutrition.kcal_suffix") },
              { label: t("dashboard.protein"), current: pro, target: proTarget, pct: proPct, color: T.teal, unit: "g" },
            ].map((m) => (
              <View key={m.label} style={s.macroRow}>
                <View style={s.macroRowHeader}>
                  <Text style={s.macroRowLabel}>{m.label}</Text>
                  <Text style={[s.macroRowValue, { color: m.color }]}>
                    {Math.round(m.current)}<Text style={s.macroRowTarget}> / {m.target}{m.unit}</Text>
                  </Text>
                </View>
                <View style={s.macroTrack}>
                  <View style={[s.macroFill, { width: `${m.pct}%` as any, backgroundColor: m.color }]} />
                </View>
              </View>
            ))}
            {(() => {
              const remaining = calTarget - cal;
              const isOver = remaining < 0;
              return (
                <View style={s.macroDeficitRow}>
                  <Text style={[s.macroDeficitText, { color: isOver ? T.red : T.accentMuted }]}>
                    {isOver
                      ? t("dashboard.kcal_over", { n: Math.round(Math.abs(remaining)) })
                      : t("dashboard.kcal_remaining", { n: Math.round(remaining) })}
                  </Text>
                  {!isOver && cal > 0 && (
                    <Text style={s.macroDeficitPct}>{t("dashboard.pct_of_goal", { pct: Math.round(calPct) })}</Text>
                  )}
                </View>
              );
            })()}
          </View>
        );
      })()}

      {/* ── This Week Stats ── */}
      <View style={s.statsGrid}>
        {[
          {
            label: t("dashboard.calories"),
            value: data?.thisWeek.avgDailyCalories
              ? `${data.thisWeek.avgDailyCalories}`
              : "—",
            unit: t("dashboard.kcal_day"),
            color: T.accent,
          },
          {
            label: t("dashboard.protein"),
            value: data?.thisWeek.avgDailyProtein
              ? `${data.thisWeek.avgDailyProtein}`
              : "—",
            unit: t("dashboard.g_day"),
            color: T.teal,
          },
          {
            label: t("dashboard.workouts"),
            value: String(data?.thisWeek.workoutsCompleted ?? 0),
            unit: t("dashboard.this_week"),
            color: T.blue,
          },
          {
            label: t("dashboard.meals"),
            value: String(data?.thisWeek.mealsLogged ?? 0),
            unit: t("dashboard.logged"),
            color: T.green,
          },
        ].map((stat) => (
          <View key={stat.label} style={s.statCard}>
            <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={s.statUnit}>{stat.unit}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Streak Banner ── */}
      {(() => {
        const ws = data?.streaks?.workouts ?? 0;
        const ms = data?.streaks?.meals ?? 0;
        const best = Math.max(ws, ms);
        if (best === 0) return (
          <View style={s.streakEmpty}>
            <Text style={s.streakEmptyTitle}>{t("streak.start")}</Text>
            <Text style={s.streakEmptySub}>{t("streak.start_sub")}</Text>
          </View>
        );
        return (
          <View style={s.streakCard}>
            <View style={s.streakLeft}>
              <Text style={s.streakNumber}>{best}</Text>
              <Text style={s.streakDayLabel}>{t("dashboard.streak_days", { count: best })}</Text>
            </View>
            <View style={s.streakDivider} />
            <View style={s.streakRight}>
              <View style={s.streakRow}>
                <Text style={s.streakDot}>💪</Text>
                <Text style={s.streakStat}>{t("streak.workouts")}</Text>
                <Text style={[s.streakVal, ws > 0 ? s.streakValActive : s.streakValZero]}>{ws}d</Text>
              </View>
              <View style={s.streakRow}>
                <Text style={s.streakDot}>🍽️</Text>
                <Text style={s.streakStat}>{t("streak.meals")}</Text>
                <Text style={[s.streakVal, ms > 0 ? s.streakValActive : s.streakValZero]}>{ms}d</Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* ── Getting Started ── */}
      {!onboardingDismissed && data && (() => {
        const tasks = [
          { label: t("dashboard.task_first_meal"),  emoji: "🍽", screen: "FoodScanner", done: (data.thisWeek.mealsLogged    ?? 0) > 0 },
          { label: t("dashboard.task_workout"),     emoji: "💪", screen: "Workouts",    done: (data.thisWeek.workoutsCompleted ?? 0) > 0 },
          { label: t("dashboard.task_weight"),      emoji: "⚖️", screen: "Settings",    done: !!data.currentWeight },
          { label: t("dashboard.task_body_scan"),   emoji: "📸", screen: "BodyScan",    done: !!data.lastAssessmentDate },
        ];
        const completedCount = tasks.filter((task) => task.done).length;
        if (completedCount === tasks.length) return null;
        const pct = Math.round((completedCount / tasks.length) * 100);
        return (
          <View style={s.onboardCard}>
            <View style={s.onboardHeader}>
              <Text style={s.onboardTitle}>{t("dashboard.getting_started")}</Text>
              <View style={s.onboardBadge}>
                <Text style={s.onboardBadgeText}>{completedCount}/{tasks.length}</Text>
              </View>
              <TouchableOpacity onPress={dismissOnboarding} style={s.onboardClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t("common.dismiss")} accessibilityRole="button">
                <Text style={s.onboardCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={s.onboardTrack}>
              <View style={[s.onboardFill, { width: `${pct}%` as any }]} />
            </View>
            {tasks.map((task, i) => (
              <TouchableOpacity
                key={i}
                style={[s.onboardTask, i < tasks.length - 1 && s.onboardTaskBorder]}
                onPress={() => !task.done && navigation.navigate(task.screen)}
                activeOpacity={task.done ? 1 : 0.7}
              >
                <View style={[s.onboardCheck, task.done && s.onboardCheckDone]}>
                  {task.done && <Text style={s.onboardCheckMark}>✓</Text>}
                </View>
                <Text style={s.onboardTaskEmoji}>{task.emoji}</Text>
                <Text style={[s.onboardTaskLabel, task.done && s.onboardTaskLabelDone]}>{task.label}</Text>
                {!task.done && <Text style={s.onboardArrow}>›</Text>}
              </TouchableOpacity>
            ))}
          </View>
        );
      })()}

      {/* ── Today's Workout ── */}
      {activeProgram && todayWorkout && (() => {
        const program = activeProgram;
        const currentWeek = program.weeks[todayWorkout.weekIndex];
        const todayDay = currentWeek?.days?.find((d) => d.dayOfWeek === todayWorkout.todayIndex);
        if (!todayDay || todayDay.exercises.length === 0) return (
          <View style={s.todayCard}>
            <Text style={s.todayTitle}>{t("dashboard.rest_day")}</Text>
            <Text style={s.todaySub}>{t("dashboard.rest_day_sub")}</Text>
          </View>
        );
        const preview = todayDay.exercises.slice(0, 3);
        const extra = todayDay.exercises.length - preview.length;
        return (
          <TouchableOpacity style={s.todayCard} onPress={() => navigation.navigate("Workouts")} activeOpacity={0.85}>
            <View style={s.todayHeader}>
              <Text style={s.todayTitle}>{t("dashboard.today_workout")}</Text>
              <Text style={s.todayBadge}>{t("dashboard.exercises_count", { count: todayDay.exercises.length })}</Text>
            </View>
            {preview.map((ex, i) => (
              <Text key={i} style={s.todayEx}>· {ex.exerciseName} — {ex.sets}×{ex.reps}</Text>
            ))}
            {extra > 0 && <Text style={s.todayMore}>{t("dashboard.exercises_more", { count: extra })}</Text>}
            <View style={s.todayBtn}><Text style={s.todayBtnText}>{t("dashboard.start_workout")}</Text></View>
          </TouchableOpacity>
        );
      })()}

      {/* ── Water Intake ── */}
      <View style={s.waterCard}>
        <View style={s.waterHeader}>
          <Text style={s.waterTitle}>💧 {t("dashboard.water")}</Text>
          <Text style={s.waterCount}>{waterGlasses} / {WATER_GOAL}</Text>
        </View>
        <View style={s.waterGlasses}>
          {Array.from({ length: WATER_GOAL }).map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setWater(i < waterGlasses ? i : i + 1)} style={s.waterGlass} accessibilityLabel={t("dashboard.water_glass_label", { n: i + 1 })} accessibilityRole="button">
              <Text style={{ fontSize: 22, opacity: i < waterGlasses ? 1 : 0.2 }}>💧</Text>
            </TouchableOpacity>
          ))}
        </View>
        {waterGlasses >= WATER_GOAL && (
          <Text style={s.waterComplete}>{t("dashboard.water_goal_reached")}</Text>
        )}
      </View>

      {/* ── Weight / Physique Row ── */}
      {(data?.currentWeight || data?.physiqueNote) && (
        <View style={s.bodyRow}>
          {data?.currentWeight ? (
            <View style={s.bodyCard}>
              <Text style={s.bodyCardLabel}>{t("dashboard.current_weight")}</Text>
              <Text style={s.bodyCardValue}>
                {formatWeight(data.currentWeight, profile?.unitSystem)}
              </Text>
            </View>
          ) : null}
          {data?.physiqueNote ? (
            <View style={[s.bodyCard, { flex: 2 }]}>
              <Text style={s.bodyCardLabel}>{t("dashboard.physique_note")}</Text>
              <Text style={s.bodyCardValue} numberOfLines={2}>
                {data.physiqueNote}
              </Text>
              {data.lastAssessmentDate && (
                <Text style={s.bodyCardSub}>
                  {new Date(data.lastAssessmentDate).toLocaleDateString(i18n.language, {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              )}
            </View>
          ) : null}
        </View>
      )}

      {/* ── Weight nudge ── */}
      {!data?.currentWeight && (
        <TouchableOpacity
          style={s.nudgeCard}
          onPress={() => navigation.navigate("Settings")}
          activeOpacity={0.85}
        >
          <Text style={s.nudgeIcon}>⚖️</Text>
          <View style={s.nudgeBody}>
            <Text style={s.nudgeTitle}>{t("dashboard.nudge_weight")}</Text>
            <Text style={s.nudgeSub}>{t("dashboard.nudge_weight_sub")}</Text>
          </View>
          <Text style={s.nudgeArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* ── Body scan nudge ── */}
      {(() => {
        const last = data?.lastAssessmentDate;
        if (!isAssessmentStale) return null;
        return (
          <TouchableOpacity
            style={s.nudgeCard}
            onPress={() => navigation.navigate("BodyScan")}
            activeOpacity={0.85}
          >
            <Text style={s.nudgeIcon}>📸</Text>
            <View style={s.nudgeBody}>
              <Text style={s.nudgeTitle}>{last ? t("dashboard.nudge_scan_update") : t("dashboard.task_body_scan")}</Text>
              <Text style={s.nudgeSub}>{last ? t("dashboard.nudge_scan_update_sub") : t("dashboard.nudge_scan_first_sub")}</Text>
            </View>
            <Text style={s.nudgeArrow}>›</Text>
          </TouchableOpacity>
        );
      })()}

      {/* ── Charts ── */}
      {daily.some((d) => d.calories > 0) && (
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <Text style={s.chartTitle}>{t("dashboard.calories")}</Text>
            <Text style={s.chartSub}>{t("dashboard.last_7_days")}</Text>
          </View>
          <MiniBarChart data={daily} valueKey="calories" color={T.accent} />
          <View style={s.chartLabels}>
            {daily.map((d, i) => (
              <Text key={i} style={s.chartLabel}>
                {new Date(d.date).toLocaleDateString(i18n.language, { weekday: "narrow" })}
              </Text>
            ))}
          </View>
        </View>
      )}

      {daily.some((d) => d.protein > 0) && (
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <Text style={s.chartTitle}>{t("dashboard.protein")}</Text>
            <Text style={s.chartSub}>{t("dashboard.last_7_days_g")}</Text>
          </View>
          <MiniBarChart data={daily} valueKey="protein" color={T.teal} />
          <View style={s.chartLabels}>
            {daily.map((d, i) => (
              <Text key={i} style={s.chartLabel}>
                {new Date(d.date).toLocaleDateString(i18n.language, { weekday: "narrow" })}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* ── Weekly Insights ── */}
      {weeklyInsightsGated ? (
        <View style={s.insightCard}>
          <Text style={s.insightTitle}>{t("dashboard.insights_title")}</Text>
          <Text style={s.insightLockedSub}>{t("dashboard.insights_locked_sub")}</Text>
          <TouchableOpacity
            onPress={() => {
              posthog.capture(Events.INSIGHT_CARD_VIEWED, { locked: true });
              presentUpgrade();
            }}
            style={s.insightUpgradeBtn}
          >
            <Text style={s.insightUpgradeBtnText}>{t("common.upgrade")}</Text>
          </TouchableOpacity>
        </View>
      ) : weeklyInsights?.insights?.length ? (
        <View style={s.insightCard} onLayout={() => posthog.capture(Events.INSIGHT_CARD_VIEWED, { locked: false })}>
          <Text style={s.insightTitle}>{t("dashboard.insights_title")}</Text>
          {weeklyInsights.insights.map((insight, i) => (
            <Text key={i} style={s.insightLine}>
              {insight}
            </Text>
          ))}
        </View>
      ) : weeklyInsights && weeklyInsights.insights === null ? (
        <View style={s.insightCard}>
          <Text style={s.insightTitle}>{t("dashboard.insights_title")}</Text>
          <Text style={s.insightLockedSub}>{t("dashboard.insights_pending_sub")}</Text>
        </View>
      ) : null}

      {/* ── Quick Actions ── */}
      <Text style={s.sectionLabel}>{t("dashboard.quick_actions")}</Text>
      <View style={s.actionList}>
        {ACTION_KEYS.map((a) => (
          <TouchableOpacity
            key={a.labelKey}
            onPress={() => navigation.navigate(a.screen)}
            style={s.actionCard}
            activeOpacity={0.75}
          >
            <View style={s.actionIcon}>
              <Text style={s.actionEmoji}>{a.emoji}</Text>
            </View>
            <View style={s.actionText}>
              <Text style={s.actionLabel}>{t(a.labelKey)}</Text>
              <Text style={s.actionSub}>{t(a.subKey)}</Text>
            </View>
            <Text style={s.actionArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Daily Quote ── */}
      <View style={s.quoteCard}>
        <Text style={s.quoteIcon}>"</Text>
        <Text style={s.quoteText}>{dailyQuote?.text}</Text>
        {!!dailyQuote?.author && (
          <Text style={s.quoteAuthor}>— {dailyQuote.author}</Text>
        )}
      </View>

      {/* ── Upgrade Banner ── */}
      {data?.subscription.plan === "free" && (
        <TouchableOpacity
          onPress={() => navigation.navigate("Pricing")}
          style={s.upgradeBanner}
          activeOpacity={0.85}
        >
          <View style={s.upgradeLeft}>
            <Text style={s.upgradeTitle}>{t("dashboard.unlock_premium")}</Text>
            <Text style={s.upgradeSub}>{t("dashboard.unlock_sub")}</Text>
          </View>
          <Text style={s.upgradeArrow}>›</Text>
        </TouchableOpacity>
      )}
    </ScrollView>

    {/* ── Streak celebration modal ── */}
    <Modal visible={!!celebrationMilestone} transparent animationType="fade">
      <View style={s.celebBackdrop}>
        <View style={s.celebCard}>
          <Text style={s.celebEmoji}>
            {celebrationMilestone === 3 ? "🔥" : celebrationMilestone === 7 ? "⚡" : celebrationMilestone === 14 ? "💪" : "🏆"}
          </Text>
          <Text style={s.celebTitle}>{t("dashboard.streak_title", { n: celebrationMilestone })}</Text>
          <Text style={s.celebSub}>
            {celebrationMilestone === 3
              ? t("dashboard.streak_msg_3")
              : celebrationMilestone === 7
              ? t("dashboard.streak_msg_7")
              : celebrationMilestone === 14
              ? t("dashboard.streak_msg_14")
              : t("dashboard.streak_msg_30")}
          </Text>
          <TouchableOpacity style={s.celebBtn} onPress={() => setCelebrationMilestone(null)} activeOpacity={0.85}>
            <Text style={s.celebBtnText}>{t("dashboard.streak_cta")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48 },
  loader: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16, color: T.textSecondary, marginBottom: 16 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  greet: { fontSize: 13, color: T.textSecondary, marginBottom: 3 },
  name: { fontSize: 28, fontWeight: "800", color: T.textPrimary, letterSpacing: -0.5 },
  premiumBadge: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  premiumBadgeText: {
    color: T.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  // Streak
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    gap: 18,
  },
  streakLeft: { alignItems: "center", minWidth: 56 },
  streakNumber: { fontSize: 42, fontWeight: "900", color: T.accent, letterSpacing: -2, lineHeight: 46 },
  streakDayLabel: { fontSize: 9, fontWeight: "800", color: T.accentMuted, letterSpacing: 1.5, marginTop: 2 },
  streakDivider: { width: 1, height: 44, backgroundColor: T.accentBorder },
  streakRight: { flex: 1, gap: 10 },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  streakDot: { fontSize: 14 },
  streakStat: { flex: 1, fontSize: 13, color: T.accentMuted, fontWeight: "600" },
  streakVal: { fontSize: 13, fontWeight: "800" },
  streakValActive: { color: T.accent },
  streakValZero: { color: T.textMuted },
  streakEmpty: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    alignItems: "center",
  },
  streakEmptyTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary, marginBottom: 4 },
  streakEmptySub: { fontSize: 12, color: T.textSecondary, textAlign: "center" },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    width: (W - 50) / 2,
  },
  statValue: { fontSize: 32, fontWeight: "800", letterSpacing: -1, marginBottom: 2 },
  statUnit: { fontSize: 11, color: T.textSecondary, marginBottom: 2 },
  statLabel: {
    fontSize: 10,
    color: T.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Body Row
  bodyRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  bodyCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
  },
  bodyCardLabel: {
    fontSize: 10,
    color: T.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  bodyCardValue: { fontSize: 16, fontWeight: "700", color: T.textPrimary },
  bodyCardSub: { fontSize: 11, color: T.textSecondary, marginTop: 4 },
  nudgeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  nudgeIcon: { fontSize: 22 },
  nudgeBody: { flex: 1 },
  nudgeTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary, marginBottom: 2 },
  nudgeSub: { fontSize: 12, color: T.textSecondary },
  nudgeArrow: { fontSize: 22, color: T.textMuted },

  // Charts
  chartCard: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    padding: 18,
    marginBottom: 10,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 16,
  },
  chartTitle: { fontSize: 15, fontWeight: "700", color: T.textPrimary },
  chartSub: { fontSize: 11, color: T.textSecondary },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 56,
    gap: 4,
  },
  barWrapper: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: 56 },
  bar: { borderRadius: 4 },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  chartLabel: { fontSize: 10, color: T.textMuted, flex: 1, textAlign: "center" },

  // Weekly Insights
  insightCard: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    padding: 18,
    marginBottom: 10,
  },
  insightTitle: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 10 },
  insightLine: { fontSize: 13, color: T.textPrimary, lineHeight: 19, marginBottom: 8 },
  insightLockedSub: { fontSize: 13, color: T.textSecondary, marginBottom: 14 },
  insightUpgradeBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  insightUpgradeBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Quick Actions
  sectionLabel: {
    fontSize: 10,
    color: T.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 20,
    marginBottom: 12,
  },
  actionList: { gap: 8, marginBottom: 14 },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    gap: 14,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: T.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  actionEmoji: { fontSize: 20 },
  actionText: { flex: 1 },
  actionLabel: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 2 },
  actionSub: { fontSize: 12, color: T.textSecondary },
  actionArrow: { fontSize: 22, color: T.textMuted, fontWeight: "300" },

  // Upgrade
  quoteCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginBottom: 14,
  },
  quoteIcon: { fontSize: 32, color: T.accentMuted, lineHeight: 30, marginBottom: 4 },
  quoteText: { fontSize: 14, color: T.textSecondary, lineHeight: 22, fontStyle: "italic" },
  quoteAuthor: { fontSize: 12, color: T.textMuted, marginTop: 10, fontWeight: "600" },

  upgradeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 18,
    padding: 20,
    gap: 14,
  },
  upgradeLeft: { flex: 1 },
  upgradeTitle: { fontSize: 16, fontWeight: "800", color: T.accent, marginBottom: 4 },
  upgradeSub: { fontSize: 12, color: T.accentMuted, lineHeight: 17 },
  upgradeArrow: { fontSize: 24, color: T.accent, fontWeight: "300" },

  // Today's macros
  macroCard: { backgroundColor: T.surface, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16, marginBottom: 14 },
  macroCardTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary, marginBottom: 12 },
  macroRow: { marginBottom: 12 },
  macroRowHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  macroRowLabel: { fontSize: 12, color: T.textSecondary, fontWeight: "600" },
  macroRowValue: { fontSize: 12, fontWeight: "700" },
  macroRowTarget: { fontWeight: "400", color: T.textMuted },
  macroTrack: { height: 6, backgroundColor: T.surface2, borderRadius: 3, overflow: "hidden" },
  macroFill: { height: "100%", borderRadius: 3 },
  macroDeficitRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  macroDeficitText: { fontSize: 12, fontWeight: "700" },
  macroDeficitPct: { fontSize: 12, color: T.textMuted },

  // Today's workout card
  todayCard: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    marginBottom: 14,
  },
  todayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  todayTitle: { fontSize: 15, fontWeight: "800", color: T.textPrimary },
  todayBadge: {
    fontSize: 11, fontWeight: "700", color: T.accent,
    backgroundColor: T.accentDark, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  todaySub: { fontSize: 13, color: T.textSecondary },
  todayEx: { fontSize: 13, color: T.textSecondary, marginBottom: 3 },
  todayMore: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  todayBtn: {
    marginTop: 12,
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  todayBtnText: { color: T.accent, fontWeight: "700", fontSize: 14 },

  // Water intake
  waterCard: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    marginBottom: 14,
  },
  waterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  waterTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary },
  waterCount: { fontSize: 13, fontWeight: "600", color: T.textSecondary },
  waterGlasses: { flexDirection: "row", justifyContent: "space-between" },
  waterGlass: { padding: 4 },
  waterComplete: { fontSize: 12, color: T.accent, textAlign: "center", marginTop: 10, fontWeight: "600" },

  // Getting Started checklist
  onboardCard: {
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 18,
    marginBottom: 14,
  },
  onboardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  onboardTitle: { fontSize: 14, fontWeight: "800", color: T.textPrimary, flex: 1 },
  onboardBadge: {
    backgroundColor: T.accentDark, borderWidth: 1, borderColor: T.accentBorder,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginRight: 10,
  },
  onboardBadgeText: { fontSize: 11, fontWeight: "700", color: T.accent },
  onboardClose: { padding: 2 },
  onboardCloseText: { fontSize: 22, color: T.textMuted, lineHeight: 22 },
  onboardTrack: {
    height: 4, backgroundColor: T.surface2, borderRadius: 2, overflow: "hidden", marginBottom: 14,
  },
  onboardFill: { height: "100%", backgroundColor: T.accent, borderRadius: 2 },
  onboardTask: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  onboardTaskBorder: { borderBottomWidth: 1, borderBottomColor: T.border },
  onboardCheck: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  onboardCheckDone: { backgroundColor: T.accent, borderColor: T.accent },
  onboardCheckMark: { fontSize: 11, fontWeight: "900", color: "#000" },
  onboardTaskEmoji: { fontSize: 16 },
  onboardTaskLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: T.textPrimary },
  onboardTaskLabelDone: { color: T.textMuted, textDecorationLine: "line-through" },
  onboardArrow: { fontSize: 20, color: T.textMuted },

  // Streak celebration
  celebBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  celebCard: {
    width: "100%",
    backgroundColor: T.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: T.accentBorder,
    padding: 32,
    alignItems: "center",
  },
  celebEmoji: { fontSize: 64, marginBottom: 16 },
  celebTitle: { fontSize: 30, fontWeight: "800", color: T.textPrimary, marginBottom: 12, letterSpacing: -0.5 },
  celebSub: { fontSize: 15, color: T.textSecondary, textAlign: "center", lineHeight: 24, marginBottom: 28 },
  celebBtn: {
    width: "100%",
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  celebBtnText: { color: "#000", fontSize: 17, fontWeight: "800" },
});
