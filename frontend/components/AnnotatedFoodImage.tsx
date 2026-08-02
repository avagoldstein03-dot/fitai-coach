import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export interface DetectedFoodItem {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  x: number;
  y: number;
}

// Cal AI-style annotation pin component
export function FoodPin({ item }: { item: DetectedFoodItem }) {
  const flipX = item.x > 0.58;
  const flipY = item.y > 0.72;

  return (
    <View
      style={[
        s.pinContainer,
        {
          left: `${item.x * 100}%` as any,
          top: `${item.y * 100}%` as any,
        },
      ]}
    >
      <View style={s.pinDot} />
      <View
        style={[
          s.pinCallout,
          flipX ? { right: 18 } : { left: 18 },
          flipY ? { bottom: 0 } : { top: -4 },
        ]}
      >
        <Text style={s.pinName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={s.pinCalories}>{item.calories} kcal</Text>
        <View style={s.pinMacros}>
          <Text style={s.pinProtein}>P {Math.round(item.protein)}g</Text>
          <Text style={s.pinCarbs}>C {Math.round(item.carbs)}g</Text>
          <Text style={s.pinFat}>F {Math.round(item.fat)}g</Text>
        </View>
      </View>
    </View>
  );
}

export function AnnotatedFoodImage({
  imageUri,
  items,
}: {
  imageUri: string;
  items: DetectedFoodItem[];
}) {
  return (
    <View style={s.annotationContainer}>
      <Image source={{ uri: imageUri }} style={s.annotationImage} resizeMode="cover" />
      <View style={s.annotationOverlay} />
      {items.map((item, i) => (
        <FoodPin key={i} item={item} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  annotationContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  annotationImage: { width: "100%", height: "100%" },
  annotationOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  pinContainer: {
    position: "absolute",
    zIndex: 10,
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: T.accent,
    borderWidth: 2,
    borderColor: T.white,
    shadowColor: T.accent,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 5,
  },
  pinCallout: {
    position: "absolute",
    backgroundColor: T.overlay,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.accentBorder,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 95,
    maxWidth: 145,
  },
  pinName: { color: T.textPrimary, fontSize: 11, fontWeight: "700", marginBottom: 2 },
  pinCalories: { color: T.accent, fontSize: 10, marginBottom: 2 },
  pinMacros: { flexDirection: "row", gap: 6 },
  pinProtein: { color: T.blue, fontSize: 9 },
  pinCarbs: { color: T.amber, fontSize: 9 },
  pinFat: { color: T.teal, fontSize: 9 },
});
