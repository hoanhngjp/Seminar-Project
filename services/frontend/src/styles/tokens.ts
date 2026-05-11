// Design tokens based on DESIGN.md — Spotify-inspired design system
// All components import from here — single source of truth

export const colors = {
  // Backgrounds
  bg:          '#121212',
  surface:     '#181818',
  surfaceMid:  '#1f1f1f',
  surfaceCard: '#252525',
  surfaceAlt:  '#272727',

  // Text
  text:        '#ffffff',
  textMuted:   '#b3b3b3',
  textNear:    '#cbcbcb',
  textLight:   '#fdfdfd',

  // Brand
  accent:       '#1ed760',
  accentBorder: '#1db954',

  // Semantic
  error:   '#f3727f',
  warning: '#ffa42b',
  info:    '#539df5',

  // Borders
  border:      '#4d4d4d',
  borderLight: '#7c7c7c',
} as const;

export const shadows = {
  heavy:  'rgba(0,0,0,0.5) 0px 8px 24px',
  medium: 'rgba(0,0,0,0.3) 0px 8px 8px',
  inset:  'rgb(18,18,18) 0px 1px 0px, rgb(124,124,124) 0px 0px 0px 1px inset',
} as const;

export const radius = {
  minimal:  2,
  subtle:   4,
  standard: 6,
  card:     8,
  medium:   12,
  large:    100,
  pill:     500,
  fullPill: 9999,
  circle:   '50%' as const,
} as const;

// Font stacks — SpotifyMixUI falls back to system sans-serif
const baseStack = "'CircularSp-Arab', 'CircularSp-Hebr', 'CircularSp-Cyrl', 'CircularSp-Grek', 'Helvetica Neue', helvetica, arial, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, 'MS Gothic', sans-serif";

export const font = {
  family: `'SpotifyMixUI', ${baseStack}`,
  title:  `'SpotifyMixUITitle', ${baseStack}`,
} as const;

export const fontSize = {
  micro:   10,
  small:   12,
  caption: 14,
  body:    16,
  feature: 18,
  section: 24,
} as const;

export const fontWeight = {
  regular:   400,
  semibold:  600,
  bold:      700,
} as const;

// Spacing — 8px base unit
export const spacing = {
  1:  1,   2:  2,   3:  3,   4:  4,
  5:  5,   6:  6,   8:  8,   10: 10,
  12: 12,  14: 14,  16: 16,  20: 20,
  24: 24,  32: 32,  40: 40,  48: 48,
  64: 64,
} as const;

// Layout constants
export const layout = {
  sidebarWidth:    240,
  bottomBarHeight: 90,
  contentMaxWidth: 1200,
} as const;
