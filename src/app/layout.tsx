import type { Metadata, Viewport } from "next";
import { Dela_Gothic_One, Fraunces, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "../components/AppShell";
import { AuthProvider } from "../lib/auth-context";
import GlobalBadgeChecker from "../components/GlobalBadgeChecker";
import PushPermissionPrompt from "../components/PushPermissionPrompt";
import ServiceWorkerRegistrar from "../components/ServiceWorkerRegistrar";

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

// Titres du mode Manga (gothique japonaise, un seul poids)
const dela = Dela_Gothic_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dela",
  display: "swap",
});

// Pose la classe .manga avant le premier rendu quand on arrive directement
// sur /manga (sinon flash de la palette Swena le temps que React s'hydrate).
const MANGA_THEME_SCRIPT = `(function(){try{var p=location.pathname;if(p==="/manga"||p.indexOf("/manga/")===0)document.documentElement.classList.add("manga")}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Swena",
  description: "Ton club de lecture privé",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Swena",
  },
  icons: {
    icon: [
      { url: "/icon", sizes: "512x512", type: "image/png" },
      { url: "/icon", sizes: "192x192", type: "image/png" },
    ],
    // Extension .png explicite — Safari la recherche en priorité
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
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
    <html lang="fr" className={`${inter.variable} ${fraunces.variable} ${dela.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MANGA_THEME_SCRIPT }} />
        {/* Fallback explicite — certains Safari ignorent la balise metadata sans extension .png */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body className="bg-paper text-ink">
        <AuthProvider>
          <AppShell>{children}</AppShell>
          <GlobalBadgeChecker />
          <PushPermissionPrompt />
          <ServiceWorkerRegistrar />
        </AuthProvider>
      </body>
    </html>
  );
}
