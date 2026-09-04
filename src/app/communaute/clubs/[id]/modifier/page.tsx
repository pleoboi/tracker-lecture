"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import { useAuth } from "../../../../../lib/auth-context";
import { CLUB_THEMES, clubThemeVar } from "../../../../../lib/bookclubs";
import type { BookClub } from "../../../../../lib/bookclubs";
import { GENRES } from "../../../../../components/BibliothequeView";
import { Toggle, FieldLabel, inputClass } from "../../../../../components/ui";

export default function ModifierClubPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const clubId = params.id as string;
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [themeColor, setThemeColor] = useState<string>(CLUB_THEMES[0].key);
  const [genres, setGenres] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [{ data: club }, { data: membership }] = await Promise.all([
      supabase.from("book_clubs").select("*").eq("id", clubId).maybeSingle(),
      supabase.from("book_club_members").select("role").eq("club_id", clubId).eq("user_id", user.id).maybeSingle(),
    ]);
    const isMod = (membership as { role?: string } | null)?.role === "moderator";
    setAllowed(isMod);
    if (club && isMod) {
      const c = club as BookClub;
      setName(c.name);
      setDescription(c.description ?? "");
      setThemeColor(c.theme_color);
      setGenres(c.genres ?? []);
      setIsPublic(c.is_public);
      setCoverUrl(c.cover_url);
    }
    setLoading(false);
  }, [clubId, user]);

  useEffect(() => { load(); }, [load]);

  const toggleGenre = (g: string) =>
    setGenres((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]));

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/book-clubs/cover-upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload échoué");
      setCoverUrl(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload échoué. Réessaie.");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("book_clubs")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        cover_url: coverUrl,
        theme_color: themeColor,
        genres,
        is_public: isPublic,
      })
      .eq("id", clubId);
    setSaving(false);
    if (err) { setError(err.message); return; }
    router.push(`/communaute/clubs/${clubId}`);
  };

  const handleDeleteClub = async () => {
    if (!confirm(`Supprimer définitivement le club « ${name} » ? Cette action est irréversible.`)) return;
    await supabase.from("book_clubs").delete().eq("id", clubId);
    router.push("/communaute");
  };

  if (loading) {
    return <div className="animate-fadeIn py-16 text-center text-xs text-muted">Chargement…</div>;
  }
  if (!allowed) {
    return (
      <div className="animate-fadeIn flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-serif text-lg text-ink">Réservé aux modérateurs du club.</p>
        <Link href={`/communaute/clubs/${clubId}`} className="text-sm font-semibold text-violet-deep">‹ Retour au club</Link>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pb-10 pt-4">
      <header className="flex items-center gap-3">
        <Link
          href={`/communaute/clubs/${clubId}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition-transform active:scale-90"
        >
          ‹
        </Link>
        <h1 className="font-serif text-2xl font-black text-ink">Modifier le club</h1>
      </header>

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      )}

      {/* Cover + thème — un seul aperçu vivant : la pastille change avec la couleur choisie */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line transition-transform active:scale-95"
          style={{ backgroundColor: coverUrl ? undefined : `color-mix(in srgb, ${clubThemeVar(themeColor)} 30%, transparent)` }}
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-serif text-2xl font-black" style={{ color: clubThemeVar(themeColor) }}>
              {name.trim()[0]?.toUpperCase() ?? "?"}
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-1 text-center text-[9px] font-semibold text-cream">
            {uploading ? "…" : "Photo"}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />

        <div className="flex flex-1 flex-col gap-1.5">
          <FieldLabel>Thème</FieldLabel>
          <div className="flex gap-2.5">
            {CLUB_THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => setThemeColor(t.key)}
                aria-label={t.label}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90"
                style={{
                  backgroundColor: t.var,
                  outline: themeColor === t.key ? "2px solid var(--color-ink)" : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Nom du club</FieldLabel>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. : Les Insatiables"
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Description</FieldLabel>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="De quoi parle ce club ?"
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Genres */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Genres</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map((g) => {
            const checked = genres.includes(g);
            return (
              <button
                key={g}
                onClick={() => toggleGenre(g)}
                className={`rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-[colors,transform] active:scale-95 ${
                  checked ? "border-violet bg-violet-soft text-violet-deep" : "border-line bg-card text-muted"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {/* Privacy */}
      <button
        onClick={() => setIsPublic((v) => !v)}
        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
      >
        <span>
          <span className="block text-[13.5px] font-medium text-ink">Club public</span>
          <span className="block text-[11.5px] leading-snug text-muted">
            Un club public apparaît dans la découverte et n&apos;importe qui peut le rejoindre. Un club
            privé se rejoint uniquement sur invitation.
          </span>
        </span>
        <Toggle on={isPublic} className="mt-0.5" />
      </button>

      <button
        onClick={handleSave}
        disabled={saving || !name.trim() || uploading}
        className="mt-1 w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>

      <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Zone dangereuse</p>
        <button
          onClick={handleDeleteClub}
          className="w-full rounded-2xl border border-danger/30 bg-danger-soft py-3 text-[13px] font-semibold text-danger transition-transform active:scale-[0.98]"
        >
          Supprimer le club
        </button>
      </div>
    </div>
  );
}
