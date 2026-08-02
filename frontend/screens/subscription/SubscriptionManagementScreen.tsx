import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";
import { TERMS_URL } from "@/lib/legal-urls";
import { LegalWebViewModal } from "@/components/LegalWebViewModal";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface SubscriptionStatus {
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelledAt: string | null;
    stripeSubscriptionId: string;
  };
}

export default function SubscriptionManagementScreen() {
  const navigation = useNavigation() as any;
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [showTerms, setShowTerms] = React.useState(false);

  const { data: subscriptionData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const response = await axios.get<SubscriptionStatus>(
        `${API_URL}/api/subscriptions/status`
      );
      return response.data;
    },
  });

  const subscription = subscriptionData?.subscription;

  const { mutate: openBillingPortal, isPending: isPortalPending } = useMutation({
    mutationFn: async () => {
      const response = await axios.post(
        `${API_URL}/api/subscriptions/billing-portal`,
        { returnUrl: "activeai://subscription/management" }
      );
      return response.data;
    },
    onSuccess: async (data) => {
      const url = data?.data?.portalUrl ?? data?.portalUrl;
      if (!url) {
        Alert.alert(t("common.error"), t("subscription.error_portal"));
        return;
      }
      await WebBrowser.openAuthSessionAsync(url, "activeai://subscription/management");
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: () => {
      Alert.alert(t("common.error"), t("subscription.error_portal_open"));
    },
  });

  if (isLoading) {
    return (
      <View style={s.loadingScreen}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.loadingBack}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  const isPremium = subscription?.plan === "premium";
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(i18n.language)
    : null;
  const isActive = subscription?.status === "active";

  return (
    <ScrollView
      style={s.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.accent} />
      }
    >
      <View style={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={s.heading}>{t("subscription.title")}</Text>

        {/* Current Plan */}
        <View style={s.card}>
          <View style={s.planRow}>
            <View>
              <Text style={s.planLabel}>{isPremium ? t("subscription.plan_premium") : t("subscription.plan_free")}</Text>
              <Text style={s.planName}>{isPremium ? t("subscription.plan_premium") : t("subscription.plan_free")}</Text>
            </View>
            <View style={[s.statusBadge, isActive ? s.statusActive : s.statusInactive]}>
              <Text style={[s.statusBadgeText, !isActive && { color: "#fff" }]}>{isActive ? t("subscription.status_active") : t("subscription.status_canceled")}</Text>
            </View>
          </View>

          {isPremium && periodEnd && (
            <View style={s.periodRow}>
              <Text style={s.periodLabel}>{t("subscription.renews_label")}:</Text>
              <Text style={s.periodValue}>{periodEnd}</Text>
            </View>
          )}
        </View>

        {/* Premium Benefits */}
        {isPremium && (
          <View style={[s.card, s.premiumCard]}>
            <Text style={s.premiumTitle}>{t("subscription.perks_title", { plan: t("subscription.plan_premium") })}</Text>
            {(t("subscription.features_premium", { returnObjects: true }) as string[]).map((benefit, i) => (
              <View key={i} style={s.benefitRow}>
                <Text style={s.benefitCheck}>✓</Text>
                <Text style={s.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        )}

        {!isPremium && (
          <View style={s.card}>
            <Text style={s.cardTitle}>{t("subscription.upgrade")}</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate("Pricing")}>
              <Text style={s.primaryBtnText}>⚡ {t("subscription.upgrade")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Billing Actions — Stripe portal only shown on web (native platforms manage via store billing) */}
        {Platform.OS === "web" && (
          <View style={s.card}>
            <TouchableOpacity
              onPress={() => openBillingPortal()}
              disabled={isPortalPending}
              style={s.primaryBtn}
            >
              {isPortalPending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={s.primaryBtnText}>💳 {t("subscription.manage_portal")}</Text>
              )}
            </TouchableOpacity>

            {isPremium && (
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() =>
                  Alert.alert(
                    t("subscription.cancel_confirm_title"),
                    t("subscription.cancel_confirm_msg", { date: periodEnd ?? "" }),
                    [
                      { text: t("common.cancel"), style: "cancel" },
                      {
                        text: t("subscription.cancel"),
                        style: "destructive",
                        onPress: () => openBillingPortal(),
                      },
                    ]
                  )
                }
              >
                <Text style={s.cancelBtnText}>✕ {t("subscription.cancel")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Invoices — web only (Apple/Google handle receipts natively) */}
        {Platform.OS === "web" && (
          <View style={s.card}>
            <Text style={s.cardTitle}>{t("subscription.invoices_title")}</Text>
            <Text style={s.cardSub}>
              {isPremium
                ? t("subscription.invoices_desc")
                : t("subscription.invoices_empty")}
            </Text>
            {isPremium && (
              <TouchableOpacity
                onPress={() => openBillingPortal()}
                disabled={isPortalPending}
                style={s.portalBtn}
              >
                <Text style={s.accentText}>{t("subscription.view_invoices")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Apple subscription management (required for App Store) */}
        {Platform.OS === "ios" && (
          <TouchableOpacity
            style={s.card}
            onPress={() => Linking.openURL("itms-apps://apps.apple.com/account/subscriptions")}
          >
            <Text style={s.cardTitle}>{t("subscription.manage_apple")}</Text>
            <Text style={[s.cardSub, { marginTop: 4 }]}>{t("subscription.manage_apple_sub")}</Text>
          </TouchableOpacity>
        )}

        {/* Google Play subscription management (required for Play Store) */}
        {Platform.OS === "android" && (
          <TouchableOpacity
            style={s.card}
            onPress={() => Linking.openURL("https://play.google.com/store/account/subscriptions?package=com.fitai.coach")}
          >
            <Text style={s.cardTitle}>{t("subscription.manage_google")}</Text>
            <Text style={[s.cardSub, { marginTop: 4 }]}>{t("subscription.manage_google_sub")}</Text>
          </TouchableOpacity>
        )}

        {/* Help */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("subscription.help_title")}</Text>
          <TouchableOpacity style={{ marginBottom: 12 }} onPress={() => Linking.openURL("mailto:support@fitaicoach.com")}>
            <Text style={s.accentText}>{t("subscription.contact_support")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginBottom: 12 }} onPress={() => Linking.openURL("https://fitaicoach.com/faq")}>
            <Text style={s.accentText}>{t("subscription.faq_link")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowTerms(true)}>
            <Text style={s.accentText}>{t("subscription.terms_link")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LegalWebViewModal
        visible={showTerms}
        title="Terms of Service"
        url={TERMS_URL}
        onClose={() => setShowTerms(false)}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loadingScreen: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  loadingBack: { position: "absolute", top: 52, left: 20 },
  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },
  back: { marginBottom: 16 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  heading: { fontSize: 26, fontWeight: "800", color: T.textPrimary, marginBottom: 24 },
  card: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginBottom: 16,
  },
  planRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planLabel: { fontSize: 12, color: T.textMuted, marginBottom: 4 },
  planName: { fontSize: 24, fontWeight: "800", color: T.textPrimary, textTransform: "capitalize" },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusActive: { backgroundColor: T.accent },
  statusInactive: { backgroundColor: T.red },
  statusBadgeText: { fontSize: 11, fontWeight: "700", color: "#000" },
  periodRow: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: T.border },
  periodLabel: { fontSize: 12, color: T.textMuted, marginBottom: 4 },
  periodValue: { fontSize: 15, fontWeight: "600", color: T.textPrimary },
  premiumCard: { backgroundColor: T.amberDark, borderColor: T.amber + "60" },
  premiumTitle: { fontSize: 14, fontWeight: "700", color: T.amber, marginBottom: 12 },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  benefitCheck: { color: T.amber, fontWeight: "800", fontSize: 13, marginTop: 1 },
  benefitText: { flex: 1, fontSize: 14, color: T.textSecondary },
  portalBtn: { marginTop: 4 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: T.textPrimary, marginBottom: 12 },
  cardSub: { fontSize: 13, color: T.textSecondary, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  cancelBtn: {
    borderWidth: 1,
    borderColor: T.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: { color: T.red, fontWeight: "600" },
  accentText: { color: T.accent, fontWeight: "600", fontSize: 14 },
});
