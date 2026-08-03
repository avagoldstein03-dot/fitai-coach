/**
 * Muscle diagram — a plain hand-drawn body silhouette as a base, with SVG
 * highlights overlaid on active muscles.
 *
 * Deliberately stylized rather than photorealistic/3D: it's a simple
 * pictogram (circle + rounded-rect limbs), not anatomical art, so it needs
 * no external image asset and stays visually consistent with the rest of
 * the app's flat dark UI.
 */

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { T } from "@/lib/theme";

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
// Two figures (front + back) laid out side by side, landscape ~1.37:1.
//
// OVERLAY_W / OVERLAY_H: the pixel size the SVG covers
// FX, FY : top-left of the FRONT figure within the overlay
// BX, BY : top-left of the BACK  figure within the overlay
// FW, FH : rendered pixel size of each figure
//
// The silhouette and the glow overlay both use these same constants, so
// they always line up regardless of what they're tuned to.
// ─────────────────────────────────────────────────────────────────────────────
const OVERLAY_W = 300;
const OVERLAY_H = 220;        // ≈ OVERLAY_W / 1.37
const FW = 112;               // figure render width in px
const FH = 204;               // figure render height in px  (≈ FW * 460/200 * 0.79 to account for padding)
const FX = 12;                // front figure left edge
const FY = 9;                 // front figure top edge
const BX = 176;               // back figure left edge (OVERLAY_W/2 + margin)
const BY = 9;

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

// ── Plain body pictogram, drawn once in the same 200×460 coordinate space as
// the muscle paths above, so it's guaranteed to line up with the glow overlay
// without needing any external reference image. Limbs are two tapered
// segments (upper/lower) with a rounded hand/foot cap, and corners use a
// modest radius rather than rx = width/2 — a fully-rounded rect that long
// and narrow reads as a balloon-animal capsule, not a limb.
function Silhouette({ ox, oy }: { ox: number; oy: number }) {
  return (
    <G transform={`translate(${ox},${oy}) scale(${SX},${SY})`} fill={T.textSecondary} opacity={0.35}>
      <Circle cx={100} cy={26} r={18} />
      <Rect x={92} y={42} width={16} height={10} rx={3} />
      <Path d="M64,56 L136,56 L140,92 L126,178 L74,178 L60,92 Z" />
      <Rect x={58} y={178} width={84} height={42} rx={12} />

      <Rect x={36} y={60} width={20} height={95} rx={7} />
      <Rect x={27} y={148} width={17} height={88} rx={7} />
      <Circle cx={35} cy={246} r={10} />
      <Rect x={144} y={60} width={20} height={95} rx={7} />
      <Rect x={156} y={148} width={17} height={88} rx={7} />
      <Circle cx={165} cy={246} r={10} />

      <Rect x={64} y={220} width={32} height={135} rx={10} />
      <Rect x={69} y={352} width={23} height={85} rx={9} />
      <Rect x={62} y={433} width={34} height={15} rx={7} />
      <Rect x={104} y={220} width={32} height={135} rx={10} />
      <Rect x={108} y={352} width={23} height={85} rx={9} />
      <Rect x={104} y={433} width={34} height={15} rx={7} />
    </G>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function MuscleDiagramSVG({ muscles }: Props) {
  const pulseRef = useRef<Animated.Value | null>(null);
  if (pulseRef.current === null) pulseRef.current = new Animated.Value(1);
  // Animated.Value is a stable, native-driven handle meant to be read during render and
  // passed into style props (e.g. `opacity={pulse}` below) — it has none of the staleness
  // concerns react-hooks/refs otherwise guards against.
  // eslint-disable-next-line react-hooks/refs
  const pulse = pulseRef.current;
  const { front, back } = resolveActive(muscles);

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
      <View style={{ width: OVERLAY_W, height: OVERLAY_H }}>
        <Svg width={OVERLAY_W} height={OVERLAY_H} viewBox={`0 0 ${OVERLAY_W} ${OVERLAY_H}`}>
          {/* Base pictogram — front and back figures side by side */}
          <Silhouette ox={FX} oy={FY} />
          <Silhouette ox={BX} oy={BY} />

          {/* Anterior glow (left figure) */}
          <Glow active={front} ac={T.accent} pulse={pulse} ox={FX} oy={FY} />
          {/* Posterior glow (right figure) */}
          <Glow active={back}  ac={T.teal}   pulse={pulse} ox={BX} oy={BY} />
        </Svg>
      </View>

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
