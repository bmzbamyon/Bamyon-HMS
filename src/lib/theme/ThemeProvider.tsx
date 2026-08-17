"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { Store } from "@/types";
import { DEFAULT_THEME, themeToCssVariables } from "@/lib/theme/tokens";
import { loadGoogleFontFor } from "@/lib/theme/fonts";

interface ThemeContextValue {
  store: Store | null;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({ store: null, loading: true });

/**
 * Subscribes to /stores/{storeId} and writes its `theme` object onto
 * :root as CSS custom properties. No component should ever hardcode a hex
 * color — every color in the design system resolves through these
 * variables (see tailwind.config.ts), so an admin changing the theme in
 * Theme Studio propagates across the entire storefront without a redeploy.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Paint the default theme immediately so there's no flash of unstyled content.
    applyCssVariables(themeToCssVariables(DEFAULT_THEME));

    if (!STORE_ID) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "stores", STORE_ID),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Store;
          setStore(data);
          applyCssVariables(themeToCssVariables(data.theme ?? DEFAULT_THEME));
          loadGoogleFontFor((data.theme ?? DEFAULT_THEME).fontDisplay);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  return <ThemeContext.Provider value={{ store, loading }}>{children}</ThemeContext.Provider>;
}

function applyCssVariables(vars: Record<string, string>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
}

export function useStore(): ThemeContextValue {
  return useContext(ThemeContext);
}
