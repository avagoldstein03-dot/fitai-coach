import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { T } from "@/lib/theme";

interface BarTrendChartProps {
  bars: Array<{ x: string; y: number }>;
  color?: string;
  height?: number;
  width?: number;
}

export default function BarTrendChart({
  bars,
  color = T.teal,
  height = 120,
  width = 300,
}: BarTrendChartProps) {
  if (bars.length === 0) {
    return (
      <View style={[s.empty, { height, width }]}>
        <Text style={s.emptyText}>Not enough data yet</Text>
      </View>
    );
  }

  const max = Math.max(...bars.map((b) => b.y), 1);
  const gap = 4;
  const barWidth = Math.max((width - gap * (bars.length - 1)) / bars.length, 2);

  return (
    <View style={{ width }}>
      <Svg height={height} width={width}>
        {bars.map((bar, i) => {
          const barHeight = Math.max((bar.y / max) * height, 1);
          return (
            <Rect
              key={i}
              x={i * (barWidth + gap)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              fill={color}
              rx={2}
            />
          );
        })}
      </Svg>
      <View style={s.xAxis}>
        <Text style={s.xLabel}>{bars[0].x}</Text>
        <Text style={s.xLabel}>{bars[bars.length - 1].x}</Text>
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
  xAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  xLabel: { color: T.textMuted, fontSize: 10 },
});
