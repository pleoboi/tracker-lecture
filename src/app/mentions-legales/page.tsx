import type { Metadata } from "next";
import LegalPage, { LegalSection } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Mentions légales · Swena",
  description: "Informations légales relatives au site Swena.",
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updated="11 août 2026">
      <LegalSection title="Éditeur du site">
        <p>
          Le site et l&apos;application Swena sont édités par Léo Ricard, personne physique,
          agissant en son nom propre.
        </p>
        <p>
          Contact : <a className="text-violet-deep underline underline-offset-2" href="mailto:ricard.leo07@gmail.com">ricard.leo07@gmail.com</a>
        </p>
        <p>Directeur de la publication : Léo Ricard.</p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723,
          États-Unis — <a className="text-violet-deep underline underline-offset-2" href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>
        </p>
        <p>
          Les données de compte, la base de données et les fichiers envoyés par les
          utilisateurs sont hébergés par Supabase Inc.
          — <a className="text-violet-deep underline underline-offset-2" href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a>
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          La structure du site, son interface, ses textes et ses éléments graphiques sont la
          propriété de l&apos;éditeur, sauf mention contraire. Toute reproduction sans
          autorisation est interdite.
        </p>
        <p>
          Les couvertures, résumés et métadonnées de livres proviennent de sources tierces
          (Google Books, Open Library, Wikipédia, Apple Books). Ils restent la propriété de
          leurs ayants droit respectifs et sont affichés à titre d&apos;information.
        </p>
        <p>
          Les contenus publiés par les utilisateurs (notes de lecture, avis, photos) restent
          la propriété de leurs auteurs.
        </p>
      </LegalSection>

      <LegalSection title="Liens d&apos;affiliation">
        <p>
          Swena participe au programme Partenaires d&apos;Amazon. Certains liens présents sur
          les fiches de livres sont des liens affiliés : si vous effectuez un achat après avoir
          cliqué sur l&apos;un d&apos;eux, l&apos;éditeur peut percevoir une commission, sans
          coût supplémentaire pour vous.
        </p>
        <p>
          En tant que Partenaire Amazon, Swena réalise un bénéfice sur les achats remplissant
          les conditions requises.
        </p>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <p>
          L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude des informations
          diffusées, sans pouvoir la garantir, en particulier pour les métadonnées de livres
          issues de sources tierces. Le service est fourni en l&apos;état, sans garantie de
          disponibilité continue.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Le traitement des données personnelles est décrit dans la politique de
          confidentialité, accessible depuis le pied de page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
