"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalBooksCompleted: 0,
    totalPagesRead: 0,
    pagesDiff: 0,
    booksDiff: 0,
    chartData: [] as any[],
    avgPagesPerBook: 0,
    longestBook: { title: "-", pages: 0 },
    shortestBook: { title: "-", pages: 0 },
    avgPagesPerDay: 0,
    bestDay: { date: "-", pages: 0 },
    worstDay: { date: "-", pages: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);

  const GOAL_PAGES = 25000;
  const GOAL_BOOKS = 60;

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const expectedPagesToDate = Math.round((GOAL_PAGES / 365) * dayOfYear);
    const expectedBooksToDate = Math.round((GOAL_BOOKS / 365) * dayOfYear);

    const { data: booksData } = await supabase.from("books").select("*");
    const { data: logsData } = await supabase.from("reading_logs").select("*");

    let totalPages = 0;
    let totalCompletedBooks = 0;

    const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const monthlyData = months.map(m => ({ name: m, pages: 0, books: 0 }));

    let avgPagesPerBook = 0;
    let longestBook = { title: "-", pages: 0 };
    let shortestBook = { title: "-", pages: 0 };
    let bestDay = { date: "-", pages: 0 };
    let worstDay = { date: "-", pages: 0 };

    if (logsData && booksData) {
      const dailyMap = new Map<string, number>();

      logsData.forEach(log => {
        const pages = log.pages_read || 0;
        totalPages += pages;
        
        const logDate = new Date(log.date);
        if (logDate.getFullYear() === today.getFullYear()) {
          monthlyData[logDate.getMonth()].pages += pages;
        }

        const dateStr = logDate.toISOString().split('T')[0];
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + pages);
      });

      if (dailyMap.size > 0) {
        let maxP = -1;
        let minP = Infinity;
        let maxD = "";
        let minD = "";

        dailyMap.forEach((pages, date) => {
          if (pages > maxP) { maxP = pages; maxD = date; }
          if (pages < minP) { minP = pages; minD = date; }
        });

        const formatDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' });
        bestDay = { date: formatDate(maxD), pages: maxP };
        worstDay = { date: formatDate(minD), pages: minP };
      }

      const completedBooks = booksData.filter(b => b.status === "completed");
      totalCompletedBooks = completedBooks.length;

      if (completedBooks.length > 0) {
        const sortedByPages = [...completedBooks].sort((a, b) => b.pages - a.pages);
        longestBook = { title: sortedByPages[0].title, pages: sortedByPages[0].pages };
        shortestBook = { title: sortedByPages[sortedByPages.length - 1].title, pages: sortedByPages[sortedByPages.length - 1].pages };
        
        const sumPages = completedBooks.reduce((acc, b) => acc + b.pages, 0);
        avgPagesPerBook = Math.round(sumPages / completedBooks.length);
      }

      completedBooks.forEach(book => {
        const bookLogs = logsData
          .filter(l => l.book_id === book.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        if (bookLogs.length > 0) {
          const completionDate = new Date(bookLogs[0].date);
          if (completionDate.getFullYear() === today.getFullYear()) {
            monthlyData[completionDate.getMonth()].books += 1;
          }
        }
      });
    }

    setStats({
      totalBooksCompleted: totalCompletedBooks,
      totalPagesRead: totalPages,
      pagesDiff: totalPages - expectedPagesToDate,
      booksDiff: totalCompletedBooks - expectedBooksToDate,
      chartData: monthlyData,
      avgPagesPerBook,
      longestBook,
      shortestBook,
      avgPagesPerDay: Math.round(totalPages / dayOfYear),
      bestDay,
      worstDay
    });
    
    setIsLoading(false);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black border border-gray-800 text-blue-400 text-xs font-bold px-3 py-2 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.2)]">
          <p>{`${label} : ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <main className="min-h-screen bg-[#0A0A0A] p-6 pb-32 font-sans flex flex-col gap-6 text-gray-200 antialiased selection:bg-blue-500/30">
      <header className="pt-6">
        <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">Performances</h1>
        <p className="text-gray-500 mt-1 uppercase tracking-widest text-xs font-bold">Analyse brute de ton exécution</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10 text-blue-500 font-bold animate-pulse tracking-widest text-sm uppercase">Synchronisation...</div>
      ) : (
        <>
          {/* SECTION GRAPHIQUES ET AVANCE/RETARD */}
          <div className="bg-[#111111] p-5 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.05)] border border-gray-800 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-20"></div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total pages lues</h3>
                <span className="text-3xl font-black text-white">{stats.totalPagesRead} <span className="text-sm font-medium text-gray-600">/ 25000</span></span>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${stats.pagesDiff >= 0 ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'}`}>
                {stats.pagesDiff >= 0 ? `+${stats.pagesDiff} pages` : `${stats.pagesDiff} pages`}
              </div>
            </div>
            
            <div className="h-40 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#52525b', fontWeight: 'bold' }} dy={10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#27272a', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="pages" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPages)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#111111] p-5 rounded-2xl shadow-[0_0_20px_rgba(34,197,94,0.05)] border border-gray-800 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-20"></div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Livres terminés</h3>
                <span className="text-3xl font-black text-white">{stats.totalBooksCompleted} <span className="text-sm font-medium text-gray-600">/ 60</span></span>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${stats.booksDiff >= 0 ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'}`}>
                {stats.booksDiff >= 0 ? `+${stats.booksDiff} livres` : `${stats.booksDiff} livres`}
              </div>
            </div>

            <div className="h-40 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBooks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#52525b', fontWeight: 'bold' }} dy={10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#27272a', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="books" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorBooks)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TABLEAUX DE DONNEES */}
          <div className="flex flex-col gap-4 mt-2">
            <div className="bg-[#111111] rounded-2xl shadow-sm border border-gray-800 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#1A1A1A] text-gray-400 text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-4 font-bold border-b border-gray-800">Mois</th>
                    <th className="px-4 py-4 font-bold border-b border-gray-800 text-right">Pages lues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {stats.chartData.map((data, index) => (
                    <tr key={index} className="hover:bg-[#151515] transition-colors">
                      <td className="px-4 py-3 text-gray-300 font-medium">{data.name}</td>
                      <td className="px-4 py-3 text-right font-black text-blue-400">{data.pages}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#0f172a] border-t-2 border-blue-900/30">
                    <td className="px-4 py-4 text-gray-300 font-bold uppercase text-[10px] tracking-widest">Total</td>
                    <td className="px-4 py-4 text-right text-blue-400 font-black">{stats.totalPagesRead}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION STATISTIQUES GRANULAIRES */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-[#111111] p-5 rounded-2xl shadow-sm border border-gray-800 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 blur-2xl rounded-full"></div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Moyenne / Livre</span>
              <span className="text-2xl font-black text-white leading-none">{stats.avgPagesPerBook} <span className="text-xs font-normal text-gray-600">p.</span></span>
            </div>
            <div className="bg-[#111111] p-5 rounded-2xl shadow-sm border border-gray-800 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 blur-2xl rounded-full"></div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Moyenne / Jour</span>
              <span className="text-2xl font-black text-blue-400 leading-none">{stats.avgPagesPerDay} <span className="text-xs font-normal text-gray-600">p.</span></span>
            </div>
          </div>

          <div className="bg-[#111111] rounded-2xl shadow-sm border border-gray-800 divide-y divide-gray-800/50 mt-2">
            <div className="p-5 flex flex-col">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Livre le plus long</span>
              <div className="flex justify-between items-end mt-2 gap-4">
                <span className="text-sm font-medium text-gray-300 truncate">{stats.longestBook.title}</span>
                <span className="text-base font-black text-white whitespace-nowrap">{stats.longestBook.pages} <span className="text-gray-600 text-xs font-normal">p.</span></span>
              </div>
            </div>
            <div className="p-5 flex flex-col">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Livre le plus court</span>
              <div className="flex justify-between items-end mt-2 gap-4">
                <span className="text-sm font-medium text-gray-300 truncate">{stats.shortestBook.title}</span>
                <span className="text-base font-black text-white whitespace-nowrap">{stats.shortestBook.pages} <span className="text-gray-600 text-xs font-normal">p.</span></span>
              </div>
            </div>
          </div>

          <div className="bg-[#111111] rounded-2xl shadow-sm border border-gray-800 divide-y divide-gray-800/50 mt-2">
            <div className="p-5 flex flex-col relative overflow-hidden">
              <div className="absolute inset-0 bg-green-500/5 opacity-0 hover:opacity-100 transition-opacity"></div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Journée record</span>
              <div className="flex justify-between items-end mt-2">
                <span className="text-sm font-medium text-gray-400">{stats.bestDay.date}</span>
                <span className="text-lg font-black text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]">{stats.bestDay.pages} p.</span>
              </div>
            </div>
            <div className="p-5 flex flex-col relative overflow-hidden">
              <div className="absolute inset-0 bg-red-500/5 opacity-0 hover:opacity-100 transition-opacity"></div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pire journée</span>
              <div className="flex justify-between items-end mt-2">
                <span className="text-sm font-medium text-gray-400">{stats.worstDay.date}</span>
                <span className="text-lg font-black text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">{stats.worstDay.pages} p.</span>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}