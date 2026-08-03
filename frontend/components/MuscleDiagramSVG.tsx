/**
 * Muscle diagram — a real front+back reference image as the base, with SVG
 * highlights overlaid on active muscles.
 *
 * frontend/assets/muscle-diagram.png was generated once via
 * scripts/generate-muscle-diagram-asset.mjs (OpenAI gpt-image-1) — a plain
 * mannequin-style front/back figure pair, no faces/anatomy/clothing detail.
 * It's a static asset, not a live per-request AI call.
 */

import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { T } from "@/lib/theme";
import { getMovementCategory, MovementCategory } from "@/lib/exercise-movement-category";

// React Native image assets are resolved by Metro at build time as opaque numbers.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IMG = require("../assets/muscle-diagram.png") as number;

interface Props { muscles: string[]; exerciseName: string; }
const AnimatedG = Animated.createAnimatedComponent(G);

// ── Mirror x = 100 ───────────────────────────────────────────────────────────
function mX(d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
    (_, x, y) => `${200 - parseFloat(x)},${y}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Highlight region paths
// Coordinate space: each figure = 200 wide × 460 tall
// Transforms (below) map these into the correct half of the displayed image.
// ─────────────────────────────────────────────────────────────────────────────
const L: Record<string, string> = {
  // ── FRONT ──────────────────────────────────────────────────────────────────
  trapF:   "M94,70 C83,72 63,78 48,94 C40,104 40,116 50,120 C60,116 74,108 86,94 C92,86 95,76 94,70 Z",
  deltF:   "M48,94 C37,98 28,112 26,134 C24,152 30,168 43,172 C55,174 64,166 68,150 C70,136 68,118 62,106 C57,98 52,92 48,94 Z",
  pec:     "M96,82 C84,78 68,76 53,86 C40,96 34,114 34,132 C34,150 44,162 57,167 C70,172 84,170 92,162 C98,154 100,140 100,124 C100,108 99,92 96,82 Z",
  serr:    "M55,132 C46,142 44,158 50,170 C54,174 64,170 68,160 C70,148 66,134 55,132 Z",
  bic:     "M28,130 C18,146 16,170 21,188 C26,200 39,204 50,194 C59,184 59,162 54,144 C49,130 38,126 28,130 Z",
  brach:   "M21,186 C13,202 12,224 17,238 C22,250 36,252 46,240 C53,226 52,206 46,190 Z",
  foreF:   "M17,236 C8,256 6,280 11,296 C17,308 32,310 42,296 C50,280 48,256 41,240 Z",
  abs1L:   "M84,154 C79,157 75,168 75,178 C75,186 80,190 88,190 C96,190 100,186 100,178 C100,168 96,157 91,154 Z",
  abs2L:   "M83,193 C78,196 74,207 74,217 C74,225 79,229 87,229 C95,229 99,225 99,217 C99,207 95,196 90,193 Z",
  abs3L:   "M82,232 C77,235 73,246 73,256 C73,264 78,268 86,268 C94,268 98,264 98,256 C98,246 94,235 89,232 Z",
  obl:     "M96,148 C71,164 56,196 54,226 C52,246 63,260 80,262 C92,258 98,238 98,212 C98,182 97,164 96,148 Z",
  hipf:    "M83,270 C76,276 72,288 76,300 C80,310 91,310 97,298 C100,286 97,272 91,270 Z",
  tfl:     "M68,262 C58,272 53,288 57,302 C62,313 73,312 78,298 C82,284 76,266 68,262 Z",
  add:     "M86,274 C80,292 78,326 82,360 C84,372 90,374 94,364 C96,344 94,306 92,278 Z",
  rfem:    "M87,272 C81,294 79,330 82,364 C84,382 91,390 98,385 C104,376 104,346 102,318 C100,290 95,274 87,272 Z",
  vlat:    "M72,272 C58,298 54,338 56,374 C58,396 68,406 80,401 C86,392 86,362 86,328 C86,294 82,276 72,272 Z",
  vmed:    "M87,345 C77,360 75,378 80,392 C85,402 98,400 101,388 C104,374 101,356 94,346 Z",
  tib:     "M78,394 C69,414 67,440 70,449 C75,453 86,450 88,443 C88,424 88,398 84,394 Z",
  gastF:   "M88,394 C97,412 97,440 92,449 C87,452 79,448 77,440 C75,427 78,412 84,396 Z",
  // ── BACK ───────────────────────────────────────────────────────────────────
  trapUpr: "M100,68 C78,70 54,84 38,104 C30,116 30,138 44,145 C59,148 79,138 91,126 C98,118 101,108 Z",
  trapMid: "M91,126 C86,148 84,172 88,192 C92,202 100,200 100,192 Z",
  trapLow: "M88,192 C84,208 86,226 92,232 C97,238 100,234 100,228 Z",
  deltB:   "M44,145 C34,158 30,178 35,198 C42,210 54,210 62,196 C68,180 64,158 56,146 Z",
  inf:     "M44,145 C34,164 34,188 48,202 C62,212 80,208 87,190 C91,174 87,152 74,142 Z",
  ter:     "M48,200 C40,216 44,234 60,244 C73,252 84,244 88,226 C90,210 83,198 68,196 Z",
  rhom:    "M92,122 C87,140 85,162 88,180 C92,190 100,188 100,180 Z",
  lat:     "M44,145 C27,170 22,210 36,250 C46,278 68,292 86,283 C98,276 100,254 98,226 C96,194 84,164 64,146 Z",
  erect:   "M96,140 C91,172 90,210 93,248 C96,262 100,264 100,256 L100,136 Z",
  gluteMed:"M58,248 C48,262 48,282 60,290 C70,296 84,288 88,272 C90,258 84,244 72,242 Z",
  glute:   "M74,264 C55,278 48,308 53,337 C57,358 76,374 91,366 C102,358 105,334 100,306 C96,280 88,262 74,264 Z",
  itband:  "M72,362 C67,386 66,412 70,430 C73,438 80,438 83,430 C81,412 80,386 78,362 Z",
  bifem:   "M72,362 C58,388 55,420 61,440 C66,452 78,451 84,440 C86,416 86,386 82,364 Z",
  semit:   "M94,362 C88,388 86,420 92,440 C97,452 107,450 110,438 C112,414 110,386 106,364 Z",
  gastBo:  "M76,435 C62,448 60,455 65,455 C73,455 82,451 84,443 C84,438 82,434 76,435 Z",
  gastBi:  "M87,435 C96,446 97,454 92,455 C87,455 83,449 83,441 C83,437 85,435 87,435 Z",
  tric:    "M30,132 C19,156 17,184 22,208 C28,222 43,226 53,210 C60,192 58,164 51,138 Z",
};

const R: Record<string, string> = Object.fromEntries(
  Object.entries(L).map(([k, v]) => [k, mX(v)]),
);

// ── Muscle → key mapping ──────────────────────────────────────────────────────
const MUSCLE_MAP: Record<string, { f?: string[]; b?: string[] }> = {
  chest:               { f: ["pec"] },
  pectorals:           { f: ["pec"] },
  "pectoralis major":  { f: ["pec"] },
  shoulders:           { f: ["deltF"], b: ["deltB"] },
  deltoids:            { f: ["deltF"], b: ["deltB"] },
  "anterior deltoid":  { f: ["deltF"] },
  "rear deltoid":      { b: ["deltB"] },
  "posterior deltoid": { b: ["deltB"] },
  biceps:              { f: ["bic","brach"] },
  "biceps brachii":    { f: ["bic","brach"] },
  brachialis:          { f: ["brach"] },
  forearms:            { f: ["foreF"] },
  triceps:             { b: ["tric"] },
  "triceps brachii":   { b: ["tric"] },
  abs:                 { f: ["abs1L","abs2L","abs3L"] },
  "rectus abdominis":  { f: ["abs1L","abs2L","abs3L"] },
  core:                { f: ["abs1L","abs2L","abs3L","obl"] },
  obliques:            { f: ["obl"] },
  "external obliques": { f: ["obl"] },
  serratus:            { f: ["serr"] },
  "serratus anterior": { f: ["serr"] },
  adductors:           { f: ["add"] },
  back:                { b: ["lat","trapUpr","trapMid"] },
  lats:                { b: ["lat"] },
  "latissimus dorsi":  { b: ["lat"] },
  traps:               { b: ["trapUpr","trapMid","trapLow"] },
  trapezius:           { b: ["trapUpr","trapMid","trapLow"] },
  rhomboids:           { b: ["rhom"] },
  infraspinatus:       { b: ["inf"] },
  "teres major":       { b: ["ter"] },
  "erector spinae":    { b: ["erect"] },
  "lower back":        { b: ["erect"] },
  glutes:              { b: ["glute","gluteMed"] },
  "gluteus maximus":   { b: ["glute"] },
  "gluteus medius":    { b: ["gluteMed"] },
  "hip flexors":       { f: ["hipf","tfl"] },
  quadriceps:          { f: ["rfem","vlat","vmed"] },
  quads:               { f: ["rfem","vlat","vmed"] },
  "rectus femoris":    { f: ["rfem"] },
  "vastus lateralis":  { f: ["vlat"] },
  "vastus medialis":   { f: ["vmed"] },
  hamstrings:          { b: ["bifem","semit"] },
  "biceps femoris":    { b: ["bifem"] },
  semitendinosus:      { b: ["semit"] },
  calves:              { b: ["gastBo","gastBi"] },
  gastrocnemius:       { b: ["gastBo","gastBi"] },
  shin:                { f: ["tib"] },
  "tibialis anterior": { f: ["tib"] },
};

function resolveActive(muscles: string[]): { front: Set<string>; back: Set<string> } {
  const front = new Set<string>();
  const back  = new Set<string>();
  for (const m of muscles) {
    const key = m.toLowerCase().trim();
    let match = MUSCLE_MAP[key];
    if (!match) {
      for (const [mk, mv] of Object.entries(MUSCLE_MAP)) {
        if (key.includes(mk) || mk.includes(key)) { match = mv; break; }
      }
    }
    if (match) {
      match.f?.forEach((k) => front.add(k));
      match.b?.forEach((k) => back.add(k));
    }
  }
  return { front, back };
}

// ─────────────────────────────────────────────────────────────────────────────
// Display constants
//
// muscle-diagram.png is 1536×1024 (1.5:1) — OVERLAY_W/H match that ratio
// exactly so <Image resizeMode="contain"> fills the box with no letterboxing,
// which makes the fractional figure position in the source image map 1:1
// onto pixel offsets here.
//
// FX/FY/FW/FH and BX/BY below are measured directly off the generated image
// (front figure ≈ 19–46% of width, back figure ≈ 54–81%, both ≈ 6–93% of
// height) — re-measure these if the PNG is ever regenerated/replaced.
// ─────────────────────────────────────────────────────────────────────────────
const OVERLAY_W = 300;
const OVERLAY_H = 200;        // = OVERLAY_W / 1.5
const FW = 81;                // figure render width in px
const FH = 175;               // figure render height in px
const FX = 57;                // front figure left edge
const FY = 12;                // front figure top edge
const BX = 162;               // back figure left edge
const BY = 12;

// SVG path data is 200 wide × 460 tall → scale to FW × FH
const SX = FW / 200;          // ≈ 0.56
const SY = FH / 460;          // ≈ 0.44

// ── Pulse overlay for one side ────────────────────────────────────────────────
function Glow({ active, ac, pulse, ox, oy }: {
  active: Set<string>; ac: string; pulse: Animated.Value; ox: number; oy: number;
}) {
  const keys = [...active].filter((k) => k in L);
  if (!keys.length) return null;
  return (
    <AnimatedG opacity={pulse} transform={`translate(${ox},${oy}) scale(${SX},${SY})`}>
      {keys.map((k) => (
        <G key={k}>
          <Path d={L[k]} fill={ac} opacity={0.6} />
          <Path d={R[k]} fill={ac} opacity={0.6} />
        </G>
      ))}
    </AnimatedG>
  );
}

// Whole-diagram motion, keyed to the exercise's broad movement category and
// driven by the same `pulse` value that already animates the glow (1 = bright/
// "top" of the rep, 0.08 = dim/"bottom" of the rep) — no rigged limbs, just a
// visual cue for the kind of motion. Categories with no obvious whole-body
// cue (e.g. curl/pull, which mostly move the arms) get a small scale pulse;
// null (unrecognized exercise) gets no extra motion at all.
function getMotionTransform(category: MovementCategory | null, pulse: Animated.Value) {
  switch (category) {
    case "squat":
    case "hinge":
      return [{ translateY: pulse.interpolate({ inputRange: [0.08, 1], outputRange: [8, 0] }) }];
    case "calf":
      return [{ translateY: pulse.interpolate({ inputRange: [0.08, 1], outputRange: [-6, 0] }) }];
    case "press":
    case "pull":
    case "curl":
      return [{ scale: pulse.interpolate({ inputRange: [0.08, 1], outputRange: [1.035, 1] }) }];
    case "core":
      return [{ scaleY: pulse.interpolate({ inputRange: [0.08, 1], outputRange: [0.96, 1] }) }];
    default:
      return undefined;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function MuscleDiagramSVG({ muscles, exerciseName }: Props) {
  const pulseRef = useRef<Animated.Value | null>(null);
  if (pulseRef.current === null) pulseRef.current = new Animated.Value(1);
  // Animated.Value is a stable, native-driven handle meant to be read during render and
  // passed into style props (e.g. `opacity={pulse}` below) — it has none of the staleness
  // concerns react-hooks/refs otherwise guards against.
  // eslint-disable-next-line react-hooks/refs
  const pulse = pulseRef.current;
  const { front, back } = resolveActive(muscles);
  const motionTransform = getMotionTransform(getMovementCategory(exerciseName), pulse);

  useEffect(() => {
    if (!muscles.length) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.08, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [muscles, pulse]);

  return (
    <View style={ui.container}>
      <Animated.View
        style={{ width: OVERLAY_W, height: OVERLAY_H, transform: motionTransform }}
      >
        <Image
          source={IMG}
          style={{ width: OVERLAY_W, height: OVERLAY_H, borderRadius: 12 }}
          resizeMode="contain"
        />

        {/* SVG glow overlay — pointerEvents none so it doesn't block touches */}
        <Svg
          style={StyleSheet.absoluteFill}
          viewBox={`0 0 ${OVERLAY_W} ${OVERLAY_H}`}
          pointerEvents="none"
        >
          {/* Anterior glow (front figure) */}
          <Glow active={front} ac={T.accent} pulse={pulse} ox={FX} oy={FY} />
          {/* Posterior glow (back figure) */}
          <Glow active={back}  ac={T.teal}   pulse={pulse} ox={BX} oy={BY} />
        </Svg>
      </Animated.View>

      {/* Active muscle labels */}
      {muscles.length > 0 && (
        <View style={ui.legend}>
          {muscles.slice(0, 5).map((m, i) => {
            const key   = m.toLowerCase().trim();
            const match = MUSCLE_MAP[key]
              ?? Object.entries(MUSCLE_MAP).find(([k]) => key.includes(k) || k.includes(key))?.[1];
            const isFront = (match?.f?.length ?? 0) > 0;
            return (
              <View key={i} style={ui.legendItem}>
                <View style={[ui.dot, { backgroundColor: isFront ? T.accent : T.teal }]} />
                <Text style={ui.legendTxt}>{m}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ui = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  legend:     { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  legendTxt:  { fontSize: 11, color: "#fff", fontWeight: "500" },
});
