import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Image, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { findExerciseMovement } from "@/lib/exercise-movement-db";
import { T } from "@/lib/theme";

interface Props { exerciseName: string; style?: StyleProp<ViewStyle>; }

// Simple crossfade "boomerang" between the exercise's start/end position
// images from free-exercise-db — not a real video, but enough motion to
// convey the movement rather than a single static pose.
export default function ExerciseMovementPreview({ exerciseName, style }: Props) {
  const { t } = useTranslation();
  const movement = useMemo(() => findExerciseMovement(exerciseName), [exerciseName]);
  const crossfadeRef = useRef<Animated.Value | null>(null);
  if (crossfadeRef.current === null) crossfadeRef.current = new Animated.Value(0);
  // eslint-disable-next-line react-hooks/refs
  const crossfade = crossfadeRef.current;

  useEffect(() => {
    if (!movement) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(crossfade, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(crossfade, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [movement, crossfade]);

  if (!movement) return null;

  return (
    <View style={[s.container, style]}>
      <View style={s.imageBox}>
        <Image source={{ uri: movement.images[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <Animated.Image
          source={{ uri: movement.images[1] }}
          style={[StyleSheet.absoluteFill, { opacity: crossfade }]}
          resizeMode="cover"
        />
      </View>
      <Text style={s.label}>{t("form_check.movement_preview_label")}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 20 },
  imageBox: {
    width: "100%",
    aspectRatio: 3 / 2,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  label: { color: T.textMuted, fontSize: 11, marginTop: 6, textAlign: "center" },
});
