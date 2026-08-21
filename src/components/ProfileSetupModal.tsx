"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { updateGoal } from "../lib/settings";
import { Modal, Button, FieldLabel, inputClass } from "./ui";

/**
 * Fenêtre de personnalisation affichée une seule fois, juste après l'inscription
 * et avant le tutoriel : photo de profil, pseudo, bio, objectifs de lecture.
 * Skippable à tout moment — rien n'est obligatoire.
 */
export default function ProfileSetupModal({
  open,
  onClose,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  userId?: string;
}) {
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pagesGoal, setPagesGoal] = useState("");
  const [booksGoal, setBooksGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(user?.user_metadata?.display_name || "");
    setBio("");
    setAvatarUrl(null);
    setPagesGoal("");
    setBooksGoal("");
    setError(null);
  }, [open, user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/avatar/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload échoué");
      setAvatarUrl(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload échoué. Réessaie.");
    }
    setAvatarUploading(false);
  };

  const handleFinish = async () => {
    if (!userId) { onClose(); return; }
    setSaving(true);
    setError(null);
    try {
      const name = displayName.trim();
      await Promise.all([
        name
          ? Promise.all([
              supabase.auth.updateUser({ data: { display_name: name } }),
              supabase.from("user_profiles").upsert(
                { id: userId, display_name: name, bio: bio.trim() || null, avatar_url: avatarUrl },
                { onConflict: "id" },
              ),
            ])
          : supabase.from("user_profiles").upsert(
              { id: userId, bio: bio.trim() || null, avatar_url: avatarUrl },
              { onConflict: "id" },
            ),
        pagesGoal && Number(pagesGoal) > 0 ? updateGoal("reading_pages_year", Number(pagesGoal), userId) : null,
        booksGoal && Number(booksGoal) > 0 ? updateGoal("reading_books_year", Number(booksGoal), userId) : null,
      ]);
      window.dispatchEvent(new CustomEvent("profile-updated"));
    } catch {
      // On ne bloque pas l'entrée dans l'app pour un enregistrement de préférences.
    }
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Personnalise ton profil"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1 py-3">
            Passer
          </Button>
          <Button onClick={handleFinish} disabled={saving} className="flex-1 py-3">
            {saving ? "Enregistrement…" : "Continuer"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-muted">
          Tout est optionnel — tu pourras toujours changer ça plus tard depuis Mon compte.
        </p>

        {/* Photo de profil */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Photo de profil"
                className="h-24 w-24 rounded-full object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-violet font-serif text-3xl font-semibold text-cream">
                {(displayName || "?")[0]?.toUpperCase()}
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-violet text-[13px] text-cream shadow-md">
              {avatarUploading ? "…" : "✎"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={avatarUploading}
              />
            </label>
          </div>
          <p className="text-[11.5px] text-muted">Ajoute une photo de profil</p>
        </div>

        <div>
          <FieldLabel>Pseudo</FieldLabel>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ton pseudo"
            className={inputClass}
          />
        </div>

        <div>
          <FieldLabel>Bio (optionnel)</FieldLabel>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Tes goûts de lecture, ce que tu aimes en ce moment…"
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </div>

        <div>
          <FieldLabel>Objectif de lecture pour l&apos;année (optionnel)</FieldLabel>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={pagesGoal}
              onChange={(e) => setPagesGoal(e.target.value)}
              placeholder="Pages (ex. 12000)"
              className={inputClass}
            />
            <input
              type="number"
              min={1}
              value={booksGoal}
              onChange={(e) => setBooksGoal(e.target.value)}
              placeholder="Livres (ex. 24)"
              className={inputClass}
            />
          </div>
        </div>

        {error && <p className="text-xs font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
