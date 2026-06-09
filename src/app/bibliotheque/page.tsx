"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

interface Book {
  id: number;
  created_at: string;
  title: string;
  author: string;
  pages: number;
  progress: number;
  status: string;
  cover_url?: string;
  rating?: number;
}

export default function BibliothequePage() {
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"ajout" | "title" | "author" | "rating">("ajout");
  
  // Modale de notation géante
  const [selectedRatingBook, setSelectedRatingBook] = useState<Book | null>(null);
  const [liveRating, setLiveRating] = useState<number>(0);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setIsLoading(true);
    const { data } = await supabase.from("books").select("*");
    if (data) setAllBooks(data);
    setIsLoading(false);
  };

  const openRatingModal = (book: Book) => {
    setSelectedRatingBook(book);
    setLiveRating(book.rating || 0);
  };

  const saveRating = async () => {
    if (!selectedRatingBook) return;
    await supabase.from("books").update({ rating: liveRating }).eq("id", selectedRatingBook.id);
    setSelectedRatingBook(null);
    loadBooks();
  };

  const sortedBooks = [...allBooks].sort((a, b) => {
    if (sortBy === "title") return a.title.localeCompare(b.title);
    if (sortBy === "author") return a.author.localeCompare(b.author);
    if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <main className="min-h-screen bg-[#0A0A0A] p-6 pb-32 font-sans text-gray-200 antialiased">
      <header className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Bibliothèque</h1>
          <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mt-0.5">Registre complet</p>
        </div>
        <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
          <span className="text-xs font-bold text-gray-400">{sortedBooks.length} ouvrages</span>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)} 
            className="bg-[#111111] border border-gray-800 text-gray-400 text-[10px] font-bold uppercase tracking-wider rounded-lg px-2 py-1 outline-none cursor-pointer"
          >
            <option value="ajout">Tri : Ajout récent</option>
            <option value="title">Tri : Titre</option>
            <option value="author">Tri : Auteur</option>
            <option value="rating">Tri : Note (Décroissant)</option>
          </select>
        </div>
      </header>

      {isLoading ? (
        <div className="text-center py-20 text-xs font-bold text-gray-600 uppercase tracking-widest animate-pulse">Chargement...</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 animate-fadeIn">
          {sortedBooks.length === 0 ? (
            <p className="col-span-2 text-center py-6 text-xs text-gray-500 font-medium">Ta bibliothèque est vide.</p>
          ) : (
            sortedBooks.map(book => {
              const pct = book.pages > 0 ? Math.min(Math.round((book.progress / book.pages) * 100), 100) : 0;
              const currentRating = book.rating || 0;
              const isCompleted = book.status === 'completed' || pct === 100;
              
              return (
                <div 
                  key={book.id} 
                  onClick={() => openRatingModal(book)}
                  className="bg-[#111111] rounded-2xl border border-gray-800 overflow-hidden flex flex-col cursor-pointer hover:border-gray-700 transition-all group"
                >
                  <div className="aspect-[3/4] w-full bg-gray-900 border-b border-gray-800 flex items-center justify-center overflow-hidden relative">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <span className="text-[10px] uppercase font-black text-gray-600 tracking-widest px-2 text-center">{book.title}</span>
                    )}
                    {isCompleted && (
                      <div className="absolute top-0 left-0 bg-green-500 w-3 h-3 rounded-br-md"></div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md border border-gray-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <span className="text-[9px] font-black text-yellow-500">★ {currentRating > 0 ? currentRating.toFixed(1) : "-"}</span>
                    </div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-white truncate leading-tight">{book.title}</h3>
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{book.author}</p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold mb-1">
                        <span>{isCompleted ? 'Terminé' : `${book.progress}/${book.pages} p.`}</span>
                        <span className={isCompleted ? "text-green-500 font-black" : "text-blue-500 font-black"}>{pct}%</span>
                      </div>
                      <div className="w-full bg-black h-1 rounded-full overflow-hidden border border-gray-900">
                        <div className={isCompleted ? "bg-green-500 h-full rounded-full" : "bg-blue-500 h-full rounded-full"} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODALE DE NOTATION AVEC STEPPERS POUR MOBILE */}
      {selectedRatingBook && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fadeIn" onClick={() => setSelectedRatingBook(null)}>
          <div className="bg-[#111111] border border-gray-800 rounded-3xl p-6 w-full max-w-sm flex flex-col items-center gap-5 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedRatingBook(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white font-bold text-sm px-2">✕</button>
            <div className="text-center"><h2 className="text-sm font-black text-white px-4 line-clamp-2">{selectedRatingBook.title}</h2><p className="text-[11px] text-gray-500 mt-0.5">{selectedRatingBook.author}</p></div>
            
            <div className="flex flex-col items-center gap-2 my-2 w-full">
              {/* Étoiles de base */}
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => setLiveRating(star)} className="text-4xl transition-transform active:scale-95 focus:outline-none">
                    <span className={star <= Math.floor(liveRating) ? "text-yellow-500" : "text-gray-800"}>★</span>
                  </button>
                ))}
              </div>
              
              {/* Ajustement précis avec boutons -0.1 et +0.1 */}
              <div className="flex items-center justify-center gap-3 mt-3 w-full">
                <button 
                  type="button"
                  onClick={() => setLiveRating(prev => Math.max(0, Math.round((prev - 0.1) * 10) / 10))}
                  className="w-10 h-10 bg-gray-900 border border-gray-800 rounded-xl text-xs font-black text-white active:scale-95 transition-transform"
                >
                  -0.1
                </button>
                
                <div className="flex items-center gap-1 bg-[#161616] border border-gray-800 rounded-xl px-4 py-2">
                  <span className="text-sm font-black text-yellow-500 min-w-[24px] text-center">
                    {liveRating.toFixed(1)}
                  </span>
                  <span className="text-xs font-bold text-gray-600">/ 5</span>
                </div>

                <button 
                  type="button"
                  onClick={() => setLiveRating(prev => Math.min(5, Math.round((prev + 0.1) * 10) / 10))}
                  className="w-10 h-10 bg-gray-900 border border-gray-800 rounded-xl text-xs font-black text-white active:scale-95 transition-transform"
                >
                  +0.1
                </button>
              </div>
            </div>
            
            <button onClick={saveRating} className="w-full bg-yellow-500 text-black font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-transform active:scale-[0.98]">Enregistrer la note</button>
          </div>
        </div>
      )}
    </main>
  );
}