import type { Metadata } from "next";
import LegalPage, { LegalSection } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Politique de confidentialité · Swena",
  description: "Quelles données Swena collecte, pourquoi, et quels sont vos droits.",
};

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updated="11 août 2026">
      <LegalSection title="Responsable du traitement">
        <p>
          Léo Ricard, éditeur de Swena, est responsable du traitement des données
          personnelles collectées via le site et l&apos;application.
        </p>
        <p>
          Contact : <a className="text-violet-deep underline underline-offset-2" href="mailto:ricard.leo07@gmail.com">ricard.leo07@gmail.com</a>
        </p>
      </LegalSection>

      <LegalSection title="Données collectées">
        <p>Swena collecte uniquement les données nécessaires au fonctionnement du service :</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Compte : adresse e-mail et mot de passe (chiffré), nom d&apos;affichage, photo de profil si vous en ajoutez une.</li>
          <li>Bibliothèque : livres ajoutés, statuts, notes attribuées, dates de lecture, avis.</li>
          <li>Sessions de lecture : dates, pages lues, notes de session et photos que vous joignez.</li>
          <li>Activité sociale : abonnements entre membres, mentions j&apos;aime, commentaires, recommandations, participations aux défis et badges obtenus.</li>
          <li>Notifications : identifiant technique d&apos;abonnement push de votre navigateur, si vous les activez.</li>
        </ul>
        <p>
          Aucun traceur publicitaire n&apos;est utilisé. Aucune donnée n&apos;est vendue ni
          cédée à des fins commerciales.
        </p>
      </LegalSection>

      <LegalSection title="Finalités et bases légales">
        <ul className="ml-4 list-disc space-y-1">
          <li>Fournir le service (compte, bibliothèque, suivi de lecture, fonctions sociales) : exécution du contrat qui nous lie.</li>
          <li>Envoyer des notifications de rappel ou d&apos;activité : votre consentement, révocable à tout moment depuis les paramètres.</li>
          <li>Assurer la sécurité et prévenir les abus : intérêt légitime de l&apos;éditeur.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Visibilité de vos contenus">
        <p>
          Swena est un service social : votre nom d&apos;affichage, votre photo de profil,
          votre bibliothèque, vos avis, vos notes de session et vos photos de lecture sont
          visibles par les autres membres. Ne publiez pas d&apos;information que vous
          souhaitez garder privée. Votre adresse e-mail n&apos;est jamais affichée aux autres
          membres.
        </p>
      </LegalSection>

      <LegalSection title="Sous-traitants et services tiers">
        <ul className="ml-4 list-disc space-y-1">
          <li>Supabase Inc. : hébergement de la base de données, authentification et stockage des photos.</li>
          <li>Vercel Inc. : hébergement de l&apos;application.</li>
          <li>Services de notification push d&apos;Apple et de Google : acheminement des notifications vers votre appareil, si vous les activez.</li>
          <li>Google Books, Open Library, Wikipédia, Apple Books : interrogés pour récupérer les métadonnées et couvertures des livres. Seuls le titre et l&apos;auteur recherchés leur sont transmis, jamais vos données personnelles.</li>
          <li>Amazon : uniquement si vous cliquez sur un lien d&apos;achat, dans le cadre du programme d&apos;affiliation.</li>
        </ul>
        <p>
          Certains de ces prestataires sont établis hors de l&apos;Union européenne. Les
          transferts s&apos;effectuent dans le cadre des garanties prévues par le RGPD,
          notamment les clauses contractuelles types.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Swena n&apos;utilise que des cookies strictement nécessaires : ils maintiennent
          votre session ouverte et mémorisent vos préférences d&apos;affichage (thème,
          filtres). Ils ne servent ni au suivi publicitaire ni à la mesure d&apos;audience,
          et ne nécessitent donc pas de bandeau de consentement.
        </p>
      </LegalSection>

      <LegalSection title="Durée de conservation">
        <p>
          Vos données sont conservées tant que votre compte existe. Lorsque vous supprimez
          votre compte depuis les paramètres, vos données personnelles, votre bibliothèque,
          vos sessions et vos photos sont effacées.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
          portabilité, de limitation et d&apos;opposition sur vos données.
        </p>
        <p>
          Deux de ces droits s&apos;exercent directement dans l&apos;application, depuis
          Mon compte : l&apos;export de vos données et la suppression de votre compte. Pour
          les autres demandes, écrivez à{" "}
          <a className="text-violet-deep underline underline-offset-2" href="mailto:ricard.leo07@gmail.com">ricard.leo07@gmail.com</a>.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une
          réclamation auprès de la CNIL — <a className="text-violet-deep underline underline-offset-2" href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>.
        </p>
      </LegalSection>

      <LegalSection title="Âge minimum">
        <p>
          L&apos;inscription est réservée aux personnes âgées d&apos;au moins 15 ans. En
          dessous de cet âge, l&apos;autorisation d&apos;un titulaire de l&apos;autorité
          parentale est requise.
        </p>
      </LegalSection>

      <LegalSection title="Sécurité">
        <p>
          Les échanges sont chiffrés (HTTPS), les mots de passe ne sont jamais stockés en
          clair, et l&apos;accès aux données est restreint par des règles de sécurité au
          niveau de la base de données.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
