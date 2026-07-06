import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
  Dimensions,
  StyleSheet,
  Share,
} from "react-native";

import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const SCREEN_WIDTH = Dimensions.get("window").width;
const THUMB_SIZE = (SCREEN_WIDTH - 48) / 3;

interface ProgressPhoto {
  id: string;
  photoUrl: string;
  photoType: "front" | "side" | "back" | "full_body";
  notes: string | null;
  createdAt: string;
}

function PhotoThumb({
  photo, onPress, compareMode, isSelected, onCompareToggle,
}: {
  photo: ProgressPhoto;
  onPress: () => void;
  compareMode?: boolean;
  isSelected?: boolean;
  onCompareToggle?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const TYPE_LABELS: Record<string, string> = {
    front: t("progress_photos.front"),
    side: t("progress_photos.side"),
    back: t("progress_photos.back"),
    full_body: t("progress_photos.full_body"),
  };
  const baseUrl = API_URL?.replace("/api", "") ?? "";
  const uri = photo.photoUrl.startsWith("http") ? photo.photoUrl : `${baseUrl}${photo.photoUrl}`;

  return (
    <TouchableOpacity
      onPress={compareMode ? onCompareToggle : onPress}
      style={{ width: THUMB_SIZE, height: THUMB_SIZE, margin: 4 }}
    >
      <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: 8 }} resizeMode="cover" />
      <View style={s.thumbLabel}>
        <Text style={s.thumbLabelText}>{TYPE_LABELS[photo.photoType]}</Text>
        <Text style={s.thumbDateText}>
          {new Date(photo.createdAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
        </Text>
      </View>
      {compareMode && (
        <View style={[s.compareOverlay, isSelected && s.compareOverlaySelected]}>
          <Text style={s.compareCheckmark}>{isSelected ? "✓" : ""}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ProgressPhotosScreen() {
  const navigation = useNavigation() as any;
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const TYPE_LABELS: Record<string, string> = {
    front: t("progress_photos.front"),
    side: t("progress_photos.side"),
    back: t("progress_photos.back"),
    full_body: t("progress_photos.full_body"),
  };
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);
  const [uploadType, setUploadType] = useState<"front" | "side" | "back" | "full_body">("full_body");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePhotos, setComparePhotos] = useState<ProgressPhoto[]>([]);
  const [isSharing, setIsSharing] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["progress-photos"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/progress/photos?limit=50`);
      return res.data?.data as { photos: ProgressPhoto[]; total: number };
    },
  });

  const { mutate: upload, isPending: isUploading } = useMutation({
    mutationFn: async ({ base64, photoType }: { base64: string; photoType: string }) => {
      await axios.post(`${API_URL}/api/progress/photos`, { base64, photoType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress-photos"] });
      setShowUploadModal(false);
      Alert.alert(t("progress_photos.upload_success"), t("progress_photos.upload_success_msg"));
    },
    onError: () => Alert.alert(t("common.error"), t("progress_photos.error_upload")),
  });

  const { mutate: deletePhoto, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${API_URL}/api/progress/photos?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress-photos"] });
      setSelectedPhoto(null);
    },
    onError: () => Alert.alert(t("common.error"), t("progress_photos.error_delete")),
  });

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("progress_photos.permission_title"), t("progress_photos.permission_msg"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      upload({ base64: result.assets[0].base64, photoType: uploadType });
    }
  }, [uploadType, upload]);

  const sharePhoto = useCallback(async (photo: ProgressPhoto) => {
    setIsSharing(true);
    try {
      const uri = photo.photoUrl.startsWith("http")
        ? photo.photoUrl
        : `${API_URL?.replace("/api", "")}${photo.photoUrl}`;
      await Share.share({ url: uri, message: t("progress_photos.share_msg") });
    } catch {
      Alert.alert(t("common.error"), t("progress_photos.error_share"));
    } finally {
      setIsSharing(false);
    }
  }, []);

  const toggleCompareSelect = useCallback((photo: ProgressPhoto) => {
    setComparePhotos((prev) => {
      if (prev.find((p) => p.id === photo.id)) return prev.filter((p) => p.id !== photo.id);
      if (prev.length >= 2) return [prev[1], photo];
      return [...prev, photo];
    });
  }, []);

  const photos = data?.photos ?? [];

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t("progress_photos.title")}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {photos.length >= 2 && (
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCompareMode((v) => !v); setComparePhotos([]); }}
              style={[s.addBtn, compareMode && s.addBtnActive]}
              accessibilityLabel={t("progress_photos.compare_toggle")}
              accessibilityRole="button"
            >
              <Text style={[s.addBtnText, compareMode && s.addBtnTextActive]}>⇄</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowUploadModal(true)} style={s.addBtn}>
            <Text style={s.addBtnText}>{t("progress_photos.add_photo")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : isError ? (
        <View style={s.centered}>
          <Text style={s.errorText}>⚠️ {t("common.error")}</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
            <Text style={s.retryBtnText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : photos.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>📸</Text>
          <Text style={s.emptyTitle}>{t("progress_photos.empty_title")}</Text>
          <Text style={s.emptySub}>{t("progress_photos.empty_sub")}</Text>
          <TouchableOpacity onPress={() => setShowUploadModal(true)} style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>{t("progress_photos.add_photo")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          numColumns={3}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.accent} />}
          renderItem={({ item }) => (
            <PhotoThumb
              photo={item}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedPhoto(item); }}
              compareMode={compareMode}
              isSelected={comparePhotos.some((p) => p.id === item.id)}
              onCompareToggle={() => toggleCompareSelect(item)}
            />
          )}
        />
      )}

      {/* Upload modal */}
      <Modal visible={showUploadModal} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>{t("progress_photos.upload_title")}</Text>

            <Text style={s.modalSectionLabel}>{t("progress_photos.photo_type")}</Text>
            <View style={s.typeRow}>
              {(["full_body", "front", "side", "back"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUploadType(type); }}
                  style={[s.typeChip, uploadType === type && s.typeChipActive]}
                >
                  <Text style={[s.typeChipText, uploadType === type && s.typeChipTextActive]}>
                    {TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={pickImage} disabled={isUploading} style={s.primaryBtn}>
              {isUploading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={s.primaryBtnText}>{t("progress_photos.choose_from_library")}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowUploadModal(false)} style={s.cancelBtn}>
              <Text style={s.cancelBtnText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full-screen viewer */}
      <Modal visible={!!selectedPhoto} transparent animationType="fade">
        <View style={s.viewerScreen}>
          {selectedPhoto && (
            <>
              <TouchableOpacity onPress={() => setSelectedPhoto(null)} style={s.closeBtn} accessibilityLabel={t("common.close")} accessibilityRole="button">
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>

              <Image
                source={{
                  uri: selectedPhoto.photoUrl.startsWith("http")
                    ? selectedPhoto.photoUrl
                    : `${API_URL?.replace("/api", "")}${selectedPhoto.photoUrl}`,
                }}
                style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.3 }}
                resizeMode="contain"
              />

              <View style={s.viewerInfo}>
                <Text style={s.viewerTypeLabel}>{TYPE_LABELS[selectedPhoto.photoType]}</Text>
                <Text style={s.viewerDate}>
                  {new Date(selectedPhoto.createdAt).toLocaleDateString(i18n.language, {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </Text>
                {selectedPhoto.notes && (
                  <Text style={s.viewerNotes}>{selectedPhoto.notes}</Text>
                )}

                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    onPress={() => sharePhoto(selectedPhoto)}
                    disabled={isSharing}
                    style={[s.shareBtn, { flex: 1 }]}
                  >
                    {isSharing ? (
                      <ActivityIndicator color={T.accent} />
                    ) : (
                      <Text style={s.shareBtnText}>{t("common.share")}</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(t("progress_photos.delete_title"), t("progress_photos.delete_msg"), [
                        { text: t("common.cancel"), style: "cancel" },
                        { text: t("progress_photos.delete_button"), style: "destructive", onPress: () => deletePhoto(selectedPhoto.id) },
                      ])
                    }
                    disabled={isDeleting}
                    style={[s.deleteBtn, { flex: 1 }]}
                  >
                    {isDeleting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={s.deleteBtnText}>{t("progress_photos.delete_button")}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Before/After comparison modal */}
      <Modal visible={comparePhotos.length === 2} transparent animationType="fade">
        <View style={s.compareScreen}>
          <TouchableOpacity
            onPress={() => { setComparePhotos([]); setCompareMode(false); }}
            style={s.closeBtn}
            accessibilityLabel={t("common.close")} accessibilityRole="button"
          >
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {comparePhotos.length === 2 && (() => {
            const sorted = [...comparePhotos].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            const msElapsed = new Date(sorted[1].createdAt).getTime() - new Date(sorted[0].createdAt).getTime();
            const weeksElapsed = Math.round(msElapsed / (7 * 24 * 60 * 60 * 1000));
            const elapsed = weeksElapsed >= 4
              ? t("progress_photos.elapsed_months", { count: Math.round(weeksElapsed / 4.33) })
              : weeksElapsed > 0
              ? t("progress_photos.elapsed_weeks", { count: weeksElapsed })
              : t("progress_photos.elapsed_same_day");
            return (
              <>
                <View style={s.compareHeaderRow}>
                  <Text style={s.compareTitle}>{t("progress_photos.compare_title")}</Text>
                  {weeksElapsed > 0 && (
                    <View style={s.elapsedBadge}>
                      <Text style={s.elapsedBadgeText}>⏱ {elapsed}</Text>
                    </View>
                  )}
                </View>
                <View style={s.compareRow}>
                  {sorted.map((p, i) => {
                    const cUri = p.photoUrl.startsWith("http")
                      ? p.photoUrl
                      : `${API_URL?.replace("/api", "")}${p.photoUrl}`;
                    return (
                      <View key={p.id} style={s.comparePane}>
                        <Image source={{ uri: cUri }} style={s.compareImage} resizeMode="cover" />
                        <View style={s.comparePaneLabelRow}>
                          <View style={[s.beforeAfterBadge, i === 1 && s.afterBadge]}>
                            <Text style={[s.beforeAfterText, i === 1 && s.afterText]}>
                              {i === 0 ? t("progress_photos.before") : t("progress_photos.after")}
                            </Text>
                          </View>
                          <Text style={s.comparePaneDate}>
                            {new Date(p.createdAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            );
          })()}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12 },
  backBtn: { marginRight: 12 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.textPrimary, flex: 1 },
  addBtn: { backgroundColor: T.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  addBtnText: { color: "#000", fontWeight: "700", fontSize: 13 },
  addBtnActive: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.accent },
  addBtnTextActive: { color: T.accent },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: T.textSecondary, fontSize: 16, marginBottom: 16 },
  retryBtn: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: T.accent, fontWeight: "700", fontSize: 15 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: T.textPrimary, textAlign: "center", marginBottom: 8 },
  emptySub: { fontSize: 14, color: T.textSecondary, textAlign: "center", marginBottom: 24 },
  thumbLabel: { position: "absolute", bottom: 4, left: 4, right: 4, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 3 },
  thumbLabelText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  thumbDateText: { color: "rgba(255,255,255,0.7)", fontSize: 9 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: T.textPrimary, marginBottom: 20 },
  modalSectionLabel: { fontSize: 12, color: T.textSecondary, marginBottom: 12 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bg,
  },
  typeChipActive: { backgroundColor: T.accent, borderColor: T.accent },
  typeChipText: { color: T.textPrimary, fontWeight: "600" },
  typeChipTextActive: { color: "#000" },
  primaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  cancelBtn: { paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { color: T.textSecondary, fontSize: 14 },
  viewerScreen: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
  closeBtn: { position: "absolute", top: 56, right: 24, zIndex: 10 },
  closeBtnText: { color: "#fff", fontSize: 28, fontWeight: "300" },
  viewerInfo: { paddingHorizontal: 24, paddingTop: 16 },
  viewerTypeLabel: { color: "#fff", fontWeight: "600", fontSize: 17 },
  viewerDate: { color: T.textSecondary, fontSize: 13, marginTop: 4 },
  viewerNotes: { color: T.textPrimary, marginTop: 8, fontSize: 14 },
  deleteBtn: { backgroundColor: T.red, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  shareBtn: { backgroundColor: T.surface, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: T.accent },
  shareBtnText: { color: T.accent, fontWeight: "700", fontSize: 15 },
  compareOverlay: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 8,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center", alignItems: "center",
  },
  compareOverlaySelected: { borderColor: T.accent, backgroundColor: "rgba(168,85,247,0.25)" },
  compareCheckmark: { fontSize: 28, color: T.accent, fontWeight: "700" },
  compareScreen: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  compareHeaderRow: { alignItems: "center", marginBottom: 12, gap: 6 },
  compareTitle: { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  elapsedBadge: { backgroundColor: T.accentDark, borderWidth: 1, borderColor: T.accentBorder, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  elapsedBadgeText: { color: T.accent, fontSize: 12, fontWeight: "700" },
  compareRow: { flexDirection: "row", flex: 1, paddingHorizontal: 8, gap: 8 },
  comparePane: { flex: 1, gap: 6 },
  compareImage: { flex: 1, borderRadius: 10 },
  comparePaneLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, paddingHorizontal: 2 },
  beforeAfterBadge: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  afterBadge: { backgroundColor: `${T.accentDark}cc`, borderWidth: 1, borderColor: T.accentBorder },
  beforeAfterText: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  afterText: { color: T.accent },
  comparePaneDate: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
  comparePaneLabel: { color: T.textSecondary, fontSize: 12, textAlign: "center", paddingBottom: 16 },
});
