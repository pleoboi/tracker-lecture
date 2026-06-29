import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "../components/AppShell";
import { AuthProvider } from "../lib/auth-context";
import GlobalBadgeChecker from "../components/GlobalBadgeChecker";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Swena",
  description: "Ton club de lecture privé",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Swena",
    startupImage: [],
  },
  icons: {
    icon: [
      { url: "/icon", sizes: "512x512", type: "image/png" },
      { url: "/icon", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icon",
  },
};

export const viewport: Viewport = {
  themeColor: "#8b79be",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="bg-paper text-ink">
        <AuthProvider>
          <AppShell>{children}</AppShell>
          <GlobalBadgeChecker />
        </AuthProvider>
      </body>
    </html>
  );
}
