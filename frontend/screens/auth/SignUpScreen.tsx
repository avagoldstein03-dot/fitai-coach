import React, { useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";

export default function SignUpScreen() {
  const { signUp, setActive } = useSignUp();
  const navigation = useNavigation() as any;
  const { t } = useTranslation();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [loading, setLoading] = React.useState(false);
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState("");

  const onSignUp = async () => {
    if (password !== confirmPassword) {
      Alert.alert(t("common.error"), t("auth.signup.error_mismatch"));
      return;
    }
    setLoading(true);
    try {
      const result = await signUp?.create({ emailAddress: email, password });
      if (result?.status === "complete" && result?.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
      } else if (result?.status === "missing_requirements") {
        await signUp?.prepareEmailAddressVerification({ strategy: "email_code" });
        setPendingVerification(true);
      } else {
        Alert.alert(t("common.error"), t("auth.signup.error_unexpected"));
      }
    } catch (err: any) {
      Alert.alert(t("common.error"), err.errors?.[0]?.message || t("auth.signup.error_signup"));
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    setLoading(true);
    try {
      const result = await signUp?.attemptEmailAddressVerification({ code });
      if (result?.status === "complete" && result?.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
      } else {
        Alert.alert(t("common.error"), t("auth.signup.error_verify_incomplete"));
      }
    } catch (err: any) {
      Alert.alert(t("common.error"), err.errors?.[0]?.message || t("auth.signup.error_verify"));
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView style={s.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.container}>
          <Text style={s.heading}>{t("auth.signup.verify_title")}</Text>
          <Text style={s.subtitle}>{t("auth.signup.verify_subtitle")}</Text>

          <View style={s.fieldGroup}>
            <Text style={s.label}>{t("auth.signup.verify_code")}</Text>
            <TextInput
              placeholder={t("auth.signup.verify_code_placeholder")}
              placeholderTextColor={T.textMuted}
              style={[s.input, s.codeInput]}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <TouchableOpacity onPress={onVerify} disabled={loading} style={[s.primaryBtn, loading && s.disabledBtn]}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>{t("auth.signup.verify_button")}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setPendingVerification(false)} style={s.backRow}>
            <Text style={s.accentText}>{t("auth.signup.back_to_signin")}</Text>
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
        <Text style={s.heading}>{t("auth.signup.title")}</Text>
        <Text style={s.subtitle}>{t("auth.signup.subtitle")}</Text>

        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("auth.signup.email")}</Text>
          <TextInput
            placeholder={t("auth.signup.email_placeholder")}
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
          <Text style={s.label}>{t("auth.signup.password")}</Text>
          <TextInput
            placeholder={t("auth.signup.password_placeholder")}
            placeholderTextColor={T.textMuted}
            style={s.input}
            value={password}
            ref={passwordRef}
            onChangeText={setPassword}
            secureTextEntry
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
        </View>

        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("auth.signup.confirm_password")}</Text>
          <TextInput
            placeholder={t("auth.signup.confirm_placeholder")}
            placeholderTextColor={T.textMuted}
            style={s.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            ref={confirmRef}
            secureTextEntry
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={onSignUp}
          />
        </View>

        <TouchableOpacity onPress={onSignUp} disabled={loading} style={[s.primaryBtn, loading && s.disabledBtn]} accessibilityLabel={t("auth.signup.button")} accessibilityRole="button">
          {loading ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>{t("auth.signup.button")}</Text>}
        </TouchableOpacity>

        <View style={s.signInRow}>
          <Text style={s.mutedText}>{t("auth.signup.have_account")}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
            <Text style={s.accentText}> {t("auth.signup.signin_link")}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.legalFooter}>
          {t("auth.legal_footer")}{" "}
          <Text style={s.legalLink} onPress={() => Linking.openURL("https://fitaicoach.com/terms")}>{t("auth.terms_link")}</Text>
          {" "}{t("auth.and")}{" "}
          <Text style={s.legalLink} onPress={() => Linking.openURL("https://fitaicoach.com/privacy")}>{t("auth.privacy_link")}</Text>
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
  heading: { fontSize: 32, fontWeight: "800", color: T.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: T.textSecondary, marginBottom: 40 },
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
    marginBottom: 20,
  },
  disabledBtn: { backgroundColor: T.surface },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  backRow: { alignItems: "center", marginTop: 8 },
  signInRow: { flexDirection: "row", justifyContent: "center" },
  mutedText: { color: T.textSecondary, fontSize: 14, textAlign: "center" },
  accentText: { color: T.accent, fontWeight: "600", fontSize: 14 },
  legalFooter: { fontSize: 12, color: T.textMuted, textAlign: "center", marginTop: 20, lineHeight: 18 },
  legalLink: { color: T.accent, fontWeight: "600" },
});
