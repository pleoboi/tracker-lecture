"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function JournalPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

const fetchLogs = async () => {
    // 1. On récupère les sessions pures (sans demander de jointure à Supabase)
    const { data: logsData, error: logsError } = await supabase
      .from("reading_logs")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    // 2. On récupère les livres
    const { data: booksData } = await supabase
      .from("books")
      .select("id, title, author");

    if (logsError) {
      setDbError(logsError.message);
    } else if (logsData && booksData) {
      // 3. L'assemblage de force : on associe les données manuellement
      const mergedLogs = logsData.map(log => {
        const book = booksData.find(b => b.id === log.book_id);
        return {
          ...log,
          books: book || { title: "Livre inconnu", author: "" }
        };
      });
      setLogs(mergedLogs);
      setDbError(null); // On efface toute erreur précédente
    }
    setIsLoading(false);
  };

  const deleteLog = async (id: number) => {
    const { error } = await supabase.from("reading_logs").delete().eq("id", id);
    if (!error) {
      setLogs(logs.filter((log) => log.id !== id));
    }
  };

  return (
    <main className="min-h-screen bg-[#F2F2F7] p-6 pb-32 font-sans">
      <header className="pt-6 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-black">Journal</h1>
        <p className="text-gray-500 mt-1">Ton historique de lecture</p>
      </header>

      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex justify-center py-10 opacity-50 text-gray-500 font-medium">Chargement...</div>
        ) : dbError ? (
          <div className="bg-red-50 p-6 rounded-2xl border border-red-200 shadow-sm">
            <p className="text-red-800 font-bold mb-2">Supabase a rejeté la requête :</p>
            <p className="text-red-600 font-mono text-xs bg-red-100 p-2 rounded">{dbError}</p>
            <p className="text-red-800 text-xs mt-4 font-medium">
              Action : Tu dois aller dans Supabase &gt; SQL Editor et lier les tables `reading_logs` et `books`.
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
            <p className="text-gray-400 font-medium">Aucune session enregistrée.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="relative bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-1">
              <button 
                onClick={() => deleteLog(log.id)}
                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 text-xl font-bold p-1"
              >
                &times;
              </button>
              
              <div className="flex justify-between items-start pr-6">
                <h2 className="text-lg font-bold text-black leading-tight">
                  {log.books?.title || "Livre supprimé"}
                </h2>
              </div>
              <p className="text-sm text-gray-500 font-medium">
                {new Date(log.date).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              
              <div className="flex gap-3 mt-3">
                <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Pages lues</span>
                  <span className="font-bold text-lg">+{log.pages_read}</span>
                </div>
                <div className="bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-100 flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Arrêté page</span>
                  <span className="font-bold text-lg">{log.end_page}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}