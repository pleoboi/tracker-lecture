import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mes Lectures",
  description: "Tracker personnel de lecture",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lectures",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased bg-[#F2F2F7]">
        {children}
      </body>
    </html>
  );
}