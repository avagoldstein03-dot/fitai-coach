import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/lib/theme";

interface LegalWebViewModalProps {
  visible: boolean;
  title: string;
  url: string | null;
  onClose: () => void;
}

export function LegalWebViewModal({ visible, title, url, onClose }: LegalWebViewModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={12}>
            <Text style={s.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        {url && (
          <WebView
            source={{ uri: url }}
            style={s.webview}
            startInLoadingState
            renderLoading={() => (
              <View style={s.loading}>
                <ActivityIndicator color={T.accent} />
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  title: { flex: 1, fontSize: 17, fontWeight: "700", color: T.textPrimary, marginRight: 12 },
  closeBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  closeBtnText: { fontSize: 16, fontWeight: "700", color: T.accent },
  webview: { flex: 1, backgroundColor: T.bg },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: T.bg,
  },
});
