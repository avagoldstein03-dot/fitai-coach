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
  /** optional constructive action on the opposite swipe, e.g. add this meal */
  onAdd?: () => void;
  addLabel?: string;
}

export function SwipeToDeleteRow({
  children,
  onDelete,
  deleteLabel,
  disabled,
  borderRadius = 16,
  onAdd,
  addLabel,
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

  // Swiping the other way is the constructive counterpart: the same gesture
  // vocabulary, in the accent rather than the destructive red.
  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.5, 1],
      extrapolate: "clamp",
    });
    return (
      <TouchableOpacity
        style={[s.addAction, { borderRadius }]}
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => {
          swipeRef.current?.close();
          onAdd?.();
        }}
        accessibilityLabel={addLabel}
        accessibilityRole="button"
      >
        <Animated.Text style={[s.addActionText, { transform: [{ scale }] }]}>
          {addLabel}
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={onAdd ? renderLeftActions : undefined}
      leftThreshold={40}
      overshootLeft={false}
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
    backgroundColor: T.redSolid,
    justifyContent: "center",
    alignItems: "center",
    width: 84,
    marginLeft: 8,
  },
  deleteActionText: { color: T.white, fontSize: 13, fontWeight: "700" },
  addAction: {
    backgroundColor: T.accent,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  addActionText: { color: T.black, fontWeight: "800", fontSize: 13 },
});
