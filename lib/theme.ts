export const colors = {
  bg: '#000000',
  card: '#141414',
  cardElevated: '#1C1C1E',
  cardMuted: '#0F0F0F',
  border: '#262626',
  borderSoft: '#1F1F1F',
  text: '#FFFFFF',
  textMuted: '#A1A1A6',
  textDim: '#6E6E73',
  accent: '#FF5A5F',
  accentDeep: '#E0484D',
  accentSoft: 'rgba(255, 90, 95, 0.16)',
  accentSofter: 'rgba(255, 90, 95, 0.08)',
  accentBorder: 'rgba(255, 90, 95, 0.5)',
  accentBorderSoft: 'rgba(255, 90, 95, 0.28)',
  overlay: 'rgba(0, 0, 0, 0.45)',
  pillBg: 'rgba(255, 255, 255, 0.12)',
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.18)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.20)',
  warning: '#F59E0B',
  // Paywall accent — kept as `orange*` keys for back-compat, but valued to the
  // Airbnb-red brand accent so the whole paywall flow renders red.
  orange: '#FF5A5F',
  orangeSoft: 'rgba(255, 90, 95, 0.16)',
  orangeBorder: 'rgba(255, 90, 95, 0.55)',
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const typography = {
  display: { fontSize: 24, fontWeight: '600' as const, color: colors.text },
  title: { fontSize: 20, fontWeight: '600' as const, color: colors.text },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text },
  caption: { fontSize: 13, fontWeight: '400' as const, color: colors.textMuted },
  micro: { fontSize: 11, fontWeight: '600' as const, color: colors.textMuted, letterSpacing: 0.6 },
};

export const gradients = {
  cta: ['#FF5A5F', '#E0484D'] as const,
};
