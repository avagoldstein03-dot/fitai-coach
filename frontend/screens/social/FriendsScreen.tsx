import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface Friend {
  id: string;
  name: string;
  workoutStreak: number;
  lastWorkoutDate: string | null;
}

interface FriendsData {
  myCode: string;
  friends: Friend[];
}

function formatLastWorkout(dateStr: string | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!dateStr) return t("friends.no_workouts_yet");
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days <= 0) return t("friends.today");
  if (days === 1) return t("friends.yesterday");
  return t("friends.days_ago", { count: days });
}

export default function FriendsScreen() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [cheeredIds, setCheeredIds] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isRefetching } = useQuery<FriendsData>({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/friends`);
      return res.data.data;
    },
    staleTime: 30_000,
  });

  const { mutate: connect, isPending: isConnecting } = useMutation({
    mutationFn: async (friendCode: string) => {
      await axios.post(`${API_URL}/api/friends/connect`, { code: friendCode });
    },
    onSuccess: () => {
      setCode("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (err: any) => {
      Alert.alert(t("common.error"), err.response?.data?.message || t("friends.error_connect"));
    },
  });

  const { mutate: cheer } = useMutation({
    mutationFn: async (friendId: string) => {
      await axios.post(`${API_URL}/api/friends/${friendId}/cheer`);
    },
    onSuccess: (_, friendId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCheeredIds((prev) => new Set(prev).add(friendId));
    },
    onError: (err: any, friendId) => {
      // A 429 means someone else's device already sent today's cheer — treat as sent, not an error.
      if (err.response?.status === 429) {
        setCheeredIds((prev) => new Set(prev).add(friendId));
        return;
      }
      Alert.alert(t("common.error"), err.response?.data?.message || t("friends.error_cheer"));
    },
  });

  const { mutate: unfriend } = useMutation({
    mutationFn: async (friendId: string) => {
      await axios.delete(`${API_URL}/api/friends/${friendId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["friends"] }),
    onError: () => Alert.alert(t("common.error"), t("friends.error_remove")),
  });

  const confirmUnfriend = (friend: Friend) => {
    Alert.alert(t("friends.remove_title"), t("friends.remove_msg", { name: friend.name }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("friends.remove_button"), style: "destructive", onPress: () => unfriend(friend.id) },
    ]);
  };

  const shareCode = () => {
    if (!data?.myCode) return;
    Share.share({
      message: t("friends.share_message", { code: data.myCode }),
    });
  };

  const handleConnect = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    connect(trimmed);
  };

  if (isLoading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.accent} />}
    >
      <View style={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.heading}>{t("friends.title")} 🤝</Text>

        {/* Your code */}
        <View style={s.codeCard}>
          <Text style={s.codeLabel}>{t("friends.your_code")}</Text>
          <Text style={s.codeValue}>{data?.myCode}</Text>
          <TouchableOpacity style={s.shareBtn} onPress={shareCode}>
            <Text style={s.shareBtnText}>{t("friends.share_code")}</Text>
          </TouchableOpacity>
        </View>

        {/* Connect via code */}
        <View style={s.connectCard}>
          <Text style={s.connectLabel}>{t("friends.connect_label")}</Text>
          <View style={s.connectRow}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              placeholder={t("friends.code_placeholder")}
              placeholderTextColor={T.textMuted}
              autoCapitalize="characters"
              maxLength={12}
              style={s.connectInput}
            />
            <TouchableOpacity
              style={[s.connectBtn, (isConnecting || !code.trim()) && s.connectBtnDisabled]}
              onPress={handleConnect}
              disabled={isConnecting || !code.trim()}
            >
              {isConnecting ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={s.connectBtnText}>{t("friends.connect_button")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Friends list */}
        <Text style={s.sectionTitle}>{t("friends.your_friends")}</Text>
        {!data?.friends?.length ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>{t("friends.empty")}</Text>
          </View>
        ) : (
          data.friends.map((friend) => {
            const alreadyCheered = cheeredIds.has(friend.id);
            return (
              <View key={friend.id} style={s.friendRow}>
                <View style={s.friendInfo}>
                  <Text style={s.friendName}>{friend.name}</Text>
                  <Text style={s.friendMeta}>
                    {friend.workoutStreak > 0
                      ? `🔥 ${t("friends.streak_days", { count: friend.workoutStreak })}`
                      : t("friends.no_streak")}
                    {"  ·  "}
                    {formatLastWorkout(friend.lastWorkoutDate, t)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.cheerBtn, alreadyCheered && s.cheerBtnDisabled]}
                  onPress={() => cheer(friend.id)}
                  disabled={alreadyCheered}
                >
                  <Text style={[s.cheerBtnText, alreadyCheered && s.cheerBtnTextDisabled]}>
                    {alreadyCheered ? "👋" : t("friends.cheer_button")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.removeBtn} onPress={() => confirmUnfriend(friend)}>
                  <Text style={s.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loadingScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  container: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 40 },
  back: { marginBottom: 12 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  heading: { fontSize: 24, fontWeight: "800", color: T.textPrimary, marginBottom: 20 },

  codeCard: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  codeLabel: { fontSize: 12, color: T.accentMuted, marginBottom: 6 },
  codeValue: { fontSize: 28, fontWeight: "800", color: T.accent, letterSpacing: 4, marginBottom: 14 },
  shareBtn: { backgroundColor: T.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  shareBtnText: { color: "#000", fontWeight: "700", fontSize: 13 },

  connectCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  connectLabel: { fontSize: 13, fontWeight: "600", color: T.textPrimary, marginBottom: 10 },
  connectRow: { flexDirection: "row", gap: 10 },
  connectInput: {
    flex: 1,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: T.textPrimary,
    fontSize: 15,
    letterSpacing: 2,
  },
  connectBtn: {
    backgroundColor: T.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  connectBtnDisabled: { backgroundColor: T.surface2 },
  connectBtnText: { color: "#000", fontWeight: "700", fontSize: 13 },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: T.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  emptyCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
  },
  emptyText: { color: T.textSecondary, fontSize: 13, textAlign: "center" },

  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 4 },
  friendMeta: { fontSize: 12, color: T.textSecondary },
  cheerBtn: { backgroundColor: T.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  cheerBtnDisabled: { backgroundColor: T.surface2 },
  cheerBtnText: { color: "#000", fontWeight: "700", fontSize: 13 },
  cheerBtnTextDisabled: { fontSize: 16 },
  removeBtn: { padding: 6 },
  removeBtnText: { color: T.textMuted, fontSize: 15, fontWeight: "700" },
});
