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
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { isPremiumRequiredError } from "@/contexts/UpgradeGateContext";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";
import { posthog, Events } from "@/lib/analytics";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  requiresUpgrade?: boolean;
  upgradeTo?: string | null;
}

type ParsedBlock =
  | { type: "headline"; text: string }
  | { type: "section"; text: string }
  | { type: "bullet"; text: string }
  | { type: "numbered"; n: string; text: string }
  | { type: "body"; text: string };

const QUICK_PROMPT_META = [
  { emoji: "🔥", labelKey: "coach.prompt_calories", qKey: "coach.prompt_calories_q", color: T.red, dark: T.redDark },
  { emoji: "💪", labelKey: "coach.prompt_protein", qKey: "coach.prompt_protein_q", color: T.blue, dark: T.blueDark },
  { emoji: "⚡", labelKey: "coach.prompt_preworkout", qKey: "coach.prompt_preworkout_q", color: T.accent, dark: T.accentDark },
  { emoji: "😴", labelKey: "coach.prompt_sleep", qKey: "coach.prompt_sleep_q", color: T.teal, dark: T.tealDark },
];

function parseBlocks(content: string): ParsedBlock[] {
  const lines = content.split("\n").filter((l) => l.trim());
  let headlineUsed = false;
  return lines.map((line) => {
    const t = line.trim();
    if (/^#{1,3}\s/.test(t)) {
      return { type: "section", text: t.replace(/^#{1,3}\s/, "") };
    }
    if (/^\*\*[^*]+\*\*[:\s]*$/.test(t) && t.length < 70) {
      return { type: "section", text: t.replace(/^\*\*|\*\*[:\s]*$/g, "") };
    }
    if (/^[-•*]\s/.test(t)) {
      return { type: "bullet", text: t.replace(/^[-•*]\s/, "") };
    }
    if (/^\d+[.)]\s/.test(t)) {
      const n = t.match(/^(\d+)/)?.[1] ?? "?";
      return { type: "numbered", n, text: t.replace(/^\d+[.)]\s/, "") };
    }
    if (!headlineUsed) {
      headlineUsed = true;
      return { type: "headline", text: t };
    }
    return { type: "body", text: t };
  });
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

function TypingIndicator() {
  const dots = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

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
        return <InlineText key={i} text={block.text} style={cs.bodyText} />;
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
      setLocalMessages(historyData.messages);
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
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onSuccess: (data) => {
      posthog.capture(Events.COACH_MESSAGE_SENT, { requiresUpgrade: data.requiresUpgrade ?? false });
      const assistantMsg: ChatMessage = {
        id: data.message.id,
        role: "assistant",
        content: data.response,
        createdAt: data.message.createdAt,
        requiresUpgrade: data.requiresUpgrade ?? false,
        upgradeTo: data.upgradeTo ?? null,
      };
      setLocalMessages((prev) => {
        const withoutTemp = prev.filter((m) => !m.id.startsWith("temp-"));
        return [...withoutTemp, ...data.conversationHistory, assistantMsg].filter(
          (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
        );
      });
      queryClient.invalidateQueries({ queryKey: ["chatHistory"] });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={cs.header}>
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
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
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
            {localMessages.map((msg) => (
              <View
                key={msg.id}
                style={[cs.messageRow, msg.role === "user" ? cs.messageRowUser : cs.messageRowCoach]}
              >
                {msg.role === "user" ? (
                  <>
                    <View style={cs.userBubble}>
                      <Text style={cs.userText}>{msg.content}</Text>
                    </View>
                    <Text style={[cs.timestamp, cs.timestampRight]}>
                      {new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </>
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
                      <Text style={cs.timestamp}>
                        {new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
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

      {/* Context Prompt Strip */}
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

      {/* Input */}
      <View style={cs.inputBar}>
        <TextInput
          style={cs.input}
          placeholder={t("coach.input_placeholder")}
          placeholderTextColor={T.textMuted}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => handleSend()}
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
    paddingTop: 56,
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
  onlineText: { fontSize: 11, color: T.accentMuted, fontWeight: "600" },
  clearBtn: { color: T.textSecondary, fontSize: 13 },

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
    maxWidth: "90%",
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
  bodyText: { fontSize: 14, color: T.textSecondary, lineHeight: 22 },
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
  upgradeCardCheck: { color: T.accentMuted, fontSize: 12, fontWeight: "700" },
  upgradeCardPerk: { color: T.accentMuted, fontSize: 13, flex: 1 },
  upgradeCardBtn: {
    marginTop: 10,
    backgroundColor: T.accent,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  upgradeCardBtnText: { color: T.black, fontWeight: "800", fontSize: 13 },

  // Timestamps
  timestamp: { fontSize: 10, color: T.textMuted, marginTop: 4, marginLeft: 6 },
  timestampRight: { textAlign: "right", marginLeft: 0, marginRight: 6 },

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
