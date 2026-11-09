"use client";

import AccountView from "../../../components/AccountView";

export default function MangaComptePage() {
  return (
    <div className="manga-account flex min-w-0 flex-col gap-5 pt-4">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-deep">設定</p>
        <h1 className="font-serif text-3xl text-ink sm:text-4xl">Paramètres</h1>
      </header>
      <AccountView variant="manga" />
    </div>
  );
}
