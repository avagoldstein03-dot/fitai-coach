import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCAN_DURATION_MS = 10000;
const CAPTURE_POINTS = [
  { atMs: 1500, position: "front" as const },
  { atMs: 5000, position: "side" as const },
  { atMs: 8500, position: "back" as const },
];

export default function LiveBodyScanScreen() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusKey, setStatusKey] = useState("status_initial");
  const [isProcessing, setIsProcessing] = useState(false);

  const laserAnim = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const captured = useRef<{ front?: string; side?: string; back?: string }>({});

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanning]);

  const captureFrame = async (position: "front" | "side" | "back") => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.6 });
      if (photo?.base64) {
        captured.current[position] = photo.base64;
      }
    } catch (error) {
      console.error(`Failed to capture ${position} frame:`, error);
    }
  };

  const uploadAndAnalyze = async () => {
    setIsProcessing(true);
    setStatusKey("status_uploading");
    try {
      let scanId: string | undefined;

      for (const position of ["front", "side", "back"] as const) {
        const base64 = captured.current[position];
        if (!base64) continue;
        const res = await axios.post(`${API_URL}/api/assessment/upload`, {
          base64, position, scanId,
        });
        scanId = res.data.data.scanId;
      }

      if (!scanId) throw new Error("No frames were captured during the scan");

      setStatusKey("status_analyzing");
      const analyzeRes = await axios.post(`${API_URL}/api/assessment/analyze`, { scanId });
      const data = analyzeRes.data.data;

      navigation.replace("AssessmentResults", {
        assessment: data.assessment,
        assessmentId: data.assessmentId,
      });
    } catch (error: any) {
      setIsProcessing(false);
      setScanning(false);
      setProgress(0);
      Alert.alert(
        t("body_scan.scan_failed"),
        error?.response?.data?.message || error?.message || t("body_scan.scan_failed_msg")
      );
    }
  };

  const startScan = () => {
    if (!permission?.granted) {
      requestPermission();
      return;
    }

    captured.current = {};
    setProgress(0);
    setScanning(true);
    setStatusKey("status_scanning");

    const startedAt = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(1, elapsed / SCAN_DURATION_MS));
    }, 100);
    timers.current.push(progressInterval as unknown as ReturnType<typeof setTimeout>);

    CAPTURE_POINTS.forEach(({ atMs, position }) => {
      const timer = setTimeout(() => captureFrame(position), atMs);
      timers.current.push(timer);
    });

    const finishTimer = setTimeout(() => {
      clearInterval(progressInterval);
      setScanning(false);
      setProgress(1);
      uploadAndAnalyze();
    }, SCAN_DURATION_MS);
    timers.current.push(finishTimer);
  };

  const cancelScan = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setScanning(false);
    setIsProcessing(false);
    setProgress(0);
  };

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
        <Text style={s.permissionTitle}>{t("body_scan.permission_title")}</Text>
        <Text style={s.permissionSub}>{t("body_scan.permission_sub")}</Text>
        <TouchableOpacity onPress={requestPermission} style={s.grantBtn}>
          <Text style={s.grantBtnText}>{t("body_scan.grant_permission")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT * 0.18, SCREEN_HEIGHT * 0.62],
  });

  return (
    <View style={s.fullBlack}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />

      {scanning && (
        <>
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 8,
              backgroundColor: "rgba(200, 255, 71, 0.45)",
              shadowColor: T.accent,
              shadowOpacity: 0.6,
              shadowRadius: 12,
              transform: [{ translateY: laserTranslateY }],
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: SCREEN_HEIGHT * 0.15,
              bottom: SCREEN_HEIGHT * 0.25,
              left: 24,
              right: 24,
              borderWidth: 2,
              borderColor: "rgba(200, 255, 71, 0.5)",
              borderRadius: 24,
            }}
          />
        </>
      )}

      <View style={[s.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => { cancelScan(); navigation.goBack(); }}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          style={s.topBarBack}
        >
          <Text style={s.topBarBackText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>{t("body_scan.live_360_title")}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.bottomControls}>
        <Text style={s.statusText}>{t(`body_scan.${statusKey}`)}</Text>

        {scanning && (
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        )}

        {isProcessing ? (
          <View style={s.processingRow}>
            <ActivityIndicator color={T.accent} size="large" />
          </View>
        ) : scanning ? (
          <TouchableOpacity onPress={cancelScan} style={s.cancelBtn}>
            <Text style={s.cancelBtnText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={startScan} style={s.startBtn}>
            <Text style={s.startBtnText}>🔴 {t("body_scan.start_scan")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fullBlack: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  permissionScreen: {
    flex: 1,
    backgroundColor: T.bg,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  topBack: { position: "absolute", left: 16, zIndex: 10 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  permissionIcon: { fontSize: 48, marginBottom: 16 },
  permissionTitle: { fontSize: 20, fontWeight: "700", color: T.textPrimary, textAlign: "center", marginBottom: 8 },
  permissionSub: { fontSize: 14, color: T.textSecondary, textAlign: "center", marginBottom: 24 },
  grantBtn: { backgroundColor: T.accent, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12 },
  grantBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarBack: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  topBarBackText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  topBarTitle: {
    color: "#fff",
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  statusText: { color: "#fff", textAlign: "center", marginBottom: 16, fontSize: 14 },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    marginBottom: 20,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: T.accent },
  processingRow: { alignItems: "center", paddingVertical: 16 },
  cancelBtn: { backgroundColor: T.red, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  cancelBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  startBtn: { backgroundColor: T.accent, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  startBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
