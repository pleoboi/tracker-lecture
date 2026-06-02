"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function JournalPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Ton quota quotidien strict
  const DAILY_GOAL = 69;

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const { data: logsData, error: logsError } = await supabase
      .from("reading_logs")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: true }); // Important pour garder la dernière page d'arrêt chronologique

    const { data: booksData } = await supabase
      .from("books")
      .select("id, title, author, cover_url");

    if (logsError) {
      setDbError(logsError.message);
    } else if (logsData && booksData) {
      // Moteur de fusion : on regroupe par jour ET par livre
      const groupedLogsMap = new Map();

      logsData.forEach(log => {
        const dateStr = new Date(log.date).toISOString().split('T')[0];
        const key = `${dateStr}-${log.book_id}`;

        if (!groupedLogsMap.has(key)) {
          groupedLogsMap.set(key, {
            ...log,
            ids: [log.id], // On garde tous les IDs de la journée pour pouvoir tout supprimer d'un coup
            total_pages_today: log.pages_read || 0,
            latest_end_page: log.end_page || 0,
          });
        } else {
          const existing = groupedLogsMap.get(key);
          existing.ids.push(log.id);
          existing.total_pages_today += (log.pages_read || 0);
          // Vu qu'on a trié par created_at, la dernière entrée écrase logiquement la page de fin
          existing.latest_end_page = log.end_page || existing.latest_end_page;
        }
      });

      // Assemblage final avec les livres et vérification de l'objectif
      const mergedLogs = Array.from(groupedLogsMap.values()).map(group => {
        const book = booksData.find(b => b.id === group.book_id);
        const isGoalReached = group.total_pages_today >= DAILY_GOAL;
        
        return {
          ...group,
          books: book || { title: "Livre inconnu", author: "", cover_url: null },
          isGoalReached
        };
      });

      // Tri décroissant pour affichage (du plus récent au plus ancien)
      mergedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setLogs(mergedLogs);
      setDbError(null);
    }
    setIsLoading(false);
  };

  const deleteLogGroup = async (ids: number[]) => {
    // Supprime toutes les entrées fusionnées dans ce bloc
    const { error } = await supabase.from("reading_logs").delete().in("id", ids);
    if (!error) {
      fetchLogs(); // On rafraîchit radicalement
    }
  };

  return (
    <main className="min-h-screen bg-[#F2F2F7] p-6 pb-32 font-sans">
      <header className="pt-6 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-black">Journal</h1>
        <p className="text-gray-500 mt-1">Ton historique d'exécution</p>
      </header>

      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex justify-center py-10 opacity-50 text-gray-500 font-medium">Analyse des données...</div>
        ) : dbError ? (
          <div className="bg-red-50 p-6 rounded-2xl border border-red-200 shadow-sm">
            <p className="text-red-800 font-bold mb-2">Erreur de connexion :</p>
            <p className="text-red-600 font-mono text-xs bg-red-100 p-2 rounded">{dbError}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
            <p className="text-gray-400 font-medium">Ta discipline est à zéro. Aucune lecture.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.ids.join('-')} 
              className={`relative bg-white p-4 rounded-2xl shadow-sm border flex flex-col gap-3 transition-colors ${
                log.isGoalReached ? 'border-green-400 bg-green-50/10' : 'border-gray-200'
              }`}
            >
              {/* Le badge de validation qui nourrit ton besoin de perfection */}
              {log.isGoalReached && (
                <div className="absolute -top-2 left-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-[0_4px_10px_rgba(34,197,94,0.3)] z-10">
                  Objectif Atteint
                </div>
              )}

              <button 
                onClick={() => deleteLogGroup(log.ids)}
                className="absolute top-3 right-4 text-gray-300 hover:text-red-500 text-xl font-bold p-1 z-10"
                title="Supprimer cette session"
              >
                &times;
              </button>
              
              <div className={`flex items-center gap-3 pr-6 ${log.isGoalReached ? 'mt-2' : ''}`}>
                <div className="w-12 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 relative">
                  {log.books?.cover_url ? (
                    <img src={log.books.cover_url} alt={log.books.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-400 font-bold uppercase">Img</div>
                  )}
                </div>
                
                <div className="flex flex-col justify-center min-w-0">
                  <h2 className="text-base font-bold text-black leading-tight truncate">
                    {log.books?.title || "Livre supprimé"}
                  </h2>
                  <p className="text-xs text-gray-500 font-medium mt-0.5 capitalize">
                    {new Date(log.date).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    {log.ids.length > 1 && <span className="ml-2 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold">{log.ids.length} sessions fusionnées</span>}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <div className={`flex-1 px-3 py-2 rounded-xl border flex flex-col items-center ${
                  log.isGoalReached ? 'bg-green-100/50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-100 text-blue-700'
                }`}>
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">Total du jour</span>
                  <span className="font-black text-xl leading-none mt-1">+{log.total_pages_today}</span>
                </div>
                <div className="flex-1 bg-gray-50 text-gray-700 px-3 py-2 rounded-xl border border-gray-100 flex flex-col items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">Arrêté page</span>
                  <span className="font-bold text-xl leading-none mt-1">{log.latest_end_page}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}