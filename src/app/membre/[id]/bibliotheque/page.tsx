"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/auth-context";
import BibliothequeView from "../../../../components/BibliothequeView";
import MemberSectionHeader from "../../../../components/MemberSectionHeader";

export default function MemberBibliothequePage() {
  const params = useParams();
  const { user } = useAuth();
  const memberId = params.id as string;
  const isOwn = user?.id === memberId;

  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    supabase.from("user_profiles").select("display_name").eq("id", memberId).single()
      .then(({ data }) => setFirstName(((data as { display_name?: string } | null)?.display_name ?? "").split(" ")[0]));
  }, [memberId]);

  return (
    <div className="animate-fadeIn flex flex-col gap-4 pt-4">
      <MemberSectionHeader memberId={memberId} firstName={firstName} title="Bibliothèque" />
      <BibliothequeView targetUserId={memberId} isOwn={isOwn} />
    </div>
  );
}
