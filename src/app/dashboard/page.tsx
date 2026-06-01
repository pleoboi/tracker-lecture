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

  // Objectifs annuels
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
      // 1. Calculs globaux et mensuels des pages
      const dailyMap = new Map<string, number>();

      logsData.forEach(log => {
        const pages = log.pages_read || 0;
        totalPages += pages;
        
        const logDate = new Date(log.date);
        if (logDate.getFullYear() === today.getFullYear()) {
          monthlyData[logDate.getMonth()].pages += pages;
        }

        // Agrégation par jour pour trouver le meilleur/pire jour
        const dateStr = logDate.toISOString().split('T')[0];
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + pages);
      });

      // 2. Recherche du meilleur et pire jour
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

      // 3. Calculs sur les livres terminés
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
        <div className="bg-gray-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-lg">
          <p>{`${label} : ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <main className="min-h-screen bg-[#F2F2F7] p-6 pb-32 font-sans flex flex-col gap-6">
      <header className="pt-6">
        <h1 className="text-3xl font-bold tracking-tight text-black">Performances</h1>
        <p className="text-gray-500 mt-1">Analyse brute de ton exécution</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10 opacity-50 text-gray-500 font-medium">Analyse en cours...</div>
      ) : (
        <>
          {/* SECTION GRAPHIQUES ET AVANCE/RETARD */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total pages lues</h3>
                <span className="text-3xl font-bold text-black">{stats.totalPagesRead} <span className="text-sm font-medium text-gray-400">/ 25000</span></span>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${stats.pagesDiff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {stats.pagesDiff >= 0 ? `+${stats.pagesDiff} pages d'avance` : `${stats.pagesDiff} pages de retard`}
              </div>
            </div>
            
            <div className="h-40 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 2, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="pages" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPages)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Livres terminés</h3>
                <span className="text-3xl font-bold text-black">{stats.totalBooksCompleted} <span className="text-sm font-medium text-gray-400">/ 60</span></span>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${stats.booksDiff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {stats.booksDiff >= 0 ? `+${stats.booksDiff} d'avance` : `${stats.booksDiff} de retard`}
              </div>
            </div>

            <div className="h-40 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBooks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 2, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="books" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorBooks)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TABLEAUX DE DONNEES (Façon Excel) */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-blue-100 text-blue-900">
                  <tr>
                    <th className="px-4 py-3 font-bold border-b border-blue-200">Mois</th>
                    <th className="px-4 py-3 font-bold border-b border-blue-200 text-right">Pages lues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.chartData.map((data, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{data.name}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">{data.pages}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 font-bold">
                    <td className="px-4 py-3 text-blue-900">Total</td>
                    <td className="px-4 py-3 text-right text-blue-900">{stats.totalPagesRead}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-blue-100 text-blue-900">
                  <tr>
                    <th className="px-4 py-3 font-bold border-b border-blue-200">Mois</th>
                    <th className="px-4 py-3 font-bold border-b border-blue-200 text-right">Livres terminés</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.chartData.map((data, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{data.name}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">{data.books}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 font-bold">
                    <td className="px-4 py-3 text-blue-900">Total</td>
                    <td className="px-4 py-3 text-right text-blue-900">{stats.totalBooksCompleted}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION STATISTIQUES GRANULAIRES */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Moyenne / Livre</span>
              <span className="text-xl font-bold text-black leading-none">{stats.avgPagesPerBook} <span className="text-xs font-normal text-gray-500">pages</span></span>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Moyenne / Jour</span>
              <span className="text-xl font-bold text-blue-600 leading-none">{stats.avgPagesPerDay} <span className="text-xs font-normal text-gray-500">pages</span></span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100 mt-2">
            <div className="p-4 flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Journée la plus productive</span>
              <div className="flex justify-between items-end mt-1">
                <span className="text-sm font-medium text-gray-800">{stats.bestDay.date}</span>
                <span className="text-lg font-bold text-green-600">{stats.bestDay.pages} pages</span>
              </div>
            </div>
            <div className="p-4 flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Journée la moins productive</span>
              <div className="flex justify-between items-end mt-1">
                <span className="text-sm font-medium text-gray-800">{stats.worstDay.date}</span>
                <span className="text-lg font-bold text-red-500">{stats.worstDay.pages} pages</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100 mt-2">
            <div className="p-4 flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Livre le plus long</span>
              <div className="flex justify-between items-end mt-1 gap-2">
                <span className="text-sm font-medium text-gray-800 truncate">{stats.longestBook.title}</span>
                <span className="text-base font-bold text-black whitespace-nowrap">{stats.longestBook.pages} p.</span>
              </div>
            </div>
            <div className="p-4 flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Livre le plus court</span>
              <div className="flex justify-between items-end mt-1 gap-2">
                <span className="text-sm font-medium text-gray-800 truncate">{stats.shortestBook.title}</span>
                <span className="text-base font-bold text-black whitespace-nowrap">{stats.shortestBook.pages} p.</span>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}