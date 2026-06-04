import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tracker Élite',
  description: 'Exécution et Discipline',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-[#0A0A0A] text-white pb-20`}>
        {children}
        
        {/* BARRE DE NAVIGATION GLOBALE RÉPARÉE */}
        <nav className="fixed bottom-0 left-0 w-full bg-[#0A0A0A]/90 backdrop-blur-md border-t border-gray-800 flex justify-around items-center h-16 px-4 z-50">
          <Link href="/" className="flex flex-col items-center gap-1 text-gray-500 hover:text-white transition-colors">
            <span className="text-[10px] font-black uppercase tracking-widest">En cours</span>
          </Link>
          <Link href="/bibliotheque" className="flex flex-col items-center gap-1 text-gray-500 hover:text-white transition-colors">
            <span className="text-[10px] font-black uppercase tracking-widest">Livres</span>
          </Link>
          <Link href="/journal" className="flex flex-col items-center gap-1 text-gray-500 hover:text-white transition-colors">
            <span className="text-[10px] font-black uppercase tracking-widest">Journal</span>
          </Link>
          <Link href="/dashboard" className="flex flex-col items-center gap-1 text-gray-500 hover:text-white transition-colors">
            <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
          </Link>
        </nav>
      </body>
    </html>
  )
}