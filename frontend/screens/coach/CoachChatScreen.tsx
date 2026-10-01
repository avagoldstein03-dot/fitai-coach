import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  FlatList,
  Animated,
  Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import axios from "axios";
import { isPremiumRequiredError } from "@/contexts/UpgradeGateContext";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";
import { posthog, Events } from "@/lib/analytics";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Mirrors CoachActionSchema in backend/lib/coach-actions.ts. The server validates
// and clamps these before they get here, so the UI can render them directly.
type CoachAction =
  | { type: "log_food"; foodName: string; quantity: number; unit: string; calories: number; protein: number; carbs: number; fat: number; fiber: number }
  | { type: "add_to_list"; name: string; quantity?: number; unit?: string }
  | { type: "open"; screen: string; label?: string }
  | { type: "set_program"; label?: string };

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  actions?: CoachAction[] | null;
  requiresUpgrade?: boolean;
  upgradeTo?: string | null;
}

type ParsedBlock =
  | { type: "headline"; text: string }
  | { type: "section"; text: string }
  | { type: "bullet"; text: string }
  | { type: "numbered"; n: string; text: string }
  | { type: "body"; text: string; spaced?: boolean };

const QUICK_PROMPT_META = [
  { emoji: "🔥", labelKey: "coach.prompt_calories", qKey: "coach.prompt_calories_q", color: T.red, dark: T.redDark },
  { emoji: "💪", labelKey: "coach.prompt_protein", qKey: "coach.prompt_protein_q", color: T.blue, dark: T.blueDark },
  { emoji: "⚡", labelKey: "coach.prompt_preworkout", qKey: "coach.prompt_preworkout_q", color: T.accent, dark: T.accentDark },
  { emoji: "😴", labelKey: "coach.prompt_sleep", qKey: "coach.prompt_sleep_q", color: T.teal, dark: T.tealDark },
];

function parseBlocks(content: string): ParsedBlock[] {
  const lines = content.split("\n");
  let headlineUsed = false;
  const blocks: ParsedBlock[] = [];
  // A blank line in the response is a real paragraph break. Filtering empty lines
  // out entirely made a new paragraph render identically to a wrapped line, so
  // multi-paragraph answers ran together as one wall of text. Remember that a gap
  // was there and give the next body block real separation instead.
  let gapBefore = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      gapBefore = blocks.length > 0;
      continue;
    }
    // Every branch below returns via `continue`, so consume the flag up front.
    const spaced = gapBefore;
    gapBefore = false;
    if (/^#{1,3}\s/.test(t)) {
      blocks.push({ type: "section", text: t.replace(/^#{1,3}\s/, "") });
      continue;
    }
    if (/^\*\*[^*]+\*\*[:\s]*$/.test(t) && t.length < 70) {
      blocks.push({ type: "section", text: t.replace(/^\*\*|\*\*[:\s]*$/g, "") });
      continue;
    }
    if (/^[-•*]\s/.test(t)) {
      blocks.push({ type: "bullet", text: t.replace(/^[-•*]\s/, "") });
      continue;
    }
    if (/^\d+[.)]\s/.test(t)) {
      const n = t.match(/^(\d+)/)?.[1] ?? "?";
      blocks.push({ type: "numbered", n, text: t.replace(/^\d+[.)]\s/, "") });
      continue;
    }
    if (!headlineUsed) {
      headlineUsed = true;
      // A conversational reply is usually one continuous paragraph with no
      // line breaks at all between the opening thought and the supporting
      // detail -- operating on whole lines either bolds the entire
      // multi-sentence paragraph or (if gated on there being a second line)
      // bolds nothing. Splitting at the first sentence boundary instead
      // gives a real, short headline either way, with the rest of that same
      // paragraph rendered as normal body text right after it.
      const sentenceMatch = t.match(/^(.+?[.!?])\s+([A-Z].*)$/);
      if (sentenceMatch) {
        blocks.push({ type: "headline", text: sentenceMatch[1] });
        blocks.push({ type: "body", text: sentenceMatch[2] });
      } else {
        blocks.push({ type: "headline", text: t });
      }
      continue;
    }
    blocks.push({ type: "body", text: t, spaced });
  }
  return blocks;
}

// Matches **bold** markdown OR numbers optionally followed by a unit
const HIGHLIGHT_RE = /(\*\*[^*]+\*\*|\b\d[\d,.]*(?:g|kcal|cal|mg|kg|lbs?|%|oz|ml|hrs?|mins?)?\b(?:\s+(?:calories|grams?|kcal|cal|mg|kg|lbs?|percent|oz|ml|cups?|hours?|hrs?|minutes?|mins?|servings?))?)/gi;

function InlineText({ text, style, flex }: { text: string; style: any; flex?: boolean }) {
  const parts = text.split(HIGHLIGHT_RE);
  return (
    <Text style={[flex ? { flex: 1 } : null, style]}>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <Text key={i} style={cs.inlineBold}>{p.slice(2, -2)}</Text>;
        }
        if (/^\d/.test(p)) {
          return <Text key={i} style={cs.inlineNum}>{p}</Text>;
        }
        return p;
      })}
    </Text>
  );
}

// A timestamp under every single message is noise in a conversation where most
// replies land seconds apart. Show one divider above a run of messages instead,
// and only when enough time has actually passed to be worth telling the reader.
const TIME_GROUP_MS = 5 * 60 * 1000;

function startsTimeGroup(msg: ChatMessage, prev?: ChatMessage): boolean {
  if (!prev) return true;
  const gap = new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return !Number.isFinite(gap) || gap > TIME_GROUP_MS;
}

function UpgradeCard({ upgradeTo, onPress }: { upgradeTo: string; onPress: () => void }) {
  const { t } = useTranslation();
  const plan = upgradeTo.charAt(0).toUpperCase() + upgradeTo.slice(1);
  const perks = (t(`coach.perks_${upgradeTo}`, { returnObjects: true }) as string[]) ?? [];
  return (
    <TouchableOpacity style={cs.upgradeCard} onPress={onPress} activeOpacity={0.85}>
      <View style={cs.upgradeCardHeader}>
        <Text style={cs.upgradeCardBadge}>⚡ {t("coach.plan_badge", { plan })}</Text>
        <Text style={cs.upgradeCardArrow}>→</Text>
      </View>
      {perks.map((perk, i) => (
        <View key={i} style={cs.upgradeCardRow}>
          <Text style={cs.upgradeCardCheck}>✓</Text>
          <Text style={cs.upgradeCardPerk}>{perk}</Text>
        </View>
      ))}
      <View style={cs.upgradeCardBtn}>
        <Text style={cs.upgradeCardBtnText}>{t("coach.unlock", { plan })}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ActionBar({ actions, onPress, busy, idPrefix }: {
  actions: CoachAction[];
  onPress: (a: CoachAction, key: string) => void;
  busy: string | null;
  idPrefix: string;
}) {
  const { t } = useTranslation();

  const labelFor = (a: CoachAction) => {
    if (a.type === "log_food") return t("coach.action_log_food", { food: a.foodName });
    if (a.type === "add_to_list") return t("coach.action_add_to_list", { item: a.name });
    if (a.type === "set_program") return a.label || t("coach.action_set_program");
    return a.label || t("coach.action_open", { screen: a.screen });
  };
  const iconFor = (a: CoachAction) =>
    a.type === "log_food" ? "＋" : a.type === "add_to_list" ? "🛒" : a.type === "set_program" ? "⚡" : "→";

  return (
    <View style={cs.actionBar}>
      {actions.map((a, i) => {
        const key = `${idPrefix}-${i}`;
        const isBusy = busy === key;
        // "open" is navigation, not a change to their data — kept visually
        // secondary so the buttons that write something read as the real choice.
        const secondary = a.type === "open";
        return (
          <TouchableOpacity
            key={key}
            style={[cs.actionBtn, secondary && cs.actionBtnSecondary, isBusy && cs.actionBtnBusy]}
            onPress={() => onPress(a, key)}
            disabled={busy !== null}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={labelFor(a)}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={secondary ? T.textSecondary : T.accent} />
            ) : (
              <>
                <Text style={[cs.actionBtnIcon, secondary && cs.actionBtnTextSecondary]}>{iconFor(a)}</Text>
                <Text
                  style={[cs.actionBtnText, secondary && cs.actionBtnTextSecondary]}
                  numberOfLines={1}
                >
                  {labelFor(a)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Macros here are the coach's estimate, not a scanned or looked-up value, so
// nothing reaches the diary until the user has seen the numbers and picked a meal.
function LogFoodSheet({ action, onCancel, onConfirm, saving }: {
  action: Extract<CoachAction, { type: "log_food" }> | null;
  onCancel: () => void;
  onConfirm: (meal: MealType) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [meal, setMeal] = useState<MealType>("snack");

  return (
    <Modal
      visible={action !== null}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={cs.sheetBackdrop}>
        <View style={cs.sheet}>
          <Text style={cs.sheetTitle}>{t("coach.log_sheet_title")}</Text>

          <Text style={cs.sheetFood}>
            {action?.foodName}
            {action ? ` · ${action.quantity} ${action.unit}` : ""}
          </Text>
          <Text style={cs.sheetMacros}>
            {action
              ? t("coach.macros_line", {
                  calories: Math.round(action.calories),
                  protein: Math.round(action.protein),
                  carbs: Math.round(action.carbs),
                  fat: Math.round(action.fat),
                })
              : ""}
          </Text>
          <Text style={cs.sheetNote}>{t("coach.estimate_note")}</Text>

          <Text style={cs.sheetLabel}>{t("coach.log_sheet_meal")}</Text>
          <View style={cs.mealRow}>
            {MEAL_TYPES.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMeal(m)}
                style={[cs.mealChip, meal === m && cs.mealChipActive]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: meal === m }}
              >
                <Text style={[cs.mealChipText, meal === m && cs.mealChipTextActive]}>
                  {t(`coach.meal_${m}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={cs.sheetActions}>
            <TouchableOpacity
              onPress={onCancel}
              style={[cs.sheetBtn, cs.sheetBtnGhost]}
              disabled={saving}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={cs.sheetBtnGhostText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(meal)}
              style={[cs.sheetBtn, cs.sheetBtnPrimary]}
              disabled={saving}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {saving
                ? <ActivityIndicator size="small" color={T.black} />
                : <Text style={cs.sheetBtnPrimaryText}>{t("coach.log_sheet_add")}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TypingIndicator() {
  const dotsRef = useRef<Animated.Value[] | null>(null);
  if (dotsRef.current === null) {
    dotsRef.current = [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)];
  }
  // Animated.Value is a stable, native-driven handle meant to be read during render
  // (mapped into transforms below) — it has none of the staleness concerns
  // react-hooks/refs otherwise guards against.
  // eslint-disable-next-line react-hooks/refs
  const dots = dotsRef.current;

  useEffect(() => {
    const makeSeq = (dot: Animated.Value) =>
      Animated.sequence([
        Animated.timing(dot, { toValue: -5, duration: 220, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]);

    const anim = Animated.loop(
      Animated.sequence([
        makeSeq(dots[0]),
        makeSeq(dots[1]),
        makeSeq(dots[2]),
        Animated.delay(180),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={cs.coachMsgRow}>
      <View style={cs.coachMiniAvatar}>
        <Text style={cs.coachMiniAvatarText}>AI</Text>
      </View>
      <View style={cs.typingBubble}>
        {/* eslint-disable-next-line react-hooks/refs -- see justification at dotsRef above */}
        {dots.map((dot, i) => (
          <Animated.View key={i} style={[cs.dot, { transform: [{ translateY: dot }] }]} />
        ))}
      </View>
    </View>
  );
}

function CoachMessage({ content, requiresUpgrade, upgradeTo, onUpgrade }: {
  content: string;
  requiresUpgrade?: boolean;
  upgradeTo?: string | null;
  onUpgrade?: () => void;
}) {
  const blocks = parseBlocks(content);
  return (
    <View style={cs.coachBubble}>
      {blocks.map((block, i) => {
        if (block.type === "headline") {
          return <InlineText key={i} text={block.text} style={cs.headline} />;
        }
        if (block.type === "section") {
          return <Text key={i} style={cs.sectionHeader}>{block.text}</Text>;
        }
        if (block.type === "bullet") {
          return (
            <View key={i} style={cs.bulletRow}>
              <View style={cs.bulletDot} />
              <InlineText text={block.text} style={cs.bulletText} flex />
            </View>
          );
        }
        if (block.type === "numbered") {
          return (
            <View key={i} style={cs.numberedRow}>
              <View style={cs.numBadge}>
                <Text style={cs.numBadgeText}>{block.n}</Text>
              </View>
              <InlineText text={block.text} style={cs.numberedText} flex />
            </View>
          );
        }
        return (
          <InlineText
            key={i}
            text={block.text}
            style={block.spaced ? [cs.bodyText, cs.bodyTextSpaced] : cs.bodyText}
          />
        );
      })}
      {requiresUpgrade && upgradeTo && (
        <UpgradeCard upgradeTo={upgradeTo} onPress={onUpgrade ?? (() => {})} />
      )}
    </View>
  );
}

export default function CoachChatScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();
  const navigation = useNavigation() as any;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  // onContentSizeChange is the single scroll driver. The first run (history
  // hydrating) jumps straight to the bottom; everything after it animates, so a
  // new message slides in instead of snapping.
  const didInitialScroll = useRef(false);

  const { t, i18n } = useTranslation();
  const [message, setMessage] = useState("");

  const QUICK_PROMPTS = QUICK_PROMPT_META.map((p) => ({
    emoji: p.emoji,
    label: t(p.labelKey),
    q: t(p.qKey),
    color: p.color,
    dark: p.dark,
  }));

  const goToPricing = () => navigation.navigate("Pricing");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  const { data: historyData, isLoading } = useQuery<{ messages: ChatMessage[] }>({
    queryKey: ["chatHistory"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/coach/history`);
      return res.data.data;
    },
  });

  const { data: mealHistory } = useQuery<{ dailyData: Array<{ date: string; totalCalories: number; totalProtein: number; meals: Array<{ foods: Array<{ name: string }> }> }> }>({
    queryKey: ["mealHistory"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/food/history?days=7`);
      return res.data;
    },
    staleTime: 60_000,
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const todayFood = mealHistory?.dailyData?.find((d) => d.date === todayStr);
  const contextPrompts = (() => {
    const base = [
      { emoji: "💪", label: t("coach.prompt_protein_check"), q: t("coach.prompt_protein_check_q") },
      { emoji: "⚡", label: t("coach.prompt_preworkout_chip"), q: t("coach.prompt_preworkout_chip_q") },
      { emoji: "😴", label: t("coach.prompt_recovery"), q: t("coach.prompt_recovery_q") },
      { emoji: "🔥", label: t("coach.prompt_fat_loss"), q: t("coach.prompt_fat_loss_q") },
    ];
    if (!todayFood) return base;
    const cal = todayFood.totalCalories;
    const protein = Math.round(todayFood.totalProtein);
    const recentFood = todayFood.meals?.[todayFood.meals.length - 1]?.foods?.[0]?.name;
    const mealPrompts = [
      { emoji: "🍽️", label: t("coach.prompt_meals_today"), q: t("coach.prompt_meals_today_q", { cal, protein }) },
      ...(recentFood ? [{ emoji: "🥗", label: t("coach.prompt_last_meal"), q: t("coach.prompt_last_meal_q", { food: recentFood }) }] : []),
      { emoji: "📊", label: t("coach.prompt_macro_balance"), q: t("coach.prompt_macro_balance_q", { cal }) },
    ];
    return [...mealPrompts, ...base].slice(0, 6);
  })();

  useEffect(() => {
    if (historyData?.messages) {
      // Hydrates local chat state once history finishes loading — not derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalMessages((prev) => {
        const prevById = new Map(prev.map((m) => [m.id, m]));
        // requiresUpgrade/upgradeTo are computed per-request in the POST /coach/chat
        // response and never persisted on the ChatMessage row, so GET /coach/history
        // can never return them. ANY refetch of this query (default React Query
        // behavior, react-navigation focus, or a future invalidateQueries call
        // added elsewhere) would otherwise silently erase an already-showing
        // upgrade card the instant it lands. Carry the flag forward from local
        // state instead of trusting the fetched row to have it.
        return historyData.messages.map((incoming) => {
          const existing = prevById.get(incoming.id);
          if (existing?.requiresUpgrade && !incoming.requiresUpgrade) {
            return { ...incoming, requiresUpgrade: existing.requiresUpgrade, upgradeTo: existing.upgradeTo };
          }
          return incoming;
        });
      });
    }
  }, [historyData]);

  const { mutate: sendMessage, isPending: isSending } = useMutation({
    mutationFn: async (text: string) => {
      const res = await axios.post(`${API_URL}/api/coach/chat`, { message: text });
      return res.data.data;
    },
    onMutate: (text) => {
      const tempMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, tempMsg]);
    },
    onSuccess: (data) => {
      posthog.capture(Events.COACH_MESSAGE_SENT, { requiresUpgrade: data.requiresUpgrade ?? false });
      const assistantMsg: ChatMessage = {
        id: data.message.id,
        role: "assistant",
        content: data.response,
        createdAt: data.message.createdAt,
        actions: data.actions ?? null,
        requiresUpgrade: data.requiresUpgrade ?? false,
        upgradeTo: data.upgradeTo ?? null,
      };
      setLocalMessages((prev) => {
        const withoutTemp = prev.filter((m) => !m.id.startsWith("temp-"));
        // data.userMessage is the saved row for what was just sent.
        // conversationHistory is read concurrently with that write server-side,
        // so it never contains it — without this the message the user typed
        // disappears the moment the reply lands.
        return [...withoutTemp, ...data.conversationHistory, data.userMessage, assistantMsg]
          .filter(Boolean)
          .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
      // Deliberately not invalidating the chatHistory query here: local state above is
      // already the authoritative, fully-merged result of this send, including the
      // ephemeral requiresUpgrade/upgradeTo flags. Those flags are computed per-request
      // and never persisted to the ChatMessage row, so a refetch from /api/coach/history
      // would silently strip them back off and make the upgrade card disappear right
      // after it renders.
    },
    onError: (err: any) => {
      setLocalMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
      if (isPremiumRequiredError(err)) {
        // Show inline upgrade card instead of modal popup
        const limitMsg: ChatMessage = {
          id: `upgrade-${Date.now()}`,
          role: "assistant",
          content: t("coach.free_limit"),
          createdAt: new Date().toISOString(),
          requiresUpgrade: true,
          upgradeTo: "starter",
        };
        setLocalMessages((prev) => [...prev, limitMsg]);
        return;
      }
      Alert.alert(t("common.error"), err.response?.data?.message || t("coach.error_send"));
    },
  });

  const { mutate: clearHistory, isPending: isClearing } = useMutation({
    mutationFn: async () => { await axios.delete(`${API_URL}/api/coach/history`); },
    onSuccess: () => {
      setLocalMessages([]);
      queryClient.invalidateQueries({ queryKey: ["chatHistory"] });
    },
  });

  // --- Coach action buttons -------------------------------------------------
  const [pendingLog, setPendingLog] = useState<Extract<CoachAction, { type: "log_food" }> | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [savingLog, setSavingLog] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const logFood = async (meal: MealType) => {
    if (!pendingLog) return;
    setSavingLog(true);
    try {
      await axios.post(`${API_URL}/api/food/manual`, {
        mealType: meal,
        items: [{
          foodName: pendingLog.foodName,
          quantity: pendingLog.quantity,
          unit: pendingLog.unit,
          calories: pendingLog.calories,
          protein: pendingLog.protein,
          carbs: pendingLog.carbs,
          fat: pendingLog.fat,
          fiber: pendingLog.fiber,
        }],
      });
      // "food-history" backs the diary, nutrition and dashboard screens;
      // "mealHistory" is this screen's own copy behind the context chips.
      queryClient.invalidateQueries({ queryKey: ["food-history"] });
      queryClient.invalidateQueries({ queryKey: ["mealHistory"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t("coach.added_to_diary", { food: pendingLog.foodName }));
      setPendingLog(null);
    } catch {
      Alert.alert(t("common.error"), t("coach.action_failed"));
    } finally {
      setSavingLog(false);
    }
  };

  const runAction = async (action: CoachAction, key: string) => {
    if (action.type === "log_food") {
      setPendingLog(action);
      return;
    }

    if (action.type === "open") {
      navigation.navigate(action.screen as never);
      return;
    }

    if (action.type === "add_to_list") {
      setBusyAction(key);
      try {
        await axios.patch(`${API_URL}/api/nutrition/shopping-list`, {
          action: "add",
          name: action.name,
          ...(action.quantity ? { quantity: action.quantity } : {}),
          ...(action.unit ? { unit: action.unit } : {}),
        });
        queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(t("coach.added_to_list", { item: action.name }));
      } catch {
        Alert.alert(t("common.error"), t("coach.action_failed"));
      } finally {
        setBusyAction(null);
      }
      return;
    }

    // set_program replaces whatever they are currently following, so name it in
    // the confirm — and carry their existing equipment and schedule forward.
    // The generate endpoint defaults to bodyweight-only 4x/week, which would
    // quietly downgrade someone with gym access who never saw the setup form.
    let current: string | null = null;
    let carryOver: { equipment?: string[]; daysPerWeek?: number } = {};
    try {
      const res = await axios.get(`${API_URL}/api/workouts/history`);
      const active = res.data?.data?.activeProgram;
      current = active?.name ?? null;
      if (active?.equipmentAvailable?.length) carryOver.equipment = active.equipmentAvailable;
      const days = active?.weeks?.[0]?.days?.length;
      if (days) carryOver.daysPerWeek = days;
    } catch {
      // Confirm with the generic wording rather than blocking on this lookup.
    }
    Alert.alert(
      t("coach.replace_program_title"),
      current
        ? t("coach.replace_program_msg", { program: current })
        : t("coach.replace_program_none"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("coach.replace_program_yes"),
          style: "destructive",
          onPress: async () => {
            setBusyAction(key);
            try {
              await axios.post(`${API_URL}/api/workouts/generate`, carryOver);
              queryClient.invalidateQueries({ queryKey: ["workouts"] });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              navigation.navigate("Workouts" as never);
            } catch {
              Alert.alert(t("common.error"), t("coach.action_failed"));
            } finally {
              setBusyAction(null);
            }
          },
        },
      ]
    );
  };

  const handleSend = (text?: string) => {
    const t = (text ?? message).trim();
    if (!t || isSending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessage("");
    sendMessage(t);
  };

  if (isLoading) {
    return (
      <View style={cs.loader}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  const canSend = message.trim().length > 0 && !isSending;

  return (
    <KeyboardAvoidingView
      style={cs.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={tabBarHeight}
    >
      {/* Header */}
      <View style={[cs.header, { paddingTop: insets.top + 12 }]}>
        <View style={cs.headerLeft}>
          <View style={cs.coachAvatar}>
            <Text style={cs.coachAvatarText}>AI</Text>
          </View>
          <View>
            <Text style={cs.headerTitle}>{t("coach.title")}</Text>
            <View style={cs.onlineRow}>
              <View style={cs.onlineDot} />
              <Text style={cs.onlineText}>{t("coach.online")}</Text>
            </View>
          </View>
        </View>
        {localMessages.length > 0 && (
          <TouchableOpacity
            onPress={() =>
              Alert.alert(t("coach.clear_title"), t("coach.clear_msg"), [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("coach.clear"), style: "destructive", onPress: () => clearHistory() },
              ])
            }
          >
            {isClearing
              ? <ActivityIndicator size="small" color={T.textSecondary} />
              : <Text style={cs.clearBtn}>{t("coach.clear")}</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={cs.messages}
        contentContainerStyle={cs.messagesContent}
        onContentSizeChange={() => {
          scrollRef.current?.scrollToEnd({ animated: didInitialScroll.current });
          didInitialScroll.current = true;
        }}
        showsVerticalScrollIndicator={false}
      >
        {localMessages.length === 0 ? (
          <View style={cs.emptyState}>
            <View style={cs.emptyAvatar}>
              <Text style={cs.emptyAvatarText}>🏋️</Text>
            </View>
            <Text style={cs.emptyTitle}>{t("coach.empty_title")}</Text>
            <Text style={cs.emptySub}>{t("coach.empty_sub")}</Text>

            <Text style={cs.promptsLabel}>{t("coach.quick_questions")}</Text>
            <View style={cs.promptsGrid}>
              {QUICK_PROMPTS.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={[cs.promptCard, { backgroundColor: p.dark, borderColor: p.color }]}
                  onPress={() => handleSend(p.q)}
                  activeOpacity={0.8}
                >
                  <Text style={cs.promptEmoji}>{p.emoji}</Text>
                  <Text style={[cs.promptLabel, { color: p.color }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <>
            {localMessages.map((msg, idx) => (
              <React.Fragment key={msg.id}>
                {startsTimeGroup(msg, localMessages[idx - 1]) && (
                  <Text style={cs.timeDivider}>
                    {new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                )}
                <View
                  style={[cs.messageRow, msg.role === "user" ? cs.messageRowUser : cs.messageRowCoach]}
                >
                  {msg.role === "user" ? (
                    <View style={cs.userBubble}>
                      <Text style={cs.userText}>{msg.content}</Text>
                    </View>
                  ) : (
                    <View style={cs.coachMsgRow}>
                      <View style={cs.coachMiniAvatar}>
                        <Text style={cs.coachMiniAvatarText}>AI</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <CoachMessage
                          content={msg.content}
                          requiresUpgrade={msg.requiresUpgrade}
                          upgradeTo={msg.upgradeTo}
                          onUpgrade={goToPricing}
                        />
                        {!!msg.actions?.length && (
                          <ActionBar
                            actions={msg.actions}
                            busy={busyAction}
                            idPrefix={msg.id}
                            onPress={runAction}
                          />
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </React.Fragment>
            ))}

            {isSending && (
              <View style={cs.messageRow}>
                <TypingIndicator />
              </View>
            )}
          </>
        )}
        <View style={{ height: 12 }} />
      </ScrollView>

      {/* Context Prompt Strip — only once a conversation exists. On an empty chat
          the four quick-prompt cards above already offer a way in, and showing
          both put ten competing suggestions on one screen. */}
      {localMessages.length > 0 && (
      <View style={cs.promptStrip}>
        <FlatList
          data={contextPrompts}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={cs.promptStripContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={cs.promptChip}
              onPress={() => handleSend(item.q)}
              disabled={isSending}
              activeOpacity={0.75}
            >
              <Text style={cs.promptChipEmoji}>{item.emoji}</Text>
              <Text style={cs.promptChipLabel}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
      )}

      {/* Input */}
      <View style={cs.inputBar}>
        <TextInput
          style={cs.input}
          placeholder={t("coach.input_placeholder")}
          placeholderTextColor={T.textSecondary}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={500}
          // No returnKeyType="send"/onSubmitEditing here: on a multiline input iOS
          // treats return as a newline and never fires onSubmitEditing, so a "send"
          // key was a promise the keyboard didn't keep. Return inserts a line break
          // (needed for longer questions); the ↑ button is the send action.
        />
        <TouchableOpacity
          onPress={() => handleSend()}
          disabled={!canSend}
          style={[cs.sendBtn, canSend ? cs.sendBtnActive : cs.sendBtnInactive]}
          activeOpacity={0.8}
          accessibilityLabel={t("coach.send")} accessibilityRole="button"
        >
          <Text style={[cs.sendIcon, canSend ? cs.sendIconActive : cs.sendIconInactive]}>↑</Text>
        </TouchableOpacity>
      </View>

      <LogFoodSheet
        action={pendingLog}
        saving={savingLog}
        onCancel={() => setPendingLog(null)}
        onConfirm={logFood}
      />

      {toast !== null && (
        <View style={[cs.toast, { bottom: tabBarHeight + 76 }]} pointerEvents="none">
          <Text style={cs.toastText}>{toast}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const cs = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loader: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    // paddingTop comes from the safe-area inset at the call site — a hardcoded 56
    // was wrong on both notchless and Dynamic Island devices.
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  coachAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.accentDark,
    borderWidth: 1.5,
    borderColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  coachAvatarText: { color: T.accent, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: T.textPrimary },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent },
  onlineText: { fontSize: 11, color: T.accent, fontWeight: "600" },
  clearBtn: { color: T.red, fontSize: 13 },

  // Messages
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingTop: 16 },
  messageRow: { marginBottom: 12 },
  messageRowUser: { alignItems: "flex-end" },
  messageRowCoach: { alignItems: "flex-start" },

  // User bubble
  userBubble: {
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border2,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: "80%",
  },
  userText: { color: T.textPrimary, fontSize: 15, lineHeight: 22 },

  // Coach message row (mini avatar + bubble)
  coachMsgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "92%" },
  coachMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 2,
  },
  coachMiniAvatarText: { color: T.accent, fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },

  // Coach bubble + content
  coachBubble: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    padding: 16,
    // No maxWidth here: this bubble already sits inside coachMsgRow's 92% cap,
    // so a second percentage compounded to ~83% and left dense answers (bullets,
    // numbered steps) wrapping far earlier than they needed to.
    gap: 6,
  },
  headline: {
    fontSize: 17,
    fontWeight: "700",
    color: T.textPrimary,
    lineHeight: 24,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: T.accent,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 2,
  },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.accentMuted,
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: { fontSize: 14, color: T.textPrimary, lineHeight: 22 },
  numberedRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  numBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  numBadgeText: { fontSize: 11, fontWeight: "800", color: T.accent },
  numberedText: { fontSize: 14, color: T.textPrimary, lineHeight: 22 },
  bodyText: { fontSize: 14, color: T.textPrimary, lineHeight: 22 },
  // Sits on top of the bubble's 6px gap, so a paragraph break reads as a real
  // break rather than another wrapped line.
  bodyTextSpaced: { marginTop: 8 },
  inlineBold: { color: T.accent, fontWeight: "700" },
  inlineNum: { color: T.teal, fontWeight: "800", fontSize: 15 },
  upgradeCard: {
    marginTop: 12,
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  upgradeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  upgradeCardBadge: { color: T.accent, fontWeight: "800", fontSize: 14 },
  upgradeCardArrow: { color: T.accent, fontSize: 16, fontWeight: "700" },
  upgradeCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  // Deliberately NOT accentMuted here — same-hue green-on-green text on this card's
  // accentDark background reads as blending even though it technically clears WCAG
  // contrast math. textPrimary/accent break the hue-family match instead.
  upgradeCardCheck: { color: T.accent, fontSize: 12, fontWeight: "700" },
  upgradeCardPerk: { color: T.textPrimary, fontSize: 13, flex: 1 },
  upgradeCardBtn: {
    marginTop: 10,
    backgroundColor: T.accent,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  upgradeCardBtnText: { color: T.black, fontWeight: "800", fontSize: 13 },

  // Coach action buttons
  actionBar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: "100%",
  },
  actionBtnSecondary: { backgroundColor: T.surface2, borderColor: T.border2 },
  actionBtnBusy: { opacity: 0.7 },
  actionBtnIcon: { fontSize: 13, color: T.accent, fontWeight: "800" },
  actionBtnText: { fontSize: 13, fontWeight: "700", color: T.accent, flexShrink: 1 },
  actionBtnTextSecondary: { color: T.textSecondary },

  // Log-food confirm sheet
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: T.border2,
    padding: 24,
    paddingBottom: 40,
    gap: 4,
  },
  sheetTitle: { fontSize: 13, fontWeight: "800", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  sheetFood: { fontSize: 19, fontWeight: "800", color: T.textPrimary },
  sheetMacros: { fontSize: 14, color: T.teal, fontWeight: "700", marginTop: 4 },
  sheetNote: { fontSize: 12, color: T.textSecondary, marginTop: 6, lineHeight: 18 },
  sheetLabel: { fontSize: 11, fontWeight: "800", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  mealRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mealChip: {
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  mealChipActive: { backgroundColor: T.accentDark, borderColor: T.accent },
  mealChipText: { fontSize: 13, fontWeight: "600", color: T.textSecondary },
  mealChipTextActive: { color: T.accent, fontWeight: "800" },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 24 },
  sheetBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  sheetBtnGhost: { backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border },
  sheetBtnGhostText: { fontSize: 14, fontWeight: "700", color: T.textSecondary },
  sheetBtnPrimary: { backgroundColor: T.accent },
  sheetBtnPrimaryText: { fontSize: 14, fontWeight: "800", color: T.black },

  // Confirmation toast
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastText: { fontSize: 13, color: T.textPrimary, fontWeight: "600", textAlign: "center" },

  // Timestamps — one centered divider per time group, not one per message
  timeDivider: {
    fontSize: 11,
    color: T.textMuted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
  },

  // Typing indicator
  typingBubble: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.accentMuted },

  // Empty state
  emptyState: { paddingTop: 32, paddingHorizontal: 8, alignItems: "center" },
  emptyAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: T.accentDark,
    borderWidth: 2,
    borderColor: T.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyAvatarText: { fontSize: 32 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: T.textPrimary, marginBottom: 8, textAlign: "center" },
  emptySub: { fontSize: 14, color: T.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 32 },

  // Quick prompts
  promptsLabel: {
    fontSize: 11,
    color: T.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  promptsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  promptCard: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "flex-start",
    gap: 8,
  },
  promptEmoji: { fontSize: 24 },
  promptLabel: { fontSize: 13, fontWeight: "700", lineHeight: 18 },

  // Input bar
  inputBar: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  input: {
    flex: 1,
    backgroundColor: T.surface2,
    color: T.textPrimary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: { backgroundColor: T.accent },
  sendBtnInactive: { backgroundColor: T.surface2 },
  sendIcon: { fontSize: 18, fontWeight: "900" },
  sendIconActive: { color: T.black },
  sendIconInactive: { color: T.textMuted },

  // Context prompt strip
  promptStrip: {
    borderTopWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    paddingVertical: 10,
  },
  promptStripContent: { paddingHorizontal: 14, gap: 8 },
  promptChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  promptChipEmoji: { fontSize: 15 },
  promptChipLabel: { fontSize: 13, fontWeight: "600", color: T.textSecondary },
});
