"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

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

export default function SportPage() {
  const [currentWorkout, setCurrentWorkout] = useState<any[]>([]);
  const [inputs, setInputs] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [bestEvers, setBestEvers] = useState<Record<string, number>>({});
  const [activeBest, setActiveBest] = useState<{name: string, score: number, unit: string} | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSportData();
  }, []);

  const loadSportData = async () => {
    const { data: logs } = await supabase.from("workout_logs").select("*");
    
    if (logs) {
      setHistoryCount(logs.length);
      
      const maxMap: Record<string, number> = {};
      logs.forEach(log => {
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

  const generateWorkout = () => {
    const isDayA = historyCount % 2 === 0;
    const pool = isDayA ? EXERCISE_POOL.dayA : EXERCISE_POOL.dayB;
    
    const adapted = pool.map(ex => {
      const trainingSessions = historyCount / 2; 
      const multiplier = 1 + Math.log1p(trainingSessions) * 0.15;
      let target = Math.round(ex.baseTarget * multiplier);
      
      if (ex.unit === "reps" && target > 45) target = 45;
      if (ex.id === "squats_explosifs" && target > 60) target = 60;
      if (ex.unit === "sec" && target > 150) target = 150;

      return { ...ex, target };
    });

    setCurrentWorkout(adapted);
    setInputs(adapted.map(e => e.target));
    setChecked(adapted.map(() => false));
    setIsSaved(false);
    setActiveBest(null);
  };

  const showBestEver = (exId: string, exName: string, unit: string) => {
    const score = bestEvers[exId] || 0;
    setActiveBest({ name: exName, score, unit });
  };

  const handleInputChange = (index: number, val: number) => {
    const next = [...inputs];
    next[index] = val;
    setInputs(next);
  };

  const handleCheck = (index: number) => {
    const next = [...checked];
    next[index] = !next[index];
    setChecked(next);
  };

  const allDone = checked.length > 0 && checked.every(c => c === true);

  const submitWorkout = async () => {
    if (!allDone || isSaved) return;

    const formattedExercises = currentWorkout.map((ex, idx) => `${ex.id}:${inputs[idx]}:${ex.unit}`);

    const { error } = await supabase.from("workout_logs").insert({
      exercises: formattedExercises,
      duration_minutes: 30,
      performance_rating: 4
    });

    if (!error) {
      setIsSaved(true);
      loadSportData();
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0A0A] p-6 pb-32 font-sans text-gray-200 antialiased">
      <header className="pt-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Coach Préparation</h1>
          <p className="text-orange-500 mt-1 uppercase tracking-widest text-xs font-bold">Zéro Équipement • Physique Sec</p>
        </div>
        <button 
          onClick={generateWorkout}
          className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(234,88,12,0.2)]"
        >
          {currentWorkout.length > 0 ? "Changer" : "Générer Séance"}
        </button>
      </header>

      {currentWorkout.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {activeBest && (
            <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-xl flex justify-between items-center text-xs animate-fadeIn">
              <span className="font-medium text-gray-400">Record personnel sur <span className="text-white font-bold">{activeBest.name}</span> :</span>
              <span className="font-black text-orange-400 uppercase tracking-wider">{activeBest.score > 0 ? `${activeBest.score} ${activeBest.unit}` : "Aucun historique"}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {currentWorkout.map((ex, idx) => (
              <div 
                key={ex.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  checked[idx] ? 'bg-green-500/5 border-green-500/20 opacity-60' : 'bg-[#111111] border-gray-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1" onClick={() => showBestEver(ex.id, ex.name, ex.unit)}>
                  <input 
                    type="checkbox" 
                    checked={checked[idx]} 
                    onChange={() => handleCheck(idx)}
                    className="w-5 h-5 rounded border-gray-700 text-orange-500 bg-black focus:ring-0 accent-orange-500 cursor-pointer"
                  />
                  <div className="min-w-0 cursor-pointer">
                    <p className="text-sm font-bold text-white truncate">{ex.name}</p>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{ex.desc} <span className="text-orange-500/80 font-bold">(Voir Record)</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    value={inputs[idx]}
                    disabled={checked[idx]}
                    onChange={(e) => handleInputChange(idx, Number(e.target.value))}
                    className="w-16 bg-[#161616] border border-gray-800 rounded-lg px-2 py-1 text-center font-black text-sm text-white focus:border-orange-500 focus:ring-0 disabled:opacity-40"
                  />
                  <span className="text-xs text-gray-500 w-8 font-bold">{ex.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={submitWorkout}
            disabled={!allDone || isSaved}
            className={`w-full font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all border ${
              isSaved 
                ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                : allDone 
                  ? 'bg-white text-black hover:bg-gray-200' 
                  : 'bg-[#111111] border-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            {isSaved ? "✓ Séance Enregistrée" : allDone ? "Enregistrer ma performance" : "Coche tous les exercices réalisés"}
          </button>
        </div>
      )}
    </main>
  );
}