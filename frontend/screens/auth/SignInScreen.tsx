import React, { useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSignIn } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";
import { TERMS_URL, PRIVACY_URL } from "@/lib/legal-urls";
import { LegalWebViewModal } from "@/components/LegalWebViewModal";

WebBrowser.maybeCompleteAuthSession();

type SecondFactorStrategy = "phone_code" | "email_code" | "totp" | "backup_code";

export default function SignInScreen() {
  const { signIn, setActive } = useSignIn();
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [legalModal, setLegalModal] = React.useState<"terms" | "privacy" | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const [loading, setLoading] = React.useState(false);
  const [secondFactorStrategy, setSecondFactorStrategy] = React.useState<SecondFactorStrategy | null>(null);
  const [code, setCode] = React.useState("");

  const onSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t("common.error"), t("auth.signin.error_fill"));
      return;
    }
    setLoading(true);
    try {
      const result = await signIn?.create({ identifier: email.trim(), password });
      if (result?.status === "complete") {
        await setActive?.({ session: result.createdSessionId });
      } else if (result?.status === "needs_second_factor") {
        const factors = result.supportedSecondFactors ?? [];
        const phoneFactor = factors.find((f) => f.strategy === "phone_code") as { strategy: "phone_code"; phoneNumberId: string } | undefined;
        const emailFactor = factors.find((f) => f.strategy === "email_code") as { strategy: "email_code"; emailAddressId: string } | undefined;
        const totpFactor = factors.find((f) => f.strategy === "totp");
        const backupCodeFactor = factors.find((f) => f.strategy === "backup_code");

        if (phoneFactor) {
          await signIn?.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: phoneFactor.phoneNumberId });
          setSecondFactorStrategy("phone_code");
        } else if (emailFactor) {
          await signIn?.prepareSecondFactor({ strategy: "email_code", emailAddressId: emailFactor.emailAddressId });
          setSecondFactorStrategy("email_code");
        } else if (totpFactor) {
          setSecondFactorStrategy("totp");
        } else if (backupCodeFactor) {
          setSecondFactorStrategy("backup_code");
        } else {
          Alert.alert(t("common.error"), t("auth.signin.error_2fa_unsupported"));
        }
      } else {
        Alert.alert(t("common.error"), t("auth.signin.error_signin"));
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? t("auth.signin.error_signin");
      Alert.alert(t("common.error"), msg);
    } finally {
      setLoading(false);
    }
  };

  const onVerifySecondFactor = async () => {
    if (!secondFactorStrategy) return;
    setLoading(true);
    try {
      const result = await signIn?.attemptSecondFactor({ strategy: secondFactorStrategy, code } as any);
      if (result?.status === "complete") {
        await setActive?.({ session: result.createdSessionId });
      } else {
        Alert.alert(t("common.error"), t("auth.signin.error_verify_incomplete"));
      }
    } catch (err: any) {
      Alert.alert(t("common.error"), err?.errors?.[0]?.message ?? t("auth.signin.error_verify"));
    } finally {
      setLoading(false);
    }
  };

  if (secondFactorStrategy) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView style={s.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.container}>
          <Text style={s.logo}>{t("auth.signin.verify_2fa_title")}</Text>
          <Text style={s.subtitle}>{t("auth.signin.verify_2fa_subtitle")}</Text>

          <View style={s.fieldGroup}>
            <Text style={s.label}>{t("auth.signin.verify_2fa_code")}</Text>
            <TextInput
              placeholder={t("auth.signin.verify_2fa_code_placeholder")}
              placeholderTextColor={T.textMuted}
              style={[s.input, s.codeInput]}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={8}
              autoFocus
            />
          </View>

          <TouchableOpacity onPress={onVerifySecondFactor} disabled={loading} style={[s.primaryBtn, loading && s.disabledBtn]}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>{t("auth.signin.verify_2fa_button")}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setSecondFactorStrategy(null); setCode(""); }} style={s.forgotBtn}>
            <Text style={s.accentText}>{t("auth.signin.back_to_signin")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.container}>
        <Text style={s.logo}>Active AI</Text>
        <Text style={s.subtitle}>{t("auth.signin.subtitle")}</Text>

        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("auth.signin.email")}</Text>
          <TextInput
            placeholder={t("auth.signin.email_placeholder")}
            placeholderTextColor={T.textMuted}
            style={s.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </View>

        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("auth.signin.password")}</Text>
          <TextInput
            placeholder={t("auth.signin.password_placeholder")}
            placeholderTextColor={T.textMuted}
            style={s.input}
            value={password}
            ref={passwordRef}
            onChangeText={setPassword}
            secureTextEntry
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSignIn}
          />
        </View>

        <TouchableOpacity onPress={onSignIn} disabled={loading} style={[s.primaryBtn, loading && s.disabledBtn]} accessibilityLabel={t("auth.signin.button")} accessibilityRole="button">
          {loading ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>{t("auth.signin.button")}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={s.forgotBtn}>
          <Text style={s.accentText}>{t("auth.signin.forgot")}</Text>
        </TouchableOpacity>

        <View style={s.signUpRow}>
          <Text style={s.mutedText}>{t("auth.signin.no_account")}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
            <Text style={s.accentText}> {t("auth.signin.signup_link")}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.legalFooter}>
          {t("auth.legal_footer")}{" "}
          <Text style={s.legalLink} onPress={() => setLegalModal("terms")}>{t("auth.terms_link")}</Text>
          {" "}{t("auth.and")}{" "}
          <Text style={s.legalLink} onPress={() => setLegalModal("privacy")}>{t("auth.privacy_link")}</Text>
          .
        </Text>
      </View>

      <LegalWebViewModal
        visible={legalModal !== null}
        title={legalModal === "terms" ? "Terms of Service" : "Privacy Policy"}
        url={legalModal === "terms" ? TERMS_URL : legalModal === "privacy" ? PRIVACY_URL : null}
        onClose={() => setLegalModal(null)}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  container: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 40 },
  logo: { fontSize: 36, fontWeight: "800", color: T.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: T.textSecondary, marginBottom: 48 },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", color: T.textPrimary, marginBottom: 8 },
  input: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: T.textPrimary,
    fontSize: 15,
  },
  codeInput: { textAlign: "center", fontSize: 24, letterSpacing: 8 },
  primaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  disabledBtn: { backgroundColor: T.surface },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  forgotBtn: { alignItems: "center", marginBottom: 24 },
  accentText: { color: T.accent, fontWeight: "600", fontSize: 14 },
  signUpRow: { flexDirection: "row", justifyContent: "center" },
  mutedText: { color: T.textSecondary, fontSize: 14 },
  legalFooter: { fontSize: 12, color: T.textMuted, textAlign: "center", marginTop: 20, lineHeight: 18 },
  legalLink: { color: T.accent, fontWeight: "600" },
});
