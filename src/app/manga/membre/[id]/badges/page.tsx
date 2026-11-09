"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../lib/supabase";
import { useAuth } from "../../../../../lib/auth-context";
import { fetchMyMangas, fetchMyMangaLogs, checkMangaBadges, mangaProfileHref, type Manga, type MangaLog } from "../../../../../lib/manga";
import { MANGA_BADGE_DEFS, MANGA_BADGE_GROUPS, evaluateMangaBadges, type MangaBadgeState } from "../../../../../lib/mangaBadges";
import { localISO } from "../../../../../lib/books";
import { TIER_META } from "../../../../../lib/badges";
import { Modal } from "../../../../../components/ui";
import { InkProgress } from "../../../../../components/manga/MangaUI";
import { MangaBadgeMedal } from "../../../../../components/manga/MangaBadgeIcon";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function MangaBadgesPage() {
  const params = useParams();
  const { user } = useAuth();
  const memberId = params.id as string;
  const isOwn = user?.id === memberId;

  const [name, setName] = useState("");
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [logs, setLogs] = useState<MangaLog[]>([]);
  const [unlockedAt, setUnlockedAt] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<MangaBadgeState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Sur sa propre page, on rattrape d'abord l'historique (badges déjà mérités mais pas encore attribués)
      if (isOwn) await checkMangaBadges();
      const [ms, ls, prof, badges] = await Promise.all([
        fetchMyMangas(memberId),
        fetchMyMangaLogs(memberId),
        supabase.from("user_profiles").select("display_name").eq("id", memberId).single(),
        supabase.from("user_badges").select("badge_id, unlocked_at").eq("user_id", memberId).like("badge_id", "manga-%"),
      ]);
      if (cancelled) return;
      setMangas(ms);
      setLogs(ls);
      setName((prof.data as { display_name?: string } | null)?.display_name ?? "");
      setUnlockedAt(new Map(((badges.data ?? []) as { badge_id: string; unlocked_at: string }[]).map((b) => [b.badge_id, b.unlocked_at])));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId, isOwn]);

  const states = useMemo(() => {
    const computed = evaluateMangaBadges({ mangas, logs }, localISO());
    // La table des badges fait foi ; le calcul sert à la progression des badges verrouillés
    return computed.map((st) => (unlockedAt.has(st.def.id) ? { ...st, unlocked: true } : st));
  }, [mangas, logs, unlockedAt]);

  const total = MANGA_BADGE_DEFS.length;
  const won = states.filter((st) => st.unlocked).length;

  return (
    <div className="animate-fadeIn flex min-w-0 flex-col gap-6 pt-4">
      <Link href={mangaProfileHref(memberId)} className="text-[12px] font-semibold text-muted hover:text-ink">← Profil manga</Link>
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-deep">勲章</p>
        <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">{isOwn ? "Mes badges manga" : `Badges manga de ${name || "…"}`}</h1>
      </header>

      {loading ? (
        <p className="py-16 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</p>
      ) : (
        <>
          <section className="manga-panel flex min-w-0 flex-col gap-2.5 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-serif text-lg text-ink">Collection</span>
              <span className="nums font-serif text-2xl text-ink">
                {won}<span className="text-base text-muted"> / {total}</span>
              </span>
            </div>
            <InkProgress value={total ? won / total : 0} />
          </section>

          {MANGA_BADGE_GROUPS.map((g) => {
            const list = states.filter((st) => st.def.group === g.key);
            const done = list.filter((st) => st.unlocked).length;
            return (
              <section key={g.key} className="flex min-w-0 flex-col gap-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-serif text-xl text-ink">{g.label}</h2>
                    <p className="text-[11.5px] text-muted">{g.hint}</p>
                  </div>
                  <span className="nums shrink-0 text-[12px] font-bold text-ink-2">{done} / {list.length}</span>
                </div>
                <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-6">
                  {list.map((st) => (
                    <button
                      key={st.def.id}
                      onClick={() => setOpen(st)}
                      className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
                    >
                      <MangaBadgeMedal icon={st.def.icon} tier={st.def.tier} unlocked={st.unlocked} className="h-16 w-16 transition-transform group-hover:-translate-y-0.5" />
                      <span className={`line-clamp-2 w-full break-words text-[11px] font-bold leading-tight ${st.unlocked ? "text-ink" : "text-muted"}`}>
                        {st.def.name}
                      </span>
                      {!st.unlocked && (
                        <span className="nums text-[10px] font-semibold text-muted">
                          {st.value} / {st.target}{st.unit ? ` ${st.unit}` : ""}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}

      <Modal open={open !== null} onClose={() => setOpen(null)} title={open?.def.name ?? ""}>
        {open && (
          <div className="flex flex-col items-center gap-4 pb-2 text-center">
            <MangaBadgeMedal icon={open.def.icon} tier={open.def.tier} unlocked={open.unlocked} className="h-24 w-24" />
            <span
              className="rounded-full border-2 border-ink px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: TIER_META[open.def.tier].stroke }}
            >
              {TIER_META[open.def.tier].label}
            </span>
            <p className="text-[14px] text-ink-2">{open.def.description}</p>
            {open.unlocked ? (
              <p className="text-[12.5px] font-bold text-success">
                {unlockedAt.get(open.def.id) ? `Débloqué le ${fmtDate(unlockedAt.get(open.def.id)!)}` : "Débloqué"}
              </p>
            ) : (
              <div className="flex w-full flex-col gap-1.5">
                <InkProgress value={open.target ? open.value / open.target : 0} />
                <p className="nums text-[12.5px] font-semibold text-muted">
                  {open.value} / {open.target}{open.unit ? ` ${open.unit}` : ""}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
