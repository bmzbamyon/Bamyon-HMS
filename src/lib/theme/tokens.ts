import type { Store } from "@/types";

/**
 * Bamyon brand default — deep green + gold, matching the uploaded brand
 * assets. A merchant deployment can override every one of these from the
 * admin Theme Studio (build doc section 18); this object is only the
 * fallback rendered before /stores/{storeId} has loaded, and the seed value
 * used when a new store document is created.
 */
export const DEFAULT_THEME: Store["theme"] = {
  colorBrand: "#0B4033",
  colorBrandDark: "#062A22",
  colorBrandLight: "#E7F3EF",
  colorAccent: "#D6A419",
  colorAccentDark: "#B3860F",
  colorSurface: "#FFFFFF",
  colorSurfaceMuted: "#F5F7F6",
  colorInk: "#12201C",
  colorInkMuted: "#5B6A65",
  radiusCard: "16px",
  fontDisplay: "'Sora', system-ui, sans-serif",
  fontBody: "'Inter', system-ui, sans-serif",
};

export function themeToCssVariables(theme: Store["theme"]): Record<string, string> {
  return {
    "--color-brand": theme.colorBrand,
    "--color-brand-dark": theme.colorBrandDark,
    "--color-brand-light": theme.colorBrandLight,
    "--color-accent": theme.colorAccent,
    "--color-accent-dark": theme.colorAccentDark,
    "--color-surface": theme.colorSurface,
    "--color-surface-muted": theme.colorSurfaceMuted,
    "--color-ink": theme.colorInk,
    "--color-ink-muted": theme.colorInkMuted,
    "--radius-card": theme.radiusCard,
    "--font-display": theme.fontDisplay,
    "--font-body": theme.fontBody,
  };
}
