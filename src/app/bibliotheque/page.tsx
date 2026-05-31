"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

interface Book {
  id: number;
  title: string;
  author: string;
  total_pages: number;
  cover_url?: string;
  created_at: string;
}

export default function BibliothequePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    // Tri décroissant : les livres créés ou lus récemment apparaissent en premier
    const { data } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setBooks(data);
    }
    setIsLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#F2F2F7] p-6 pb-32 font-sans">
      <header className="pt-6 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-black">Bibliothèque</h1>
        <p className="text-gray-500 mt-1">Toutes tes lectures enregistrées</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10 opacity-50 text-gray-500 font-medium">Chargement...</div>
      ) : books.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
          <p className="text-gray-400 font-medium">Ta bibliothèque est encore vide.</p>
        </div>
      ) : (
        /* Grille de livres style Letterboxd */
        <div className="grid grid-cols-3 gap-4">
          {books.map((book) => (
            <div 
              key={book.id} 
              onClick={() => setSelectedBook(book)}
              className="flex flex-col cursor-pointer active:scale-95 transition-transform"
            >
              <div className="aspect-[2/3] bg-gray-200 rounded-xl overflow-hidden shadow-sm border border-gray-200 relative">
                {book.cover_url ? (
                  <img 
                    src={book.cover_url} 
                    alt={book.title} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback si l'adresse de l'image est morte
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-center p-2 text-xs text-gray-400 font-medium">
                    Pas d'image
                  </div>
                )}
              </div>
              <h2 className="text-xs font-bold text-black mt-2 truncate leading-tight">{book.title}</h2>
              <p className="text-[10px] text-gray-400 truncate">{book.author}</p>
            </div>
          ))}
        </div>
      )}

      {/* Affichage détaillé (Modal) */}
      {selectedBook && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl relative animate-scale-up">
            <button 
              onClick={() => setSelectedBook(null)}
              className="absolute top-4 right-4 bg-gray-100 text-gray-500 hover:text-black w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg"
            >
              &times;
            </button>

            <div className="flex gap-4 mt-4">
              <div className="w-24 aspect-[2/3] bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
                {selectedBook.cover_url && (
                  <img src={selectedBook.cover_url} alt={selectedBook.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex flex-col justify-center">
                <h2 className="text-xl font-bold text-black leading-tight">{selectedBook.title}</h2>
                <p className="text-gray-500 font-medium mt-1">{selectedBook.author}</p>
                <div className="mt-4 inline-flex bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-xs font-bold w-max">
                  {selectedBook.total_pages} pages au total
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}