import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { T } from "@/lib/theme";
import { GLView } from "expo-gl";
import type { ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ── Replace with your hosted .glb model URL ───────────────────────────────────
// Use a model where each muscle group is a separate named mesh, e.g.
// meshes named: "biceps", "quadriceps", "gluteus_maximus", etc.
const MUSCLE_MODEL_URL =
  "https://YOUR_CDN/human-muscular-system.glb";

interface Props {
  muscles: string[];
  exerciseName: string;
}

// Adapted from the user-provided Three.js recipe.
// Traverses every mesh in the model: active muscles glow neon cyan,
// resting muscles stay muted gray.
function highlightMusclesForExercise(
  model: THREE.Object3D,
  activeMuscles: string[]
) {
  const lower = activeMuscles.map((m) => m.toLowerCase());

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;

    // Clone material so we never mutate a shared reference
    if (!Array.isArray(mesh.material)) {
      mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone();
    }
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const name = mesh.name.toLowerCase();

    // Match by substring in either direction (handles e.g. "biceps_brachii" ↔ "biceps")
    const isActive = lower.some((m) => name.includes(m) || m.includes(name));

    if (isActive) {
      mat.color.setHex(0x00ffcc); // Neon Cyan
      mat.emissive.setHex(0x00aaff); // Blue glow
      mat.emissiveIntensity = 0.8;
    } else {
      mat.color.setHex(0x555555); // Muted Gray
      mat.emissive.setHex(0x000000); // No glow
      mat.emissiveIntensity = 0;
    }
  });
}

export default function MuscleDiagram3D({ muscles, exerciseName }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const frameRef  = useRef<number>(0);
  const modelRef  = useRef<THREE.Object3D | null>(null);
  const glRef     = useRef<ExpoWebGLRenderingContext | null>(null);

  // Re-highlight whenever the muscle list changes after mount
  useEffect(() => {
    if (modelRef.current) {
      highlightMusclesForExercise(modelRef.current, muscles);
    }
  }, [muscles]);

  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      glRef.current = gl;
      const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;

      // ── Renderer ─────────────────────────────────────────────────────────────
      const renderer = new Renderer({ gl });
      renderer.setSize(w, h);
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x111827);

      // ── Scene ────────────────────────────────────────────────────────────────
      const scene = new THREE.Scene();

      // ── Camera ───────────────────────────────────────────────────────────────
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 1000);
      camera.position.set(0, 1.4, 2.8);
      camera.lookAt(0, 1.0, 0);

      // ── Lighting ─────────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const key = new THREE.DirectionalLight(0xffffff, 1.2);
      key.position.set(2, 4, 3);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x8888ff, 0.4);
      fill.position.set(-2, 2, -2);
      scene.add(fill);

      // ── Load GLTF ────────────────────────────────────────────────────────────
      try {
        const gltf = await new Promise<any>((resolve, reject) => {
          new GLTFLoader().load(MUSCLE_MODEL_URL, resolve, undefined, reject);
        });

        const model: THREE.Object3D = gltf.scene;
        modelRef.current = model;
        scene.add(model);
        highlightMusclesForExercise(model, muscles);
        setStatus("ready");
      } catch {
        setStatus("error");
        return;
      }

      // ── Render loop (slow auto-rotate) ───────────────────────────────────────
      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);
        if (modelRef.current) modelRef.current.rotation.y += 0.004;
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      animate();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [muscles.join(",")]
  );

  return (
    <View style={s.wrapper}>
      <Text style={s.label}>{exerciseName} — Active Muscles</Text>

      <GLView style={s.canvas} onContextCreate={onContextCreate} />

      {status === "loading" && (
        <View style={s.overlay}>
          <ActivityIndicator color={T.teal} size="large" />
          <Text style={s.overlayText}>Building 3D diagram…</Text>
        </View>
      )}

      {status === "error" && (
        <View style={s.overlay}>
          <Text style={s.errorText}>
            3D model unavailable.{"\n"}Set MUSCLE_MODEL_URL in MuscleDiagram3D.tsx.
          </Text>
        </View>
      )}

      <View style={s.legend}>
        <View style={[s.dot, { backgroundColor: T.teal }]} />
        <Text style={s.legendText}>{t("muscle_diagram.active")}</Text>
        <View style={[s.dot, { backgroundColor: T.surface2 }]} />
        <Text style={s.legendText}>{t("muscle_diagram.resting")}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  label: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  canvas:      { width: "100%", height: 340 },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: T.bg,
    gap: 10,
  },
  overlayText: { color: T.teal, fontSize: 13, marginTop: 8 },
  errorText:   { color: T.red, fontSize: 13, textAlign: "center", padding: 20, lineHeight: 20 },
  legend:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  legendText:  { color: T.textMuted, fontSize: 11, marginRight: 12 },
});
