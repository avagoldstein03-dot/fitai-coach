import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import axios from "axios";
import * as WebBrowser from "expo-web-browser";
import { type PurchasesOffering } from "react-native-purchases";
import { getOffering, purchasePkg, restorePurchases, isPremiumActive } from "@/lib/purchases";
import { getCountryByName, getLocalPrice, DEFAULT_COUNTRY } from "@/lib/currency";
import { T } from "@/lib/theme";
import { TERMS_URL, PRIVACY_URL } from "@/lib/legal-urls";
import { LegalWebViewModal } from "@/components/LegalWebViewModal";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type BillingPeriod = "weekly" | "monthly" | "annual";
type PlanTier = "starter" | "pro" | "elite";

const PLANS: Record<PlanTier, {
  name: string;
  badge: string | null;
  accentColor: string;
  accentDark: string;
  accentBorder: string;
  monthly: string;
  features: string[];
  monthlyPriceId: string;
  weeklyPriceId: string;
  annualPriceId: string;
}> = {
  starter: {
    name: "Starter",
    badge: null,
    accentColor: T.blue,
    accentDark: T.blueDark,
    accentBorder: T.blueBorder ?? T.border,
    monthly: "$9.99",
    features: [
      "Unlimited food scans & logging",
      "Unlimited AI coaching messages",
      "AI meal plan generation",
      "Full workout program library",
    ],
    monthlyPriceId: process.env.EXPO_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID ?? process.env.EXPO_PUBLIC_STRIPE_PREMIUM_PRICE_ID ?? "",
    weeklyPriceId:  process.env.EXPO_PUBLIC_STRIPE_STARTER_WEEKLY_PRICE_ID  ?? "",
    annualPriceId:  process.env.EXPO_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID  ?? "",
  },
  pro: {
    name: "Pro",
    badge: "POPULAR",
    accentColor: T.accent,
    accentDark: T.accentDark,
    accentBorder: T.accentBorder,
    monthly: "$15.99",
    features: [
      "Everything in Starter",
      "Weekly & monthly progress reviews",
      "AI body scan photo analysis",
      "Supplement recommendations",
      "Priority AI response times",
    ],
    monthlyPriceId: process.env.EXPO_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
    weeklyPriceId:  process.env.EXPO_PUBLIC_STRIPE_PRO_WEEKLY_PRICE_ID  ?? "",
    annualPriceId:  process.env.EXPO_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID  ?? "",
  },
  elite: {
    name: "Elite",
    badge: "BEST VALUE",
    accentColor: T.amber,
    accentDark: T.amberDark,
    accentBorder: T.amberBorder ?? T.border,
    monthly: "$19.99",
    features: [
      "Everything in Pro",
      "Live 360° body scan",
      "AI form check (video analysis)",
      "Advanced analytics & insights",
      "1:1 coaching feedback",
    ],
    monthlyPriceId: process.env.EXPO_PUBLIC_STRIPE_ELITE_MONTHLY_PRICE_ID ?? "",
    weeklyPriceId:  process.env.EXPO_PUBLIC_STRIPE_ELITE_WEEKLY_PRICE_ID  ?? "",
    annualPriceId:  process.env.EXPO_PUBLIC_STRIPE_ELITE_ANNUAL_PRICE_ID  ?? "",
  },
};

interface SubscriptionInfo {
  subscription: {
    id: string | null;
    plan: "free" | "premium";
    status: string;
    currentPeriodEnd: string | null;
  };
}

export default function PricingScreen({ onClose }: { onClose?: () => void } = {}) {
  const navigation = useNavigation() as any;
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const goBack = () => {
    if (onClose) { onClose(); return; }
    if (navigation.canGoBack()) { navigation.goBack(); } else { navigation.navigate("Main"); }
  };

  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [selectedTier, setSelectedTier] = useState<PlanTier>("pro");
  const [isIAPPending, setIsIAPPending] = useState(false);
  const [legalModal, setLegalModal] = useState<"terms" | "privacy" | null>(null);
  const [offerings, setOfferings] = useState<Partial<Record<PlanTier, PurchasesOffering>>>({});

  useEffect(() => {
    if (Platform.OS === "web") return;
    const tiers: PlanTier[] = ["starter", "pro", "elite"];
    Promise.all(tiers.map((tier) => getOffering(tier).then((o) => [tier, o] as const))).then((results) => {
      const map: Partial<Record<PlanTier, PurchasesOffering>> = {};
      for (const [tier, o] of results) {
        if (o) map[tier] = o;
      }
      setOfferings(map);
    });
  }, []);

  const { data: subscriptionData, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await axios.get<SubscriptionInfo>(`${API_URL}/api/subscriptions/status`);
      return res.data;
    },
  });

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/auth/profile`);
      return res.data.data;
    },
    staleTime: 0,
  });

  useFocusEffect(
    useCallback(() => { refetchProfile(); }, [refetchProfile])
  );

  const countryInfo = getCountryByName(profile?.country ?? "") ?? DEFAULT_COUNTRY;

  const subscription = subscriptionData?.subscription;
  const isPremium = subscription?.plan === "premium";
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(i18n.language)
    : null;

  const { mutate: createCheckout, isPending: isCheckoutPending } = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await axios.post(`${API_URL}/api/subscriptions/create-checkout`, {
        priceId,
        successUrl: "activeai://subscription/success",
        cancelUrl: "activeai://subscription/cancel",
      });
      return res.data;
    },
    onSuccess: async (data) => {
      const checkoutUrl = data?.data?.checkoutUrl;
      if (!checkoutUrl) { Alert.alert(t("common.error"), t("pricing.error_no_url")); return; }
      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, "activeai://subscription/success");
      if (result.type === "success") {
        queryClient.invalidateQueries({ queryKey: ["subscription"] });
        Alert.alert(t("pricing.premium"), t("pricing.success_active"));
      }
    },
    onError: () => Alert.alert(t("common.error"), t("pricing.error_checkout")),
  });

  const handleRestore = async () => {
    setIsIAPPending(true);
    try {
      const info = await restorePurchases();
      if (isPremiumActive(info)) {
        queryClient.invalidateQueries({ queryKey: ["subscription"] });
        Alert.alert(t("pricing.premium"), t("pricing.success_active"));
      } else {
        Alert.alert(t("pricing.restore"), t("pricing.restore_none"));
      }
    } catch {
      Alert.alert(t("common.error"), t("pricing.error_checkout"));
    } finally {
      setIsIAPPending(false);
    }
  };

  if (isLoading) {
    return (
      <View style={s.loader}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} style={s.backBtnAbs}>
          <Text style={s.backText}>{onClose ? t("common.close") : t("common.back")}</Text>
        </TouchableOpacity>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  const handleUpgrade = async () => {
    if (Platform.OS !== "web") {
      const tierOffering = offerings[selectedTier];
      const pkg =
        billing === "weekly" ? tierOffering?.weekly :
        billing === "annual" ? tierOffering?.annual :
        tierOffering?.monthly;
      if (!pkg) {
        Alert.alert(t("pricing.coming_soon_title"), t("pricing.coming_soon_msg"));
        return;
      }
      setIsIAPPending(true);
      try {
        const info = await purchasePkg(pkg);
        if (isPremiumActive(info)) {
          queryClient.invalidateQueries({ queryKey: ["subscription"] });
          Alert.alert(t("pricing.premium"), t("pricing.success_active"));
        }
      } catch (err: any) {
        if (!err.userCancelled) {
          Alert.alert(t("common.error"), err.message ?? t("pricing.error_checkout"));
        }
      } finally {
        setIsIAPPending(false);
      }
      return;
    }
    // Web: Stripe checkout (native platforms use RevenueCat/store billing above)
    const plan = PLANS[selectedTier];
    const priceId =
      billing === "weekly" ? plan.weeklyPriceId :
      billing === "annual" ? plan.annualPriceId :
      plan.monthlyPriceId;
    if (!priceId) {
      Alert.alert(t("pricing.coming_soon_title"), t("pricing.coming_soon_msg"));
      return;
    }
    createCheckout(priceId);
  };

  const displayPrice = () => {
    if (billing === "weekly")  return { amount: getLocalPrice(selectedTier, "weekly", countryInfo),  period: t("pricing.per_week"),  sub: null };
    if (billing === "annual")  return { amount: getLocalPrice(selectedTier, "annual", countryInfo),  period: t("pricing.per_year"),  sub: t("pricing.billed_annually") };
    return { amount: getLocalPrice(selectedTier, "monthly", countryInfo), period: t("pricing.per_month"), sub: null };
  };

  const { amount, period, sub } = displayPrice();
  const activePlan = billing !== "monthly" ? null : PLANS[selectedTier];

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <View style={s.container}>

        {/* Back */}
        <TouchableOpacity onPress={goBack} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backText}>{onClose ? t("common.close") : t("common.back")}</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>⚡</Text>
          <Text style={s.heroTitle}>{t("pricing.title")}</Text>
          <Text style={s.heroSub}>{t("pricing.subtitle")}</Text>
          <View style={s.socialProof}>
            <Text style={s.socialProofText}>{t("pricing.social_proof")}</Text>
          </View>
        </View>

        {isPremium && periodEnd && (
          <View style={s.activeBanner}>
            <Text style={s.activeBannerText}>{t("pricing.premium_active", { date: periodEnd ?? "" })}</Text>
          </View>
        )}

        {/* Billing Toggle */}
        <View style={s.billingToggle}>
          {([
            { key: "weekly",  label: t("pricing.billing_weekly"),  sub: getLocalPrice("pro", "weekly", countryInfo) },
            { key: "monthly", label: t("pricing.billing_monthly"), sub: null },
            { key: "annual",  label: t("pricing.billing_annual"),  sub: t("pricing.save_33") },
          ] as { key: BillingPeriod; label: string; sub: string | null }[]).map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBilling(p.key); }}
              style={[s.billingBtn, billing === p.key && s.billingBtnActive]}
            >
              <Text style={[s.billingBtnText, billing === p.key && s.billingBtnTextActive]}>
                {p.label}
              </Text>
              {p.sub && (
                <Text style={[s.billingBtnSub, billing === p.key && s.billingBtnSubActive]}>
                  {p.sub}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Free Card */}
        <View style={s.freeCard}>
          <View style={s.planCardHeader}>
            <Text style={s.planName}>{t("pricing.free")}</Text>
            {!isPremium && <View style={s.currentBadge}><Text style={s.currentBadgeText}>{t("pricing.current_plan")}</Text></View>}
          </View>
          <Text style={s.freeSub}>{t("pricing.free_sub")}</Text>
          <Text style={s.freePrice}>
            {countryInfo.symbol}0<Text style={s.pricePeriod}>{t("pricing.per_month")}</Text>
          </Text>
          {(t("pricing.features_free", { returnObjects: true }) as string[]).map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={s.featureCheck}>✓</Text>
              <Text style={s.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Premium Tier Cards */}
        {billing === "monthly" ? (
          (["starter", "pro", "elite"] as PlanTier[]).map((tier) => {
            const plan = PLANS[tier];
            const isSelected = selectedTier === tier;
            return (
              <TouchableOpacity
                key={tier}
                activeOpacity={0.85}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedTier(tier); }}
                style={[
                  s.planCard,
                  { borderColor: isSelected ? plan.accentColor + "80" : T.border },
                  isSelected && { backgroundColor: plan.accentDark },
                ]}
              >
                <View style={s.planCardHeader}>
                  <Text style={s.planName}>{t(`pricing.${tier}`)}</Text>
                  {plan.badge && (
                    <View style={[s.planBadge, { backgroundColor: plan.accentColor }]}>
                      <Text style={s.planBadgeText}>
                        {tier === "pro" ? t("pricing.popular") : t("pricing.best_value")}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={s.priceRow}>
                  <Text style={[s.priceAmount, isSelected && { color: plan.accentColor }]}>
                    {getLocalPrice(tier, "monthly", countryInfo)}
                  </Text>
                  <Text style={s.pricePeriod}>{t("pricing.per_month")}</Text>
                </View>

                {(t(`pricing.features_${tier}`, { returnObjects: true }) as string[]).map((f, i) => (
                  <View key={i} style={s.featureRow}>
                    <Text style={[s.featureCheck, { color: isSelected ? plan.accentColor : T.textMuted }]}>✓</Text>
                    <Text style={s.featureText}>{f}</Text>
                  </View>
                ))}

                {isSelected && (
                  <View style={[s.selectedDot, { backgroundColor: plan.accentColor }]}>
                    <Text style={s.selectedDotText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={[s.planCard, s.planCardSelected]}>
            <View style={s.planCardHeader}>
              <Text style={s.planName}>{t("pricing.premium")}</Text>
              <View style={[s.planBadge, { backgroundColor: T.accent }]}>
                <Text style={[s.planBadgeText, { color: "#000" }]}>
                  {billing === "annual" ? t("pricing.save_33") : t("pricing.flexible")}
                </Text>
              </View>
            </View>
            <View style={s.priceRow}>
              <Text style={[s.priceAmount, { color: T.accent }]}>{amount}</Text>
              <Text style={s.pricePeriod}>{period}</Text>
            </View>
            {sub && <Text style={s.annualNote}>{sub}</Text>}
            {(t("pricing.features_premium", { returnObjects: true }) as string[]).map((f, i) => (
              <View key={i} style={s.featureRow}>
                <Text style={[s.featureCheck, { color: T.accent }]}>✓</Text>
                <Text style={s.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        {/* CTA */}
        {isPremium ? (
          <TouchableOpacity style={s.manageBtn} onPress={() => navigation.navigate("SubscriptionManagement")}>
            <Text style={s.manageBtnText}>{t("pricing.manage_subscription")}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              onPress={handleUpgrade}
              disabled={isCheckoutPending || isIAPPending}
              style={[
                s.ctaBtn,
                { backgroundColor: activePlan ? activePlan.accentColor : T.accent },
                (isCheckoutPending || isIAPPending) && s.ctaBtnDisabled,
              ]}
              activeOpacity={0.85}
              accessibilityLabel={t("common.upgrade")} accessibilityRole="button"
            >
              {(isCheckoutPending || isIAPPending) ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={s.ctaBtnText}>
                    {t("pricing.get_plan", {
                      plan: billing !== "monthly" ? t("pricing.premium") : t(`pricing.${selectedTier}`),
                      price: amount,
                      period: period,
                    })}
                  </Text>
                  {billing === "annual" && (
                    <Text style={s.ctaBtnSub}>{t("pricing.save_33_vs")}</Text>
                  )}
                </>
              )}
            </TouchableOpacity>
            {Platform.OS !== "web" && (
              <TouchableOpacity
                onPress={handleRestore}
                disabled={isIAPPending}
                style={s.restoreBtn}
                accessibilityLabel={t("pricing.restore")}
              >
                <Text style={s.restoreText}>{t("pricing.restore")}</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <Text style={s.cancelNote}>{t("pricing.cancel_note")}</Text>

        {/* Legal links — required by App Store */}
        <View style={s.legalRow}>
          <TouchableOpacity onPress={() => setLegalModal("terms")}>
            <Text style={s.legalLink}>{t("pricing.terms_link")}</Text>
          </TouchableOpacity>
          <Text style={s.legalDot}>·</Text>
          <TouchableOpacity onPress={() => setLegalModal("privacy")}>
            <Text style={s.legalLink}>{t("pricing.privacy_link")}</Text>
          </TouchableOpacity>
        </View>

        <LegalWebViewModal
          visible={legalModal !== null}
          title={legalModal === "terms" ? "Terms of Service" : "Privacy Policy"}
          url={legalModal === "terms" ? TERMS_URL : legalModal === "privacy" ? PRIVACY_URL : null}
          onClose={() => setLegalModal(null)}
        />

        {/* FAQ */}
        <Text style={s.faqTitle}>{t("pricing.faq_title")}</Text>
        {(t("pricing.faq", { returnObjects: true }) as { q: string; a: string }[]).map((faq, i) => (
          <View key={i} style={s.faqCard}>
            <Text style={s.faqQ}>{faq.q}</Text>
            <Text style={s.faqA}>{faq.a}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  loader: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  backBtnAbs: { position: "absolute", top: 52, left: 24, padding: 8 },
  container: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 56 },

  backBtn: { marginBottom: 24, alignSelf: "flex-start", padding: 4 },
  backText: { color: T.accent, fontSize: 16, fontWeight: "600" },

  // Hero
  hero: { alignItems: "center", marginBottom: 28, paddingHorizontal: 16 },
  heroEmoji: { fontSize: 40, marginBottom: 12 },
  heroTitle: { fontSize: 28, fontWeight: "800", color: T.textPrimary, textAlign: "center", letterSpacing: -0.5, marginBottom: 8 },
  heroSub: { fontSize: 14, color: T.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 14 },
  socialProof: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  socialProofText: { fontSize: 12, color: T.accentMuted, fontWeight: "600" },

  // Active banner
  activeBanner: {
    backgroundColor: T.accentDark,
    borderWidth: 1,
    borderColor: T.accentBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    alignItems: "center",
  },
  activeBannerText: { color: T.accent, fontWeight: "700", fontSize: 13 },

  // Billing toggle
  billingToggle: {
    flexDirection: "row",
    backgroundColor: T.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: T.border,
  },
  billingBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  billingBtnActive: { backgroundColor: T.accentDark, borderWidth: 1, borderColor: T.accentBorder },
  billingBtnText: { fontSize: 12, fontWeight: "600", color: T.textSecondary },
  billingBtnTextActive: { color: T.accent },
  billingBtnSub: { fontSize: 10, color: T.accent, fontWeight: "700", marginTop: 1 },
  billingBtnSubActive: { color: T.accentMuted },

  // Free card
  freeCard: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    marginBottom: 12,
  },
  freeSub: { fontSize: 12, color: T.textMuted, marginBottom: 10 },
  freePrice: { fontSize: 34, fontWeight: "800", color: T.textPrimary, marginBottom: 14 },
  currentBadge: { backgroundColor: T.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  currentBadgeText: { color: T.textMuted, fontSize: 11, fontWeight: "700" },

  // Plan cards
  planCard: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: T.border,
    padding: 20,
    marginBottom: 12,
  },
  planCardSelected: { backgroundColor: T.accentDark, borderColor: T.accentBorder },
  planCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  planName: { fontSize: 20, fontWeight: "800", color: T.textPrimary },
  planBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  planBadgeText: { color: "#000", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  priceRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 14 },
  priceAmount: { fontSize: 34, fontWeight: "800", color: T.textPrimary, marginRight: 3 },
  pricePeriod: { fontSize: 14, color: T.textMuted, marginBottom: 6 },
  annualNote: { fontSize: 12, color: T.accent, fontWeight: "600", marginBottom: 12, marginTop: -10 },
  selectedDot: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-end", marginTop: 8,
  },
  selectedDotText: { color: "#000", fontSize: 13, fontWeight: "800" },

  // Features
  featureRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 10 },
  featureCheck: { fontSize: 13, fontWeight: "800", color: T.textMuted, marginTop: 1 },
  featureText: { flex: 1, fontSize: 14, color: T.textSecondary, lineHeight: 20 },

  // CTA
  ctaBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  ctaBtnDisabled: { backgroundColor: T.surface2 },
  ctaBtnText: { color: "#000", fontWeight: "800", fontSize: 17 },
  ctaBtnSub: { color: "rgba(0,0,0,0.6)", fontSize: 12, marginTop: 3 },
  manageBtn: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  manageBtnText: { color: T.textSecondary, fontWeight: "700", fontSize: 15 },
  restoreBtn: { alignItems: "center", paddingVertical: 10, marginTop: 4, marginBottom: 4 },
  restoreText: { color: T.textMuted, fontSize: 13, fontWeight: "500" },
  cancelNote: { color: T.textMuted, fontSize: 12, textAlign: "center", marginBottom: 12 },
  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 24 },
  legalLink: { color: T.accent, fontSize: 12, fontWeight: "600" },
  legalDot: { color: T.textMuted, fontSize: 12 },

  // FAQ
  faqTitle: { fontSize: 18, fontWeight: "800", color: T.textPrimary, marginBottom: 14 },
  faqCard: {
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    marginBottom: 10,
  },
  faqQ: { color: T.textPrimary, fontWeight: "700", fontSize: 14, marginBottom: 6 },
  faqA: { color: T.textSecondary, fontSize: 13, lineHeight: 20 },
});
