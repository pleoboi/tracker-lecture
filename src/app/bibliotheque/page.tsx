"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

interface Book {
  id: number;
  title: string;
  author: string;
  pages: number;
  cover_url?: string;
  created_at: string;
  progress: number;
  status: string;
}

export default function BibliothequePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
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
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-center p-2 text-xs text-gray-400 font-medium">
                    Pas d'image
                  </div>
                )}
                {book.status === "completed" && (
                  <div className="absolute top-1 right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-white shadow-sm"></div>
                )}
              </div>
              <h2 className="text-xs font-bold text-black mt-2 truncate leading-tight">{book.title}</h2>
              <p className="text-[10px] text-gray-400 truncate">{book.author}</p>
            </div>
          ))}
        </div>
      )}

      {selectedBook && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl relative max-h-[80vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedBook(null)}
              className="absolute top-4 right-4 bg-gray-100 text-gray-500 hover:text-black w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg"
            >
              &times;
            </button>

            <div className="flex gap-4 mt-4">
              <div className="w-24 aspect-[2/3] bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200 relative">
                {selectedBook.cover_url ? (
                  <img src={selectedBook.cover_url} alt={selectedBook.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 p-2 text-center">Sans image</div>
                )}
              </div>
              <div className="flex flex-col justify-center min-w-0 w-full">
                <h2 className="text-xl font-bold text-black leading-tight truncate">{selectedBook.title}</h2>
                <p className="text-gray-500 font-medium mt-1 truncate">{selectedBook.author}</p>
                <div className="mt-3 inline-flex bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-bold w-max">
                  {selectedBook.pages} pages au total
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-black uppercase tracking-wider text-gray-400">Progression</h3>
                <span className="text-xs font-bold text-blue-600">
                  {selectedBook.pages > 0 ? Math.min(Math.round((selectedBook.progress / selectedBook.pages) * 100), 100) : 0}%
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-1">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${selectedBook.pages > 0 ? Math.min(Math.round((selectedBook.progress / selectedBook.pages) * 100), 100) : 0}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 font-medium text-right">{selectedBook.progress} / {selectedBook.pages} pages lues</p>
            </div>

            <div className="mt-5 pt-5 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">Statut</span>
              {selectedBook.status === "completed" ? (
                <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-lg">Terminé</span>
              ) : (
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-lg">En cours</span>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}