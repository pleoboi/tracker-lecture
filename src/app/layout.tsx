import type { Metadata } from "next";
import Link from "next/link";
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
      <body className="antialiased bg-[#F2F2F7] pb-24">
        {/* Le contenu de tes pages s'affichera ici */}
        {children}

        {/* Barre de navigation mobile (Tab Bar) */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-20 pb-4 px-2 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <Link href="/" className="flex flex-col items-center text-gray-500 hover:text-black transition-colors w-1/3 pt-2">
            <span className="text-xl mb-1">📚</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">En cours</span>
          </Link>
          <Link href="/journal" className="flex flex-col items-center text-gray-500 hover:text-black transition-colors w-1/3 pt-2">
            <span className="text-xl mb-1">📖</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Journal</span>
          </Link>
          <Link href="/dashboard" className="flex flex-col items-center text-gray-500 hover:text-black transition-colors w-1/3 pt-2">
            <span className="text-xl mb-1">📊</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Stats</span>
          </Link>
        </nav>
      </body>
    </html>
  );
}