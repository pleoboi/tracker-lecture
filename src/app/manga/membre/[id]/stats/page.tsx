"use client";

import { useParams } from "next/navigation";
import { useAuth } from "../../../../../lib/auth-context";
import MangaStatsView from "../../../../../components/manga/MangaStatsView";

export default function MangaMemberStatsPage() {
  const params = useParams();
  const { user } = useAuth();
  const memberId = params.id as string;
  return <MangaStatsView userId={memberId} isOwn={user?.id === memberId} />;
}
