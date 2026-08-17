"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { Store } from "@/types";
import { DEFAULT_THEME } from "@/lib/theme/tokens";
import { FONT_OPTIONS, loadGoogleFontFor } from "@/lib/theme/fonts";
import { Button } from "@/components/ui/Button";
import { MediaUploader } from "@/components/admin/MediaUploader";
import type { ProductMedia } from "@/types";

const COLOR_FIELDS: { key: keyof Store["theme"]; label: string }[] = [
  { key: "colorBrand", label: "Brand (primary)" },
  { key: "colorBrandDark", label: "Brand — dark" },
  { key: "colorBrandLight", label: "Brand — light" },
  { key: "colorAccent", label: "Accent" },
  { key: "colorAccentDark", label: "Accent — dark" },
  { key: "colorSurface", label: "Surface" },
  { key: "colorSurfaceMuted", label: "Surface — muted" },
  { key: "colorInk", label: "Text" },
  { key: "colorInkMuted", label: "Text — muted" },
];

const PRESETS: { name: string; theme: Partial<Store["theme"]> }[] = [
  { name: "Bamyon green & gold (default)", theme: DEFAULT_THEME },
  {
    name: "Royal purple",
    theme: { colorBrand: "#4C1D95", colorBrandDark: "#2E1065", colorBrandLight: "#F3EEFF", colorAccent: "#F59E0B", colorAccentDark: "#B45309" },
  },
  {
    name: "Ocean blue",
    theme: { colorBrand: "#0C4A6E", colorBrandDark: "#082F49", colorBrandLight: "#E0F2FE", colorAccent: "#F97316", colorAccentDark: "#C2410C" },
  },
  {
    name: "Sunset red",
    theme: { colorBrand: "#7F1D1D", colorBrandDark: "#450A0A", colorBrandLight: "#FEE2E2", colorAccent: "#EAB308", colorAccentDark: "#A16207" },
  },
];

export default function AdminThemePage() {
  const [theme, setTheme] = useState<Store["theme"]>(DEFAULT_THEME);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "stores", STORE_ID));
      if (snap.exists()) {
        const store = snap.data() as Store;
        setTheme(store.theme ?? DEFAULT_THEME);
        setName(store.name ?? "");
        setLogoUrl(store.branding?.logoUrl);
      }
      setLoading(false);
    })();
  }, []);

  // Load the selected Google Font on the fly for live preview.
  useEffect(() => {
    loadGoogleFontFor(theme.fontDisplay);
  }, [theme.fontDisplay]);

  // Live-preview: apply to the document root as the admin edits, before saving.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--color-brand", theme.colorBrand);
    root.style.setProperty("--color-brand-dark", theme.colorBrandDark);
    root.style.setProperty("--color-brand-light", theme.colorBrandLight);
    root.style.setProperty("--color-accent", theme.colorAccent);
    root.style.setProperty("--color-accent-dark", theme.colorAccentDark);
    root.style.setProperty("--color-surface", theme.colorSurface);
    root.style.setProperty("--color-surface-muted", theme.colorSurfaceMuted);
    root.style.setProperty("--color-ink", theme.colorInk);
    root.style.setProperty("--color-ink-muted", theme.colorInkMuted);
  }, [theme]);

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "stores", STORE_ID),
        { name, theme, branding: { logoUrl: logoUrl ?? null }, updatedAt: Date.now() },
        { merge: true }
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Theme studio</h1>
        <p className="text-sm text-ink-muted">
          Changes preview live on this page immediately, and propagate across the whole storefront
          for every visitor once saved — no redeploy needed.
        </p>
      </div>

      <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Store name</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
        />
      </section>

      <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Logo</p>
        <p className="text-xs text-ink-muted">Appears in the header, and on every printed/PDF receipt.</p>
        <MediaUploader
          folder="branding"
          media={logoUrl ? [{ publicId: "logo", url: logoUrl }] : []}
          onChange={(media: ProductMedia[]) => setLogoUrl(media[media.length - 1]?.url)}
        />
      </section>

      <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Font pairing</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.name}
              onClick={() => setTheme({ ...theme, fontDisplay: f.display, fontBody: f.body })}
              className={`rounded-card border px-3 py-2 text-left text-sm ${
                theme.fontDisplay === f.display ? "border-brand bg-brand-light" : "border-surface-muted"
              }`}
              style={{ fontFamily: f.display }}
            >
              {f.name}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => setTheme({ ...theme, ...p.theme })}
              className="flex items-center gap-2 rounded-card border border-surface-muted px-3 py-2 text-sm hover:border-brand"
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: (p.theme as Store["theme"]).colorBrand }}
              />
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Colors</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {COLOR_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-2 text-sm text-ink-muted">
              {f.label}
              <input
                type="color"
                value={theme[f.key]}
                onChange={(e) => setTheme({ ...theme, [f.key]: e.target.value })}
                className="h-8 w-14 rounded border border-surface-muted"
              />
            </label>
          ))}
        </div>
      </section>

      <Button onClick={handleSave} loading={saving}>
        {saved ? "Saved ✓" : "Save theme"}
      </Button>
    </div>
  );
}
