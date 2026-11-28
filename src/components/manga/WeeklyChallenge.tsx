"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { championScope } from "../../lib/championScope";
import { shiftDateISO, todayISO } from "../../lib/books";
import { AvatarImg } from "../ui";

const MIN_GOAL = 20;
const MAX_PER_DAY = 60;
const WEEKS_BACK = 8;
const PAGE = 1000;

type Contributor = { id: string; name: string; avatar: string | null; chapters: number };
type State = {
  total: number;
  goal: number;
  daysLeft: number;
  projected: number | null;
  last: { reads: number; goal: number; success: boolean } | null;
  contributors: Contributor[];
};

/** Lundi de la semaine d'une date (YYYY-MM-DD). */
function mondayOf(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return shiftDateISO(iso, -((d.getDay() + 6) % 7));
}

/**
 * Objectif de la semaine : repose sur les chapitres lus par la communauté la semaine d'avant.
 * Semaine d'avant réussie (objectif atteint) : on monte de 10 %. Ratée : on baisse de 10 %.
 * On rejoue les semaines passées pour savoir si chacune était réussie.
 */
export function weeklyGoal(readsByWeek: number[]): { goal: number; last: { reads: number; goal: number; success: boolean } | null } {
  // readsByWeek[0] = semaine en cours, [1] = la précédente, etc.
  const oldest = readsByWeek.length - 1;
  let goal = Math.max(MIN_GOAL, readsByWeek[oldest] ?? 0);
  let last: { reads: number; goal: number; success: boolean } | null = null;
  for (let w = oldest - 1; w >= 0; w--) {
    const reads = readsByWeek[w + 1];
    const success = reads >= goal;
    last = { reads, goal, success };
    goal = Math.max(MIN_GOAL, Math.round(reads * (success ? 1.1 : 0.9)));
  }
  return { goal, last };
}

/** Défi de la communauté : une jauge de chapitres pour la semaine, objectif réajusté chaque semaine. */
export default function WeeklyChallenge() {
  const { user } = useAuth();
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const today = todayISO();
      const monday = mondayOf(today);
      const since = shiftDateISO(monday, -7 * WEEKS_BACK);
      const inScope = await championScope(user.id);

      // Toutes les lectures en chapitres des membres visibles, par pages de 1000
      const rows: { user_id: string; amount: number; date: string }[] = [];
      for (let from = 0; from < PAGE * 8; from += PAGE) {
        const { data } = await supabase
          .from("manga_logs")
          .select("user_id, amount, date")
          .eq("unit", "chapter")
          .gte("date", since)
          .order("date", { ascending: false })
          .range(from, from + PAGE - 1);
        const page = (data ?? []) as { user_id: string; amount: number; date: string }[];
        rows.push(...page);
        if (page.length < PAGE) break;
      }
      const visible = rows.filter((r) => inScope(r.user_id));

      const byWeek = new Array(WEEKS_BACK + 1).fill(0) as number[];
      const mine = new Map<string, number>();
      // Un membre compte au plus MAX_PER_DAY chapitres par jour : un rattrapage d'historique saisi d'un coup
      // (des centaines de chapitres) ne doit pas fausser la jauge ni les objectifs suivants.
      const perDay = new Map<string, { user: string; date: string; n: number }>();
      for (const r of visible) {
        const k = `${r.user_id}|${r.date}`;
        const e = perDay.get(k) ?? { user: r.user_id, date: r.date, n: 0 };
        e.n += r.amount;
        perDay.set(k, e);
      }
      for (const e of perDay.values()) {
        const idx = Math.round((new Date(monday + "T12:00:00").getTime() - new Date(mondayOf(e.date) + "T12:00:00").getTime()) / (7 * 86_400_000));
        if (idx < 0 || idx > WEEKS_BACK) continue;
        const n = Math.min(e.n, MAX_PER_DAY);
        byWeek[idx] += n;
        if (idx === 0) mine.set(e.user, (mine.get(e.user) ?? 0) + n);
      }

      const { goal, last } = weeklyGoal(byWeek);
      const dayIndex = (new Date(today + "T12:00:00").getDay() + 6) % 7; // 0 = lundi
      const top = [...mine.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      const { data: profs } = top.length ? await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", top.map(([id]) => id)) : { data: [] };
      const pm = new Map(((profs ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]));

      if (!alive) return;
      setState({
        total: byWeek[0],
        goal,
        daysLeft: 6 - dayIndex,
        projected: dayIndex >= 1 ? Math.round((byWeek[0] / (dayIndex + 1)) * 7) : null,
        last: last && byWeek.length > 1 ? last : null,
        contributors: top.map(([id, chapters]) => ({ id, chapters, name: id === user.id ? "Toi" : pm.get(id)?.display_name ?? "Un membre", avatar: pm.get(id)?.avatar_url ?? null })),
      });
    })();
    return () => { alive = false; };
  }, [user]);

  if (!state) return <p className="py-6 text-center text-xs text-muted">Chargement…</p>;

  const pct = Math.min(100, (state.total / state.goal) * 100);
  const done = state.total >= state.goal;
  const topChapters = Math.max(1, ...state.contributors.map((c) => c.chapters));

  return (
    <div className="manga-panel flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="nums font-serif text-4xl leading-none text-ink">
          {state.total}
          <span className="font-sans text-[15px] font-semibold text-muted"> / {state.goal} chapitres</span>
        </p>
        <span className={`rounded-md border-2 border-ink px-2 py-0.5 text-[11px] font-bold ${done ? "bg-violet text-cream" : "bg-card text-ink"}`}>
          {done ? "Objectif atteint" : state.daysLeft === 0 ? "Dernier jour" : `${state.daysLeft} jour${state.daysLeft > 1 ? "s" : ""} restant${state.daysLeft > 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="h-[26px] overflow-hidden rounded border-2 border-ink bg-card" role="progressbar" aria-valuenow={state.total} aria-valuemax={state.goal}>
        <div
          className="h-full bg-violet transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ width: `${pct}%`, backgroundImage: "radial-gradient(rgba(0,0,0,.35) 1.1px, transparent 1.5px)", backgroundSize: "6px 6px" }}
        />
      </div>

      <p className="text-[12px] leading-snug text-muted">
        {done
          ? "La communauté a atteint l'objectif de la semaine. Chaque chapitre en plus prépare un objectif plus haut."
          : state.projected != null
            ? `Au rythme actuel, la communauté finira la semaine vers ${state.projected} chapitres.`
            : "La semaine commence : chaque chapitre que tu enregistres compte pour tout le monde."}
      </p>

      {state.last && (
        <p className="rounded-md bg-violet-soft px-3 py-2 text-[12px] leading-snug text-ink">
          <b>Semaine dernière :</b> {state.last.reads} chapitres pour un objectif de {state.last.goal}.{" "}
          {state.last.success
            ? "C'est réussi, donc l'objectif de cette semaine est relevé de 10 %."
            : "Il n'a pas été atteint, donc l'objectif de cette semaine est baissé de 10 %."}
        </p>
      )}

      {state.contributors.length > 0 && (
        <div className="flex flex-col gap-2 border-t-2 border-dashed border-line pt-3">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted">Ceux qui font avancer la jauge</p>
          {state.contributors.map((c) => (
            <div key={c.id} className="flex items-center gap-2.5">
              <AvatarImg url={c.avatar} name={c.name} className="h-6 w-6 shrink-0 text-[9px]" />
              <span className="w-[72px] shrink-0 truncate text-[12px] font-bold text-ink">{c.name}</span>
              <div className="h-[10px] flex-1 overflow-hidden rounded-[3px] border-2 border-ink bg-card">
                <div className="h-full bg-violet" style={{ width: `${(c.chapters / topChapters) * 100}%` }} />
              </div>
              <span className="nums w-7 shrink-0 text-right text-[11.5px] font-semibold text-ink-2">{c.chapters}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
