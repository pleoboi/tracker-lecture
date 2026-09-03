"use client";

import Link from "next/link";

/** En-tête partagé des sous-pages de profil (Journal, Reviews, Challenges…) —
 *  retour vers le profil + titre centré, façon Letterboxd. */
export default function MemberSectionHeader({
  memberId,
  firstName,
  title,
}: {
  memberId: string;
  firstName: string;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={`/membre/${memberId}`} className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <span className="text-base leading-none">‹</span> {firstName}
      </Link>
      <h1 className="flex-1 truncate text-center font-serif text-lg font-semibold text-ink">{title}</h1>
      <div className="w-[52px] shrink-0" aria-hidden />
    </div>
  );
}
