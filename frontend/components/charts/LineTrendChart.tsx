import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polyline, Circle } from "react-native-svg";
import { T } from "@/lib/theme";
import { scaleToPoints } from "./scale";

interface LineTrendChartProps {
  points: Array<{ x: string; y: number }>;
  color?: string;
  height?: number;
  width?: number;
  yLabel?: string;
}

export default function LineTrendChart({
  points,
  color = T.accent,
  height = 120,
  width = 300,
  yLabel,
}: LineTrendChartProps) {
  if (points.length < 2) {
    return (
      <View style={[s.empty, { height, width }]}>
        <Text style={s.emptyText}>Not enough data yet</Text>
      </View>
    );
  }

  const scaled = scaleToPoints(points.map((p) => p.y), width, height);
  const polylinePoints = scaled.map((p) => `${p.x},${p.y}`).join(" ");
  const last = scaled[scaled.length - 1];

  return (
    <View style={{ width }}>
      {yLabel ? <Text style={s.yLabel}>{yLabel}</Text> : null}
      <Svg height={height} width={width}>
        <Polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2} />
        <Circle cx={last.x} cy={last.y} r={4} fill={color} />
      </Svg>
      <View style={s.xAxis}>
        <Text style={s.xLabel}>{points[0].x}</Text>
        <Text style={s.xLabel}>{points[points.length - 1].x}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  empty: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: T.surface2,
    borderRadius: 12,
  },
  emptyText: { color: T.textMuted, fontSize: 12 },
  yLabel: { color: T.textSecondary, fontSize: 11, marginBottom: 4 },
  xAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  xLabel: { color: T.textMuted, fontSize: 10 },
});
