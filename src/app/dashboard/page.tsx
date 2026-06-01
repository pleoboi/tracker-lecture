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
  });
  const [isLoading, setIsLoading] = useState(true);

  // Tes objectifs annuels
  const GOAL_PAGES = 25000;
  const GOAL_BOOKS = 60;

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    
    // Calcul du jour exact de l'année (ex: 1er Juin = 152e jour)
    const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const expectedPagesToDate = Math.round((GOAL_PAGES / 365) * dayOfYear);
    const expectedBooksToDate = Math.round((GOAL_BOOKS / 365) * dayOfYear);

    const { data: booksData } = await supabase.from("books").select("*");
    const { data: logsData } = await supabase.from("reading_logs").select("*");

    let totalPages = 0;
    let totalCompletedBooks = 0;

    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const monthlyData = months.map(m => ({ name: m, pages: 0, books: 0 }));

    if (logsData && booksData) {
      // Calcul des pages
      logsData.forEach(log => {
        totalPages += (log.pages_read || 0);
        const logDate = new Date(log.date);
        if (logDate.getFullYear() === today.getFullYear()) {
          monthlyData[logDate.getMonth()].pages += (log.pages_read || 0);
        }
      });

      // Calcul des livres terminés
      const completedBooks = booksData.filter(b => b.status === "completed");
      totalCompletedBooks = completedBooks.length;

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
          {/* BLOC PAGES */}
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

          {/* BLOC LIVRES */}
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
        </>
      )}
    </main>
  );
}