"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book } from "../../lib/types";
import { isCompleted } from "../../lib/books";
import { Cover, Button, Toggle } from "../../components/ui";
import NotificationPrefsModal from "../../components/NotificationPrefsModal";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array, ensurePushSubscription } from "../../lib/push.client";

// ── Favorite Book Picker ────────────────────────────────────────────────────
// Se charge tout seul depuis Supabase — pas de dépendance sur l'onglet Biblio

function FavoriteBookPicker({
  userId,
  current,
  slotIndex,
  onSelect,
  onClose,
}: {
  userId: string;
  current: number[];
  slotIndex: number;
  onSelect: (bookId: number) => void;
  onClose: () => void;
}) {
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .then(({ data }) => {
        setAllBooks((data as Book[]) || []);
        setLoadingBooks(false);
      });
  }, [userId]);

  const completed = allBooks.filter(
    (b) => isCompleted(b) && !current.filter((_, i) => i !== slotIndex).includes(b.id)
  );
  const filtered = q.trim()
    ? completed.filter(
        (b) =>
          b.title.toLowerCase().includes(q.toLowerCase()) ||
          b.author.toLowerCase().includes(q.toLowerCase())
      )
    : completed;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4 pt-4 pb-24 [touch-action:none]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-paper p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold text-ink">Choisir un favori</h3>
          <button onClick={onClose} className="text-xl font-light text-muted">✕</button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="mb-3 w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
          autoFocus
        />
        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {loadingBooks && (
            <p className="py-8 text-center text-xs font-medium uppercase tracking-wider text-muted">
              Chargement…
            </p>
          )}
          {!loadingBooks && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">
              {completed.length === 0 ? "Aucun livre terminé dans ta bibliothèque." : "Aucun résultat."}
            </p>
          )}
          {filtered.map((b) => (
            <button
              key={b.id}
              onClick={() => { onSelect(b.id); onClose(); }}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left transition-colors hover:border-violet"
            >
              <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-14 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-[14px] font-medium text-ink">{b.title}</p>
                <p className="truncate text-[11px] text-muted">{b.author}</p>
                {(b.rating || 0) > 0 && (
                  <p className="text-[11px] font-medium text-gold">★ {b.rating!.toFixed(1)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ComptePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  // Dark mode
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);
  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  };

  // Notifications push
  const [notifStatus, setNotifStatus] = useState<"granted" | "default" | "denied" | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [showNotifPrefs, setShowNotifPrefs] = useState(false);
  const [notifTestResult, setNotifTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = Notification.permission as "granted" | "default" | "denied";
    setNotifStatus(perm);
    if (perm === "granted" && "serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setNotifEnabled(!!sub);
      });
    }
  }, []);

  const handleToggleNotif = async () => {
    if (notifLoading || notifStatus === "denied" || !("serviceWorker" in navigator)) return;
    setNotifLoading(true);
    setNotifError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (notifEnabled) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await fetch("/api/push/subscribe", {
              method: "DELETE",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ endpoint }),
            });
          }
        }
        setNotifEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        setNotifStatus(permission as "granted" | "default" | "denied");
        if (permission === "granted") {
          const result = await ensurePushSubscription();
          setNotifEnabled(true);
          sessionStorage.removeItem("swena_push_dismissed_session");
          if (!result.ok) {
            setNotifError(`Activation partielle : ${result.message}`);
          }
        } else if (permission === "denied") {
          setNotifError("Permission refusée — autorise les notifications dans les réglages de ton navigateur");
        }
      }
    } catch (err) {
      setNotifError((err as Error).message || "Erreur lors de l'activation");
    }
    setNotifLoading(false);
  };

  const [notifDiag, setNotifDiag] = useState<{
    vapidKey: string; subsCount: number; totalSubs: number; subsError: string | null;
  } | null>(null);
  const [notifDiagLoading, setNotifDiagLoading] = useState(false);

  const handleSyncNotif = async () => {
    setNotifTestResult("Renouvellement…");
    // force=true : désabonne + réabonne pour garantir une souscription fraîche
    const result = await ensurePushSubscription(true);
    if (result.ok) {
      setNotifEnabled(true);
      setNotifTestResult("Synchronisé — appuie sur Tester");
    } else {
      setNotifTestResult(`Erreur : ${result.message}`);
    }
    setTimeout(() => setNotifTestResult(null), 5000);
  };

  const handleTestNotif = async () => {
    setNotifTestResult("Préparation…");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotifTestResult("Push non supporté sur cet appareil");
      return;
    }
    if (Notification.permission !== "granted") {
      setNotifTestResult("Notifications non autorisées");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setNotifTestResult("Non connecté"); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      // Obtenir ou créer la souscription directement depuis le navigateur
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const subJson = sub.toJSON();
      const p256dh = subJson.keys?.p256dh;
      const auth = subJson.keys?.auth;
      if (!p256dh || !auth) {
        setNotifTestResult("Impossible de lire les clés de souscription");
        return;
      }
      setNotifTestResult("Envoi en cours…");
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint: sub.endpoint, p256dh, auth }),
      });
      const json = await res.json();
      if (!res.ok) {
        const d = json.debug;
        const debugStr = d ? ` [vapid:${d.vapidPresent ? d.vapidLength + "c" : "ABSENT"}]` : "";
        setNotifTestResult(`Échec : ${json.error}${debugStr}`);
      } else {
        setNotifTestResult("Envoyée — vérifie tes notifications");
      }
    } catch (err) {
      setNotifTestResult("Erreur : " + (err as Error).message);
    }
    setTimeout(() => setNotifTestResult(null), 6000);
  };

  const handleDiagnostic = async () => {
    setNotifDiagLoading(true);
    setNotifDiag(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setNotifDiagLoading(false); return; }
    try {
      const res = await fetch("/api/push/diagnostic", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setNotifDiag({
        vapidKey: json.env?.vapidPrivateKey ?? "inconnue",
        subsCount: json.subscriptions?.forUserCount ?? 0,
        totalSubs: json.subscriptions?.totalInDB ?? 0,
        subsError: json.subscriptions?.error ?? null,
      });
    } catch {
      setNotifDiag({ vapidKey: "erreur réseau", subsCount: 0, totalSubs: 0, subsError: "réseau" });
    }
    setNotifDiagLoading(false);
  };

  // Profile
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pseudoDraft, setPseudoDraft] = useState("");
  const [editingPseudo, setEditingPseudo] = useState(false);
  const [savingPseudo, setSavingPseudo] = useState(false);
  const [bio, setBio] = useState<string | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Favorites
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [savingFavorites, setSavingFavorites] = useState(false);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("user_profiles")
      .select("avatar_url, bio, favorite_book_ids")
      .eq("id", uid)
      .single();
    const d = data as { avatar_url?: string | null; bio?: string | null; favorite_book_ids?: number[] | null } | null;
    const url = d?.avatar_url ?? null;
    setAvatarUrl(url);
    setAvatarDraft(url ?? "");
    setBio(d?.bio ?? null);
    setBioDraft(d?.bio ?? "");
    const ids = (d?.favorite_book_ids ?? []).filter(Boolean);
    setFavoriteIds(ids);
    if (ids.length > 0) {
      const { data: favData } = await supabase
        .from("books")
        .select("id, title, author, cover_url, rating")
        .in("id", ids);
      setFavoriteBooks((favData as Book[]) || []);
    }
  };

  useEffect(() => {
    if (userId) loadProfile(userId);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Suppression échouée");
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Suppression échouée");
      setDeletingAccount(false);
    }
  };

  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/avatar/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload échoué");
      setAvatarDraft(json.url);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload échoué. Réessaie.");
    }
    setAvatarUploading(false);
  };

  const handleSaveAvatar = async () => {
    if (!userId) return;
    setSavingAvatar(true);
    setAvatarError(null);
    const url = avatarDraft.trim() || null;
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ id: userId, avatar_url: url }, { onConflict: "id" });
    setSavingAvatar(false);
    if (error) { setAvatarError(error.message); return; }
    setAvatarUrl(url);
    setEditingAvatar(false);
    window.dispatchEvent(new CustomEvent("profile-updated"));
  };

  const handleSavePseudo = async () => {
    if (!userId) return;
    const name = pseudoDraft.trim();
    if (!name) return;
    setSavingPseudo(true);
    await Promise.all([
      supabase.auth.updateUser({ data: { display_name: name } }),
      supabase.from("user_profiles").upsert({ id: userId, display_name: name }, { onConflict: "id" }),
    ]);
    setSavingPseudo(false);
    setEditingPseudo(false);
    window.dispatchEvent(new CustomEvent("profile-updated"));
  };

  const handleSaveBio = async () => {
    if (!userId) return;
    setSavingBio(true);
    const text = bioDraft.trim() || null;
    await supabase.from("user_profiles").upsert({ id: userId, bio: text }, { onConflict: "id" });
    setSavingBio(false);
    setBio(text);
    setEditingBio(false);
  };

  const handleSelectFavorite = async (slotIndex: number, bookId: number) => {
    if (!userId) return;
    const updated = [...favoriteIds];
    while (updated.length <= slotIndex) updated.push(0);
    updated[slotIndex] = bookId;
    const cleaned = updated.filter(Boolean);
    setSavingFavorites(true);
    await supabase
      .from("user_profiles")
      .upsert({ id: userId, favorite_book_ids: cleaned }, { onConflict: "id" });
    setSavingFavorites(false);
    setFavoriteIds(cleaned);
    const { data: favData } = await supabase
      .from("books")
      .select("id, title, author, cover_url, rating")
      .in("id", cleaned);
    setFavoriteBooks((favData as Book[]) || []);
  };

  const handleRemoveFavorite = async (slotIndex: number) => {
    if (!userId) return;
    const updated = favoriteIds.filter((_, i) => i !== slotIndex);
    await supabase
      .from("user_profiles")
      .upsert({ id: userId, favorite_book_ids: updated }, { onConflict: "id" });
    setFavoriteIds(updated);
    setFavoriteBooks((prev) => prev.filter((b) => updated.includes(b.id)));
  };

  if (authLoading) {
    return (
      <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">
        Chargement…
      </div>
    );
  }

  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Anonyme";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
        <div className="flex flex-col gap-4">
          {/* Carte profil */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-card p-5">
            <div className="relative">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-violet/20"
                />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-violet font-serif text-3xl font-semibold text-cream">
                  {initial}
                </span>
              )}
            </div>
            <div className="text-center">
              {editingPseudo ? (
                <div className="flex flex-col gap-2 w-full max-w-[220px]">
                  <input
                    value={pseudoDraft}
                    onChange={(e) => setPseudoDraft(e.target.value)}
                    placeholder="Ton pseudo"
                    autoFocus
                    className="rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-violet text-center"
                  />
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setEditingPseudo(false)} className="flex-1 text-xs py-1.5">Annuler</Button>
                    <Button onClick={handleSavePseudo} disabled={savingPseudo} className="flex-1 text-xs py-1.5">
                      {savingPseudo ? "…" : "OK"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 justify-center">
                  <p className="font-serif text-lg font-semibold text-ink">{displayName}</p>
                  <button
                    onClick={() => { setPseudoDraft(displayName); setEditingPseudo(true); }}
                    className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-[10px] font-medium text-muted hover:border-violet/40 hover:text-violet-deep"
                  >
                    Modifier
                  </button>
                </div>
              )}
              <p className="text-xs text-muted">{user?.email}</p>
            </div>
            <button
              onClick={() => { setEditingAvatar((v) => !v); setAvatarError(null); }}
              className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-violet/40 hover:text-violet-deep"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l-4 1 1-4L14.5 3.5a2.121 2.121 0 013 3L9 13z" />
              </svg>
              {editingAvatar ? "Fermer" : "Modifier la photo"}
            </button>

            {editingAvatar && (
              <div className="w-full rounded-2xl border border-violet/30 bg-violet-soft p-4">
                {/* Aperçu de la future photo */}
                {avatarDraft ? (
                  <div className="mb-3 flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarDraft} alt="Aperçu" className="h-20 w-20 rounded-full object-cover ring-2 ring-violet/30" />
                    <button
                      onClick={() => setAvatarDraft("")}
                      className="text-[11px] font-medium text-danger underline"
                    >
                      Changer de photo
                    </button>
                  </div>
                ) : (
                  <label className="mb-3 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-violet/30 bg-input px-4 py-7 text-center transition-colors hover:border-violet hover:bg-violet-soft/60 active:scale-[0.98]">
                    {avatarUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet/20 border-t-violet" />
                        <span className="text-[12px] font-medium text-violet-deep">Envoi en cours…</span>
                      </div>
                    ) : (
                      <>
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-soft text-violet">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-ink">
                            Choisir une photo
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted">Galerie ou appareil photo · max 10 Mo</p>
                        </div>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileUpload}
                      disabled={avatarUploading}
                    />
                  </label>
                )}
                {avatarError && (
                  <p className="mt-1 text-xs font-medium text-danger">{avatarError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => { setEditingAvatar(false); setAvatarDraft(avatarUrl ?? ""); }}
                    className="flex-1 text-sm"
                  >
                    Annuler
                  </Button>
                  <Button onClick={handleSaveAvatar} disabled={savingAvatar || !avatarDraft || avatarUploading} className="flex-1 text-sm">
                    {savingAvatar ? "Sauvegarde…" : "Sauvegarder"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[15px] font-medium text-ink">Bio</h3>
              {!editingBio && (
                <button
                  onClick={() => { setEditingBio(true); setBioDraft(bio ?? ""); }}
                  className="text-xs font-medium text-violet-deep"
                >
                  {bio ? "Modifier" : "Ajouter"}
                </button>
              )}
            </div>
            {editingBio ? (
              <div className="mt-3 flex flex-col gap-2">
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  rows={3}
                  maxLength={280}
                  placeholder="Décris ton rapport aux livres, tes genres favoris…"
                  className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
                  autoFocus
                />
                <p className="text-right text-[10px] text-muted">{bioDraft.length}/280</p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditingBio(false)} className="flex-1 text-sm">
                    Annuler
                  </Button>
                  <Button onClick={handleSaveBio} disabled={savingBio} className="flex-1 text-sm">
                    {savingBio ? "Sauvegarde…" : "Enregistrer"}
                  </Button>
                </div>
              </div>
            ) : bio ? (
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>{bio}</p>
            ) : (
              <p className="mt-2 text-[13px] text-muted">Pas encore de bio.</p>
            )}
          </div>

          {/* Top 4 favoris */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[15px] font-medium text-ink">Mes 4 favoris</h3>
              {savingFavorites && (
                <span className="text-[11px] text-muted">Sauvegarde…</span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-muted">
              Tes livres coup de cœur, visibles sur ton profil public.
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((slot) => {
                const bkId = favoriteIds[slot];
                const bk = bkId ? favoriteBooks.find((b) => b.id === bkId) : null;
                return (
                  <div key={slot} className="flex w-full flex-col items-center gap-1.5">
                    {bk ? (
                      <div className="group relative w-full">
                        <Cover
                          id={bk.id}
                          title={bk.title}
                          coverUrl={bk.cover_url}
                          className="aspect-[3/4] w-full cursor-pointer rounded-lg"
                          rounded="rounded-lg"
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-ink/60 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => setPickerSlot(slot)}
                            className="text-[10px] font-semibold text-cream underline"
                          >
                            Changer
                          </button>
                          <button
                            onClick={() => handleRemoveFavorite(slot)}
                            className="text-[10px] font-semibold text-cream/70 underline"
                          >
                            Retirer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPickerSlot(slot)}
                        className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border-2 border-dashed border-violet/30 bg-violet-soft text-2xl text-violet/40 transition-colors hover:border-violet/60 hover:text-violet"
                      >
                        +
                      </button>
                    )}
                    <span className="max-w-full truncate text-center text-[9.5px] text-muted">
                      {bk ? bk.title : `Favori ${slot + 1}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Outils avancés */}
          <Link
            href="/compte/outils"
            className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40"
          >
            <div>
              <h3 className="font-serif text-[15px] font-medium text-ink">Outils avancés</h3>
              <p className="mt-0.5 text-[11px] text-muted">
                Frise historique, import Goodreads, couvertures manquantes, parrainage.
              </p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-muted">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            </svg>
          </Link>

          {/* Liens rapides */}
          <div className="flex flex-col gap-2">
            {user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
              <Link
                href="/admin"
                className="flex items-center justify-between rounded-2xl border border-violet/30 bg-violet-soft p-4 transition-colors hover:border-violet/60"
              >
                <div>
                  <p className="font-serif text-[15px] font-medium text-violet-deep">Administration</p>
                  <p className="mt-0.5 text-xs text-muted">Fusion de livres, outils admin</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-violet-deep">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
            {user?.id && (
              <Link
                href={`/membre/${user.id}`}
                className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40"
              >
                <div>
                  <p className="font-serif text-[15px] font-medium text-ink">Voir mon profil public</p>
                  <p className="mt-0.5 text-xs text-muted">Ce que les autres membres voient de toi</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-muted">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
            <Link
              href="/membres"
              className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40"
            >
              <div>
                <p className="font-serif text-[15px] font-medium text-ink">Membres du club</p>
                <p className="mt-0.5 text-xs text-muted">Voir tous les lecteurs</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-muted">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40"
            >
              <div>
                <p className="font-serif text-[15px] font-medium text-ink">Statistiques</p>
                <p className="mt-0.5 text-xs text-muted">Tableau de bord &amp; objectifs</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-muted">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Toggle mode sombre */}
          <button
            onClick={toggleDark}
            className="flex w-full items-center justify-between rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{darkMode ? "☀️" : "🌙"}</span>
              <div>
                <p className="text-left font-serif text-[15px] font-medium text-ink">
                  {darkMode ? "Mode clair" : "Mode sombre"}
                </p>
                <p className="text-left text-xs text-muted">
                  {darkMode ? "Revenir au thème clair" : "Activer le thème sombre"}
                </p>
              </div>
            </div>
            <Toggle on={darkMode} />
          </button>

          {/* Toggle notifications */}
          {notifStatus !== null && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleToggleNotif}
                disabled={notifLoading || notifStatus === "denied"}
                className="flex w-full items-center justify-between rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40 disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{notifLoading ? "⏳" : "🔔"}</span>
                  <div>
                    <p className="text-left font-serif text-[15px] font-medium text-ink">Notifications</p>
                    <p className="text-left text-xs text-muted">
                      {notifStatus === "denied"
                        ? "Bloquées — autorise dans les réglages"
                        : notifEnabled
                        ? "Activées"
                        : notifLoading
                        ? "Activation…"
                        : "Désactivées — appuie pour activer"}
                    </p>
                  </div>
                </div>
                {notifStatus !== "denied" && <Toggle on={notifEnabled} />}
              </button>

              {/* Choix des types de notifications — indépendant de l'état de la
                  souscription push sur cet appareil : ce sont des préférences
                  de compte, pas un réglage local. */}
              {notifStatus !== "denied" && (
                <button
                  onClick={() => setShowNotifPrefs(true)}
                  className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 transition-colors hover:border-violet/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">⚙️</span>
                    <div>
                      <p className="text-left text-[13.5px] font-medium text-ink">
                        Gérer les notifications
                      </p>
                      <p className="text-left text-[11.5px] text-muted">
                        Choisis les types que tu veux recevoir
                      </p>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              )}

              {notifError && (
                <p className="rounded-xl border border-danger/20 bg-[#f6e7e1] px-3 py-2 text-[11px] text-danger">
                  {notifError}
                </p>
              )}
              {notifStatus === "granted" && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={handleSyncNotif}
                      className="flex-1 rounded-2xl border border-line bg-card px-3 py-2.5 text-[12px] font-semibold text-ink transition-colors hover:border-violet/40"
                    >
                      Synchroniser
                    </button>
                    <button
                      onClick={handleTestNotif}
                      className="flex-1 rounded-2xl border border-violet/40 bg-violet-soft px-3 py-2.5 text-[12px] font-semibold text-violet-deep transition-colors hover:border-violet"
                    >
                      Tester
                    </button>
                    <button
                      onClick={handleDiagnostic}
                      disabled={notifDiagLoading}
                      className="rounded-2xl border border-line bg-card px-3 py-2.5 text-[12px] text-muted transition-colors hover:border-violet/40 hover:text-ink disabled:opacity-50"
                    >
                      {notifDiagLoading ? "…" : "Diagnostic"}
                    </button>
                  </div>
                  {notifTestResult && (
                    <p className="text-center text-[11.5px] text-muted">{notifTestResult}</p>
                  )}
                  {notifDiag && (
                    <div className="rounded-2xl border border-line bg-input px-4 py-3 text-[11.5px] leading-relaxed text-ink">
                      <p className={notifDiag.vapidKey.startsWith("présente") ? "text-success" : "text-danger"}>
                        Clé VAPID : {notifDiag.vapidKey}
                      </p>
                      <p className={notifDiag.subsCount > 0 ? "text-success" : "text-danger"}>
                        Souscriptions pour toi : {notifDiag.subsCount}
                      </p>
                      <p className="text-muted">Total en base : {notifDiag.totalSubs}</p>
                      {notifDiag.subsError && (
                        <p className="text-danger">Erreur DB : {notifDiag.subsError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full border-danger/30 text-danger hover:bg-danger-soft"
          >
            Se déconnecter
          </Button>

          <button
            onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
            className="w-full rounded-2xl border border-transparent py-2 text-[12px] font-medium text-muted transition-colors hover:text-danger"
          >
            Supprimer mon compte
          </button>

          <NotificationPrefsModal
            open={showNotifPrefs}
            onClose={() => setShowNotifPrefs(false)}
            userId={user?.id}
          />

          {/* Informations légales */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-line pt-4">
            <Link href="/mentions-legales" className="text-[11px] text-muted transition-colors hover:text-ink">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="text-[11px] text-muted transition-colors hover:text-ink">
              Confidentialité
            </Link>
            <Link href="/conditions" className="text-[11px] text-muted transition-colors hover:text-ink">
              Conditions d&apos;utilisation
            </Link>
          </div>
        </div>

      {/* ── Modale suppression compte ── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4 pt-4 pb-24 [touch-action:none]"
          onClick={() => !deletingAccount && setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-paper p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6e7e1] text-danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <h3 className="font-serif text-lg font-bold text-ink">Supprimer mon compte</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              Cette action est <span className="font-semibold text-danger">irréversible</span>. Tous tes livres, sessions de lecture, statistiques et ton profil seront définitivement supprimés.
            </p>
            {deleteError && (
              <p className="mt-3 rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-2 text-xs font-medium text-danger">
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="w-full rounded-2xl bg-danger py-3 text-[14px] font-semibold text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deletingAccount ? "Suppression…" : "Oui, supprimer définitivement"}
              </button>
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingAccount}
                className="w-full"
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Picker favoris — charge ses propres livres depuis Supabase */}
      {pickerSlot !== null && userId && (
        <FavoriteBookPicker
          userId={userId}
          current={favoriteIds}
          slotIndex={pickerSlot}
          onSelect={(id) => {
            handleSelectFavorite(pickerSlot, id);
            setPickerSlot(null);
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}


