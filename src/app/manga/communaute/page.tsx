"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { userUniverses } from "../../../lib/universes";
import { todayISO, shiftDateISO } from "../../../lib/books";
import { getAniListById, enrichMangaSummary, mangaProfileHref, type Manga } from "../../../lib/manga";
import { AvatarImg } from "../../../components/ui";
import { MangaCover } from "../../../components/manga/MangaUI";
import { championScope } from "../../../lib/championScope";
import { parseMessage } from "../../../lib/chat";
import RecommendMangaModal from "../../../components/manga/RecommendMangaModal";
import SharedReads from "../../../components/manga/SharedReads";
import WeeklyChallenge from "../../../components/manga/WeeklyChallenge";

type Release = {
  id: number;
  anilist_id: number | null;
  series_title: string;
  chapter: number;
  chapter_title: string | null;
  url: string;
  cover_url: string | null;
  released_at: string;
};

type Leader = { userId: string; name: string; avatar: string | null; chapters: number; volumes: number };

/** Série lue par plusieurs membres ces 7 derniers jours. */
type Hot = {
  key: string;
  title: string;
  cover: string | null;
  mangaId: number;
  anilistId: number | null;
  readers: { id: string; name: string; avatar: string | null }[];
  chapters: number;
  volumes: number;
};

type Period = "week" | "month";

/** Série recommandée par un membre, reçue en message. */
type Reco = { id: number; mangaId: number; from: { id: string; name: string; avatar: string | null }; title: string; cover: string | null; note: string | null; at: string };

const HELP_KEY = "swena_manga_scans_help";

/** « il y a 3 h », « hier », « il y a 4 j » */
function ago(ts: string) {
  const h = Math.floor((Date.now() - new Date(ts).getTime()) / 3_600_000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hier" : `il y a ${d} j`;
}

const RELEASE_DAYS = 7;

function dayLabel(iso: string) {
  const today = todayISO();
  if (iso === today) return "Aujourd'hui";
  if (iso === shiftDateISO(today, -1)) return "Hier";
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Date locale (YYYY-MM-DD) d'un horodatage, pour regrouper les sorties par jour. */
function localDay(ts: string) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MangaCommunityPage() {
  const { user } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [mine, setMine] = useState<Pick<Manga, "id" | "anilist_id" | "current_chapter">[]>([]);
  const [leaders, setLeaders] = useState<Record<Period, Leader[]>>({ week: [], month: [] });
  const [period, setPeriod] = useState<Period>("month");
  const [hot, setHot] = useState<Hot[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [recos, setRecos] = useState<Reco[]>([]);
  const [recoOpen, setRecoOpen] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const since = new Date(Date.now() - RELEASE_DAYS * 86_400_000).toISOString();
    const monthStart = `${todayISO().slice(0, 7)}-01`;
    const [{ data: rel }, { data: my }, { data: follows }] = await Promise.all([
      supabase.from("manga_releases").select("*").gte("released_at", since).order("released_at", { ascending: false }).limit(200),
      supabase.from("mangas").select("id, anilist_id, current_chapter").eq("user_id", user.id),
      supabase.from("user_follows").select("following_id").eq("follower_id", user.id),
    ]);
    setReleases((rel as Release[]) ?? []);
    setMine((my as Pick<Manga, "id" | "anilist_id" | "current_chapter">[]) ?? []);

    // Classement du club (toi + tes abonnements) et séries du moment (tous les membres visibles)
    const clubIds = [user.id, ...((follows ?? []) as { following_id: string }[]).map((f) => f.following_id)];
    const weekStart = shiftDateISO(todayISO(), -6);
    const [{ data: logs }, { data: profs }, { data: allWeek }, inScope] = await Promise.all([
      supabase.from("manga_logs").select("user_id, unit, amount, date").in("user_id", clubIds).gte("date", monthStart),
      supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", clubIds),
      supabase
        .from("manga_logs")
        .select("user_id, manga_id, unit, amount, mangas(title, cover_url, anilist_id)")
        .gte("date", weekStart)
        .limit(1500),
      championScope(user.id),
    ]);
    const profMap = new Map(((profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]));
    const rank = (from: string): Leader[] => {
      const totals = new Map<string, { chapters: number; volumes: number }>();
      for (const l of (logs ?? []) as { user_id: string; unit: string; amount: number; date: string }[]) {
        if (l.date < from) continue;
        const t = totals.get(l.user_id) ?? { chapters: 0, volumes: 0 };
        if (l.unit === "chapter") t.chapters += l.amount;
        else t.volumes += l.amount;
        totals.set(l.user_id, t);
      }
      return [...totals.entries()]
        .map(([id, t]) => ({
          userId: id,
          name: id === user.id ? "Toi" : profMap.get(id)?.display_name ?? "Membre",
          avatar: profMap.get(id)?.avatar_url ?? null,
          ...t,
        }))
        .sort((x, y) => y.chapters + y.volumes * 10 - (x.chapters + x.volumes * 10))
        .slice(0, 5);
    };
    setLeaders({ week: rank(weekStart), month: rank(monthStart) });

    // Séries que des membres m'ont recommandées (messages portant une série), 30 derniers jours
    const { data: dms } = await supabase
      .from("direct_messages")
      .select("id, sender_id, body, created_at")
      .eq("recipient_id", user.id)
      .like("body", "⟦manga:%")
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(10);
    const parsed = ((dms ?? []) as { id: number; sender_id: string; body: string; created_at: string }[])
      .map((d) => ({ d, p: parseMessage(d.body) }))
      .filter((x) => x.p.mangaId != null);
    if (parsed.length) {
      const [{ data: ms }, { data: senders }] = await Promise.all([
        supabase.from("mangas").select("id, title, cover_url").in("id", [...new Set(parsed.map((x) => x.p.mangaId!))]),
        supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", [...new Set(parsed.map((x) => x.d.sender_id))]),
      ]);
      const mm = new Map(((ms ?? []) as { id: number; title: string; cover_url: string | null }[]).map((m) => [m.id, m]));
      const sm = new Map(((senders ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]));
      setRecos(parsed.filter((x) => mm.has(x.p.mangaId!)).map((x) => {
        const m = mm.get(x.p.mangaId!)!;
        // Le mot personnel : le texte du message sans la phrase automatique
        const extra = x.p.text.split("\n").slice(1).join(" ").trim();
        return {
          id: x.d.id, mangaId: m.id, title: m.title, cover: m.cover_url, note: extra || null, at: x.d.created_at,
          from: { id: x.d.sender_id, name: sm.get(x.d.sender_id)?.display_name ?? "Un membre", avatar: sm.get(x.d.sender_id)?.avatar_url ?? null },
        };
      }));
    } else setRecos([]);

    type WeekRow = { user_id: string; manga_id: number; unit: string; amount: number; mangas: { title: string; cover_url: string | null; anilist_id: number | null } | null };
    const series = new Map<string, Hot & { readerIds: Set<string> }>();
    for (const l of ((allWeek ?? []) as unknown as WeekRow[]).filter((r) => r.mangas && inScope(r.user_id))) {
      const key = l.mangas!.anilist_id ? `a${l.mangas!.anilist_id}` : l.mangas!.title.trim().toLowerCase();
      const e = series.get(key) ?? { key, title: l.mangas!.title, cover: l.mangas!.cover_url, mangaId: l.manga_id, anilistId: l.mangas!.anilist_id, readers: [], readerIds: new Set<string>(), chapters: 0, volumes: 0 };
      e.readerIds.add(l.user_id);
      if (l.unit === "chapter") e.chapters += l.amount;
      else e.volumes += l.amount;
      series.set(key, e);
    }
    const top = [...series.values()]
      .sort((x, y) => y.readerIds.size - x.readerIds.size || y.chapters + y.volumes * 10 - (x.chapters + x.volumes * 10))
      .slice(0, 6);
    const readerIds = [...new Set(top.flatMap((t) => [...t.readerIds]))];
    const { data: rprofs } = readerIds.length ? await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", readerIds) : { data: [] };
    const rmap = new Map(((rprofs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]));
    setHot(top.map((t) => ({
      key: t.key, title: t.title, cover: t.cover, mangaId: t.mangaId, anilistId: t.anilistId, chapters: t.chapters, volumes: t.volumes,
      readers: [...t.readerIds].map((id) => ({ id, name: id === user.id ? "Toi" : rmap.get(id)?.display_name ?? "Membre", avatar: rmap.get(id)?.avatar_url ?? null })),
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    try { setShowHelp(localStorage.getItem(HELP_KEY) !== "1"); } catch { setShowHelp(true); }
  }, []);

  const closeHelp = () => {
    setShowHelp(false);
    try { localStorage.setItem(HELP_KEY, "1"); } catch { /* stockage indisponible */ }
  };

  // Va chercher les dernières sorties MANGA Plus (au plus une fois par heure côté serveur)
  useEffect(() => {
    if (!user) return;
    fetch("/api/manga/releases/sync", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res?.inserted) load(); })
      .catch(() => {});
  }, [user, load]);

  const mineByAnilist = useMemo(() => new Map(mine.filter((m) => m.anilist_id).map((m) => [m.anilist_id!, m])), [mine]);

  const shown = onlyMine ? releases.filter((r) => r.anilist_id && mineByAnilist.has(r.anilist_id)) : releases;
  const groups = useMemo(() => {
    const out: { day: string; items: Release[] }[] = [];
    for (const r of shown) {
      const day = localDay(r.released_at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(r);
      else out.push({ day, items: [r] });
    }
    return out;
  }, [shown]);

  const follow = async (r: Release) => {
    if (!user || !r.anilist_id) return;
    setAdding(r.id);
    const info = await getAniListById(r.anilist_id).catch(() => null);
    const { data: created, error } = await supabase
      .from("mangas")
      .insert({
        user_id: user.id,
        title: info?.title ?? r.series_title,
        title_native: info?.title_native ?? null,
        author: info?.author ?? null,
        cover_url: info?.cover_url ?? r.cover_url,
        anilist_id: r.anilist_id,
        format: info?.format ?? "MANGA",
        publication_status: info?.publication_status ?? "RELEASING",
        total_chapters: info?.total_chapters ?? null,
        total_volumes: info?.total_volumes ?? null,
        genres: info?.genres?.length ? info.genres : null,
        published_year: info?.published_year ?? null,
        ...(info?.demographic ? { demographic: info.demographic } : {}),
        status: "reading",
      })
      .select("id, title, anilist_id, current_chapter")
      .single();
    setAdding(null);
    if (error || !created) {
      setToast("Impossible d'ajouter la série.");
    } else {
      enrichMangaSummary(created).catch(() => {});
      setMine((prev) => [...prev, created]);
      setToast(`« ${created.title} » ajouté à ta mangathèque`);
    }
    setTimeout(() => setToast(null), 3000);
  };

  // Chapitres de MES séries sortis et pas encore lus
  const waiting = releases.filter((r) => {
    const own = r.anilist_id ? mineByAnilist.get(r.anilist_id) : undefined;
    return own && own.current_chapter < Math.floor(Number(r.chapter));
  });
  const waitingSeries = new Set(waiting.map((r) => r.anilist_id)).size;
  const board = leaders[period];

  return (
    <div className="animate-fadeIn flex min-w-0 flex-col gap-7 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-deep">仲間</p>
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">Communauté manga</h1>
          <p className="mt-1 max-w-[46ch] text-[12.5px] text-muted">
            Les sorties officielles en français, ce que le club lit en ce moment et le classement. Le fil des lectures de tes amis est sur l&apos;accueil.
          </p>
        </div>
        {user && userUniverses(user).includes("books") && (
          <Link href="/communaute" className="text-[12px] font-semibold text-muted hover:text-ink">Côté livres →</Link>
        )}
      </header>

      {/* Sorties de chapitres : le cœur de la page */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-xl text-ink">
              Sorties de chapitres
              <span className="manga-tone-band rounded-[3px] border-2 border-ink px-1.5 text-[11px] font-bold text-cream">VF</span>
            </h2>
            <p className="text-[11.5px] text-muted">Chapitres sortis en français sur MANGA Plus, {RELEASE_DAYS} derniers jours</p>
          </div>
          <div className="flex gap-1 rounded-lg border-2 border-ink p-0.5">
            {[
              { v: false, label: "Toutes" },
              { v: true, label: "Mes séries" },
            ].map((o) => (
              <button
                key={o.label}
                onClick={() => setOnlyMine(o.v)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold ${onlyMine === o.v ? "bg-ink text-paper" : "text-ink-2"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode d'emploi, une fois */}
        {showHelp ? (
          <div className="manga-panel flex flex-col gap-2.5 p-3.5">
            <p className="text-[13px] font-bold text-ink">Comment fonctionnent les sorties</p>
            <ul className="flex flex-col gap-1.5 text-[12.5px] leading-snug text-ink-2">
              <li><span className="font-bold text-ink">Officiel et en français.</span> Chaque chapitre est publié par l&apos;éditeur sur MANGA Plus. Swena le détecte tout seul, plusieurs fois par jour.</li>
              <li><span className="font-bold text-ink">Le bouton « Lire » ouvre le chapitre annoncé.</span> Si la page s&apos;ouvre dans une autre langue, change la langue dans ton compte MANGA Plus.</li>
              <li><span className="font-bold text-ink">Les séries que tu lis ressortent.</span> Un cadre violet les marque, avec le nombre de chapitres qu&apos;il te reste à lire.</li>
              <li><span className="font-bold text-ink">« Nouveau » = moins de 24 h.</span> « + Suivre » ajoute la série à ta mangathèque pour ne plus la rater.</li>
            </ul>
            <button onClick={closeHelp} className="btn-press self-start rounded-lg border-2 border-ink bg-card px-3 py-1 text-[12px] font-bold text-ink">Compris</button>
          </div>
        ) : (
          <button onClick={() => setShowHelp(true)} className="self-start text-[11.5px] font-semibold text-muted underline underline-offset-2 hover:text-ink">
            Comment ça marche ?
          </button>
        )}

        {waiting.length > 0 && (
          <div className="manga-panel flex items-center gap-3 bg-violet-soft p-3">
            <span className="nums font-serif text-2xl text-violet-deep">{waiting.length}</span>
            <p className="text-[12.5px] leading-snug text-ink">
              chapitre{waiting.length > 1 ? "s" : ""} t&apos;attend{waiting.length > 1 ? "ent" : ""} sur {waitingSeries} de tes séries.
            </p>
            {!onlyMine && (
              <button onClick={() => setOnlyMine(true)} className="btn-press ml-auto shrink-0 rounded-lg border-2 border-ink bg-card px-2.5 py-1 text-[11.5px] font-bold text-ink">Les voir</button>
            )}
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</p>
        ) : groups.length === 0 ? (
          <p className="rounded-lg border-2 border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            {onlyMine ? "Aucune sortie récente pour les séries de ta mangathèque." : "Pas encore de sortie récupérée."}
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.day} className="flex flex-col gap-2">
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted first-letter:uppercase">{dayLabel(g.day)}</p>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-2">
                {g.items.map((r) => {
                  const own = r.anilist_id ? mineByAnilist.get(r.anilist_id) : undefined;
                  const chapter = Math.floor(Number(r.chapter));
                  const fresh = Date.now() - new Date(r.released_at).getTime() < 86_400_000;
                  const behind = own ? chapter - own.current_chapter : 0;
                  return (
                    <div key={r.id} className={`manga-panel flex min-w-0 items-center gap-2.5 p-2.5 ${own ? "ring-2 ring-violet ring-offset-2 ring-offset-paper" : ""}`}>
                      {own ? (
                        <Link href={`/manga/${own.id}`}>
                          <MangaCover id={r.id} title={r.series_title} coverUrl={r.cover_url} className="h-[72px] w-12" />
                        </Link>
                      ) : (
                        <MangaCover id={r.id} title={r.series_title} coverUrl={r.cover_url} className="h-[72px] w-12" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="line-clamp-2 break-words text-[13.5px] font-bold leading-tight text-ink">{r.series_title}</p>
                        <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-bold text-violet-deep">
                          Chapitre {chapter}
                          {fresh && <span className="rounded bg-violet px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-cream">Nouveau</span>}
                        </p>
                        {r.chapter_title && <p className="line-clamp-2 break-words text-[11.5px] italic leading-snug text-ink-2">« {r.chapter_title} »</p>}
                        <p className="text-[10.5px] text-muted">
                          Sorti {ago(r.released_at)}
                          {own && own.current_chapter > 0 && (behind <= 0 ? " · déjà lu" : ` · ${behind} chapitre${behind > 1 ? "s" : ""} à lire`)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        {/* Le lien mène exactement au chapitre annoncé (même entrée MANGA Plus) */}
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn-press whitespace-nowrap rounded-lg border-2 border-ink bg-violet px-2 py-1.5 text-center text-[11.5px] font-bold text-cream">
                          Lire le ch. {chapter}
                        </a>
                        {!own && r.anilist_id && (
                          <button
                            onClick={() => follow(r)}
                            disabled={adding === r.id}
                            className="btn-press whitespace-nowrap rounded-lg border-2 border-ink bg-card px-2 py-1.5 text-[11.5px] font-bold text-ink disabled:opacity-50"
                          >
                            {adding === r.id ? "Ajout…" : "+ Suivre"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Défi de la semaine : jauge commune de la communauté */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-serif text-xl text-ink">Défi de la semaine</h2>
          <p className="text-[11.5px] text-muted">Tous les chapitres lus par la communauté, du lundi au dimanche</p>
        </div>
        <WeeklyChallenge />
      </section>

      {/* Lectures communes : détectées automatiquement */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-serif text-xl text-ink">Lectures communes</h2>
          <p className="text-[11.5px] text-muted">Les séries que tu lis en même temps que les membres que tu suis, et où en est chacun</p>
        </div>
        <SharedReads />
      </section>

      {/* Recommandations entre membres */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-serif text-xl text-ink">Recommandations</h2>
            <p className="text-[11.5px] text-muted">Les séries que tes amis te conseillent, et celles que tu leur conseilles</p>
          </div>
          <button onClick={() => setRecoOpen(true)} className="btn-press rounded-lg border-2 border-ink bg-violet px-3 py-1.5 text-[12px] font-bold text-cream">
            Recommander une série
          </button>
        </div>
        {recos.length === 0 ? (
          <p className="rounded-lg border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Personne ne t&apos;a encore recommandé de série. Recommande-en une à un ami pour lancer la conversation.
          </p>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-2">
            {recos.map((r) => (
              <div key={r.id} className="manga-panel flex min-w-0 items-center gap-3 p-2.5">
                <Link href={`/manga/${r.mangaId}`} className="shrink-0">
                  <MangaCover id={r.mangaId} title={r.title} coverUrl={r.cover} className="h-[84px] w-14" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <AvatarImg url={r.from.avatar} name={r.from.name} className="h-5 w-5 shrink-0 text-[9px]" />
                    <p className="truncate text-[11.5px] font-semibold text-muted"><span className="text-ink">{r.from.name}</span> te recommande</p>
                  </div>
                  <p className="line-clamp-2 break-words text-[13.5px] font-bold leading-tight text-ink">{r.title}</p>
                  {r.note && <p className="line-clamp-2 break-words text-[11.5px] italic leading-snug text-ink-2">« {r.note} »</p>}
                  <p className="text-[10.5px] text-muted">{ago(r.at)}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Link href={`/manga/${r.mangaId}`} className="btn-press whitespace-nowrap rounded-lg border-2 border-ink bg-violet px-2 py-1.5 text-center text-[11.5px] font-bold text-cream">Voir la série</Link>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("swena:open-chat", { detail: { otherId: r.from.id, name: r.from.name, avatar: r.from.avatar } }))}
                    className="btn-press whitespace-nowrap rounded-lg border-2 border-ink bg-card px-2 py-1.5 text-[11.5px] font-bold text-ink"
                  >
                    Répondre
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <RecommendMangaModal open={recoOpen} onClose={() => setRecoOpen(false)} onSent={(to, title) => { setToast(`« ${title} » envoyé à ${to}`); setTimeout(() => setToast(null), 3000); }} />

      {/* Séries du moment : ce que le club lit */}
      {hot.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-serif text-xl text-ink">Séries du moment</h2>
            <p className="text-[11.5px] text-muted">Les plus lues par les membres ces 7 derniers jours</p>
          </div>
          <div className="manga-panel divide-y divide-line p-0">
            {hot.map((h, i) => {
              const own = h.anilistId ? mineByAnilist.get(h.anilistId) : undefined;
              const shownReaders = h.readers.slice(0, 4);
              return (
                <Link key={h.key} href={`/manga/${own?.id ?? h.mangaId}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-violet-soft">
                  <span className="w-5 shrink-0 text-center font-serif text-lg text-violet-deep">{i + 1}</span>
                  <MangaCover id={h.mangaId} title={h.title} coverUrl={h.cover} className="h-14 w-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-ink">{h.title}</p>
                    <p className="nums text-[11.5px] text-muted">
                      {h.readers.length} lecteur{h.readers.length > 1 ? "s" : ""}
                      {" · "}
                      {[h.chapters ? `${h.chapters} ch.` : null, h.volumes ? `${h.volumes} t.` : null].filter(Boolean).join(" + ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 -space-x-1.5">
                    {shownReaders.map((r) => (
                      <AvatarImg key={r.id} url={r.avatar} name={r.name} className="h-6 w-6 border-2 border-card text-[9px]" />
                    ))}
                    {h.readers.length > shownReaders.length && (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-card bg-violet-soft px-1 text-[9.5px] font-bold text-violet-deep">+{h.readers.length - shownReaders.length}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Classement de ton club */}
      {(leaders.week.length > 0 || leaders.month.length > 0) && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-serif text-xl text-ink">Classement de ton club</h2>
              <p className="text-[11.5px] text-muted">Toi et les membres que tu suis</p>
            </div>
            <div className="flex gap-1 rounded-lg border-2 border-ink p-0.5">
              {([["week", "7 jours"], ["month", "Ce mois-ci"]] as [Period, string][]).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setPeriod(v)}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold ${period === v ? "bg-ink text-paper" : "text-ink-2"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {board.length === 0 ? (
            <p className="rounded-lg border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted">Personne n&apos;a encore lu sur cette période.</p>
          ) : (
            <div className="manga-panel divide-y divide-line p-0">
              {board.map((l, i) => (
                <Link key={l.userId} href={mangaProfileHref(l.userId)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-violet-soft">
                  <span className="w-5 font-serif text-lg text-violet-deep">{i + 1}</span>
                  <AvatarImg url={l.avatar} name={l.name} className="h-7 w-7 text-[11px]" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{l.name}</span>
                  <span className="nums shrink-0 text-[12px] font-semibold text-ink-2">
                    {[l.chapters ? `${l.chapters} ch.` : null, l.volumes ? `${l.volumes} t.` : null].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {toast && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-1/2 z-[70] -translate-x-1/2 rounded-xl border-2 border-ink bg-card px-4 py-2.5 text-sm font-bold text-ink shadow-[4px_4px_0_var(--color-ink)] md:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
