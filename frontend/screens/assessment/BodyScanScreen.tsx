import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";
import { useNavigation } from "@react-navigation/native";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface PhotoData {
  position: "front" | "side" | "back";
  localUri?: string;
  serverUri?: string;
  uploaded?: boolean;
}

interface ScanState {
  scanId?: string;
  front?: PhotoData;
  side?: PhotoData;
  back?: PhotoData;
}

const POSITIONS = [
  { key: "front" as const, labelKey: "body_scan.front_view", icon: "⬆️", hintKey: "body_scan.front_hint" },
  { key: "side" as const, labelKey: "body_scan.side_view", icon: "➡️", hintKey: "body_scan.side_hint" },
  { key: "back" as const, labelKey: "body_scan.back_view", icon: "⬇️", hintKey: "body_scan.back_hint" },
];

export default function BodyScanScreen() {
  const navigation = useNavigation() as any;
  const { t, i18n } = useTranslation();
  const [scanState, setScanState] = useState<ScanState>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: assessmentData, refetch: refetchAssessments, isRefetching: isRefetchingAssessments } = useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/assessment/history`);
      return response.data.data;
    },
  });

  const lastAssessment = assessmentData?.assessments?.[0];

  const { mutate: uploadImage, isPending: isUploading } = useMutation({
    mutationFn: async ({
      position,
      base64,
    }: {
      position: "front" | "side" | "back";
      base64: string;
    }) => {
      const response = await axios.post(`${API_URL}/api/assessment/upload`, {
        base64,
        position,
        scanId: scanState.scanId,
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      const key = data.position as "front" | "side" | "back";
      setScanState((prev) => ({
        ...prev,
        scanId: data.scanId,
        [key]: {
          ...(prev[key] ?? ({} as PhotoData)),
          serverUri: data.imageUrl,
          uploaded: true,
        },
      }));
    },
    onError: () => {
      Alert.alert(t("common.error"), t("body_scan.error"));
    },
  });

  const { mutate: analyzeBody, isPending: isAnalyzingMutation } = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`${API_URL}/api/assessment/analyze`, {
        scanId: scanState.scanId,
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      setIsAnalyzing(false);
      navigation.navigate("AssessmentResults", {
        assessment: data.assessment,
        assessmentId: data.assessmentId,
        frontImageUri: scanState.front?.localUri,
      });
    },
    onError: (error: any) => {
      setIsAnalyzing(false);
      Alert.alert(t("body_scan.error"), error.response?.data?.message || t("common.retry"));
    },
  });

  const launchPicker = async (position: "front" | "side" | "back", useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(t("body_scan.permission_camera_title"), t("body_scan.permission_camera_msg"));
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"] as any,
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.8,
          base64: true,
        });
        if (!result.canceled && result.assets[0].base64) {
          setScanState((prev) => ({
            ...prev,
            [position]: { position, localUri: result.assets[0].uri, uploaded: false },
          }));
          uploadImage({ position, base64: result.assets[0].base64 });
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(t("body_scan.permission_camera_title"), t("body_scan.permission_photos_msg"));
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"] as any,
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.8,
          base64: true,
        });
        if (!result.canceled && result.assets[0].base64) {
          setScanState((prev) => ({
            ...prev,
            [position]: { position, localUri: result.assets[0].uri, uploaded: false },
          }));
          uploadImage({ position, base64: result.assets[0].base64 });
        }
      }
    } catch {
      Alert.alert(t("common.error"), t("body_scan.error_pick"));
    }
  };

  const pickImage = (position: "front" | "side" | "back") => {
    Alert.alert(t("food_scanner.log_meal_title"), t("food_scanner.log_meal_sources"), [
      { text: t("food_scanner.take_photo"), onPress: () => launchPicker(position, true) },
      { text: t("food_scanner.choose_library"), onPress: () => launchPicker(position, false) },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const isScanned =
    scanState.front?.uploaded &&
    scanState.side?.uploaded &&
    scanState.back?.uploaded;

  const uploadedCount = [scanState.front, scanState.side, scanState.back].filter(
    (p) => p?.uploaded
  ).length;

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetchingAssessments} onRefresh={refetchAssessments} tintColor={T.accent} />}
    >
      <View style={styles.container}>
        {/* Header */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t("body_scan.scan_title")}</Text>
        <Text style={styles.subtitle}>{t("body_scan.scan_sub")}</Text>

        {/* Progress indicator */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>{t("body_scan.photos_uploaded")}</Text>
            <Text style={styles.progressCount}>{uploadedCount} / 3</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(uploadedCount / 3) * 100}%` as any }]} />
          </View>
        </View>

        {/* Last Assessment Banner */}
        {lastAssessment?.assessment && (
          <TouchableOpacity
            style={styles.lastAssessmentCard}
            onPress={() =>
              navigation.navigate("AssessmentResults", {
                assessment: lastAssessment.assessment,
                assessmentId: lastAssessment.id,
              })
            }
          >
            <View style={styles.lastAssessmentLeft}>
              <Text style={styles.lastAssessmentTitle}>{t("body_scan.last_assessment")}</Text>
              <Text style={styles.lastAssessmentDate}>
                {new Date(lastAssessment.assessment.createdAt).toLocaleDateString(i18n.language, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <Text style={styles.lastAssessmentArrow}>{t("body_scan.view_last")}</Text>
          </TouchableOpacity>
        )}

        {/* Live 360 Scan */}
        <TouchableOpacity
          onPress={() => navigation.navigate("LiveBodyScan")}
          style={styles.liveScanCard}
          activeOpacity={0.85}
        >
          <View style={styles.liveScanLeft}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.liveScanTitle}>{t("body_scan.live_360_title")}</Text>
            <Text style={styles.liveScanSub}>{t("body_scan.live_360_sub")}</Text>
          </View>
          <Text style={styles.liveScanArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t("body_scan.or_upload")}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Photo Upload Cards */}
        <View style={styles.photoGrid}>
          {POSITIONS.map(({ key, labelKey, icon, hintKey }) => {
            const photo = scanState[key];
            const uploaded = photo?.uploaded;
            return (
              <View key={key} style={[styles.photoCard, uploaded && styles.photoCardDone]}>
                {photo?.localUri ? (
                  <Image
                    source={{ uri: photo.localUri }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoIcon}>{icon}</Text>
                  </View>
                )}
                <View style={styles.photoInfo}>
                  <View style={styles.photoLabelRow}>
                    <Text style={styles.photoLabel}>{t(labelKey)}</Text>
                    {uploaded && <Text style={styles.photoCheck}>✓</Text>}
                  </View>
                  <Text style={styles.photoHint}>{t(hintKey)}</Text>
                  <TouchableOpacity
                    onPress={() => pickImage(key)}
                    disabled={isUploading}
                    style={[styles.photoBtn, uploaded && styles.photoBtnDone]}
                  >
                    {isUploading && !photo?.uploaded ? (
                      <ActivityIndicator color={T.accent} size="small" />
                    ) : (
                      <Text style={[styles.photoBtnText, uploaded && styles.photoBtnTextDone]}>
                        {uploaded ? t("body_scan.re_upload") : t("body_scan.upload")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Analyze Button */}
        {isScanned && (
          <TouchableOpacity
            onPress={() => {
              setIsAnalyzing(true);
              analyzeBody();
            }}
            disabled={isAnalyzingMutation || isAnalyzing}
            style={[styles.analyzeBtn, (isAnalyzingMutation || isAnalyzing) && styles.analyzeBtnLoading]}
            activeOpacity={0.85}
          >
            {isAnalyzing || isAnalyzingMutation ? (
              <View style={styles.analyzingRow}>
                <ActivityIndicator color={T.accent} />
                <Text style={styles.analyzingText}>{t("body_scan.analyzing")}</Text>
              </View>
            ) : (
              <Text style={styles.analyzeBtnText}>{t("body_scan.start_scan")}</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>{t("body_scan.tips_title")}</Text>
          {(t("body_scan.tips", { returnObjects: true }) as string[]).map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48 },

  backBtn: { marginBottom: 20 },
  backText: { color: T.accent, fontSize: 15, fontWeight: "600" },

  title: { fontSize: 30, fontWeight: "800", color: T.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 14, color: T.textSecondary, marginBottom: 24 },

  // Progress
  progressCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    marginBottom: 16,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  progressLabel: { fontSize: 13, color: T.textSecondary, fontWeight: "600" },
  progressCount: { fontSize: 13, color: T.accent, fontWeight: "700" },
  progressTrack: {
    height: 4,
    backgroundColor: T.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: T.accent, borderRadius: 2 },

  // Last Assessment
  lastAssessmentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.accentDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.accentBorder,
    padding: 16,
    marginBottom: 16,
  },
  lastAssessmentLeft: { flex: 1 },
  lastAssessmentTitle: { fontSize: 14, fontWeight: "700", color: T.accentMuted, marginBottom: 2 },
  lastAssessmentDate: { fontSize: 12, color: T.accent },
  lastAssessmentArrow: { color: T.accent, fontSize: 14, fontWeight: "700" },

  // Live Scan
  liveScanCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border2,
    padding: 20,
    marginBottom: 24,
  },
  liveScanLeft: { flex: 1 },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.red },
  liveText: { fontSize: 10, color: T.red, fontWeight: "800", letterSpacing: 1 },
  liveScanTitle: { fontSize: 17, fontWeight: "800", color: T.textPrimary, marginBottom: 4 },
  liveScanSub: { fontSize: 12, color: T.textSecondary },
  liveScanArrow: { fontSize: 20, color: T.accent, fontWeight: "700" },

  // Divider
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: T.border },
  dividerText: { fontSize: 10, color: T.textMuted, fontWeight: "700", letterSpacing: 1 },

  // Photo Grid
  photoGrid: { gap: 12, marginBottom: 20 },
  photoCard: {
    flexDirection: "row",
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
  },
  photoCardDone: { borderColor: T.accentBorder },
  photoPreview: { width: 90, height: 120 },
  photoPlaceholder: {
    width: 90,
    height: 120,
    backgroundColor: T.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  photoIcon: { fontSize: 28 },
  photoInfo: { flex: 1, padding: 14, justifyContent: "space-between" },
  photoLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoLabel: { fontSize: 15, fontWeight: "700", color: T.textPrimary },
  photoCheck: { fontSize: 14, color: T.green, fontWeight: "700" },
  photoHint: { fontSize: 12, color: T.textSecondary, marginTop: 4, flex: 1 },
  photoBtn: {
    backgroundColor: T.surface2,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  photoBtnDone: { backgroundColor: T.accentDark, borderWidth: 1, borderColor: T.accentBorder },
  photoBtnText: { color: T.textPrimary, fontSize: 13, fontWeight: "700" },
  photoBtnTextDone: { color: T.accent },

  // Analyze
  analyzeBtn: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginBottom: 20,
  },
  analyzeBtnLoading: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  analyzingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  analyzingText: { color: T.accent, fontSize: 15, fontWeight: "600" },
  analyzeBtnText: { color: T.accent, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },

  // Tips
  tipsCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
  },
  tipsTitle: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 14 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, gap: 10 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent, marginTop: 5 },
  tipText: { flex: 1, fontSize: 13, color: T.textSecondary, lineHeight: 18 },
});
