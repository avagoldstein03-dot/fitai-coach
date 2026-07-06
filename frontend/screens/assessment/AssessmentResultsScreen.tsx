import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";

interface BodyFocusArea {
  label: string;
  x: number;
  y: number;
  type: "strength" | "improvement";
}

interface Assessment {
  bodyComposition: Record<string, string>;
  posture: Record<string, string>;
  strengths: string[];
  areasForImprovement: string[];
  recommendations: Record<string, string[]>;
  summary: string;
  focusAreas?: BodyFocusArea[];
}

function BodyAnnotationPin({ area }: { area: BodyFocusArea }) {
  const isStrength = area.type === "strength";
  const flipX = area.x > 0.5;

  return (
    <View
      style={[
        styles.pinContainer,
        {
          left: `${area.x * 100}%` as any,
          top: `${area.y * 100}%` as any,
        },
      ]}
    >
      <View
        style={[
          styles.pinDot,
          { backgroundColor: isStrength ? T.green : T.amber },
        ]}
      />
      <View
        style={[
          styles.pinCallout,
          flipX ? { right: 16 } : { left: 16 },
          { borderColor: isStrength ? T.greenBorder : T.amberBorder },
          { backgroundColor: isStrength ? T.greenDark : T.amberDark },
        ]}
      >
        <Text
          style={[
            styles.pinLabel,
            { color: isStrength ? T.green : T.amber },
          ]}
        >
          {isStrength ? "✓" : "→"} {area.label}
        </Text>
      </View>
    </View>
  );
}

function AnnotatedBodyImage({
  imageUri,
  focusAreas,
}: {
  imageUri: string;
  focusAreas: BodyFocusArea[];
}) {
  return (
    <View style={styles.annotationContainer}>
      <Image
        source={{ uri: imageUri }}
        style={styles.annotationImage}
        resizeMode="cover"
      />
      <View style={styles.annotationDim} />
      {focusAreas.map((area, i) => (
        <BodyAnnotationPin key={i} area={area} />
      ))}
    </View>
  );
}

export default function AssessmentResultsScreen() {
  const route = useRoute() as any;
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const { assessment, frontImageUri } = route.params as {
    assessment: Assessment;
    frontImageUri?: string;
  };

  const focusAreas = assessment.focusAreas ?? [];

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t("assessment.title")}</Text>
        <Text style={styles.subtitle}>{t("assessment.subtitle")}</Text>

        {/* Annotated Body Image */}
        {frontImageUri && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("assessment.body_map")}</Text>
            <AnnotatedBodyImage imageUri={frontImageUri} focusAreas={focusAreas} />
            {focusAreas.length > 0 && (
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: T.green }]} />
                  <Text style={styles.legendText}>{t("assessment.strength")}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: T.amber }]} />
                  <Text style={styles.legendText}>{t("assessment.focus_area")}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t("assessment.coach_summary")}</Text>
          <Text style={styles.summaryText}>{assessment.summary}</Text>
        </View>

        {/* Body Composition */}
        {assessment.bodyComposition &&
          Object.keys(assessment.bodyComposition).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("assessment.body_composition")}</Text>
              {Object.entries(assessment.bodyComposition).map(([key, value]) => (
                <View key={key} style={styles.cardRow}>
                  <Text style={styles.cardKey}>
                    {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                  </Text>
                  <Text style={styles.cardValue}>{value}</Text>
                </View>
              ))}
            </View>
          )}

        {/* Posture */}
        {assessment.posture && Object.keys(assessment.posture).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("assessment.posture")}</Text>
            {Object.entries(assessment.posture).map(([key, value]) => (
              <View key={key} style={styles.postureRow}>
                <Text style={styles.postureKey}>
                  {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                </Text>
                <Text style={styles.postureValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Strengths */}
        {assessment.strengths?.length > 0 && (
          <View style={[styles.card, styles.strengthCard]}>
            <Text style={[styles.cardTitle, { color: T.green }]}>{t("assessment.strengths")}</Text>
            {assessment.strengths.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.strengthBullet}>✓</Text>
                <Text style={styles.strengthText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Areas for Improvement */}
        {assessment.areasForImprovement?.length > 0 && (
          <View style={[styles.card, styles.improveCard]}>
            <Text style={[styles.cardTitle, { color: T.amber }]}>{t("assessment.focus_areas")}</Text>
            {assessment.areasForImprovement.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.improveBullet}>→</Text>
                <Text style={styles.improveText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendations */}
        {assessment.recommendations?.exercise?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("assessment.exercise_plan")}</Text>
            {assessment.recommendations.exercise.map((rec, i) => (
              <View key={i} style={styles.recRow}>
                <View style={styles.recDot} />
                <Text style={styles.recText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}

        {assessment.recommendations?.nutrition?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("assessment.nutrition_guidance")}</Text>
            {assessment.recommendations.nutrition.map((rec, i) => (
              <View key={i} style={styles.recRow}>
                <View style={styles.recDot} />
                <Text style={styles.recText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}

        {assessment.recommendations?.recovery?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("assessment.recovery")}</Text>
            {assessment.recommendations.recovery.map((rec, i) => (
              <View key={i} style={styles.recRow}>
                <View style={styles.recDot} />
                <Text style={styles.recText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionPrimary}
            onPress={() => navigation.navigate("Workouts")}
          >
            <Text style={styles.actionPrimaryText}>{t("assessment.generate_workout")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionSecondary}
            onPress={() => navigation.navigate("Nutrition")}
          >
            <Text style={styles.actionSecondaryText}>{t("assessment.generate_meal")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionSecondary}
            onPress={() => navigation.navigate("Supplements")}
          >
            <Text style={styles.actionSecondaryText}>{t("assessment.supplements")}</Text>
          </TouchableOpacity>
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

  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: T.textPrimary, marginBottom: 12 },

  // Annotation
  annotationContainer: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  annotationImage: { width: "100%", height: "100%" },
  annotationDim: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.15)",
  },

  // Pins
  pinContainer: {
    position: "absolute",
    zIndex: 10,
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: T.white,
  },
  pinCallout: {
    position: "absolute",
    top: -4,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 9,
    minWidth: 80,
    maxWidth: 130,
  },
  pinLabel: { fontSize: 11, fontWeight: "700" },

  // Legend
  legendRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: T.textSecondary },

  // Summary
  summaryCard: {
    backgroundColor: T.accentDark,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.accentBorder,
    padding: 20,
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 11, fontWeight: "800", color: T.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  summaryText: { fontSize: 15, color: T.accentMuted, lineHeight: 24 },

  // Cards
  card: {
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginBottom: 12,
  },
  strengthCard: { borderColor: T.greenBorder, backgroundColor: T.greenDark },
  improveCard: { borderColor: T.amberBorder, backgroundColor: T.amberDark },
  cardTitle: { fontSize: 14, fontWeight: "800", color: T.textPrimary, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 },

  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  cardKey: { fontSize: 13, color: T.textSecondary, flex: 1 },
  cardValue: { fontSize: 13, color: T.textPrimary, fontWeight: "600", flex: 1, textAlign: "right" },

  postureRow: { marginBottom: 12 },
  postureKey: { fontSize: 12, color: T.textSecondary, fontWeight: "600", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 },
  postureValue: { fontSize: 13, color: T.textPrimary, lineHeight: 19 },

  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  strengthBullet: { color: T.green, fontSize: 13, fontWeight: "700", marginTop: 1 },
  strengthText: { flex: 1, fontSize: 13, color: T.textPrimary, lineHeight: 19 },
  improveBullet: { color: T.amber, fontSize: 13, fontWeight: "700", marginTop: 1 },
  improveText: { flex: 1, fontSize: 13, color: T.textPrimary, lineHeight: 19 },

  recRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  recDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.accent, marginTop: 7 },
  recText: { flex: 1, fontSize: 13, color: T.textSecondary, lineHeight: 19 },

  // Actions
  actions: { gap: 10, marginTop: 8 },
  actionPrimary: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  actionPrimaryText: { color: T.accent, fontSize: 16, fontWeight: "800" },
  actionSecondary: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    alignItems: "center",
  },
  actionSecondaryText: { color: T.textSecondary, fontSize: 15, fontWeight: "600" },
});
