"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { shiftDateISO, todayISO } from "../../lib/books";
import { AvatarImg } from "../ui";
import { MangaCover } from "./MangaUI";

type Row = {
  id: number;
  user_id: string;
  title: string;
  cover_url: string | null;
  anilist_id: number | null;
  current_chapter: number;
  current_volume: number;
  total_chapters: number | null;
  latest_chapter: number | null;
  manual_latest_chapter: number | null;
  status: string;
};

export type Person = {
  id: string;
  name: string;
  avatar: string | null;
  chapter: number;
  volume: number;
  /** Chapitres lus par jour sur les 14 derniers jours. */
  pace: number;
  /** Date (YYYY-MM-DD) de la dernière lecture enregistrée sur cette série. */
  last: string | null;
  me: boolean;
};
export type Shared = { key: string; title: string; cover: string | null; myId: number; end: number; people: Person[] };

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const keyOf = (r: Row) => (r.anilist_id ? `a${r.anilist_id}` : `t${norm(r.title)}`);
const SELECT = "id, user_id, title, cover_url, anilist_id, current_chapter, current_volume, total_chapters, latest_chapter, manual_latest_chapter, status";
const STATUSES = ["reading", "paused", "completed"];
const PACE_DAYS = 14;

function lastRead(iso: string | null) {
  if (!iso) return "pas de lecture récente";
  const days = Math.round((new Date(todayISO() + "T12:00:00").getTime() - new Date(iso + "T12:00:00").getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 60) return `il y a ${days} jours`;
  return "il y a plus de 2 mois";
}

const fmtPace = (p: number) => (p === 0 ? "aucun" : `${(Math.round(p * 10) / 10).toString().replace(".", ",")} ch. / jour`);

/** Comparaison calculée entre la personne sélectionnée et toi. */
function comparison(me: Person, other: Person) {
  const d = other.chapter - me.chapter;
  if (d === 0) return `Vous êtes au même chapitre que ${other.name}.`;
  if (d > 0) {
    const gain = me.pace - other.pace;
    const lead = `${other.name} a ${d} chapitre${d > 1 ? "s" : ""} d'avance.`;
    if (gain > 0) {
      const days = Math.ceil(d / gain);
      return `${lead} À vos rythmes actuels, tu le rattrapes dans ${days} jour${days > 1 ? "s" : ""}.`;
    }
    return `${lead} Il lit au moins aussi vite que toi, l'écart ne se réduit pas pour l'instant.`;
  }
  return `Tu as ${-d} chapitre${-d > 1 ? "s" : ""} d'avance sur ${other.name}. Évite de lui raconter la suite.`;
}

export function SharedCard({ s }: { s: Shared }) {
  const me = s.people.find((p) => p.me)!;
  const friends = s.people.filter((p) => !p.me);
  const [sel, setSel] = useState<string>(friends[0]?.id ?? me.id);
  const picked = s.people.find((p) => p.id === sel) ?? me;
  // Position sur la piste : de 0 % à 100 %, quelqu'un à jour est tout à droite
  const pct = (c: number) => Math.min(100, Math.max(0, (c / s.end) * 100));

  // Amis au même endroit (ou presque) : regroupés en une seule pastille avec un « +N ».
  // Un clic fait défiler les membres du groupe, et la liste en dessous permet de choisir directement.
  const MIN_GAP = 11;
  const clusters: { x: number; members: Person[] }[] = [];
  for (const p of [...friends].sort((a, b) => a.chapter - b.chapter)) {
    const x = pct(p.chapter);
    const last = clusters[clusters.length - 1];
    if (last && x - last.x < MIN_GAP) {
      last.members.push(p);
      last.x = last.members.reduce((sum, m) => sum + pct(m.chapter), 0) / last.members.length;
    } else clusters.push({ x, members: [p] });
  }
  const cycle = (members: Person[]) => {
    const i = members.findIndex((m) => m.id === sel);
    setSel(members[(i + 1) % members.length].id);
  };

  return (
    <div className="manga-panel flex min-w-0 flex-col gap-2 p-3">
      <Link href={`/manga/${s.myId}`} className="flex items-center gap-2.5">
        <MangaCover id={s.myId} title={s.title} coverUrl={s.cover} className="h-14 w-10 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-bold text-ink">{s.title}</p>
          <p className="text-[11.5px] text-muted">Avec {friends.length === 1 ? friends[0].name : `${friends.length} membres`} · {s.end} chapitres</p>
        </div>
      </Link>

      {/* Piste : toi au-dessus de la ligne, tes amis en dessous */}
      <div className="relative mx-6 h-[96px]" role="group" aria-label="Progression de chacun sur la série">
        <div className="absolute inset-x-0 top-[47px] border-t-[3px] border-ink" />
        <div className="absolute left-0 top-[45px] h-[7px] rounded-[3px] border-2 border-ink bg-violet" style={{ width: `${pct(me.chapter)}%` }} />
        <div className="absolute right-[-1px] top-[37px] h-[22px] w-[3px] bg-ink" />
        <span aria-hidden className="absolute w-[2px] -translate-x-1/2 bg-ink" style={{ left: `${pct(me.chapter)}%`, top: 36, height: 11 }} />
        <button
          type="button"
          onClick={() => setSel(me.id)}
          aria-pressed={sel === me.id}
          aria-label={`Toi : chapitre ${me.chapter}`}
          className={`absolute -translate-x-1/2 rounded-full transition-transform duration-[140ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-110 active:scale-95 ${sel === me.id ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : ""}`}
          style={{ left: `${pct(me.chapter)}%`, top: 6 }}
        >
          <AvatarImg url={me.avatar} name="Toi" className="h-[30px] w-[30px] border-2 border-ink text-[10px]" />
        </button>
        {clusters.map((c) => {
          const active = c.members.some((m) => m.id === sel);
          const shown = c.members.slice(0, 2);
          return (
            <div key={c.members[0].id}>
              {/* La tige reste à la vraie position ; la pastille se décale près des bords pour ne pas déborder */}
              <span aria-hidden className="absolute w-[2px] -translate-x-1/2 bg-ink" style={{ left: `${c.x}%`, top: 47, height: 7 }} />
              <div className="absolute" style={{ left: `${c.x}%`, top: 54, transform: `translateX(-${c.x > 80 ? 80 : c.x < 20 ? 20 : 50}%)` }}>
              <button
                type="button"
                onClick={() => (c.members.length > 1 && active ? cycle(c.members) : setSel(c.members[0].id))}
                aria-pressed={active}
                aria-label={c.members.map((m) => `${m.name} : chapitre ${m.chapter}`).join(", ")}
                className={`relative flex items-center rounded-full transition-transform duration-[140ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-110 active:scale-95 ${active ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : ""}`}
              >
                <span className="flex -space-x-3">
                  {shown.map((m) => (
                    <AvatarImg key={m.id} url={m.avatar} name={m.name} className="h-[30px] w-[30px] border-2 border-ink text-[10px]" />
                  ))}
                </span>
                {c.members.length > shown.length && (
                  <span className="nums -ml-2 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-ink bg-card px-1 text-[10px] font-bold text-ink">
                    +{c.members.length - shown.length}
                  </span>
                )}
              </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Qui regarder : tout le monde, même ceux qui sont au même endroit */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choisir un lecteur">
        {s.people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSel(p.id)}
            aria-pressed={sel === p.id}
            className={`btn-press flex items-center gap-1.5 rounded-full border-2 border-ink py-0.5 pl-0.5 pr-2.5 text-[11.5px] font-bold ${sel === p.id ? "bg-ink text-paper" : "bg-card text-ink"}`}
          >
            <AvatarImg url={p.avatar} name={p.me ? "Toi" : p.name} className="h-5 w-5 text-[8px]" />
            <span className="nums">{p.me ? "Toi" : p.name.split(" ")[0]} · {p.chapter}</span>
          </button>
        ))}
      </div>

      {/* Détail du lecteur choisi */}
      <dl className="grid grid-cols-2 gap-2">
        {[
          ["Chapitre", `${picked.chapter} / ${s.end}`],
          ["Tome", picked.volume > 0 ? `tome ${picked.volume}` : "—"],
          ["Rythme", fmtPace(picked.pace)],
          ["Dernière lecture", lastRead(picked.last)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border-2 border-ink px-2 py-1.5">
            <dt className="text-[9.5px] font-bold uppercase tracking-wider text-muted">{k}</dt>
            <dd className="nums mt-0.5 text-[12.5px] font-bold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t-2 border-dashed border-line pt-2 text-[12.5px] font-bold text-ink">
        {picked.me ? comparison(me, friends[0]) : comparison(me, picked)}
      </p>
      {!picked.me && (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("swena:open-chat", { detail: { otherId: picked.id, name: picked.name, avatar: picked.avatar } }))}
          className="btn-press self-start rounded-lg border-2 border-ink bg-card px-2.5 py-1 text-[11.5px] font-bold text-ink"
        >
          Écrire à {picked.name.split(" ")[0]}
        </button>
      )}
    </div>
  );
}

/**
 * Lectures communes : on repère tout seul les séries que tu lis en même temps que les membres que tu suis,
 * et on montre où chacun en est sur une piste, avec le détail au toucher.
 */
export default function SharedReads() {
  const { user } = useAuth();
  const [items, setItems] = useState<Shared[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const { data: follows } = await supabase.from("user_follows").select("following_id").eq("follower_id", user.id);
      const ids = ((follows ?? []) as { following_id: string }[]).map((f) => f.following_id);
      if (!ids.length) { if (alive) setItems([]); return; }
      const [{ data: mine }, { data: theirs }, { data: profs }] = await Promise.all([
        supabase.from("mangas").select(SELECT).eq("user_id", user.id).in("status", STATUSES).gt("current_chapter", 0),
        supabase.from("mangas").select(SELECT).in("user_id", ids).in("status", STATUSES).gt("current_chapter", 0).limit(1500),
        supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", ids),
      ]);
      const pm = new Map(((profs ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]));
      const byKey = new Map<string, Row[]>();
      for (const r of (theirs ?? []) as Row[]) byKey.set(keyOf(r), [...(byKey.get(keyOf(r)) ?? []), r]);

      // Séries en commun (hors séries terminées par tout le monde)
      const pairs: { m: Row; others: Row[] }[] = [];
      for (const m of (mine ?? []) as Row[]) {
        const others = byKey.get(keyOf(m));
        if (!others?.length) continue;
        if (m.status === "completed" && others.every((o) => o.status === "completed")) continue;
        pairs.push({ m, others });
      }
      pairs.sort((a, b) => b.others.length - a.others.length || b.m.current_chapter - a.m.current_chapter);
      const top = pairs.slice(0, 6);
      if (!top.length) { if (alive) setItems([]); return; }

      // Rythme et dernière lecture, calculés sur les lectures déjà enregistrées
      const mangaIds = top.flatMap((t) => [t.m.id, ...t.others.map((o) => o.id)]);
      const since = shiftDateISO(todayISO(), -60);
      const { data: logs } = await supabase
        .from("manga_logs")
        .select("manga_id, unit, amount, date")
        .in("manga_id", mangaIds)
        .gte("date", since)
        .limit(3000);
      const paceFrom = shiftDateISO(todayISO(), -(PACE_DAYS - 1));
      const stats = new Map<number, { chapters: number; last: string | null }>();
      for (const l of (logs ?? []) as { manga_id: number; unit: string; amount: number; date: string }[]) {
        const e = stats.get(l.manga_id) ?? { chapters: 0, last: null };
        if (l.unit === "chapter" && l.date >= paceFrom) e.chapters += l.amount;
        if (!e.last || l.date > e.last) e.last = l.date;
        stats.set(l.manga_id, e);
      }
      const person = (r: Row, me: boolean): Person => ({
        id: me ? "me" : r.user_id,
        name: me ? "Toi" : pm.get(r.user_id)?.display_name ?? "Un membre",
        avatar: me ? user.user_metadata?.avatar_url ?? null : pm.get(r.user_id)?.avatar_url ?? null,
        chapter: r.current_chapter,
        volume: r.current_volume,
        pace: (stats.get(r.id)?.chapters ?? 0) / PACE_DAYS,
        last: stats.get(r.id)?.last ?? null,
        me,
      });

      const out: Shared[] = top.map(({ m, others }) => {
        const people = [person(m, true), ...others.map((o) => person(o, false)).sort((a, b) => b.chapter - a.chapter)];
        const known = Math.max(
          m.total_chapters ?? 0, m.latest_chapter ?? 0, m.manual_latest_chapter ?? 0,
          ...others.map((o) => Math.max(o.total_chapters ?? 0, o.latest_chapter ?? 0)),
          ...people.map((p) => p.chapter),
          1,
        );
        return { key: keyOf(m), title: m.title, cover: m.cover_url, myId: m.id, end: known, people };
      });
      if (alive) setItems(out);
    })();
    return () => { alive = false; };
  }, [user]);

  if (items === null || items.length === 0) {
    return (
      <p className="rounded-lg border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted">
        {items === null
          ? "Recherche des séries que tu lis avec tes amis…"
          : "Aucune série en commun pour l'instant. Dès que toi et un membre que tu suis lisez la même série, elle apparaît ici toute seule."}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
      {items.map((s) => (
        <SharedCard key={s.key} s={s} />
      ))}
    </div>
  );
}
