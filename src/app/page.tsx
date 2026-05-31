"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [books, setBooks] = useState<any[]>([]);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  
  // Formulaire : Nouveau Livre
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("");

  // Formulaire : Session
  const [selectedBookId, setSelectedBookId] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [endPage, setEndPage] = useState("");

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (data) {
      setBooks(data);
      const inProgress = data.filter(b => b.status === "in_progress");
      if (inProgress.length > 0 && !selectedBookId) {
        setSelectedBookId(inProgress[0].id.toString());
      }
    }
  };

  const addBook = async () => {
    if (!title || !author) {
      alert("Erreur : Le titre et l'auteur sont obligatoires !");
      return;
    }
    
    const { data, error } = await supabase
      .from("books")
      .insert([{ title, author, pages: parseInt(pages) || 0, status: "in_progress", progress: 0 }])
      .select();

    if (error) {
      alert("Erreur base de données : " + error.message);
      return;
    }

    if (data) {
      setBooks([data[0], ...books]);
      setIsBookModalOpen(false);
      setTitle(""); setAuthor(""); setPages("");
    }
  };

  const deleteBook = async (id: number) => {
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (!error) {
      setBooks(books.filter((book) => book.id !== id));
    }
  };

  const saveReadingSession = async () => {
    if (!selectedBookId) {
      alert("Erreur : Tu dois sélectionner un livre !");
      return;
    }
    if (!endPage) {
      alert("Erreur : Tu dois indiquer la page où tu t'es arrêté !");
      return;
    }

    const bookIdNum = parseInt(selectedBookId);
    const targetBook = books.find(b => b.id === bookIdNum);
    
    if (!targetBook) {
      alert("Erreur : Le livre sélectionné n'existe pas.");
      return;
    }

    const currentProgress = targetBook.progress;
    const newEndPage = parseInt(endPage);

    if (newEndPage <= currentProgress) {
      alert(`Erreur mathématique : Ta page de fin (${newEndPage}) doit être supérieure à ta progression actuelle (${currentProgress}).`);
      return;
    }
    if (newEndPage > targetBook.pages && targetBook.pages > 0) {
      alert(`Erreur : Tu indiques la page ${newEndPage}, mais le livre ne fait que ${targetBook.pages} pages !`);
      return;
    }

    const pagesReadToday = newEndPage - currentProgress;

    const { error: logError } = await supabase
      .from("reading_logs")
      .insert([
        {
          book_id: bookIdNum,
          date: logDate,
          end_page: newEndPage,
          pages_read: pagesReadToday
        }
      ]);

    if (logError) {
      alert("Erreur lors de la création du log : " + logError.message);
      return;
    }

    const isFinished = newEndPage === targetBook.pages;
    const { error: bookError } = await supabase
      .from("books")
      .update({ 
        progress: newEndPage,
        status: isFinished ? "completed" : "in_progress"
      })
      .eq("id", bookIdNum);

    if (bookError) {
      alert("Erreur lors de la mise à jour du livre : " + bookError.message);
      return;
    }

    await fetchBooks();
    setIsLogModalOpen(false);
    setEndPage("");
  };

  const inProgressBooks = books.filter(b => b.status === "in_progress");

  return (
    <main className="min-h-screen bg-[#F2F2F7] pb-32 flex flex-col text-gray-900 antialiased font-sans">
      
      <header className="pt-12 pb-6 px-6 bg-white border-b border-gray-200 flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-black">Lectures</h1>
        <button 
          onClick={() => setIsBookModalOpen(true)}
          className="bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold px-4 py-2 rounded-full text-sm transition-colors"
        >
          + Nouveau livre
        </button>
      </header>

      <div className="flex-1 p-6 flex flex-col gap-4">
        {books.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <p className="text-gray-400 font-medium text-lg">Aucun livre enregistré</p>
          </div>
        ) : (
          books.map((book) => {
            const percentage = book.pages > 0 ? Math.min(Math.round((book.progress / book.pages) * 100), 100) : 0;
            return (
              <div key={book.id} className="relative bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-2">
                <button 
                  onClick={() => deleteBook(book.id)}
                  className="absolute top-4 right-4 text-gray-300 hover:text-red-500 text-xl font-bold p-1"
                >
                  &times;
                </button>

                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-black leading-tight pr-8">{book.title}</h2>
                  {book.status === "completed" && (
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">Terminé</span>
                  )}
                </div>
                <p className="text-gray-500 text-sm">{book.author}</p>
                
                <div className="mt-2 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-400 font-medium">{book.progress} / {book.pages} pages</p>
                  <p className="text-xs text-blue-600 font-bold">{percentage}%</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {inProgressBooks.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 p-6 bg-gradient-to-t from-[#F2F2F7] via-[#F2F2F7] to-transparent">
          <button
            onClick={() => {
              if (inProgressBooks.length > 0 && !selectedBookId) {
                setSelectedBookId(inProgressBooks[0].id.toString());
              }
              setIsLogModalOpen(true);
            }}
            className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            📝 Noter ma lecture du jour
          </button>
        </div>
      )}

      {/* MODAL : Ajouter un livre */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h2 className="text-xl font-bold text-black">Nouveau livre</h2>
              <button onClick={() => setIsBookModalOpen(false)} className="text-gray-400 text-2xl">&times;</button>
            </div>
            <div className="flex flex-col gap-3">
              <input type="text" placeholder="Titre du livre" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-black outline-none focus:border-blue-500" />
              <input type="text" placeholder="Auteur" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-black outline-none focus:border-blue-500" />
              <input type="number" placeholder="Nombre de pages total" value={pages} onChange={(e) => setPages(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-black outline-none focus:border-blue-500" />
              <button onClick={addBook} className="w-full bg-black text-white font-bold py-3 rounded-xl mt-2 hover:bg-gray-800">Créer le livre</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL : Log de lecture */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h2 className="text-xl font-bold text-black">J'ai lu !</h2>
              <button onClick={() => setIsLogModalOpen(false)} className="text-gray-400 text-2xl">&times;</button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Livre</label>
                <select 
                  value={selectedBookId} 
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-black font-medium outline-none focus:border-blue-500"
                >
                  {inProgressBooks.map(b => (
                    <option key={b.id} value={b.id}>{b.title} (actuellement p. {b.progress})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Date de la lecture</label>
                <input 
                  type="date" 
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-black font-medium outline-none focus:border-blue-500" 
                />
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Nouvelle page de fin</label>
                <input 
                  type="number" 
                  placeholder="Ex: la page où tu t'es arrêté"
                  value={endPage}
                  onChange={(e) => setEndPage(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-black font-medium outline-none border-blue-500 focus:ring-2 focus:ring-blue-200" 
                />
              </div>

              <button 
                onClick={saveReadingSession}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-blue-700 transition-colors"
              >
                Enregistrer ma session
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}