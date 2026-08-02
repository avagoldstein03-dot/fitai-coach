import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useUpgradeGate, isPremiumRequiredError } from "@/contexts/UpgradeGateContext";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const CAPTURE_INTERVAL_MS = 2000;
const MAX_FRAMES = 3;

interface FormCheckResult {
  exerciseName: string;
  overallScore: number;
  muscles: string[];
  positives: string[];
  corrections: string[];
  cues: string[];
  safetyWarnings: string[];
  summary: string;
}

export default function FormCheckScreen() {
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { exerciseName, formCues } = route.params ?? {};
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { presentUpgrade } = useUpgradeGate();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [showInstructions, setShowInstructions] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<FormCheckResult | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const captured = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const captureFrame = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.6 });
      if (photo?.base64) {
        captured.current.push(photo.base64);
        if (captured.current.length > MAX_FRAMES) {
          captured.current.shift();
        }
      }
    } catch (error) {
      console.error("Failed to capture form-check frame:", error);
    }
  };

  const runFormCheck = async () => {
    if (captured.current.length === 0) {
      setScanning(false);
      Alert.alert(t("form_check.check_failed"), t("form_check.no_frames_captured"));
      setShowInstructions(true);
      return;
    }

    setIsProcessing(true);
    try {
      const res = await axios.post(`${API_URL}/api/workouts/form-check`, {
        exerciseName,
        images: captured.current.map((base64) => ({ base64, mimeType: "image/jpeg" })),
        formCues,
      });
      setIsProcessing(false);
      setResult(res.data.data.formCheck);
    } catch (err: any) {
      setIsProcessing(false);
      setScanning(false);
      if (isPremiumRequiredError(err)) {
        presentUpgrade();
        navigation.goBack();
      } else {
        Alert.alert(
          t("form_check.check_failed"),
          err?.response?.data?.message || t("form_check.check_failed_msg")
        );
        setShowInstructions(true);
      }
    }
  };

  const startScan = () => {
    captured.current = [];
    setElapsedSec(0);
    setScanning(true);
    captureFrame();

    const startedAt = Date.now();
    const elapsedInterval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    timers.current.push(elapsedInterval as unknown as ReturnType<typeof setTimeout>);

    const captureInterval = setInterval(captureFrame, CAPTURE_INTERVAL_MS);
    timers.current.push(captureInterval as unknown as ReturnType<typeof setTimeout>);
  };

  const stopScan = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setScanning(false);
    runFormCheck();
  };

  const beginCameraReady = () => {
    if (!permission?.granted) {
      requestPermission();
      return;
    }
    setShowInstructions(false);
  };

  const resetToInstructions = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setScanning(false);
    setIsProcessing(false);
    setElapsedSec(0);
    setResult(null);
    setShowInstructions(true);
  };

  const cancelScan = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setScanning(false);
    setIsProcessing(false);
    setElapsedSec(0);
    setShowInstructions(true);
  };

  if (result) {
    return (
      <ScrollView style={s.resultsScreen} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[s.resultsHeader, { paddingTop: insets.top + 16 }]}>
          <Text style={s.resultsExercise}>{result.exerciseName}</Text>
          <View style={s.scoreCircle}>
            <Text style={s.scoreValue}>{result.overallScore}</Text>
            <Text style={s.scoreMax}>/10</Text>
          </View>
          <Text style={s.scoreLabel}>{t("form_check.score_label")}</Text>
        </View>

        {result.muscles?.length > 0 && (
          <View style={s.resultsSection}>
            <Text style={s.sectionTitle}>{t("form_check.muscles_label")}</Text>
            <View style={s.chipRow}>
              {result.muscles.map((m, i) => (
                <View key={i} style={s.chip}>
                  <Text style={s.chipText}>{m}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {result.positives?.length > 0 && (
          <View style={[s.card, s.positiveCard]}>
            <Text style={[s.cardTitle, { color: T.green }]}>{t("form_check.positives_label")}</Text>
            {result.positives.map((item, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={[s.bullet, { color: T.green }]}>✓</Text>
                <Text style={s.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {result.corrections?.length > 0 && (
          <View style={[s.card, s.correctionCard]}>
            <Text style={[s.cardTitle, { color: T.amber }]}>{t("form_check.corrections_label")}</Text>
            {result.corrections.map((item, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={[s.bullet, { color: T.amber }]}>→</Text>
                <Text style={s.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {result.cues?.length > 0 && (
          <View style={s.resultsSection}>
            <Text style={s.sectionTitle}>{t("form_check.cues_label")}</Text>
            <View style={s.chipRow}>
              {result.cues.map((cue, i) => (
                <View key={i} style={s.cueChip}>
                  <Text style={s.cueChipText}>{cue}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {result.safetyWarnings?.length > 0 && (
          <View style={[s.card, s.warningCard]}>
            <Text style={[s.cardTitle, { color: T.red }]}>{t("form_check.safety_label")}</Text>
            {result.safetyWarnings.map((item, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={[s.bullet, { color: T.red }]}>⚠</Text>
                <Text style={s.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>{t("form_check.summary_label")}</Text>
          <Text style={s.summaryText}>{result.summary}</Text>
        </View>

        <View style={s.resultsActions}>
          <TouchableOpacity onPress={resetToInstructions} style={s.secondaryBtn}>
            <Text style={s.secondaryBtnText}>{t("form_check.check_again")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>{t("form_check.done")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (!permission) {
    return (
      <View style={s.fullBlack}>
        <ActivityIndicator color={T.accent} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={s.permissionScreen}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          style={[s.topBack, { top: insets.top + 12 }]}
        >
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.permissionIcon}>📷</Text>
        <Text style={s.permissionTitle}>{t("form_check.permission_title")}</Text>
        <Text style={s.permissionSub}>{t("form_check.permission_sub")}</Text>
        <TouchableOpacity onPress={requestPermission} style={s.grantBtn}>
          <Text style={s.grantBtnText}>{t("form_check.grant_permission")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showInstructions) {
    return (
      <View style={s.instructionsScreen}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          style={[s.topBack, { top: insets.top + 12 }]}
        >
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.permissionIcon}>🏋️</Text>
        <Text style={s.permissionTitle}>{exerciseName}</Text>
        <Text style={s.permissionSub}>{t("form_check.prep_sub")}</Text>
        <View style={s.tipsList}>
          {[
            t("form_check.prep_tip_frame"),
            t("form_check.prep_tip_light"),
            t("form_check.prep_tip_pace"),
          ].map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <Text style={s.tipBullet}>•</Text>
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={beginCameraReady} style={s.grantBtn}>
          <Text style={s.grantBtnText}>{t("form_check.prep_ready_btn")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.fullBlack}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      <View style={[s.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => { cancelScan(); navigation.goBack(); }}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          style={s.topBarBack}
        >
          <Text style={s.topBarBackText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>{exerciseName}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.bottomControls}>
        {isProcessing ? (
          <View style={s.processingRow}>
            <ActivityIndicator color={T.accent} size="large" />
            <Text style={s.statusText}>{t("form_check.status_analyzing")}</Text>
          </View>
        ) : scanning ? (
          <>
            <View style={s.recordingRow}>
              <View style={s.recordingDot} />
              <Text style={s.statusText}>
                {t("form_check.status_recording", { seconds: elapsedSec })}
              </Text>
            </View>
            <TouchableOpacity onPress={stopScan} style={s.stopBtn}>
              <Text style={s.stopBtnText}>{t("form_check.stop_recording")}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.statusText}>{t("form_check.ready_hint")}</Text>
            <TouchableOpacity onPress={startScan} style={s.startBtn}>
              <Text style={s.startBtnText}>{t("form_check.start_recording")}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fullBlack: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  permissionScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  instructionsScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  tipsList: { alignSelf: "stretch", marginBottom: 32 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  tipBullet: { color: T.accent, fontSize: 16, marginRight: 10, lineHeight: 21 },
  tipText: { flex: 1, color: T.textPrimary, fontSize: 15, lineHeight: 21 },
  topBack: { position: "absolute", left: 16, zIndex: 10 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  permissionIcon: { fontSize: 48, marginBottom: 16 },
  permissionTitle: { fontSize: 20, fontWeight: "700", color: T.textPrimary, textAlign: "center", marginBottom: 8 },
  permissionSub: { fontSize: 14, color: T.textSecondary, textAlign: "center", marginBottom: 24 },
  grantBtn: { backgroundColor: T.accent, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12 },
  grantBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  topBar: {
    position: "absolute", left: 0, right: 0, zIndex: 20, paddingHorizontal: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  topBarBack: { backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  topBarBackText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  topBarTitle: {
    color: "#fff", fontWeight: "600", backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, maxWidth: 200,
  },
  bottomControls: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 24, backgroundColor: "rgba(0,0,0,0.6)",
  },
  statusText: { color: "#fff", textAlign: "center", marginBottom: 16, fontSize: 14 },
  processingRow: { alignItems: "center", paddingVertical: 16 },
  recordingRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 16 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.red },
  startBtn: { backgroundColor: T.accent, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  startBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  stopBtn: { backgroundColor: T.red, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  stopBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  resultsScreen: { flex: 1, backgroundColor: T.bg },
  resultsHeader: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 24 },
  resultsExercise: { fontSize: 20, fontWeight: "800", color: T.textPrimary, marginBottom: 16 },
  scoreCircle: { flexDirection: "row", alignItems: "flex-end" },
  scoreValue: { fontSize: 56, fontWeight: "800", color: T.accent, lineHeight: 56 },
  scoreMax: { fontSize: 20, fontWeight: "700", color: T.textMuted, marginBottom: 6 },
  scoreLabel: { fontSize: 12, color: T.textSecondary, marginTop: 4 },
  resultsSection: { paddingHorizontal: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: T.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: T.surface2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: T.textSecondary, fontSize: 13, fontWeight: "600" },
  cueChip: { backgroundColor: T.tealDark, borderWidth: 1, borderColor: T.tealBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  cueChipText: { color: T.teal, fontSize: 13, fontWeight: "600" },
  card: {
    marginHorizontal: 24, marginBottom: 16, backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 18,
  },
  positiveCard: { borderColor: T.greenBorder, backgroundColor: T.greenDark },
  correctionCard: { borderColor: T.amberBorder, backgroundColor: T.amberDark },
  warningCard: { borderColor: T.redBorder, backgroundColor: T.redDark },
  cardTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary, marginBottom: 12 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 8 },
  bullet: { fontSize: 14, fontWeight: "700", marginTop: 1 },
  bulletText: { flex: 1, color: T.textPrimary, fontSize: 13.5, lineHeight: 20 },
  summaryText: { color: T.textPrimary, fontSize: 13.5, lineHeight: 20 },
  resultsActions: { flexDirection: "row", gap: 12, paddingHorizontal: 24, marginTop: 8 },
  secondaryBtn: {
    flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
  },
  secondaryBtnText: { color: T.textSecondary, fontWeight: "700", fontSize: 14 },
  primaryBtn: { flex: 1, backgroundColor: T.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  primaryBtnText: { color: "#000", fontWeight: "700", fontSize: 14 },
});
