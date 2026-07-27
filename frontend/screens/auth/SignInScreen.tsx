import React, { useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, KeyboardAvoidingView, Platform, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSignIn } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";
import { TERMS_URL, PRIVACY_URL } from "@/lib/legal-urls";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive } = useSignIn();
  const navigation = useNavigation() as any;
  const { t } = useTranslation();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const passwordRef = useRef<TextInput>(null);

  const onSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t("common.error"), t("auth.signin.error_fill"));
      return;
    }
    try {
      const result = await signIn?.create({ identifier: email.trim(), password });
      if (result?.status === "complete") {
        await setActive?.({ session: result.createdSessionId });
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? t("auth.signin.error_signin");
      Alert.alert(t("common.error"), msg);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.container}>
        <Text style={s.logo}>FitAI Coach</Text>
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

        <TouchableOpacity onPress={onSignIn} style={s.primaryBtn} accessibilityLabel={t("auth.signin.button")} accessibilityRole="button">
          <Text style={s.primaryBtnText}>{t("auth.signin.button")}</Text>
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
          <Text style={s.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>{t("auth.terms_link")}</Text>
          {" "}{t("auth.and")}{" "}
          <Text style={s.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>{t("auth.privacy_link")}</Text>
          .
        </Text>
      </View>
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
  primaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  forgotBtn: { alignItems: "center", marginBottom: 24 },
  accentText: { color: T.accent, fontWeight: "600", fontSize: 14 },
  signUpRow: { flexDirection: "row", justifyContent: "center" },
  mutedText: { color: T.textSecondary, fontSize: 14 },
  legalFooter: { fontSize: 12, color: T.textMuted, textAlign: "center", marginTop: 20, lineHeight: 18 },
  legalLink: { color: T.accent, fontWeight: "600" },
});
