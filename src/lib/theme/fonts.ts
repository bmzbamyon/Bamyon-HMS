export interface FontOption {
  name: string;
  display: string;
  body: string;
  google: string; // Google Fonts CSS2 family query segment
}

export const FONT_OPTIONS: FontOption[] = [
  {
    name: "Sora + Inter (default)",
    display: "'Sora', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    google: "Sora:wght@600;700;800|Inter:wght@400;500;600",
  },
  {
    name: "Playfair + Lato (elegant)",
    display: "'Playfair Display', serif",
    body: "'Lato', system-ui, sans-serif",
    google: "Playfair+Display:wght@700;800|Lato:wght@400;500;700",
  },
  {
    name: "Poppins (modern rounded)",
    display: "'Poppins', system-ui, sans-serif",
    body: "'Poppins', system-ui, sans-serif",
    google: "Poppins:wght@400;500;600;700;800",
  },
  {
    name: "Space Grotesk (technical)",
    display: "'Space Grotesk', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    google: "Space+Grotesk:wght@600;700|Inter:wght@400;500",
  },
];

/** Injects (or updates) a single Google Fonts <link> tag for the given font pairing. */
export function loadGoogleFontFor(fontDisplay: string): void {
  if (typeof document === "undefined") return;
  const match = FONT_OPTIONS.find((f) => f.display === fontDisplay);
  if (!match) return;
  const linkId = "bamyon-google-font";
  let link = document.getElementById(linkId) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = `https://fonts.googleapis.com/css2?family=${match.google}&display=swap`;
}
