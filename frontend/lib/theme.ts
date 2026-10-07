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
  // Solid destructive-button fill only — NOT a swap-in for T.red generally.
  // T.red itself is tuned to work as text/icon color on dark backgrounds;
  // darkening it there would fix white-on-red buttons but break every
  // red-text-on-dark-background usage elsewhere. This is verified at 4.75:1
  // with white (#fff) text specifically, for solid button backgrounds only.
  redSolid:     "#d63535",
  blue:         "#3b82f6",
  blueDark:     "#06102a",
  blueBorder:   "#0f2a5e",

  // Typography — three tiers with real separation between them.
  //
  // textSecondary used to be #8291ab, which sat 1.12x from textMuted: close
  // enough that they rendered as the same colour. Every label, caption and
  // helper therefore carried identical visual weight, and screens read as flat
  // walls of equally-important text. The scale now steps 1.83x then 1.74x.
  //
  // Contrast against the worst-case background (surface2, the lightest tier):
  //   textPrimary   14.68:1    body copy, numbers, anything being read
  //   textSecondary  8.03:1    labels and supporting copy
  //   textMuted      4.61:1    captions and hints — at the WCAG AA floor
  // textMuted cannot go dimmer without failing AA. Don't darken either of these
  // without re-checking against surface2 specifically.
  textPrimary:   "#f0f2f6",
  textSecondary: "#a9b6cc",
  textMuted:     "#7a88a4",

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
