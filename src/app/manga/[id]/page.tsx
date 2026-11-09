"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { todayISO } from "../../../lib/books";
import {
  formatLabel,
  publicationLabel,
  demographicLabel,
  recomputeMangaProgress,
  enrichMangaSummary,
  checkMangaBadges,
  releaseState,
  readTarget,
  unitLabel,
  type Manga,
  type MangaLog,
  type MangaStatus,
} from "../../../lib/manga";
import { MangaCover, InkProgress, StatusPicker, StarPicker, DemographicPicker, RatingTag } from "../../../components/manga/MangaUI";
import LogMangaModal from "../../../components/manga/LogMangaModal";
import { inputClass } from "../../../components/ui";

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function MangaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const id = Number(params.id);
  const [manga, setManga] = useState<Manga | null>(null);
  const [logs, setLogs] = useState<MangaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [notes, setNotes] = useState("");
  const [editingTotals, setEditingTotals] = useState(false);
  const [totals, setTotals] = useState({ chapters: "", volumes: "" });
  const [readUrl, setReadUrl] = useState("");
  const [readUrlVolume, setReadUrlVolume] = useState("");
  const [readUrlMsg, setReadUrlMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [{ data: m }, { data: ls }] = await Promise.all([
      supabase.from("mangas").select("*").eq("id", id).single(),
      supabase
        .from("manga_logs")
        .select("*")
        .eq("manga_id", id)
        .order("date", { ascending: false })
        .order("id", { ascending: false }),
    ]);
    const mm = (m as Manga) ?? null;
    setManga(mm);
    setNotes(mm?.notes ?? "");
    setReadUrl(mm?.read_url ?? "");
    setReadUrlVolume(mm?.read_url_volume ?? "");
    setTotals({ chapters: mm?.total_chapters ? String(mm.total_chapters) : "", volumes: mm?.total_volumes ? String(mm.total_volumes) : "" });
    setLogs((ls as MangaLog[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwn = !!user && manga?.user_id === user.id;

  // Descriptif : récupéré automatiquement une fois si la série n'en a pas
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);
  const autoEnriched = useRef(false);

  const fetchSummary = useCallback(async (target: Manga) => {
    setEnriching(true);
    setEnrichMsg(null);
    const res = await enrichMangaSummary(target);
    setEnriching(false);
    if (res) setManga((m) => (m ? { ...m, ...res } : m));
    else setEnrichMsg("Aucun descriptif trouvé sur Wikipédia ni AniList. Tu peux l'écrire toi-même.");
  }, []);

  useEffect(() => {
    if (!manga || !isOwn || manga.summary || autoEnriched.current) return;
    autoEnriched.current = true;
    fetchSummary(manga);
  }, [manga, isOwn, fetchSummary]);

  const readUrlsChanged = readUrl.trim() !== (manga?.read_url ?? "") || readUrlVolume.trim() !== (manga?.read_url_volume ?? "");

  const saveReadUrl = async () => {
    const ch = readUrl.trim();
    const vol = readUrlVolume.trim();
    if ([ch, vol].some((v) => v && !/^https?:\/\//i.test(v))) {
      setReadUrlMsg({ ok: false, text: "Les liens doivent commencer par http:// ou https://" });
      return;
    }
    await patch({ read_url: ch || null, read_url_volume: vol || null });
    setReadUrlMsg({ ok: true, text: ch || vol ? "Liens enregistrés ✓" : "Liens retirés, retour au lien officiel" });
  };

  const saveSummary = async () => {
    const text = summaryDraft.trim();
    await patch({ summary: text || null, summary_source: text ? "Perso" : null, summary_url: null });
    setEditingSummary(false);
  };

  const patch = async (p: Partial<Manga>) => {
    if (!manga) return;
    setManga({ ...manga, ...p });
    await supabase.from("mangas").update(p).eq("id", manga.id);
  };

  const changeStatus = (s: MangaStatus) => {
    const p: Partial<Manga> = { status: s };
    if (s === "completed" && !manga?.date_finished) p.date_finished = todayISO();
    if (s === "reading" && !manga?.date_started) p.date_started = todayISO();
    if (s !== "completed") p.date_finished = null;
    patch(p).then(() => { if (s === "completed") checkMangaBadges(); });
  };

  const deleteLog = async (logId: number) => {
    if (!manga || !confirm("Supprimer cette session ?")) return;
    await supabase.from("manga_logs").delete().eq("id", logId);
    const cur = await recomputeMangaProgress(manga.id);
    setManga({ ...manga, ...cur });
    setLogs((prev) => prev.filter((l) => l.id !== logId));
  };

  const deleteManga = async () => {
    if (!manga || !confirm(`Supprimer « ${manga.title} » et toutes ses sessions ? C'est définitif.`)) return;
    await supabase.from("mangas").delete().eq("id", manga.id);
    router.push("/manga");
  };

  const saveTotals = async () => {
    const toInt = (s: string) => (parseInt(s, 10) > 0 ? parseInt(s, 10) : null);
    await patch({ total_chapters: toInt(totals.chapters), total_volumes: toInt(totals.volumes) });
    setEditingTotals(false);
  };

  if (loading) {
    return <p className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</p>;
  }
  if (!manga) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="font-serif text-2xl text-ink">Série introuvable</p>
        <Link href="/manga" className="text-sm font-semibold text-violet-deep">← Retour à la mangathèque</Link>
      </div>
    );
  }

  const isOngoingSeries = manga.publication_status === "RELEASING";
  const chapterTotal = logs.filter((l) => l.unit === "chapter").reduce((s, l) => s + l.amount, 0);
  const volumeTotal = logs.filter((l) => l.unit === "volume").reduce((s, l) => s + l.amount, 0);
  const meta = [
    manga.demographic && manga.demographic !== "autre" ? demographicLabel(manga.demographic) : null,
    formatLabel(manga.format),
    manga.published_year,
    publicationLabel(manga.publication_status),
  ].filter(Boolean);

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pt-4">
      <Link href="/manga" className="text-[12px] font-semibold text-muted hover:text-ink">← Mangathèque</Link>

      {/* Fiche */}
      <section className="manga-panel manga-speedlines flex flex-col gap-5 p-5 md:flex-row">
        <MangaCover id={manga.id} title={manga.title} coverUrl={manga.cover_url} className="mx-auto h-60 w-40 md:mx-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            {manga.title_native && <p className="text-[12px] font-semibold text-muted">{manga.title_native}</p>}
            <h1 className="font-serif text-3xl leading-tight text-ink">{manga.title}</h1>
            {manga.author && <p className="mt-1 text-[14px] font-medium text-ink-2">{manga.author}</p>}
            {meta.length > 0 && <p className="mt-1 text-[12px] text-muted">{meta.join(" · ")}</p>}
          </div>
          {manga.genres && manga.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {manga.genres.map((g) => (
                <span key={g} className="rounded-[3px] border-2 border-ink bg-card px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-ink">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Avancement sur les deux unités */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Chapitre", current: manga.current_chapter, total: isOngoingSeries ? releaseState(manga)?.latest ?? null : manga.total_chapters },
              { label: "Tome", current: manga.current_volume, total: manga.total_volumes },
            ].map((u) => (
              <div key={u.label} className="flex flex-col gap-1.5 rounded-lg border-2 border-ink bg-card p-3">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{u.label}</span>
                <span className="nums font-serif text-2xl text-ink">
                  {u.current}
                  <span className="text-sm text-muted"> / {u.total ?? "?"}</span>
                </span>
                {u.total ? <InkProgress value={u.current / u.total} /> : null}
              </div>
            ))}
          </div>

          {(() => {
            const rs = releaseState(manga);
            if (!rs) return null;
            return (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-2 border-ink bg-card px-3 py-2 text-[12.5px]">
                <span className="font-bold text-ink">
                  Dernier chapitre sorti : {rs.latest}
                  {manga.latest_chapter_at && (
                    <span className="font-medium text-muted"> · {new Date(manga.latest_chapter_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span>
                  )}
                </span>
                <span className={`font-bold ${rs.upToDate ? "text-success" : "text-violet-deep"}`}>
                  {rs.upToDate ? "Tu es à jour" : `${rs.behind} ch. de retard`}
                </span>
                {readTarget(manga) && (
                  <a href={readTarget(manga)!.url} target="_blank" rel="noopener noreferrer" className="ml-auto font-bold text-violet-deep underline-offset-2 hover:underline">
                    {readTarget(manga)!.label} →
                  </a>
                )}
              </div>
            );
          })()}

          {isOwn && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowLog(true)}
                className="btn-press rounded-xl border-2 border-ink bg-violet px-4 py-2.5 text-[13px] font-bold text-cream shadow-[3px_3px_0_var(--color-ink)]"
              >
                Noter une session
              </button>
              {!editingTotals ? (
                <button onClick={() => setEditingTotals(true)} className="text-[12px] font-semibold text-muted hover:text-ink">
                  Modifier les totaux
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    value={totals.chapters}
                    onChange={(e) => setTotals({ ...totals, chapters: e.target.value.replace(/\D/g, "") })}
                    placeholder="Ch."
                    className="w-20 rounded-lg border-2 border-line bg-input px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
                  />
                  <input
                    inputMode="numeric"
                    value={totals.volumes}
                    onChange={(e) => setTotals({ ...totals, volumes: e.target.value.replace(/\D/g, "") })}
                    placeholder="Tomes"
                    className="w-20 rounded-lg border-2 border-line bg-input px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
                  />
                  <button onClick={saveTotals} className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-paper">OK</button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* De quoi ça parle */}
      {(manga.summary || isOwn) && (
        <section className="manga-panel flex flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-serif text-lg text-ink">De quoi ça parle</h2>
            {isOwn && !editingSummary && (
              <div className="flex gap-3 text-[11.5px] font-semibold">
                <button onClick={() => fetchSummary(manga)} disabled={enriching} className="text-muted hover:text-ink disabled:opacity-50">
                  {enriching ? "Recherche…" : manga.summary ? "Rechercher à nouveau" : "Chercher sur Wikipédia"}
                </button>
                <button
                  onClick={() => { setSummaryDraft(manga.summary ?? ""); setEditingSummary(true); }}
                  className="text-muted hover:text-ink"
                >
                  Modifier
                </button>
              </div>
            )}
          </div>

          {editingSummary ? (
            <>
              <textarea value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} rows={7} className={`${inputClass} resize-y`} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingSummary(false)} className="rounded-lg border-2 border-line px-3 py-1.5 text-[12px] font-bold text-ink-2">Annuler</button>
                <button onClick={saveSummary} className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-paper">Enregistrer</button>
              </div>
            </>
          ) : manga.summary ? (
            <>
              <div className={`whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2 ${!summaryExpanded && manga.summary.length > 320 ? "max-h-[110px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]" : ""}`}>
                {manga.summary}
              </div>
              <div className="flex items-center justify-between gap-2">
                {manga.summary.length > 320 ? (
                  <button onClick={() => setSummaryExpanded((v) => !v)} className="text-[12px] font-bold text-violet-deep">
                    {summaryExpanded ? "Réduire" : "Lire la suite"}
                  </button>
                ) : <span />}
                {manga.summary_source && (
                  <span className="text-[11px] text-muted">
                    Source :{" "}
                    {manga.summary_url ? (
                      <a href={manga.summary_url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{manga.summary_source}</a>
                    ) : manga.summary_source}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted">{enriching ? "Recherche du descriptif…" : enrichMsg ?? "Pas encore de descriptif."}</p>
          )}
        </section>
      )}

      {isOwn && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="manga-panel flex flex-col gap-3 p-4">
            <h2 className="font-serif text-lg text-ink">Statut</h2>
            <StatusPicker value={manga.status} onChange={changeStatus} />
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Parution</span>
              {[
                { v: "RELEASING", label: "En cours" },
                { v: "FINISHED", label: "Terminée" },
              ].map((o) => {
                const active = (manga.publication_status === "RELEASING") === (o.v === "RELEASING");
                return (
                  <button
                    key={o.v}
                    onClick={() => !active && patch({ publication_status: o.v })}
                    className={`rounded-full border-2 px-3 py-1 text-[12px] font-bold ${active ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink"}`}
                  >
                    {o.label}
                  </button>
                );
              })}
              <span className="w-full text-[11px] text-muted">« En cours » active le suivi des nouveaux chapitres.</span>
            </div>
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Catégorie</span>
              <DemographicPicker value={manga.demographic} onChange={(d) => patch({ demographic: d })} />
            </div>
            <div className="border-t border-line pt-3">
              <StarPicker value={Number(manga.rating ?? 0)} onChange={(v) => patch({ rating: v > 0 ? v : null })} />
            </div>
          </div>
          <div className="manga-panel flex flex-col gap-3 p-4">
            <h2 className="font-serif text-lg text-ink">Mon avis</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (manga.notes ?? "") && patch({ notes: notes.trim() || null })}
              rows={5}
              placeholder="Ce que tu en penses, tes arcs préférés…"
              className={`${inputClass} flex-1 resize-none`}
            />
            <p className="text-[11px] text-muted">Enregistré automatiquement.</p>
            <div className="border-t border-line pt-3">
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted">Mes liens de lecture</p>
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-ink-2">Chapitres</span>
                  <input
                    value={readUrl}
                    onChange={(e) => { setReadUrl(e.target.value); setReadUrlMsg(null); }}
                    onKeyDown={(e) => e.key === "Enter" && saveReadUrl()}
                    placeholder={manga.latest_chapter_url ? "Vide : lien officiel du dernier chapitre" : "https://…/chapitre-{chapitre}"}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-ink-2">Tomes</span>
                  <input
                    value={readUrlVolume}
                    onChange={(e) => { setReadUrlVolume(e.target.value); setReadUrlMsg(null); }}
                    onKeyDown={(e) => e.key === "Enter" && saveReadUrl()}
                    placeholder="https://…/tome-{tome}"
                    className={inputClass}
                  />
                </label>
                <button
                  onClick={saveReadUrl}
                  disabled={!readUrlsChanged}
                  className="self-end rounded-xl bg-ink px-4 py-2 text-[12px] font-bold text-paper disabled:opacity-30"
                >
                  Enregistrer
                </button>
              </div>
              {readUrlMsg && (
                <p className={`mt-1 text-[11.5px] font-bold ${readUrlMsg.ok ? "text-success" : "text-danger"}`}>{readUrlMsg.text}</p>
              )}
              {/* Aperçu : où mène le bouton « Lire » avec le lien tel qu'il est enregistré */}
              {readTarget(manga) && (
                <p className="mt-1.5 truncate text-[11.5px] text-ink-2">
                  <span className="font-bold">{readTarget(manga)!.label}</span> → {readTarget(manga)!.url}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted">
                Mets {"{chapitre}"} ou {"{tome}"} à la place du numéro pour ouvrir directement le prochain à lire. Si tu remplis les deux, le bouton « Lire » prend
                celui de l&apos;unité de ta dernière session (tomes ou chapitres). Un lien sans numéro ouvre toujours la même page (ton Drive…).
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Sessions */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl text-ink">Sessions</h2>
          <p className="nums text-[12px] text-muted">
            {chapterTotal > 0 && `${chapterTotal} ${unitLabel("chapter", chapterTotal)}`}
            {chapterTotal > 0 && volumeTotal > 0 && " · "}
            {volumeTotal > 0 && `${volumeTotal} ${unitLabel("volume", volumeTotal)}`}
          </p>
        </div>
        {logs.length === 0 ? (
          <p className="rounded-lg border-2 border-dashed border-line py-8 text-center text-sm text-muted">Aucune session pour l&apos;instant.</p>
        ) : (
          <div className="manga-panel divide-y divide-line p-0">
            {logs.map((l) => (
              <div key={l.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink">
                    <span className="text-violet-deep">+{l.amount} {unitLabel(l.unit, l.amount)}</span>
                    <span className="font-medium text-muted"> · jusqu&apos;au {l.unit === "chapter" ? "ch." : "tome"} {l.end_value}</span>
                    {l.unit === "chapter" && l.volume ? <span className="font-medium text-muted"> · tome {l.volume}</span> : null}
                    {l.rating ? <RatingTag value={Number(l.rating)} className="ml-2 text-[12px]" /> : null}
                  </p>
                  <p className="text-[11px] text-muted">{fmtDate(l.date)}</p>
                  {l.notes && <p className="mt-1 text-[12.5px] italic text-ink-2">« {l.notes} »</p>}
                </div>
                {isOwn && (
                  <button onClick={() => deleteLog(l.id)} className="shrink-0 text-[11px] font-semibold text-muted hover:text-danger" aria-label="Supprimer la session">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {isOwn && (
        <button onClick={deleteManga} className="self-center text-[12px] font-semibold text-muted hover:text-danger">
          Supprimer la série
        </button>
      )}

      <LogMangaModal
        open={showLog}
        presetMangaId={manga.id}
        onClose={() => setShowLog(false)}
        onSaved={() => {
          setShowLog(false);
          load();
        }}
      />
    </div>
  );
}
