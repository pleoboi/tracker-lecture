"use client";

import { notFound } from "next/navigation";
import PodiumModal from "../../../components/PodiumModal";

// Apercu du podium d hiver avec des donnees d exemple, developpement uniquement.
const DEMO = [
  { userId: "a", name: "Léo", pages: 142 },
  { userId: "b", name: "Camille", pages: 98 },
  { userId: "c", name: "Nath", pages: 61 },
];

export default function PodiumHiverPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PodiumModal demo={DEMO} onClose={() => {}} />;
}
