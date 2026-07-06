import React, { useEffect, useRef, useState } from "react";
import { View, Text, AppState, AppStateStatus, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";

async function checkOnline(): Promise<boolean> {
  try {
    await fetch("https://www.gstatic.com/generate_204", { method: "HEAD", cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}

export function OfflineBanner() {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    const online = await checkOnline();
    setIsOffline(!online);
  };

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 15_000);
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") poll();
    });
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View style={s.banner}>
      <Text style={s.text}>{t("common.offline")}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: T.amberDark,
    borderBottomWidth: 1,
    borderBottomColor: T.amberBorder,
    paddingTop: 44,
    paddingBottom: 8,
    paddingHorizontal: 16,
    zIndex: 999,
    alignItems: "center",
  },
  text: { color: T.amber, fontWeight: "700", fontSize: 13 },
});
