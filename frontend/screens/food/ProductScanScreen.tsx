import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  StyleSheet,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { T } from "@/lib/theme";
import { posthog, Events } from "@/lib/analytics";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface FlaggedIngredient {
  code: string;
  name: string;
  riskLevel: "moderate" | "high";
  reason: string;
}

interface ScannedProduct {
  productName: string | null;
  brand: string | null;
  imageUrl: string | null;
  score: number;
  grade: "great" | "good" | "mediocre" | "bad";
  flaggedIngredients: FlaggedIngredient[];
}

type ScanResponse =
  | { status: "found"; cacheHit: boolean; product: ScannedProduct }
  | { status: "not_found"; barcode: string };

const GRADE_COLOR: Record<ScannedProduct["grade"], string> = {
  great: T.green,
  good: T.teal,
  mediocre: T.amber,
  bad: T.red,
};

export default function ProductScanScreen() {
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isPaused, setIsPaused] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);

  const { mutate: scanProduct, isPending: isScanning } = useMutation({
    mutationFn: async (barcode: string) => {
      const response = await axios.post<{ data: ScanResponse }>(`${API_URL}/api/products/scan`, { barcode });
      return response.data.data;
    },
    onSuccess: (data) => {
      if (data.status === "found") {
        posthog.capture(Events.PRODUCT_SCAN_COMPLETED, {
          status: data.status,
          grade: data.product.grade,
          score: data.product.score,
          cacheHit: data.cacheHit,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setResult(data);
    },
    onError: () => {
      setIsPaused(false);
      Alert.alert(t("common.error"), t("product_scan.error_upstream"));
    },
  });

  const handleBarcodeScanned = (scan: { data: string }) => {
    if (isPaused || isScanning) return;
    setIsPaused(true);
    scanProduct(scan.data);
  };

  const submitManualBarcode = () => {
    const trimmed = manualBarcode.trim();
    if (!/^\d{6,14}$/.test(trimmed)) return;
    setIsPaused(true);
    scanProduct(trimmed);
  };

  const scanAnother = () => {
    setResult(null);
    setManualBarcode("");
    setIsPaused(false);
  };

  if (result) {
    if (result.status === "not_found") {
      return (
        <ScrollView style={s.resultsScreen} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={[s.resultsHeader, { paddingTop: insets.top + 16 }]}>
            <Text style={s.emptyIcon}>🔍</Text>
            <Text style={s.emptyTitle}>{t("product_scan.not_found_title")}</Text>
            <Text style={s.emptySub}>{t("product_scan.not_found_sub")}</Text>
          </View>
          <View style={s.resultsActions}>
            <TouchableOpacity onPress={scanAnother} style={s.secondaryBtn}>
              <Text style={s.secondaryBtnText}>{t("product_scan.scan_another")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("Supplements")}
              style={s.primaryBtn}
            >
              <Text style={s.primaryBtnText}>{t("product_scan.try_supplements_cta")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    const { product } = result;
    const gradeColor = GRADE_COLOR[product.grade];

    return (
      <ScrollView style={s.resultsScreen} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[s.resultsHeader, { paddingTop: insets.top + 16 }]}>
          {product.brand ? <Text style={s.productBrand}>{product.brand}</Text> : null}
          <Text style={s.productName}>{product.productName ?? t("product_scan.unknown_product")}</Text>
        </View>

        <View style={s.scoreCard}>
          <View style={s.scoreRow}>
            <Text style={[s.scoreValue, { color: gradeColor }]}>{product.score}</Text>
            <View style={[s.gradePill, { backgroundColor: gradeColor }]}>
              <Text style={s.gradePillText}>{t(`product_scan.grade_${product.grade}`)}</Text>
            </View>
          </View>
          <View style={s.scoreBarTrack}>
            <View style={[s.scoreBarFill, { width: `${product.score}%`, backgroundColor: gradeColor }]} />
          </View>
        </View>

        <View style={s.ingredientsSection}>
          <Text style={s.ingredientsTitle}>{t("product_scan.flagged_ingredients_title")}</Text>
          {product.flaggedIngredients.length === 0 ? (
            <Text style={s.noFlagged}>{t("product_scan.no_flagged_ingredients")}</Text>
          ) : (
            product.flaggedIngredients.map((ing) => (
              <View key={ing.code} style={s.ingredientRow}>
                <View
                  style={[
                    s.riskDot,
                    { backgroundColor: ing.riskLevel === "high" ? T.red : T.amber },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.ingredientName}>{ing.name}</Text>
                  <Text style={s.ingredientReason}>{ing.reason}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={s.resultsActions}>
          <TouchableOpacity onPress={scanAnother} style={s.secondaryBtn}>
            <Text style={s.secondaryBtnText}>{t("product_scan.scan_another")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>{t("product_scan.done")}</Text>
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
      <ScrollView contentContainerStyle={s.permissionScreen}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          style={[s.topBack, { top: insets.top + 12 }]}
        >
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.permissionIcon}>🔍</Text>
        <Text style={s.permissionTitle}>{t("product_scan.permission_title")}</Text>
        <Text style={s.permissionSub}>{t("product_scan.permission_sub")}</Text>
        <TouchableOpacity onPress={requestPermission} style={s.grantBtn}>
          <Text style={s.grantBtnText}>{t("product_scan.grant_permission")}</Text>
        </TouchableOpacity>

        <Text style={s.manualEntryLabel}>{t("product_scan.manual_entry_label")}</Text>
        <View style={s.manualEntryRow}>
          <TextInput
            style={s.manualEntryInput}
            value={manualBarcode}
            onChangeText={setManualBarcode}
            placeholder={t("product_scan.manual_entry_placeholder")}
            placeholderTextColor={T.textMuted}
            keyboardType="number-pad"
          />
          <TouchableOpacity onPress={submitManualBarcode} style={s.manualEntrySubmit} disabled={isScanning}>
            {isScanning ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={s.manualEntrySubmitText}>{t("product_scan.manual_entry_submit")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={s.fullBlack}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
        onBarcodeScanned={isPaused || isScanning ? undefined : handleBarcodeScanned}
      />

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
        <Text style={s.frameHintText}>{t("product_scan.frame_hint")}</Text>
      </View>

      <View style={s.bottomControls}>
        {isScanning ? (
          <View style={s.processingRow}>
            <ActivityIndicator color={T.accent} size="large" />
            <Text style={s.statusText}>{t("product_scan.scanning")}</Text>
          </View>
        ) : (
          <View style={s.manualEntryRow}>
            <TextInput
              style={s.manualEntryInputDark}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              placeholder={t("product_scan.manual_entry_placeholder")}
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="number-pad"
            />
            <TouchableOpacity onPress={submitManualBarcode} style={s.manualEntrySubmit}>
              <Text style={s.manualEntrySubmitText}>{t("product_scan.manual_entry_submit")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fullBlack: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  permissionScreen: { flexGrow: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, paddingVertical: 60 },
  topBack: { position: "absolute", left: 16, zIndex: 10 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  permissionIcon: { fontSize: 48, marginBottom: 16 },
  permissionTitle: { fontSize: 20, fontWeight: "700", color: T.textPrimary, textAlign: "center", marginBottom: 8 },
  permissionSub: { fontSize: 14, color: T.textSecondary, textAlign: "center", marginBottom: 24 },
  grantBtn: { backgroundColor: T.accent, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12, marginBottom: 28 },
  grantBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },

  manualEntryLabel: { color: T.textSecondary, fontSize: 13, marginBottom: 8 },
  manualEntryRow: { flexDirection: "row", gap: 8, width: "100%", paddingHorizontal: 16 },
  manualEntryInput: {
    flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: T.textPrimary, fontSize: 14,
  },
  manualEntryInputDark: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: "#fff", fontSize: 14,
  },
  manualEntrySubmit: {
    backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: "center", alignItems: "center",
  },
  manualEntrySubmitText: { color: "#000", fontWeight: "700", fontSize: 13 },

  topBar: {
    position: "absolute", left: 0, right: 0, zIndex: 20, paddingHorizontal: 16,
    flexDirection: "row", justifyContent: "flex-start", alignItems: "center",
  },
  topBarBack: { backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  topBarBackText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  frameHint: { position: "absolute", top: "38%", left: 32, right: 32, alignItems: "center" },
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

  resultsScreen: { flex: 1, backgroundColor: T.bg },
  resultsHeader: { paddingHorizontal: 24, paddingBottom: 16, alignItems: "center" },
  productBrand: { fontSize: 13, color: T.textSecondary, marginBottom: 2 },
  productName: { fontSize: 20, fontWeight: "800", color: T.textPrimary, textAlign: "center" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: T.textPrimary, textAlign: "center", marginBottom: 6 },
  emptySub: { fontSize: 14, color: T.textSecondary, textAlign: "center" },

  scoreCard: {
    marginHorizontal: 24, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, padding: 20, marginBottom: 20,
  },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  scoreValue: { fontSize: 40, fontWeight: "800" },
  gradePill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  gradePillText: { color: "#000", fontWeight: "700", fontSize: 13, textTransform: "capitalize" },
  scoreBarTrack: { height: 8, borderRadius: 4, backgroundColor: T.surface2, overflow: "hidden" },
  scoreBarFill: { height: 8, borderRadius: 4 },

  ingredientsSection: { paddingHorizontal: 24, marginBottom: 20 },
  ingredientsTitle: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 12 },
  noFlagged: { color: T.textMuted, fontSize: 13 },
  ingredientRow: { flexDirection: "row", gap: 10, marginBottom: 14, alignItems: "flex-start" },
  riskDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  ingredientName: { color: T.textPrimary, fontWeight: "600", fontSize: 14 },
  ingredientReason: { color: T.textSecondary, fontSize: 12, marginTop: 2 },

  resultsActions: { flexDirection: "row", gap: 12, paddingHorizontal: 24, marginTop: 8 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  secondaryBtnText: { color: T.textSecondary, fontWeight: "700", fontSize: 14 },
  primaryBtn: { flex: 1, backgroundColor: T.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  primaryBtnText: { color: "#000", fontWeight: "700", fontSize: 14 },
});
