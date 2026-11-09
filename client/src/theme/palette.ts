/**
 * Semantic color aliases used by the application shell and screen styles.
 * Change the design system in theme.ts; keep feature code on these semantic names.
 */
import { teddyTheme } from './theme';

export const C = {
  canvas: teddyTheme.colors.canvas, paper: teddyTheme.colors.surface, paperAlt: teddyTheme.colors.surfaceAlt, ink: teddyTheme.colors.text,
  muted: teddyTheme.colors.textSecondary, line: teddyTheme.colors.border, cocoa: teddyTheme.colors.primary, cocoaDark: teddyTheme.colors.onPrimaryContainer,
  peach: teddyTheme.colors.clay, peachLight: teddyTheme.colors.claySoft, green: teddyTheme.colors.success, greenLight: teddyTheme.colors.successContainer,
  rose: teddyTheme.colors.accentText, white: teddyTheme.colors.white,
} as const;
