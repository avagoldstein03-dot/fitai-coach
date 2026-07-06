import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import i18n from "@/lib/i18n";
import { T } from "@/lib/theme";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <View style={s.screen}>
        <Text style={s.emoji}>⚠️</Text>
        <Text style={s.title}>{i18n.t("common.error_boundary_title")}</Text>
        <Text style={s.message}>
          {this.state.error?.message ?? i18n.t("common.error_boundary_msg")}
        </Text>
        <TouchableOpacity onPress={this.reset} style={s.retryBtn}>
          <Text style={s.retryBtnText}>{i18n.t("common.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { color: T.textPrimary, fontSize: 20, fontWeight: "800", marginBottom: 8, textAlign: "center" },
  message: { color: T.textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 22 },
  retryBtn: {
    backgroundColor: T.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
