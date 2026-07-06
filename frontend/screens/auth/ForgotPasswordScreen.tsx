import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, StyleSheet,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";

export default function ForgotPasswordScreen() {
  const { signIn, setActive } = useSignIn();
  const navigation = useNavigation() as any;
  const { t } = useTranslation();

  const [step, setStep]               = useState<"email" | "code">("email");
  const [email, setEmail]             = useState("");
  const [code, setCode]               = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm]         = useState("");
  const [loading, setLoading]         = useState(false);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmRef     = useRef<TextInput>(null);

  const sendCode = async () => {
    if (!email.trim()) {
      Alert.alert(t("common.error"), t("auth.forgot.error_email"));
      return;
    }
    setLoading(true);
    try {
      await signIn?.create({ strategy: "reset_password_email_code", identifier: email.trim() });
      setStep("code");
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? t("common.error");
      Alert.alert(t("common.error"), msg);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!code.trim() || newPassword.length < 8 || newPassword !== confirm) {
      Alert.alert(t("common.error"), t("auth.forgot.error_fill"));
      return;
    }
    setLoading(true);
    try {
      const result = await signIn?.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
        password: newPassword,
      });
      if (result?.status === "complete") {
        await setActive?.({ session: result.createdSessionId });
      } else {
        Alert.alert(t("common.error"), t("auth.forgot.error_reset_incomplete"));
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? t("common.error");
      Alert.alert(t("common.error"), msg);
    } finally {
      setLoading(false);
    }
  };

  if (step === "code") {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView style={s.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.container}>
          <TouchableOpacity onPress={() => setStep("email")} style={s.back}>
            <Text style={s.backText}>{t("common.back")}</Text>
          </TouchableOpacity>

          <Text style={s.heading}>{t("auth.forgot.reset_title")}</Text>
          <Text style={s.subtitle}>{t("auth.forgot.reset_subtitle")}</Text>

          <View style={s.fieldGroup}>
            <Text style={s.label}>{t("auth.forgot.code")}</Text>
            <TextInput
              placeholder={t("auth.forgot.code_placeholder")}
              placeholderTextColor={T.textMuted}
              style={[s.input, s.codeInput]}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="next"
              onSubmitEditing={() => newPasswordRef.current?.focus()}
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>{t("auth.forgot.new_password")}</Text>
            <TextInput
              placeholder={t("auth.forgot.new_placeholder")}
              placeholderTextColor={T.textMuted}
              style={s.input}
              value={newPassword}
              ref={newPasswordRef}
              onChangeText={setNewPassword}
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
            <Text style={s.label}>{t("auth.forgot.confirm_password")}</Text>
            <TextInput
              placeholder={t("auth.forgot.confirm_placeholder")}
              placeholderTextColor={T.textMuted}
              style={s.input}
              value={confirm}
              ref={confirmRef}
              onChangeText={setConfirm}
              secureTextEntry
              autoCorrect={false}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={resetPassword}
            />
          </View>

          <TouchableOpacity onPress={resetPassword} disabled={loading} style={[s.primaryBtn, loading && s.disabledBtn]}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>{t("auth.forgot.reset_button")}</Text>}
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>{t("auth.forgot.back_to_signin")}</Text>
        </TouchableOpacity>

        <Text style={s.heading}>{t("auth.forgot.title")}</Text>
        <Text style={s.subtitle}>{t("auth.forgot.subtitle")}</Text>

        <View style={s.fieldGroup}>
          <Text style={s.label}>{t("auth.forgot.email")}</Text>
          <TextInput
            placeholder={t("auth.forgot.email_placeholder")}
            placeholderTextColor={T.textMuted}
            style={s.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={sendCode}
          />
        </View>

        <TouchableOpacity onPress={sendCode} disabled={loading} style={[s.primaryBtn, loading && s.disabledBtn]}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>{t("auth.forgot.send_button")}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  container: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 40 },
  back: { marginBottom: 32 },
  backText: { color: T.accent, fontWeight: "600", fontSize: 15 },
  heading: { fontSize: 28, fontWeight: "800", color: T.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: T.textSecondary, marginBottom: 32, lineHeight: 20 },
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
  mutedText: { color: T.textSecondary, fontSize: 13 },
});
