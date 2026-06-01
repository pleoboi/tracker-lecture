"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalBooksCompleted: 0,
    totalPagesRead: 0,
    totalSessions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    // 1. Récupérer les livres terminés
    const { data: booksData } = await supabase
      .from("books")
      .select("*")
      .eq("status", "completed");

    // 2. Récupérer l'historique complet pour compter les pages et les sessions
    const { data: logsData } = await supabase
      .from("reading_logs")
      .select("pages_read");

    let pages = 0;
    let sessions = 0;

    if (logsData) {
      pages = logsData.reduce((acc, log) => acc + (log.pages_read || 0), 0);
      sessions = logsData.length;
    }

    setStats({
      totalBooksCompleted: booksData ? booksData.length : 0,
      totalPagesRead: pages,
      totalSessions: sessions,
    });
    
    setIsLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#F2F2F7] p-6 pb-32 font-sans">
      <header className="pt-6 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-black">Statistiques</h1>
        <p className="text-gray-500 mt-1">Analyse de ton historique</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10 opacity-50 text-gray-500 font-medium">Calcul des données...</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Livres terminés</h3>
            <span className="text-4xl font-bold text-black">{stats.totalBooksCompleted}</span>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total pages lues</h3>
            <span className="text-4xl font-bold text-blue-600">{stats.totalPagesRead}</span>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Sessions d'enregistrement</h3>
            <span className="text-4xl font-bold text-black">{stats.totalSessions}</span>
          </div>
          
          {stats.totalSessions > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col mt-2 bg-gradient-to-br from-blue-50 to-white">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Rythme moyen</h3>
              <span className="text-2xl font-bold text-blue-900">
                {Math.round(stats.totalPagesRead / stats.totalSessions)} pages / session
              </span>
            </div>
          )}
        </div>
      )}
    </main>
  );
}