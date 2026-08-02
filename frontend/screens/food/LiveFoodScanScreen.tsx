import React, { useRef, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";
import { posthog, Events } from "@/lib/analytics";
import { AnnotatedFoodImage, DetectedFoodItem } from "@/components/AnnotatedFoodImage";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface FoodAnalysisResult {
  mealId: string;
  foodAnalysis: {
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    items: DetectedFoodItem[];
  };
}

export default function LiveFoodScanScreen() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);

  const { mutate: scanFood, isPending: isScanning } = useMutation({
    mutationFn: async (base64: string) => {
      const response = await axios.post<{ data: FoodAnalysisResult }>(`${API_URL}/api/food/scan`, { base64 });
      return response.data.data;
    },
    onSuccess: (data) => {
      posthog.capture(Events.FOOD_SCAN_COMPLETED, { itemCount: data?.foodAnalysis?.items?.length ?? 0 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(data);
    },
    onError: (error: any) => {
      setImageUri(null);
      Alert.alert(t("common.error"), error.response?.data?.message || t("food_scanner.error_scan"));
    },
  });

  const capturePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.7 });
      if (photo?.base64) {
        setImageUri(photo.uri);
        scanFood(photo.base64);
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("live_food_scan.capture_failed"));
    }
  };

  const uploadInstead = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("food_scanner.permission_required"), t("food_scanner.library_permission"));
        return;
      }
      const pickResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      if (!pickResult.canceled && pickResult.assets[0].base64) {
        setImageUri(pickResult.assets[0].uri);
        scanFood(pickResult.assets[0].base64);
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("food_scanner.error_pick_image"));
    }
  };

  const scanAnother = () => {
    setImageUri(null);
    setResult(null);
  };

  const finishAndClose = () => {
    queryClient.invalidateQueries({ queryKey: ["mealHistory"] });
    queryClient.invalidateQueries({ queryKey: ["food-history"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    navigation.goBack();
  };

  if (result && imageUri) {
    const detectedItems = result.foodAnalysis.items ?? [];
    return (
      <ScrollView style={s.resultsScreen} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[s.resultsHeader, { paddingTop: insets.top + 16 }]}>
          <View style={s.resultBadge}>
            <Text style={s.resultBadgeText}>{t("food_scanner.logged")}</Text>
          </View>
          <Text style={s.resultsMealName}>{result.foodAnalysis.foodName}</Text>
          <Text style={s.resultsCalories}>
            {t("food_scanner.cal_protein", { cal: result.foodAnalysis.calories, p: result.foodAnalysis.protein })}
          </Text>
        </View>

        <View style={s.imageWrap}>
          <AnnotatedFoodImage imageUri={imageUri} items={detectedItems} />
        </View>

        <View style={s.resultsActions}>
          <TouchableOpacity onPress={scanAnother} style={s.secondaryBtn}>
            <Text style={s.secondaryBtnText}>{t("live_food_scan.scan_another")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={finishAndClose} style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>{t("live_food_scan.done")}</Text>
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
        <Text style={s.permissionTitle}>{t("live_food_scan.permission_title")}</Text>
        <Text style={s.permissionSub}>{t("live_food_scan.permission_sub")}</Text>
        <TouchableOpacity onPress={requestPermission} style={s.grantBtn}>
          <Text style={s.grantBtnText}>{t("live_food_scan.grant_permission")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={uploadInstead} style={s.uploadInsteadBtn}>
          <Text style={s.uploadInsteadText}>{t("live_food_scan.upload_instead")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.fullBlack}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      <View style={[s.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          style={s.topBarBack}
        >
          <Text style={s.topBarBackText}>{t("common.back")}</Text>
        </TouchableOpacity>
      </View>

      <View pointerEvents="none" style={s.frameHint}>
        <Text style={s.frameHintText}>{t("live_food_scan.frame_hint")}</Text>
      </View>

      <View style={s.bottomControls}>
        {isScanning ? (
          <View style={s.processingRow}>
            <ActivityIndicator color={T.accent} size="large" />
            <Text style={s.statusText}>{t("food_scanner.scanning")}</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={capturePhoto} style={s.shutterOuter}>
              <View style={s.shutterInner} />
            </TouchableOpacity>
            <TouchableOpacity onPress={uploadInstead} style={s.uploadInsteadLink}>
              <Text style={s.uploadInsteadLinkText}>{t("live_food_scan.upload_instead")}</Text>
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
  topBack: { position: "absolute", left: 16, zIndex: 10 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  permissionIcon: { fontSize: 48, marginBottom: 16 },
  permissionTitle: { fontSize: 20, fontWeight: "700", color: T.textPrimary, textAlign: "center", marginBottom: 8 },
  permissionSub: { fontSize: 14, color: T.textSecondary, textAlign: "center", marginBottom: 24 },
  grantBtn: { backgroundColor: T.accent, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12, marginBottom: 16 },
  grantBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  uploadInsteadBtn: { paddingVertical: 8 },
  uploadInsteadText: { color: T.accent, fontWeight: "600", fontSize: 14 },

  topBar: {
    position: "absolute", left: 0, right: 0, zIndex: 20, paddingHorizontal: 16,
    flexDirection: "row", justifyContent: "flex-start", alignItems: "center",
  },
  topBarBack: { backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  topBarBackText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  frameHint: {
    position: "absolute", top: "38%", left: 32, right: 32, alignItems: "center",
  },
  frameHintText: {
    color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },

  bottomControls: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingBottom: 48, paddingTop: 24, alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)",
  },
  statusText: { color: "#fff", textAlign: "center", marginTop: 12, fontSize: 14 },
  processingRow: { alignItems: "center", paddingVertical: 16 },
  shutterOuter: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: "#fff",
    justifyContent: "center", alignItems: "center", marginBottom: 20,
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff" },
  uploadInsteadLink: { paddingVertical: 4 },
  uploadInsteadLinkText: { color: "#fff", fontWeight: "600", fontSize: 14, textDecorationLine: "underline" },

  resultsScreen: { flex: 1, backgroundColor: T.bg },
  resultsHeader: { paddingHorizontal: 24, paddingBottom: 16 },
  resultBadge: {
    backgroundColor: T.greenDark, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: "flex-start", marginBottom: 8,
  },
  resultBadgeText: { color: T.green, fontSize: 12, fontWeight: "700" },
  resultsMealName: { fontSize: 20, fontWeight: "800", color: T.textPrimary, marginBottom: 4 },
  resultsCalories: { fontSize: 14, color: T.textSecondary },
  imageWrap: { paddingHorizontal: 24, marginBottom: 20 },
  resultsActions: { flexDirection: "row", gap: 12, paddingHorizontal: 24, marginTop: 8 },
  secondaryBtn: {
    flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
  },
  secondaryBtnText: { color: T.textSecondary, fontWeight: "700", fontSize: 14 },
  primaryBtn: { flex: 1, backgroundColor: T.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  primaryBtnText: { color: "#000", fontWeight: "700", fontSize: 14 },
});
