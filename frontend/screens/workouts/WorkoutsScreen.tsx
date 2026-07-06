import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useUpgradeGate, isPremiumRequiredError } from "@/contexts/UpgradeGateContext";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import * as StoreReview from "expo-store-review";
import { T } from "@/lib/theme";
import { posthog, Events } from "@/lib/analytics";
const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface Exercise {
  id: string;
  exerciseName: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
}

interface WorkoutDay {
  dayOfWeek: number;
  exercises: Exercise[];
}

interface WorkoutWeek {
  weekNumber: number;
  progressionStrategy?: string;
  days: WorkoutDay[];
}

interface WorkoutProgram {
  id: string;
  name: string;
  duration: number;
  goal: string;
  isActive: boolean;
  startDate: string;
  coachNote?: string | null;
  weeks: WorkoutWeek[];
}

interface SessionRecord {
  exerciseName: string;
  weight: number | null;
}

interface HistoryData {
  activeProgram: WorkoutProgram | null;
  recentSessions: SessionRecord[];
  stats: { completedThisWeek: number; totalSessions: number; currentStreak: number };
}

const EQUIPMENT_OPTIONS = ["Barbell", "Dumbbells", "Cables", "Machines", "Bodyweight", "Kettlebells"];

const BODY_GOAL_OPTIONS: Record<string, string[]> = {
  female: [
    "Lean & toned",
    "Curvier, glute-focused build",
    "Smaller, more petite frame",
    "Strong & athletic build",
    "General health & fitness",
  ],
  male: [
    "Build a bigger upper body (chest, arms, shoulders)",
    "Build a wider back & shoulders",
    "Build stronger, more developed legs",
    "Lose fat & get leaner overall",
    "Build overall strength & muscle",
  ],
  default: [
    "Lean & toned",
    "Build muscle in a specific area",
    "Lose fat & get leaner overall",
    "Strong & athletic build",
    "General health & fitness",
  ],
};

export default function WorkoutsScreen() {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const { presentUpgrade } = useUpgradeGate();
  // Locale-aware short day names: 2024-01-01 is Monday
  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(i18n.language, { weekday: "short" })
  );
  const EQUIPMENT_LABELS: Record<string, string> = {
    Barbell: t("workouts.equipment_barbell"), Dumbbells: t("workouts.equipment_dumbbells"),
    Cables: t("workouts.equipment_cables"), Machines: t("workouts.equipment_machines"),
    Bodyweight: t("workouts.equipment_bodyweight"), Kettlebells: t("workouts.equipment_kettlebells"),
  };
  const BODY_GOAL_LABELS: Record<string, string> = {
    "Lean & toned": t("workouts.goal_lean_toned"),
    "Curvier, glute-focused build": t("workouts.goal_curvy_glute"),
    "Smaller, more petite frame": t("workouts.goal_petite"),
    "Strong & athletic build": t("workouts.goal_strong_athletic"),
    "General health & fitness": t("workouts.goal_general_health"),
    "Build a bigger upper body (chest, arms, shoulders)": t("workouts.goal_upper_body"),
    "Build a wider back & shoulders": t("workouts.goal_back_shoulders"),
    "Build stronger, more developed legs": t("workouts.goal_legs"),
    "Lose fat & get leaner overall": t("workouts.goal_lose_fat"),
    "Build overall strength & muscle": t("workouts.goal_overall_strength"),
    "Build muscle in a specific area": t("workouts.goal_specific_area"),
  };
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const [logModal, setLogModal] = useState<Exercise | null>(null);
  const [logForm, setLogForm] = useState({ completedSets: "", completedReps: "", weight: "" });
  const [generateModal, setGenerateModal] = useState(false);
  const [loggedExIds, setLoggedExIds] = useState<string[]>([]);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [sessionVolume, setSessionVolume] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [restExerciseName, setRestExerciseName] = useState("");
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const logFieldKeys = ["completedSets", "completedReps", "weight"] as const;
  const logInputRefs = useRef<Partial<Record<typeof logFieldKeys[number], TextInput | null>>>({});

  useEffect(() => {
    if (restSecondsLeft === null) return;
    if (restSecondsLeft === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRestSecondsLeft(null);
      return;
    }
    timerRef.current = setInterval(() => {
      setRestSecondsLeft((s) => (s !== null && s > 0 ? s - 1 : null));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [restSecondsLeft]);
  const [genForm, setGenForm] = useState({
    daysPerWeek: "4",
    equipment: ["Barbell", "Dumbbells"],
    bodyGoalFocus: "",
    specificFocus: "",
  });
  const { data, isLoading, refetch, isRefetching } = useQuery<HistoryData>({
    queryKey: ["workouts"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/workouts/history`);
      return res.data.data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data.data;
    },
    staleTime: 300_000,
  });

  const goalOptions = BODY_GOAL_OPTIONS[profile?.sex] ?? BODY_GOAL_OPTIONS.default;

  useEffect(() => {
    const program = data?.activeProgram;
    if (!program) return;
    const msSinceStart = Date.now() - new Date(program.startDate).getTime();
    const weekIdx = Math.min(Math.max(0, Math.floor(msSinceStart / (7 * 24 * 60 * 60 * 1000))), program.weeks.length - 1);
    setSelectedWeek(weekIdx);
    const todayIdx = (new Date().getDay() + 6) % 7;
    const dayIdx = program.weeks[weekIdx]?.days?.findIndex((d) => d.dayOfWeek === todayIdx) ?? -1;
    if (dayIdx >= 0) setSelectedDay(dayIdx);
  }, [data?.activeProgram?.id]);

  useEffect(() => {
    setLoggedExIds([]);
    setSessionVolume(0);
  }, [selectedWeek, selectedDay]);

  const { mutate: generateProgram, isPending: isGenerating } = useMutation({
    mutationFn: async () => {
      const res = await axios.post(`${API_URL}/api/workouts/generate`, {
        equipment: genForm.equipment,
        daysPerWeek: Number(genForm.daysPerWeek),
        durationWeeks: 4,
        bodyGoalFocus: genForm.bodyGoalFocus || undefined,
        specificFocus: genForm.specificFocus.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      posthog.capture(Events.WORKOUT_GENERATED, { daysPerWeek: genForm.daysPerWeek, equipment: genForm.equipment });
      setGenerateModal(false);
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      Alert.alert(t("workouts.program_ready"), t("workouts.program_ready_msg"));
    },
    onError: (err: any) => {
      if (isPremiumRequiredError(err)) {
        setGenerateModal(false);
        setTimeout(() => presentUpgrade(), 350);
        return;
      }
      Alert.alert(t("common.error"), err.response?.data?.message || t("workouts.error_generate"));
    },
  });

  const { mutate: logSession, isPending: isLogging } = useMutation({
    mutationFn: async (exercise: Exercise) => {
      await axios.post(`${API_URL}/api/workouts/log-session`, {
        exerciseName: exercise.exerciseName,
        plannedSets: exercise.sets,
        plannedReps: exercise.reps,
        completedSets: logForm.completedSets || exercise.sets,
        completedReps: logForm.completedReps || exercise.reps,
        weight: logForm.weight ? Number(logForm.weight) : null,
      });
    },
    onSuccess: (_, exercise) => {
      posthog.capture(Events.WORKOUT_SESSION_COMPLETED, { exerciseName: exercise.exerciseName });
      const secs = exercise.restSeconds ?? 0;
      const newWeight = logForm.weight ? Number(logForm.weight) : 0;
      const sets = Number(logForm.completedSets || exercise.sets);

      // PR detection — compare to previous sessions before resetting cache
      if (newWeight > 0) {
        const prevMax = Math.max(0, ...(data?.recentSessions
          ?.filter((s) => s.exerciseName === exercise.exerciseName && s.weight != null)
          .map((s) => s.weight as number) ?? []));
        if (newWeight > prevMax) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => Alert.alert(t("workouts.pr_title"), t("workouts.pr_msg", { exercise: exercise.exerciseName, weight: newWeight })), 400);
        }
      }

      // Completion tracking
      const newLoggedIds = [...loggedExIds, exercise.id];
      const newVolume = sessionVolume + newWeight * sets;
      setLoggedExIds(newLoggedIds);
      setSessionVolume(newVolume);

      const dayExercises = data?.activeProgram?.weeks[selectedWeek]?.days[selectedDay]?.exercises ?? [];
      if (dayExercises.length > 0 && newLoggedIds.length >= dayExercises.length) {
        setTimeout(() => setShowCompleteModal(true), 600);
      }

      setLogModal(null);
      setLogForm({ completedSets: "", completedReps: "", weight: "" });
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (secs > 0) {
        setRestExerciseName(exercise.exerciseName);
        setRestSecondsLeft(secs);
      }
      StoreReview.isAvailableAsync().then((ok) => {
        if (ok && (data?.stats?.totalSessions ?? 0) >= 2) StoreReview.requestReview();
      }).catch(() => {});
    },
    onError: () => Alert.alert(t("common.error"), t("workouts.error_log")),
  });

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  const program = data?.activeProgram;
  const stats = data?.stats;
  const currentWeek = program?.weeks?.[selectedWeek];
  const currentDay = currentWeek?.days?.[selectedDay];

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.accent} />
      }
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t("workouts.title")}</Text>
          <Text style={styles.subtitle}>{t("workouts.subtitle")}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: t("workouts.this_week"), value: String(stats?.completedThisWeek ?? 0), color: T.accent },
            { label: t("workouts.all_time"), value: String(stats?.totalSessions ?? 0), color: T.blue },
            { label: t("workouts.streak"), value: `${stats?.currentStreak ?? 0}d`, color: T.teal },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={() => setGenerateModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.generateBtnText}>
            {program ? t("workouts.regenerate") : t("workouts.generate")}
          </Text>
        </TouchableOpacity>

        {!program ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>{t("workouts.empty_title")}</Text>
            <Text style={styles.emptySub}>{t("workouts.empty_sub")}</Text>
            <View style={styles.emptyFeatures}>
              {(t("workouts.empty_features", { returnObjects: true }) as { icon: string; text: string }[]).map((f, i) => (
                <View key={i} style={styles.emptyFeatureRow}>
                  <Text style={styles.emptyFeatureIcon}>{f.icon}</Text>
                  <Text style={styles.emptyFeatureText}>{f.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            {/* Program Card */}
            <View style={styles.programCard}>
              <Text style={styles.programName}>{program.name}</Text>
              <Text style={styles.programMeta}>
                {program.duration}{t("workouts.week_suffix")} · {t("workouts.started")}{" "}
                {new Date(program.startDate).toLocaleDateString(i18n.language, {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>

            {program.coachNote && (
              <View style={styles.coachNoteCard}>
                <Text style={styles.coachNoteLabel}>{t("workouts.coach_label")}</Text>
                <Text style={styles.coachNoteText}>{program.coachNote}</Text>
              </View>
            )}

            {/* Week Selector */}
            <Text style={styles.pickerLabel}>{t("workouts.week_label")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
              <View style={styles.pickerRow}>
                {program.weeks.map((week, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedWeek(i); setSelectedDay(0); }}
                    style={[styles.pickerChip, selectedWeek === i && styles.pickerChipActive]}
                  >
                    <Text style={[styles.pickerChipText, selectedWeek === i && styles.pickerChipTextActive]}>
                      {t("workouts.complete_week", { n: week.weekNumber })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {currentWeek?.progressionStrategy && (
              <Text style={styles.progressionNote}>{currentWeek.progressionStrategy}</Text>
            )}

            {/* Day Selector */}
            {currentWeek && currentWeek.days.length > 0 && (
              <>
                <Text style={styles.pickerLabel}>{t("workouts.day_label")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  <View style={styles.pickerRow}>
                    {currentWeek.days.map((day, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedDay(i); }}
                        style={[styles.pickerChip, selectedDay === i && styles.pickerChipActive]}
                      >
                        <Text style={[styles.pickerChipText, selectedDay === i && styles.pickerChipTextActive]}>
                          {DAYS[day.dayOfWeek] ?? t("workouts.day_n", { n: i + 1 })}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Exercises */}
            {currentDay?.exercises.length ? (
              <View style={styles.exerciseList}>
                <View style={styles.exercisesHeaderRow}>
                  <Text style={styles.exercisesHeader}>
                    {t("workouts.exercises_header", { count: currentDay.exercises.length })}
                  </Text>
                  {loggedExIds.length > 0 && (
                    <Text style={styles.exercisesProgress}>
                      {t("workouts.progress_done", { done: loggedExIds.length, total: currentDay.exercises.length })}
                    </Text>
                  )}
                </View>
                {loggedExIds.length > 0 && (
                  <View style={styles.sessionProgressTrack}>
                    <View style={[styles.sessionProgressFill, { width: `${(loggedExIds.length / currentDay.exercises.length) * 100}%` as any }]} />
                  </View>
                )}
                {currentDay.exercises.map((ex, i) => {
                  const done = loggedExIds.includes(ex.id);
                  return (
                    <View key={ex.id ?? i} style={[styles.exerciseCard, done && styles.exerciseCardDone]}>
                      <View style={[styles.exerciseNumber, done && styles.exerciseNumberDone]}>
                        {done
                          ? <Text style={styles.exerciseCheckmark}>✓</Text>
                          : <Text style={styles.exerciseNumberText}>{i + 1}</Text>
                        }
                      </View>
                      <View style={styles.exerciseBody}>
                        <Text style={[styles.exerciseName, done && styles.exerciseNameDone]}>{ex.exerciseName}</Text>
                        <Text style={styles.exerciseMeta}>
                          {t("workouts.exercise_meta", { sets: ex.sets, reps: ex.reps, rest: ex.restSeconds })}
                        </Text>
                        {ex.notes ? (
                          <Text style={styles.exerciseNotes}>{ex.notes}</Text>
                        ) : null}
                        <View style={styles.exerciseActions}>
                          {done ? (
                            <View style={styles.doneTag}>
                              <Text style={styles.doneTagText}>{t("workouts.exercise_logged")}</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.logBtnPrimary}
                              onPress={() => setLogModal(ex)}
                            >
                              <Text style={styles.logBtnPrimaryText}>{t("workouts.log_set")}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.restDay}>
                <Text style={styles.restDayIcon}>😴</Text>
                <Text style={styles.restDayText}>{t("workouts.rest_day")}</Text>
                <Text style={styles.restDaySub}>{t("workouts.rest_day_sub")}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Workout Complete Modal ── */}
      <Modal visible={showCompleteModal} transparent animationType="fade">
        <View style={styles.completeBackdrop}>
          <View style={styles.completeCard}>
            <Text style={styles.completeTrophy}>🎉</Text>
            <Text style={styles.completeTitle}>{t("workouts.complete_title")}</Text>
            <Text style={styles.completeSub}>
              {data?.activeProgram?.name ?? t("workouts.complete_session_fallback")} · {t("workouts.complete_week", { n: selectedWeek + 1 })}
            </Text>
            <View style={styles.completeStats}>
              <View style={styles.completeStat}>
                <Text style={styles.completeStatValue}>{loggedExIds.length}</Text>
                <Text style={styles.completeStatLabel}>{t("workouts.complete_stat_exercises")}</Text>
              </View>
              <View style={styles.completeStatDivider} />
              <View style={styles.completeStat}>
                <Text style={styles.completeStatValue}>{data?.stats?.currentStreak ?? 0 + 1}</Text>
                <Text style={styles.completeStatLabel}>{t("workouts.complete_stat_streak")}</Text>
              </View>
              {sessionVolume > 0 && (
                <>
                  <View style={styles.completeStatDivider} />
                  <View style={styles.completeStat}>
                    <Text style={styles.completeStatValue}>{Math.round(sessionVolume)}</Text>
                    <Text style={styles.completeStatLabel}>{t("workouts.complete_stat_volume")}</Text>
                  </View>
                </>
              )}
            </View>
            <TouchableOpacity
              style={styles.completeDoneBtn}
              onPress={() => { setShowCompleteModal(false); setLoggedExIds([]); setSessionVolume(0); }}
              activeOpacity={0.85}
            >
              <Text style={styles.completeDoneBtnText}>{t("workouts.finish")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Log Session Modal ── */}
      <Modal visible={!!logModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{logModal?.exerciseName}</Text>
            <Text style={styles.modalSub}>
              {t("workouts.target", { sets: logModal?.sets, reps: logModal?.reps })}
            </Text>

            {(() => {
              if (!logModal || !data?.recentSessions) return null;
              const prevMax = Math.max(0, ...(data.recentSessions
                .filter((s) => s.exerciseName === logModal.exerciseName && s.weight != null)
                .map((s) => s.weight as number)));
              if (prevMax <= 0) return null;
              return <Text style={styles.prevBest}>{t("workouts.prev_best", { weight: prevMax })}</Text>;
            })()}

            {[
              { label: t("workouts.sets_completed"), key: "completedSets", placeholder: String(logModal?.sets ?? "") },
              { label: t("workouts.reps_completed"), key: "completedReps", placeholder: logModal?.reps ?? "" },
              { label: t("workouts.weight_optional"), key: "weight", placeholder: t("workouts.weight_placeholder") },
            ].map((field, i) => (
              <View key={field.key} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{field.label}</Text>
                <TextInput
                  ref={(el) => { logInputRefs.current[field.key as typeof logFieldKeys[number]] = el; }}
                  style={styles.input}
                  placeholder={field.placeholder}
                  placeholderTextColor={T.textMuted}
                  keyboardType="decimal-pad"
                  value={(logForm as any)[field.key]}
                  onChangeText={(v) => setLogForm((f) => ({ ...f, [field.key]: v }))}
                  returnKeyType={i < 2 ? "next" : "done"}
                  onSubmitEditing={() => {
                    if (i < 2) {
                      logInputRefs.current[logFieldKeys[i + 1]]?.focus();
                    } else if (logModal) {
                      logSession(logModal);
                    }
                  }}
                />
              </View>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setLogModal(null);
                  setLogForm({ completedSets: "", completedReps: "", weight: "" });
                }}
              >
                <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => logModal && logSession(logModal)}
                disabled={isLogging}
              >
                {isLogging ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveBtnText}>{t("common.save")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Rest Timer Modal ── */}
      <Modal visible={restSecondsLeft !== null} transparent animationType="fade">
        <View style={styles.timerBackdrop}>
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>{t("workouts.rest_label")}</Text>
            <Text style={styles.timerExercise}>{restExerciseName}</Text>
            <Text style={styles.timerCount}>
              {restSecondsLeft !== null
                ? `${Math.floor(restSecondsLeft / 60)}:${String(restSecondsLeft % 60).padStart(2, "0")}`
                : "0:00"}
            </Text>
            <Text style={styles.timerSub}>{t("workouts.next_set")}</Text>
            <TouchableOpacity
              style={styles.timerSkipBtn}
              onPress={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                setRestSecondsLeft(null);
              }}
            >
              <Text style={styles.timerSkipText}>{t("workouts.skip_rest")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Generate Program Modal ── */}
      <Modal visible={generateModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { maxHeight: "90%" }]}>
            <Text style={styles.modalTitle}>{t("workouts.build_title")}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>{t("workouts.days_per_week")}</Text>
              <View style={styles.chipRow}>
                {["3", "4", "5", "6"].map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGenForm((f) => ({ ...f, daysPerWeek: d })); }}
                    style={[styles.selectChip, genForm.daysPerWeek === d && styles.selectChipActive]}
                  >
                    <Text style={[styles.selectChipText, genForm.daysPerWeek === d && styles.selectChipTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>{t("workouts.equipment")}</Text>
              <View style={styles.chipWrap}>
                {EQUIPMENT_OPTIONS.map((eq) => {
                  const selected = genForm.equipment.includes(eq);
                  return (
                    <TouchableOpacity
                      key={eq}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setGenForm((f) => ({
                          ...f,
                          equipment: selected
                            ? f.equipment.filter((e) => e !== eq)
                            : [...f.equipment, eq],
                        }));
                      }}
                      style={[styles.selectChip, selected && styles.selectChipActive]}
                    >
                      <Text style={[styles.selectChipText, selected && styles.selectChipTextActive]}>
                        {EQUIPMENT_LABELS[eq] ?? eq}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>{t("workouts.main_goal")}</Text>
              <View style={styles.goalList}>
                {goalOptions.map((opt) => {
                  const selected = genForm.bodyGoalFocus === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGenForm((f) => ({ ...f, bodyGoalFocus: opt })); }}
                      style={[styles.goalOption, selected && styles.goalOptionActive]}
                    >
                      <Text style={[styles.goalOptionText, selected && styles.goalOptionTextActive]}>
                        {BODY_GOAL_LABELS[opt] ?? opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>{t("workouts.specific_focus")}</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: "top", marginBottom: 20 }]}
                placeholder={t("workouts.specific_placeholder")}
                placeholderTextColor={T.textMuted}
                value={genForm.specificFocus}
                onChangeText={(text) => setGenForm((f) => ({ ...f, specificFocus: text }))}
                multiline
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setGenerateModal(false)}>
                <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => generateProgram()}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveBtnText}>{t("workouts.generate_btn")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loadingScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48 },

  header: { marginBottom: 20 },
  title: { fontSize: 30, fontWeight: "800", color: T.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: T.textSecondary, marginTop: 2 },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 11, color: T.textSecondary, marginTop: 3 },

  // Generate
  generateBtn: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 16,
    padding: 17,
    alignItems: "center",
    marginBottom: 16,
  },
  generateBtnText: { color: T.accent, fontSize: 16, fontWeight: "800" },

  // Empty
  emptyState: {
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 48,
    alignItems: "center",
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: T.textPrimary, marginBottom: 4 },
  emptySub: { fontSize: 13, color: T.textSecondary, textAlign: "center" },
  emptyFeatures: { alignSelf: "stretch", marginTop: 20, gap: 12 },
  emptyFeatureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  emptyFeatureIcon: { fontSize: 20, width: 28, textAlign: "center" },
  emptyFeatureText: { fontSize: 14, color: T.textSecondary, flex: 1 },

  // Program
  programCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 18,
    marginBottom: 10,
  },
  programName: { fontSize: 18, fontWeight: "800", color: T.textPrimary, marginBottom: 4 },
  programMeta: { fontSize: 13, color: T.textSecondary },

  coachNoteCard: {
    backgroundColor: T.accentDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.accentBorder,
    padding: 16,
    marginBottom: 16,
  },
  coachNoteLabel: { fontSize: 10, fontWeight: "800", color: T.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  coachNoteText: { fontSize: 14, color: T.accentMuted, lineHeight: 21 },

  // Pickers
  pickerLabel: { fontSize: 13, color: T.textSecondary, fontWeight: "600", marginBottom: 8, marginTop: 8 },
  pickerScroll: { marginBottom: 4 },
  pickerRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  pickerChip: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pickerChipActive: { backgroundColor: T.accentDark, borderColor: T.accent },
  pickerChipText: { color: T.textSecondary, fontSize: 13, fontWeight: "600" },
  pickerChipTextActive: { color: T.accent },
  progressionNote: { fontSize: 12, color: T.textMuted, fontStyle: "italic", marginBottom: 12 },

  // Exercise List
  exerciseList: { marginTop: 12 },
  exercisesHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  exercisesHeader: { fontSize: 14, color: T.textSecondary, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  exercisesProgress: { fontSize: 12, color: T.accent, fontWeight: "700" },
  sessionProgressTrack: { height: 4, backgroundColor: T.surface2, borderRadius: 2, overflow: "hidden", marginBottom: 12 },
  sessionProgressFill: { height: "100%", backgroundColor: T.accent, borderRadius: 2 },
  exerciseCard: {
    flexDirection: "row",
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    marginBottom: 10,
    gap: 14,
  },
  exerciseCardDone: { borderColor: T.accentBorder, backgroundColor: T.accentDark },
  exerciseNumber: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: T.surface2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  exerciseNumberDone: { backgroundColor: T.accent },
  exerciseNumberText: { color: T.textSecondary, fontSize: 12, fontWeight: "800" },
  exerciseCheckmark: { color: "#000", fontSize: 13, fontWeight: "900" },
  exerciseBody: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: "700", color: T.textPrimary, marginBottom: 4 },
  exerciseNameDone: { color: T.accentMuted },
  exerciseMeta: { fontSize: 13, color: T.textSecondary, marginBottom: 4 },
  exerciseNotes: { fontSize: 12, color: T.textMuted, fontStyle: "italic", marginBottom: 6 },
  exerciseActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  logBtnPrimary: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logBtnPrimaryText: { color: T.accent, fontSize: 12, fontWeight: "700" },
  doneTag: {
    backgroundColor: "transparent",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  doneTagText: { color: T.accentMuted, fontSize: 12, fontWeight: "700" },
  logBtn: {
    backgroundColor: T.surface2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logBtnText: { color: T.textPrimary, fontSize: 12, fontWeight: "700" },

  // Rest Day
  restDay: {
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 48,
    alignItems: "center",
    marginTop: 12,
  },
  restDayIcon: { fontSize: 36, marginBottom: 10 },
  restDayText: { fontSize: 17, fontWeight: "700", color: T.textPrimary, marginBottom: 4 },
  restDaySub: { fontSize: 13, color: T.textSecondary },

  // Shared modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: T.border,
    padding: 24,
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary, marginBottom: 4 },
  modalSub: { fontSize: 13, color: T.textSecondary, marginBottom: 8 },
  prevBest: { fontSize: 13, color: T.accent, fontWeight: "700", marginBottom: 16 },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, color: T.textSecondary, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  input: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: T.textPrimary,
    fontSize: 14,
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  cancelBtnText: { color: T.textSecondary, fontWeight: "700", fontSize: 15 },
  saveBtn: {
    flex: 1,
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  saveBtnText: { color: T.accent, fontWeight: "700", fontSize: 15 },

  // Generate Modal
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  selectChip: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectChipActive: { backgroundColor: T.accentDark, borderColor: T.accent },
  selectChipText: { color: T.textSecondary, fontSize: 13, fontWeight: "600" },
  selectChipTextActive: { color: T.accent },
  goalList: { gap: 8, marginBottom: 20 },
  goalOption: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 14,
  },
  goalOptionActive: { backgroundColor: T.accentDark, borderColor: T.accent },
  goalOptionText: { fontSize: 14, color: T.textSecondary },
  goalOptionTextActive: { color: T.accent, fontWeight: "600" },

  // Rest Timer
  timerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  timerCard: {
    backgroundColor: T.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: T.border,
    padding: 40,
    alignItems: "center",
    width: "80%",
  },
  timerLabel: { fontSize: 11, fontWeight: "800", color: T.textMuted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  timerExercise: { fontSize: 15, color: T.textSecondary, marginBottom: 28, textAlign: "center" },
  timerCount: { fontSize: 80, fontWeight: "800", color: T.accent, letterSpacing: -4, lineHeight: 88, marginBottom: 8 },
  timerSub: { fontSize: 13, color: T.textMuted, marginBottom: 32 },
  timerSkipBtn: { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  timerSkipText: { color: T.textSecondary, fontWeight: "700", fontSize: 14 },

  // Workout complete modal
  completeBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  completeCard: {
    width: "100%",
    backgroundColor: T.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: T.accentBorder,
    padding: 32,
    alignItems: "center",
  },
  completeTrophy: { fontSize: 56, marginBottom: 16 },
  completeTitle: { fontSize: 28, fontWeight: "800", color: T.textPrimary, marginBottom: 6, letterSpacing: -0.5 },
  completeSub: { fontSize: 13, color: T.textSecondary, marginBottom: 28 },
  completeStats: { flexDirection: "row", alignItems: "center", gap: 24, marginBottom: 32 },
  completeStat: { alignItems: "center" },
  completeStatValue: { fontSize: 28, fontWeight: "800", color: T.accent },
  completeStatLabel: { fontSize: 11, color: T.textMuted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  completeStatDivider: { width: 1, height: 32, backgroundColor: T.border },
  completeDoneBtn: {
    width: "100%",
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  completeDoneBtnText: { color: "#000", fontSize: 17, fontWeight: "800" },
});
