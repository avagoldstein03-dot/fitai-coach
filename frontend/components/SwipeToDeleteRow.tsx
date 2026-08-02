import React, { useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { T } from "@/lib/theme";

interface SwipeToDeleteRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel: string;
  disabled?: boolean;
  /** match the wrapped card's borderRadius so the red action sits flush */
  borderRadius?: number;
}

export function SwipeToDeleteRow({
  children,
  onDelete,
  deleteLabel,
  disabled,
  borderRadius = 16,
}: SwipeToDeleteRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });
    return (
      <TouchableOpacity
        style={[s.deleteAction, { borderRadius }]}
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => {
          swipeRef.current?.close();
          onDelete();
        }}
        accessibilityLabel={deleteLabel}
        accessibilityRole="button"
      >
        <Animated.Text style={[s.deleteActionText, { transform: [{ scale }] }]}>
          {deleteLabel}
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
    >
      {children}
    </Swipeable>
  );
}

const s = StyleSheet.create({
  deleteAction: {
    backgroundColor: T.red,
    justifyContent: "center",
    alignItems: "center",
    width: 84,
    marginLeft: 8,
  },
  deleteActionText: { color: T.white, fontSize: 13, fontWeight: "700" },
});
