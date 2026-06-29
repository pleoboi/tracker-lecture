import type { Metadata } from "next";
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
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
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
