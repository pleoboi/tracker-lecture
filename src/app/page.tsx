"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const EXERCISE_POOL = {
  dayA: [
    { id: "pompes_classiques", name: "Pompes Classiques", baseTarget: 14, unit: "reps", desc: "Forme parfaite, poitrine au sol, coudes rentrés." },
    { id: "commandos", name: "Commandos Planche", baseTarget: 10, unit: "reps", desc: "Passage alterné coudes/mains en gardant le bassin fixe." },
    { id: "gainage_planche", name: "Gainage Planche", baseTarget: 63, unit: "sec", desc: "Abdos et fessiers verrouillés, corps rectiligne." },
    { id: "russian_twists", name: "Russian Twists", baseTarget: 20, unit: "reps", desc: "Pieds décollés du sol, rotation complète du buste." }
  ],
  dayB: [
    { id: "squats_explosifs", name: "Squats Explosifs", baseTarget: 28, unit: "reps", desc: "Descente contrôlée, extension et saut vertical maximal." },
    { id: "fentes_alternees", name: "Fentes Alternées", baseTarget: 20, unit: "reps", desc: "Grand pas vers l'arrière, le genou frôle le sol." },
    { id: "burpees", name: "Burpees", baseTarget: 8, unit: "reps", desc: "Mouvement complet : pompe, regroupement, saut explosif." },
    { id: "mountain_climbers", name: "Mountain Climbers", baseTarget: 30, unit: "reps", desc: "Planche stable, genoux projetés rapidement vers l'avant." }
  ]
};

interface Book {
  id: number;
  title: string;
  author: string;
  pages: number;
  progress: number;
  status: string;
  cover_url?: string;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"livres" | "sport">("livres");
  const [isLoading, setIsLoading] = useState(true);

  // --- ÉTATS UNIVER LECTURE ---
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [showAddBook, setShowAddBook] = useState(false);
  const [showLogReading, setShowLogReading] = useState(false);
  
  // Formulaire nouveau livre
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newPages, setNewPages] = useState("");
  const [newCover, setNewCover] = useState("");

  // Formulaire log lecture
  const [selectedBookId, setSelectedBookId] = useState("");
  const [endPageInput, setEndPageInput] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookSuccess, setBookSuccess] = useState<string | null>(null);

  // --- ÉTATS UNIVER SPORT ---
  const [currentWorkout, setCurrentWorkout] = useState<any[]>([]);
  const [sportInputs, setSportInputs] = useState<number[]>([]);
  const [sportChecked, setSportChecked] = useState<boolean[]>([]);
  const [bestEvers, setBestEvers] = useState<Record<string, number>>({});
  const [activeBest, setActiveBest] = useState<{ name: string; score: number; unit: string } | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  const [sportSaved, setSportSaved] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    
    // 1. Chargement de tous les livres actifs
    const { data: booksData } = await supabase
      .from("books")
      .select("*")
      .eq("status", "reading")
      .order("title", { ascending: true });
    
    if (booksData) {
      setAllBooks(booksData);
      if (booksData.length > 0 && !selectedBookId) {
        setSelectedBookId(booksData[0].id.toString());
      }
    }

    // 2. Chargement de l'univers Sport (Logs + Historique complet)
    const { data: workoutLogs } = await supabase
      .from("workout_logs")
      .select("*")
      .order("date", { ascending: false });
    
    if (workoutLogs) {
      setWorkoutHistory(workoutLogs);
      
      const maxMap: Record<string, number> = {};
      workoutLogs.forEach(log => {
        if (Array.isArray(log.exercises)) {
          log.exercises.forEach((exStr: string) => {
            const parts = exStr.split(":");
            if (parts.length === 3) {
              const id = parts[0];
              const score = Number(parts[1]);
              if (!maxMap[id] || score > maxMap[id]) {
                maxMap[id] = score;
              }
            }
          });
        }
      });
      setBestEvers(maxMap);
    }

    setIsLoading(false);
  };

  // --- ACTIONS LECTURE ---
  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newPages) return;

    const { error } = await supabase.from("books").insert({
      title: newTitle,
      author: newAuthor || "Auteur Inconnu",
      pages: Number(newPages),
      progress: 0,
      status: "reading",
      cover_url: newCover || null
    });

    if (!error) {
      setNewTitle("");
      setNewAuthor("");
      setNewPages("");
      setNewCover("");
      setShowAddBook(false);
      loadAllData();
    }
  };

  const handleSaveReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookId || !endPageInput) return;

    const book = allBooks.find(b => b.id.toString() === selectedBookId);
    if (!book) return;

    const targetEndPage = Number(endPageInput);
    
    if (isNaN(targetEndPage) || targetEndPage < 0 || targetEndPage > book.pages) {
      alert(`Erreur : Page d'arrêt invalide (0 à ${book.pages}).`);
      return;
    }

    const pagesReadToday = targetEndPage - book.progress;
    const isCompleted = targetEndPage === book.pages;
    const isCorrection = pagesReadToday < 0;

    if (!isCorrection && pagesReadToday > 100 && !isCompleted) {
      const confirmJump = window.confirm(`Attention : Tu déclares avoir lu ${pagesReadToday} pages en une seule session. Es-tu sûr de ce chiffre ?`);
      if (!confirmJump) return;
    }

    if (!isCorrection && pagesReadToday > 0) {
      const { error: logError } = await supabase.from("reading_logs").insert({
        book_id: book.id,
        date: logDate,
        pages_read: pagesReadToday,
        end_page: targetEndPage
      });
      if (logError) return;
    }

    await supabase
      .from("books")
      .update({ progress: targetEndPage, status: isCompleted ? "completed" : "reading" })
      .eq("id", book.id);

    setBookSuccess(isCorrection ? `Correction : retour à la page ${targetEndPage}` : `Session enregistrée : +${pagesReadToday} pages !`);
    setEndPageInput("");
    setLogDate(new Date().toISOString().split('T')[0]);
    setShowLogReading(false);
    setTimeout(() => setBookSuccess(null), 3000);
    loadAllData();
  };

  const handleEditProgress = async (book: Book) => {
    const newProgressStr = window.prompt(`Modifier la page pour "${book.title}" (actuellement ${book.progress} / ${book.pages}) :`, book.progress.toString());
    if (newProgressStr === null) return; 

    const newProgress = Number(newProgressStr);
    if (isNaN(newProgress) || newProgress < 0 || newProgress > book.pages) {
      alert("Erreur : Numéro de page invalide.");
      return;
    }

    await supabase
      .from("books")
      .update({ progress: newProgress, status: newProgress === book.pages ? "completed" : "reading" })
      .eq("id", book.id);

    loadAllData();
  };

  // --- ACTIONS SPORT ---
  const generateWorkout = () => {
    const isDayA = workoutHistory.length % 2 === 0;
    const pool = isDayA ? EXERCISE_POOL.dayA : EXERCISE_POOL.dayB;
    
    const adapted = pool.map(ex => {
      const trainingSessions = workoutHistory.length / 2; 
      const multiplier = 1 + Math.log1p(trainingSessions) * 0.15;
      let target = Math.round(ex.baseTarget * multiplier);
      
      if (ex.unit === "reps" && target > 45) target = 45;
      if (ex.id === "squats_explosifs" && target > 60) target = 60;
      if (ex.unit === "sec" && target > 150) target = 150;

      return { ...ex, target };
    });

    setCurrentWorkout(adapted);
    setSportInputs(adapted.map(e => e.target));
    setSportChecked(adapted.map(() => false));
    setSportSaved(false);
    setActiveBest(null);
  };

  const showBestEver = (exId: string, exName: string, unit: string) => {
    const score = bestEvers[exId] || 0;
    setActiveBest({ name: exName, score, unit });
  };

  const handleSportInputChange = (index: number, val: number) => {
    const cleanVal = val < 0 ? 0 : val;
    const next = [...sportInputs];
    next[index] = cleanVal;
    setSportInputs(next);
  };

  const handleSportCheck = (index: number) => {
    const next = [...sportChecked];
    next[index] = !next[index];
    setSportChecked(next);
  };

  const allSportDone = sportChecked.length > 0 && sportChecked.every(c => c === true);

  const submitWorkout = async () => {
    if (!allSportDone || sportSaved) return;

    const formattedExercises = currentWorkout.map((ex, idx) => `${ex.id}:${sportInputs[idx]}:${ex.unit}`);

    const { error } = await supabase.from("workout_logs").insert({
      exercises: formattedExercises,
      duration_minutes: 30,
      performance_rating: 3
    });

    if (!error) {
      setSportSaved(true);
      loadAllData();
    }
  };

  const currentSelectedBook = allBooks.find(b => b.id.toString() === selectedBookId);

  return (
    <main className="min-h-screen bg-[#0A0A0A] p-6 pb-32 font-sans text-gray-200 antialiased">
      
      {/* COMMUTATEUR DOUBLE FLUX */}
      <div className="flex bg-[#111111] p-1.5 rounded-2xl border border-gray-800 w-full mb-6">
        <button 
          onClick={() => setActiveTab("livres")}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
            activeTab === "livres" ? 'bg-blue-600 text-white' : 'text-gray-500'
          }`}
        >
          Livres en cours
        </button>
        <button 
          onClick={() => setActiveTab("sport")}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
            activeTab === "sport" ? 'bg-orange-600 text-white' : 'text-gray-500'
          }`}
        >
          Entraînement
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-xs font-bold text-gray-600 uppercase tracking-widest animate-pulse">Chargement...</div>
      ) : activeTab === "livres" ? (
        /* ==================== UNIVER LECTURE ==================== */
        <div className="flex flex-col gap-6">
          <header className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-white">Lectures actives</h1>
              <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mt-0.5">Suivi de progression</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { setShowAddBook(!showAddBook); setShowLogReading(false); }}
                className="bg-gray-900 border border-gray-800 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-2 rounded-xl"
              >
                + Nouveau Livre
              </button>
              {allBooks.length > 0 && (
                <button 
                  onClick={() => { setShowLogReading(!showLogReading); setShowAddBook(false); }}
                  className="bg-blue-600 text-white font-black text-[10px] uppercase tracking-wider px-3 py-2 rounded-xl"
                >
                  Noter ma lecture
                </button>
              )}
            </div>
          </header>

          {bookSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-xl text-xs font-bold">{bookSuccess}</div>
          )}

          {/* FORMULAIRE NOUVEAU LIVRE POP-DOWN */}
          {showAddBook && (
            <form onSubmit={handleCreateBook} className="bg-[#111111] p-4 rounded-2xl border border-gray-800 flex flex-col gap-3 animate-fadeIn">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Ajouter un ouvrage</h3>
              <input type="text" placeholder="Titre du livre (Obligatoire)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-[#161616] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white" required />
              <input type="text" placeholder="Auteur" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} className="w-full bg-[#161616] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white" />
              <input type="number" min="1" placeholder="Nombre total de pages" value={newPages} onChange={(e) => setNewPages(e.target.value)} className="w-full bg-[#161616] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white" required />
              <input type="text" placeholder="URL de la couverture (Optionnel)" value={newCover} onChange={(e) => setNewCover(e.target.value)} className="w-full bg-[#161616] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white" />
              <button type="submit" className="w-full bg-white text-black font-black text-[10px] uppercase tracking-widest py-2 rounded-xl">Créer la fiche</button>
            </form>
          )}

          {/* FORMULAIRE REGISTRE DE LECTURE POP-DOWN */}
          {showLogReading && (
            <form onSubmit={handleSaveReading} className="bg-[#111111] p-4 rounded-2xl border border-blue-900/40 flex flex-col gap-3 animate-fadeIn">
              <h3 className="text-xs font-black text-blue-400 uppercase tracking-wider">Enregistrer une session</h3>
              <select 
                value={selectedBookId} 
                onChange={(e) => { setSelectedBookId(e.target.value); setEndPageInput(""); }} 
                className="w-full bg-[#161616] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-bold"
              >
                {allBooks.map(b => <option key={b.id} value={b.id.toString()}>{b.title}</option>)}
              </select>
              
              <div className="flex gap-2">
                <input 
                  type="date" 
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-2/5 bg-[#161616] border border-gray-800 rounded-xl px-2 py-2 text-center text-xs text-white" 
                  required
                />
                <input 
                  type="number" 
                  min="0" 
                  max={currentSelectedBook?.pages || 9999} 
                  placeholder="Page d'arrêt" 
                  value={endPageInput} 
                  onChange={(e) => setEndPageInput(e.target.value)} 
                  className="w-3/5 bg-[#161616] border border-gray-800 rounded-xl px-3 py-2 text-center font-black text-sm text-white" 
                  required 
                />
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest py-2 rounded-xl">Valider les pages</button>
            </form>
          )}

          {/* LISTE DES LIVRES AVEC LEUR BARRE DE PROGRESSION */}
          <div className="flex flex-col gap-4">
            {allBooks.length === 0 ? (
              <p className="text-center py-6 text-xs text-gray-500 font-medium">Zéro lecture active. Utilise le bouton ci-dessus.</p>
            ) : (
              allBooks.map(book => {
                const pct = book.pages > 0 ? Math.min(Math.round((book.progress / book.pages) * 100), 100) : 0;
                return (
                  <div key={book.id} className="bg-[#111111] p-4 rounded-2xl border border-gray-800 flex gap-4 items-center">
                    <div className="w-10 h-14 bg-gray-900 rounded-md border border-gray-800 overflow-hidden flex-shrink-0">
                      {book.cover_url && <img src={book.cover_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white truncate leading-tight">{book.title}</h3>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{book.author}</p>
                      
                      <div className="mt-3">
                        <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium mb-1">
                          <span>{book.progress} / {book.pages} p.</span>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleEditProgress(book)} 
                              className="text-gray-500 hover:text-white underline decoration-gray-600 underline-offset-2"
                            >
                              Modifier
                            </button>
                            <span className="text-blue-400 font-bold">{pct}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-black h-1.5 rounded-full overflow-hidden border border-gray-900">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* ==================== UNIVER SPORT ==================== */
        <div className="flex flex-col gap-6">
          <header className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-white">Coach Préparation</h1>
              <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mt-0.5">Condition & Force</p>
            </div>
            <button 
              onClick={generateWorkout}
              className="bg-orange-600 hover:bg-orange-700 text-white font-black text-[10px] uppercase tracking-wider px-3 py-2 rounded-xl transition-all"
            >
              {currentWorkout.length > 0 ? "Re-générer" : "Générer Séance"}
            </button>
          </header>

          {/* SÉANCE EN COURS ACTUELLE */}
          {currentWorkout.length > 0 ? (
            <div className="bg-[#111111] p-5 rounded-2xl border border-gray-800 flex flex-col gap-4 relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-30"></div>
              
              {activeBest && (
                <div className="bg-orange-500/10 border border-orange-500/20 p-2 rounded-xl flex justify-between text-[11px]">
                  <span className="text-gray-400">Record personnel sur <span className="text-white font-bold">{activeBest.name}</span> :</span>
                  <span className="font-black text-orange-400">{activeBest.score > 0 ? `${activeBest.score} ${activeBest.unit}` : "Aucun"}</span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {currentWorkout.map((ex, idx) => (
                  <div key={ex.id} className={`p-3 rounded-xl border flex items-center justify-between gap-4 ${sportChecked[idx] ? 'bg-green-500/5 border-green-500/20 opacity-40' : 'bg-[#161616] border-gray-800'}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1" onClick={() => showBestEver(ex.id, ex.name, ex.unit)}>
                      <input type="checkbox" checked={sportChecked[idx]} onChange={() => handleSportCheck(idx)} className="w-4 h-4 rounded border-gray-700 text-orange-500 bg-black accent-orange-500 cursor-pointer" />
                      <div className="min-w-0 cursor-pointer">
                        <p className="text-xs font-bold text-white truncate">{ex.name}</p>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{ex.desc} <span className="text-orange-500 font-bold">(Record)</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="0"
                        value={sportInputs[idx]} 
                        disabled={sportChecked[idx]} 
                        onChange={(e) => handleSportInputChange(idx, Number(e.target.value))} 
                        className="w-14 bg-black border border-gray-800 rounded-lg py-0.5 text-center font-black text-xs text-white" 
                      />
                      <span className="text-[10px] text-gray-500 w-7 font-bold">{ex.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={submitWorkout} disabled={!allSportDone || sportSaved} className={`w-full font-black text-xs uppercase tracking-widest py-3 rounded-xl border ${sportSaved ? 'bg-green-500/10 border-green-500/20 text-green-400' : allSportDone ? 'bg-white text-black' : 'bg-[#161616] border-gray-800 text-gray-600 cursor-not-allowed'}`}>
                {sportSaved ? "✓ Séance Enregistrée" : allSportDone ? "Enregistrer mes performances" : "Coche toutes les cases pour valider"}
              </button>
            </div>
          ) : (
            <div className="bg-[#111111] p-6 rounded-2xl border border-dashed border-gray-800 text-center text-xs text-gray-500 font-medium">
              Clique sur le bouton pour générer ton protocole adaptatif sans matériel.
            </div>
          )}

          {/* COMPOSANT : MES SÉANCES PRÉCÉDENTES */}
          <div className="flex flex-col gap-3 mt-2">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Mes séances précédentes</h3>
            {workoutHistory.length === 0 ? (
              <p className="text-xs text-gray-600 italic py-2">Aucun entraînement dans l'historique de la base.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {workoutHistory.map((log) => (
                  <div key={log.id} className="bg-[#111111] p-3 rounded-xl border border-gray-800/60 flex justify-between items-center text-xs">
                    <div className="flex flex-col">
                      <span className="font-bold text-white">Circuit Corps Libre</span>
                      <span className="text-[10px] text-gray-500 font-medium mt-0.5">
                        {new Date(log.date).toLocaleDateString("fr-FR", { day: '2-digit', month: 'short', year: 'numeric' })} • 30 min
                      </span>
                    </div>
                    <span className="text-[10px] bg-gray-900 border border-gray-800 text-gray-400 font-bold px-2 py-0.5 rounded-md">
                      Validé
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}