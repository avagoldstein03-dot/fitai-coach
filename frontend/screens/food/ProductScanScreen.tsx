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
  nutriscoreGrade: string | null;
  novaGroup: number | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  servingSizeGrams: number | null;
}

const NUTRISCORE_COLOR: Record<string, string> = { a: T.green, b: T.teal, c: T.amber, d: T.red, e: T.red };
const NOVA_COLOR: Record<number, string> = { 1: T.green, 2: T.teal, 3: T.amber, 4: T.red };

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

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
  const [logGrams, setLogGrams] = useState("100");
  const [logMealType, setLogMealType] = useState<typeof MEAL_TYPES[number]>("snack");

  const { mutate: addToShoppingList, isPending: isAddingToList } = useMutation({
    mutationFn: async (name: string) => {
      await axios.patch(`${API_URL}/api/nutrition/shopping-list`, { action: "add", name });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("product_scan.added_to_list_title"), t("product_scan.added_to_list_msg"));
    },
    onError: (error: any) => {
      const code = error?.response?.data?.error;
      if (code === "not_found") {
        Alert.alert(t("common.error"), t("product_scan.error_no_plan"));
      } else if (code === "subscription_required") {
        Alert.alert(t("common.error"), t("product_scan.error_subscription_required"));
      } else {
        Alert.alert(t("common.error"), t("product_scan.error_add_to_list"));
      }
    },
  });

  const { mutate: logProductAsMeal, isPending: isLoggingMeal } = useMutation({
    mutationFn: async ({ product, grams }: { product: ScannedProduct; grams: number }) => {
      const factor = grams / 100;
      await axios.post(`${API_URL}/api/food/manual`, {
        mealType: logMealType,
        items: [
          {
            foodName: product.productName ?? t("product_scan.unknown_product"),
            quantity: grams,
            unit: "g",
            calories: Math.round((product.caloriesPer100g ?? 0) * factor),
            protein: Math.round((product.proteinPer100g ?? 0) * factor),
            carbs: Math.round((product.carbsPer100g ?? 0) * factor),
            fat: Math.round((product.fatPer100g ?? 0) * factor),
            fiber: 0,
          },
        ],
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("product_scan.logged_title"), t("product_scan.logged_msg"));
    },
    onError: () => {
      Alert.alert(t("common.error"), t("product_scan.error_log_meal"));
    },
  });

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
        setLogGrams(String(data.product.servingSizeGrams ?? 100));
        setLogMealType("snack");
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
    if (!/^\d{4,14}$/.test(trimmed)) return;
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
      const isProduceCode = result.barcode.length <= 5;
      return (
        <ScrollView style={s.resultsScreen} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={[s.resultsHeader, { paddingTop: insets.top + 16 }]}>
            <Text style={s.emptyIcon}>🔍</Text>
            <Text style={s.emptyTitle}>{t("product_scan.not_found_title")}</Text>
            <Text style={s.emptySub}>
              {isProduceCode ? t("product_scan.not_found_produce_sub") : t("product_scan.not_found_sub")}
            </Text>
          </View>
          <View style={s.resultsActions}>
            <TouchableOpacity onPress={scanAnother} style={s.secondaryBtn}>
              <Text style={s.secondaryBtnText}>{t("product_scan.scan_another")}</Text>
            </TouchableOpacity>
            {!isProduceCode && (
              <TouchableOpacity
                onPress={() => navigation.navigate("Supplements")}
                style={s.primaryBtn}
              >
                <Text style={s.primaryBtnText}>{t("product_scan.try_supplements_cta")}</Text>
              </TouchableOpacity>
            )}
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
          <Text style={s.ingredientsTitle}>{t("product_scan.why_this_rating")}</Text>

          {product.nutriscoreGrade && (
            <View style={s.factorRow}>
              <View style={[s.factorBadge, { backgroundColor: NUTRISCORE_COLOR[product.nutriscoreGrade.toLowerCase()] ?? T.textMuted }]}>
                <Text style={s.factorBadgeText}>{product.nutriscoreGrade.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.factorTitle}>{t("product_scan.factor_nutrition")}</Text>
                <Text style={s.factorDetail}>{t(`product_scan.nutriscore_${product.nutriscoreGrade.toLowerCase()}`)}</Text>
              </View>
            </View>
          )}

          {product.novaGroup != null && (
            <View style={s.factorRow}>
              <View style={[s.factorBadge, { backgroundColor: NOVA_COLOR[product.novaGroup] ?? T.textMuted }]}>
                <Text style={s.factorBadgeText}>{product.novaGroup}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.factorTitle}>{t("product_scan.factor_processing")}</Text>
                <Text style={s.factorDetail}>{t(`product_scan.nova_${product.novaGroup}`)}</Text>
              </View>
            </View>
          )}

          <View style={s.factorRow}>
            <View
              style={[
                s.factorBadge,
                { backgroundColor: product.flaggedIngredients.length === 0 ? T.green : T.red },
              ]}
            >
              <Text style={s.factorBadgeText}>{product.flaggedIngredients.length}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.factorTitle}>{t("product_scan.factor_additives")}</Text>
              <Text style={s.factorDetail}>
                {product.flaggedIngredients.length === 0
                  ? t("product_scan.no_flagged_ingredients")
                  : t("product_scan.flagged_count", { count: product.flaggedIngredients.length })}
              </Text>
            </View>
          </View>

          {product.flaggedIngredients.length > 0 && (
            <View style={s.flaggedList}>
              {product.flaggedIngredients.map((ing) => (
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
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => addToShoppingList(product.productName ?? t("product_scan.unknown_product"))}
          style={s.addToListBtn}
          activeOpacity={0.8}
          disabled={isAddingToList}
        >
          {isAddingToList ? (
            <ActivityIndicator color={T.accent} size="small" />
          ) : (
            <Text style={s.addToListBtnText}>🛒  {t("product_scan.add_to_shopping_list")}</Text>
          )}
        </TouchableOpacity>

        {product.caloriesPer100g != null && (
          <View style={s.logSection}>
            <Text style={s.logSectionTitle}>{t("product_scan.log_this_product")}</Text>

            <View style={s.mealTypeRow}>
              {MEAL_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt}
                  onPress={() => setLogMealType(mt)}
                  style={[s.mealTypeChip, logMealType === mt && s.mealTypeChipActive]}
                >
                  <Text style={[s.mealTypeText, logMealType === mt && s.mealTypeTextActive]}>
                    {t(`food_diary.meal_${mt}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.gramsRow}>
              <Text style={s.gramsLabel}>{t("product_scan.grams_label")}</Text>
              <TextInput
                style={s.gramsInput}
                value={logGrams}
                onChangeText={setLogGrams}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={T.textMuted}
              />
              <Text style={s.gramsUnit}>g</Text>
            </View>

            <Text style={s.gramsPreview}>
              {t("product_scan.log_preview", {
                calories: Math.round((product.caloriesPer100g ?? 0) * (Number(logGrams || 0) / 100)),
                protein: Math.round((product.proteinPer100g ?? 0) * (Number(logGrams || 0) / 100)),
                carbs: Math.round((product.carbsPer100g ?? 0) * (Number(logGrams || 0) / 100)),
                fat: Math.round((product.fatPer100g ?? 0) * (Number(logGrams || 0) / 100)),
              })}
            </Text>

            <TouchableOpacity
              onPress={() => logProductAsMeal({ product, grams: Number(logGrams || 0) })}
              style={s.logBtn}
              activeOpacity={0.8}
              disabled={isLoggingMeal || !Number(logGrams)}
            >
              {isLoggingMeal ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={s.logBtnText}>{t("product_scan.log_button")}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

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

  factorRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 14 },
  factorBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  factorBadgeText: { color: "#000", fontWeight: "800", fontSize: 13 },
  factorTitle: { color: T.textPrimary, fontWeight: "600", fontSize: 14 },
  factorDetail: { color: T.textSecondary, fontSize: 12, marginTop: 1 },
  flaggedList: {
    marginTop: 4, paddingTop: 14, borderTopWidth: 1, borderColor: T.border,
  },

  ingredientRow: { flexDirection: "row", gap: 10, marginBottom: 14, alignItems: "flex-start" },
  riskDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  ingredientName: { color: T.textPrimary, fontWeight: "600", fontSize: 14 },
  ingredientReason: { color: T.textSecondary, fontSize: 12, marginTop: 2 },

  addToListBtn: {
    marginHorizontal: 24, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 20,
  },
  addToListBtnText: { color: T.textPrimary, fontWeight: "700", fontSize: 14 },

  logSection: {
    marginHorizontal: 24, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, padding: 18, marginBottom: 20,
  },
  logSectionTitle: { fontSize: 15, fontWeight: "700", color: T.textPrimary, marginBottom: 14 },
  mealTypeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  mealTypeChip: {
    flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 10,
    paddingVertical: 8, alignItems: "center",
  },
  mealTypeChipActive: { backgroundColor: T.accentDark, borderColor: T.accent },
  mealTypeText: { fontSize: 12, color: T.textSecondary, fontWeight: "600", textTransform: "capitalize" },
  mealTypeTextActive: { color: T.accent },
  gramsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  gramsLabel: { color: T.textSecondary, fontSize: 13, flex: 1 },
  gramsInput: {
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, color: T.textPrimary, fontSize: 14, width: 70, textAlign: "center",
  },
  gramsUnit: { color: T.textSecondary, fontSize: 13 },
  gramsPreview: { color: T.textSecondary, fontSize: 12, marginBottom: 14 },
  logBtn: { backgroundColor: T.accent, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  logBtnText: { color: "#000", fontWeight: "700", fontSize: 14 },

  resultsActions: { flexDirection: "row", gap: 12, paddingHorizontal: 24, marginTop: 8 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  secondaryBtnText: { color: T.textSecondary, fontWeight: "700", fontSize: 14 },
  primaryBtn: { flex: 1, backgroundColor: T.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  primaryBtnText: { color: "#000", fontWeight: "700", fontSize: 14 },
});
