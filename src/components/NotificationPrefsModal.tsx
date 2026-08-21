"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Modal, Toggle } from "./ui";
import {
  NOTIF_GROUPS,
  isNotifEnabled,
  type NotifPrefs,
  type NotifType,
} from "../lib/notificationPrefs";

export default function NotificationPrefsModal({
  open,
  onClose,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  userId?: string;
}) {
  const [prefs, setPrefs] = useState<NotifPrefs>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    setError(null);
    supabase
      .from("user_profiles")
      .select("notification_prefs")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) {
          // Colonne absente : on affiche tout activé sans bloquer l'écran.
          setPrefs({});
        } else {
          setPrefs(((data as { notification_prefs?: NotifPrefs } | null)?.notification_prefs) ?? {});
        }
        setLoading(false);
      });
  }, [open, userId]);

  const toggle = async (type: NotifType) => {
    if (!userId) return;
    const next: NotifPrefs = { ...prefs, [type]: !isNotifEnabled(prefs, type) };
    setPrefs(next);
    setError(null);
    const { error: err } = await supabase
      .from("user_profiles")
      .update({ notification_prefs: next })
      .eq("id", userId);
    if (err) {
      setPrefs(prefs); // retour arrière
      setError("Impossible d'enregistrer ce réglage pour le moment.");
    }
  };

  const activeCount = NOTIF_GROUPS
    .flatMap((g) => g.items)
    .filter((i) => isNotifEnabled(prefs, i.type)).length;
  const totalCount = NOTIF_GROUPS.flatMap((g) => g.items).length;

  return (
    <Modal open={open} onClose={onClose} title="Notifications">
      {loading ? (
        <p className="py-10 text-center text-xs font-medium uppercase tracking-wider text-muted">
          Chargement…
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-[12.5px] leading-relaxed text-muted">
            Choisis ce pour quoi Swena peut te notifier. {activeCount} sur {totalCount} activées.
          </p>

          {error && (
            <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-[11.5px] text-danger">
              {error}
            </p>
          )}

          {NOTIF_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">
                {group.title}
              </p>
              <div className="overflow-hidden rounded-2xl border border-line">
                {group.items.map((item, i) => {
                  const on = isNotifEnabled(prefs, item.type);
                  return (
                    <button
                      key={item.type}
                      onClick={() => toggle(item.type)}
                      className={`flex w-full items-center justify-between gap-3 bg-card px-4 py-3 text-left transition-colors hover:bg-violet-soft/40 ${
                        i > 0 ? "border-t border-line" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-medium text-ink">{item.label}</span>
                        <span className="block text-[11.5px] leading-snug text-muted">{item.desc}</span>
                      </span>
                      <Toggle on={on} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="text-[11px] leading-relaxed text-muted">
            Ces réglages s&apos;appliquent aux notifications envoyées sur ton téléphone. Les
            notifications dans l&apos;application restent visibles depuis la cloche.
          </p>
        </div>
      )}
    </Modal>
  );
}
