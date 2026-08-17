import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { ChatWidget } from "@/components/storefront/ChatWidget";

export const metadata: Metadata = {
  title: "Bamyon-IMS",
  description: "Import storefront & commerce operating system.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body">
        <AuthProvider>
          <ThemeProvider>
            <Header />
            <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-8 sm:px-6">{children}</main>
            <Footer />
            <ChatWidget />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
