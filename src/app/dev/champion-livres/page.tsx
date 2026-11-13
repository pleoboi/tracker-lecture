"use client";

import { notFound } from "next/navigation";
import { ChampionWinter } from "../../../components/ChampionProposals";
import { ChampionAurora, ChampionChristmas, ChampionRibbon, ChampionFrost } from "../../../components/ChampionWinterVariants";

// Apercu des blocs "champion du jour" (livres) hiver / Noel, developpement uniquement.
export default function ChampionLivresPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const cases = [
    { champion: { name: "Léo", pages: 142 }, yesterday: { name: "Camille", pages: 98 } },
    { champion: { name: "Marie-Charlotte de la Fontaine", pages: 37 }, yesterday: null },
  ];
  const variants = [
    { label: "1. Nuit d'hiver (épuré)", Comp: ChampionWinter },
    { label: "2. Aurore boréale", Comp: ChampionAurora },
    { label: "3. Noël : guirlande et sapins", Comp: ChampionChristmas },
    { label: "4. Noël : rouge et ruban doré", Comp: ChampionRibbon },
    { label: "5. Givre (clair)", Comp: ChampionFrost },
  ];
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-6">
      {variants.map(({ label, Comp }) => (
        <section key={label} className="flex flex-col gap-3">
          <h2 className="font-serif text-lg font-bold text-ink">{label}</h2>
          {cases.map((c, i) => (
            <Comp key={i} {...c} />
          ))}
        </section>
      ))}
    </div>
  );
}
