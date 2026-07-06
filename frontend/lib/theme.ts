export const T = {
  // Backgrounds
  bg:       "#0b0d11",   // page background
  surface:  "#13161d",   // card surface
  surface2: "#1b1f2a",   // elevated / nested card
  overlay:  "#090b0e",   // modal backdrop tint

  // Borders
  border:  "#1f2535",
  border2: "#2b3347",

  // Accent — electric lime
  accent:       "#c8ff47",
  accentDark:   "#0e1a00",
  accentBorder: "#1e3300",
  accentMuted:  "#7aad1a",

  // Teal — secondary data color
  teal:       "#00d4c8",
  tealDark:   "#001e1d",
  tealBorder: "#003d3b",

  // Status
  green:        "#22c55e",
  greenDark:    "#032310",
  greenBorder:  "#0a4020",
  amber:        "#f59e0b",
  amberDark:    "#1a0f00",
  amberBorder:  "#3d2500",
  red:          "#ef4444",
  redDark:      "#1a0000",
  redBorder:    "#3d0c0c",
  blue:         "#3b82f6",
  blueDark:     "#06102a",
  blueBorder:   "#0f2a5e",

  // Typography
  textPrimary:   "#f0f2f6",
  textSecondary: "#6b7a94",
  textMuted:     "#3a4459",

  // Utility
  white: "#ffffff",
  black: "#000000",
} as const;

// Common reusable style fragments
export const card = {
  backgroundColor: T.surface,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: T.border,
  padding: 20,
} as const;

export const chip = {
  backgroundColor: T.surface2,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: T.border,
} as const;
