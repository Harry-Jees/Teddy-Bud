/** Shared Teddy Bud design tokens: warm Material-inspired claymorphism and an 8pt rhythm. */
export const teddyTheme = {
  colors: {
    canvas: '#F7F0E7', surface: '#FFFCF7', surfaceAlt: '#F1E6DA', surfaceSoft: '#F8F1EA', surfacePressed: '#EDE0D4',
    text: '#302821', textSecondary: '#6F6256', textMuted: '#6F6256', textDisabled: '#8F8277',
    border: '#D8C8B8', borderStrong: '#BFA995',
    primary: '#75513D', primaryHover: '#68442F', onPrimary: '#FFFCF7', primaryContainer: '#F0E1D4', onPrimaryContainer: '#503728',
    clay: '#D9B49C', claySoft: '#F4E3D7', accent: '#A56D55', accentText: '#87533F',
    success: '#4F684D', successContainer: '#E8EFE5', warning: '#76552F', warningContainer: '#F2E5C9',
    danger: '#8D473F', dangerContainer: '#FCE9E3', white: '#FFFFFF',
  },
  space: { micro: 4, xs: 8, sm: 16, md: 24, lg: 32, xl: 40, '2xl': 48, '3xl': 64 },
  radius: { small: 8, medium: 12, large: 16, extraLarge: 24, pill: 999 },
  type: { label: 12, body: 14, bodyLarge: 16, title: 24, headline: 28 },
  touch: { minimum: 48, appleMinimum: 44 },
  clayShadow: { shadowColor: '#6D4B35', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2 },
} as const;
