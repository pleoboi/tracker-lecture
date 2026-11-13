"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { todayISO } from "../../lib/books";
import { unitLabel, isOngoing, releaseState, checkMangaBadges, type Manga, type MangaUnit } from "../../lib/manga";
import { Modal, Button, FieldLabel, inputClass } from "../ui";
import { MangaCover, UnitSwitch, DateNavBar, Stepper, StarPicker } from "./MangaUI";

export default function LogMangaModal({
  open,
  onClose,
  onSaved,
  presetMangaId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
  presetMangaId?: number | null;
}) {
  const { user } = useAuth();
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [unit, setUnit] = useState<MangaUnit>("chapter");
  const [endValue, setEndValue] = useState(1);
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [finished, setFinished] = useState(false);
  const [rating, setRating] = useState(0);
  // Note des chapitres / tomes lus pendant cette session (≠ note de la série)
  const [chapterRating, setChapterRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dernière unité utilisée par série (pré-sélection intelligente)
  const [lastUnits, setLastUnits] = useState<Record<number, MangaUnit>>({});

  const selected = useMemo(() => mangas.find((m) => m.id === selectedId) ?? null, [mangas, selectedId]);
  const current = selected ? (unit === "chapter" ? selected.current_chapter : selected.current_volume) : 0;
  const total = selected ? (unit === "chapter" ? selected.total_chapters : selected.total_volumes) : null;
  const amount = Math.max(0, endValue - current);

  // Coche automatiquement "terminé" quand on atteint le dernier chapitre / tome connu
  const applyEnd = (m: Manga, u: MangaUnit, v: number) => {
    const t = u === "chapter" ? m.total_chapters : m.total_volumes;
    setEndValue(v);
    // Série encore en parution : atteindre le dernier chapitre = être à jour, pas avoir fini
    setFinished(!!t && v >= t && !isOngoing(m));
  };

  const applyUnit = (m: Manga, u: MangaUnit) => {
    setUnit(u);
    applyEnd(m, u, (u === "chapter" ? m.current_chapter : m.current_volume) + 1);
  };

  // Changement de série : reprendre l'unité habituelle et proposer "le suivant"
  const pickManga = (m: Manga, units: Record<number, MangaUnit>) => {
    setSelectedId(m.id);
    applyUnit(m, units[m.id] ?? (m.current_volume > 0 && m.current_chapter === 0 ? "volume" : "chapter"));
  };

  useEffect(() => {
    if (!open || !user) return;
    setDate(todayISO());
    setNotes("");
    setFinished(false);
    setRating(0);
    setChapterRating(0);
    setError(null);
    setLoading(true);
    (async () => {
      const [{ data: ms }, { data: logs }] = await Promise.all([
        supabase
          .from("mangas")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["reading", "paused", "to-read"])
          .order("created_at", { ascending: false }),
        supabase
          .from("manga_logs")
          .select("manga_id, unit, date")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .order("id", { ascending: false })
          .limit(300),
      ]);
      let list = (ms as Manga[]) ?? [];
      // Série demandée explicitement mais hors des statuts ci-dessus (ex: relecture)
      if (presetMangaId && !list.some((m) => m.id === presetMangaId)) {
        const { data: one } = await supabase.from("mangas").select("*").eq("id", presetMangaId).single();
        if (one) list = [one as Manga, ...list];
      }
      const units: Record<number, MangaUnit> = {};
      const lastDate: Record<number, string> = {};
      for (const l of (logs ?? []) as { manga_id: number; unit: MangaUnit; date: string }[]) {
        if (!units[l.manga_id]) units[l.manga_id] = l.unit;
        if (!lastDate[l.manga_id]) lastDate[l.manga_id] = l.date;
      }
      // En cours d'abord, puis par dernière lecture
      list.sort((a, b) => {
        const rank = (m: Manga) => (m.status === "reading" ? 0 : m.status === "paused" ? 1 : 2);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        return (lastDate[b.id] ?? b.created_at).localeCompare(lastDate[a.id] ?? a.created_at);
      });
      setLastUnits(units);
      setMangas(list);
      const initial = list.find((m) => m.id === presetMangaId) ?? list[0];
      if (initial) pickManga(initial, units);
      else setSelectedId(null);
      setLoading(false);
    })();
  }, [open, user, presetMangaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!user || !selected) return;
    if (amount <= 0) {
      setError(`Indique un ${unit === "chapter" ? "chapitre" : "tome"} après le ${current}.`);
      return;
    }
    setSaving(true);
    setError(null);

    const { data: inserted, error: logError } = await supabase.from("manga_logs").insert({
      user_id: user.id,
      manga_id: selected.id,
      date,
      unit,
      amount,
      end_value: endValue,
      notes: notes.trim() || null,
      ...(chapterRating > 0 ? { rating: chapterRating } : {}),
    }).select("id").single();
    if (logError) {
      setSaving(false);
      setError("Impossible d'enregistrer la session. Réessaie.");
      return;
    }

    const patch: Partial<Manga> = unit === "chapter" ? { current_chapter: endValue } : { current_volume: endValue };
    // Unité de la dernière session : choisit le lien de lecture perso (tomes / chapitres)
    patch.last_unit = unit;
    if (selected.status !== "reading") patch.status = "reading";
    if (!selected.date_started || date < selected.date_started) patch.date_started = date;
    if (finished) {
      patch.status = "completed";
      patch.date_finished = date;
      if (rating > 0) patch.rating = rating;
    }
    await supabase.from("mangas").update(patch).eq("id", selected.id);

    // Couverture du tome correspondant (MangaDex, côté serveur) : en arrière-plan,
    // la session est déjà enregistrée.
    if (inserted?.id) {
      fetch("/api/manga/log-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: inserted.id }),
      })
        .then(() => window.dispatchEvent(new CustomEvent("mangas-updated")))
        .catch(() => {});
    }

    setSaving(false);
    // Badges (séries de jours, chapitres lus, série terminée...) : vérifiés en arrière-plan
    checkMangaBadges();
    onSaved(
      finished
        ? `« ${selected.title} » terminé`
        : `+${amount} ${unitLabel(unit, amount)} sur « ${selected.title} »`
    );
  };

  const footer = selected ? (
    <Button onClick={save} disabled={saving || amount <= 0} className="w-full">
      {saving ? "Enregistrement…" : amount > 0 ? `Enregistrer +${amount} ${unitLabel(unit, amount)}` : "Enregistrer"}
    </Button>
  ) : undefined;

  return (
    <Modal open={open} onClose={onClose} title="Noter ma lecture" footer={footer}>
      {loading ? (
        <p className="py-10 text-center text-xs text-muted">Chargement…</p>
      ) : mangas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          Aucune série en cours. Ajoute d&apos;abord un manga à ta mangathèque.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Choix de la série */}
          <div className="-mx-6 flex gap-2.5 overflow-x-auto px-6 pb-1">
            {mangas.map((m) => {
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  onClick={() => pickManga(m, lastUnits)}
                  className={`flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-lg p-1 transition-opacity ${
                    active ? "opacity-100" : "opacity-50 hover:opacity-80"
                  }`}
                >
                  <div className={active ? "rounded-[6px] ring-2 ring-violet ring-offset-2 ring-offset-paper" : ""}>
                    <MangaCover id={m.id} title={m.title} coverUrl={m.cover_url} className="h-[100px] w-[68px]" />
                  </div>
                  <span className="line-clamp-2 text-center text-[10.5px] font-semibold leading-tight text-ink">{m.title}</span>
                </button>
              );
            })}
          </div>

          {selected && (
            <>
              <div>
                <FieldLabel>Je compte en</FieldLabel>
                <UnitSwitch value={unit} onChange={(u) => applyUnit(selected, u)} />
              </div>

              <div>
                <FieldLabel>{unit === "chapter" ? "Jusqu'au chapitre" : "Jusqu'au tome"}</FieldLabel>
                <Stepper value={endValue} onChange={(v) => applyEnd(selected, unit, v)} min={0} max={total} />
                <p className="mt-1.5 text-center text-[12px] text-muted">
                  {current > 0 ? `Tu en étais au ${unit === "chapter" ? "chapitre" : "tome"} ${current}` : "Première session dans cette unité"}
                  {total ? ` · ${total} au total` : ""}
                  {amount > 0 && (
                    <span className="font-bold text-violet-deep"> · +{amount} {unitLabel(unit, amount)}</span>
                  )}
                </p>
              </div>

              <div>
                <FieldLabel>Date</FieldLabel>
                <DateNavBar value={date} onChange={setDate} />
              </div>

              <div>
                <FieldLabel>{unit === "chapter" ? "Note des chapitres lus (facultatif)" : "Note des tomes lus (facultatif)"}</FieldLabel>
                <div className="rounded-xl border-2 border-line bg-card py-2.5">
                  <StarPicker
                    value={chapterRating}
                    onChange={setChapterRating}
                    emptyLabel={unit === "chapter" ? "Comment étaient ces chapitres ?" : "Comment étaient ces tomes ?"}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Note de session (facultatif)</FieldLabel>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ce chapitre était dingue…"
                  className={`${inputClass} resize-none`}
                />
              </div>

{isOngoing(selected) ? (
                (() => {
                  const rs = releaseState(selected);
                  if (!rs || unit !== "chapter") return null;
                  const left = Math.max(0, rs.latest - endValue);
                  return (
                    <p className="rounded-xl border-2 border-ink bg-card px-4 py-3 text-center text-[13px] font-bold text-ink">
                      {left === 0 ? "Tu seras à jour 🔥" : `Encore ${left} ch. avant d'être à jour (dernier sorti : ${rs.latest})`}
                    </p>
                  );
                })()
              ) : (
                            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-card px-4 py-3">
                <input
                  type="checkbox"
                  checked={finished}
                  onChange={(e) => setFinished(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-violet)]"
                />
                <span className="text-[13px] font-semibold text-ink">J&apos;ai terminé la série</span>
              </label>
              )}

              {finished && (
                <div>
                  <FieldLabel>Note de la série</FieldLabel>
                  <StarPicker value={rating} onChange={setRating} />
                </div>
              )}

              {error && <p className="text-xs font-medium text-danger">{error}</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
