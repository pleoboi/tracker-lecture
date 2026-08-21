import type { Metadata } from "next";
import LegalPage, { LegalSection } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Conditions d'utilisation · Swena",
  description: "Les règles d'utilisation du service Swena.",
};

export default function ConditionsPage() {
  return (
    <LegalPage title="Conditions d'utilisation" updated="11 août 2026">
      <LegalSection title="Objet">
        <p>
          Les présentes conditions encadrent l&apos;utilisation de Swena, un service de suivi
          de lecture permettant d&apos;enregistrer ses lectures et de les partager avec
          d&apos;autres membres. Créer un compte vaut acceptation de ces conditions.
        </p>
      </LegalSection>

      <LegalSection title="Accès au service">
        <p>
          Le service est gratuit. L&apos;inscription requiert une adresse e-mail valide et un
          nom d&apos;affichage. Vous êtes responsable de la confidentialité de vos
          identifiants et des activités menées depuis votre compte.
        </p>
        <p>
          L&apos;inscription est réservée aux personnes âgées d&apos;au moins 15 ans. En
          dessous de cet âge, l&apos;accord d&apos;un titulaire de l&apos;autorité parentale
          est nécessaire.
        </p>
      </LegalSection>

      <LegalSection title="Vos contenus">
        <p>
          Vous restez propriétaire des contenus que vous publiez : avis, notes de session,
          photos, commentaires. Vous accordez à Swena le droit de les afficher aux autres
          membres dans le cadre du fonctionnement du service.
        </p>
        <p>
          Vous garantissez disposer des droits nécessaires sur les contenus que vous publiez,
          notamment sur les photos que vous envoyez.
        </p>
      </LegalSection>

      <LegalSection title="Règles de conduite">
        <p>Il est interdit de publier ou de diffuser via le service :</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>des contenus injurieux, haineux, discriminatoires ou harcelants ;</li>
          <li>des contenus violents, pornographiques ou manifestement inadaptés à un public mineur ;</li>
          <li>des contenus violant les droits d&apos;autrui, notamment le droit d&apos;auteur ou le droit à l&apos;image ;</li>
          <li>des données personnelles de tiers sans leur accord ;</li>
          <li>des contenus publicitaires ou des liens non sollicités.</li>
        </ul>
        <p>
          Il est également interdit de tenter d&apos;accéder aux comptes d&apos;autres
          membres, de perturber le fonctionnement du service ou d&apos;en extraire
          automatiquement les données.
        </p>
      </LegalSection>

      <LegalSection title="Modération">
        <p>
          L&apos;éditeur peut retirer tout contenu contraire à ces conditions et suspendre ou
          fermer un compte en cas de manquement grave ou répété. Tout contenu problématique
          peut être signalé à{" "}
          <a className="text-violet-deep underline underline-offset-2" href="mailto:ricard.leo07@gmail.com">ricard.leo07@gmail.com</a>.
        </p>
      </LegalSection>

      <LegalSection title="Liens d'affiliation">
        <p>
          Les fiches de livres peuvent comporter des liens d&apos;achat affiliés. Un achat
          effectué après un clic sur l&apos;un de ces liens peut donner lieu à une commission
          pour l&apos;éditeur, sans surcoût pour vous. Swena n&apos;est ni vendeur ni
          responsable des transactions réalisées sur les sites marchands.
        </p>
      </LegalSection>

      <LegalSection title="Disponibilité et évolution">
        <p>
          Le service est fourni en l&apos;état, sans garantie de disponibilité continue. Des
          interruptions peuvent survenir pour maintenance ou pour des raisons techniques.
          Les fonctionnalités peuvent évoluer, être modifiées ou retirées.
        </p>
      </LegalSection>

      <LegalSection title="Résiliation">
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis Mon compte. La suppression
          entraîne l&apos;effacement de vos données, dans les conditions décrites par la
          politique de confidentialité.
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <p>
          Ces conditions sont soumises au droit français. En cas de litige, une solution
          amiable sera recherchée avant toute action contentieuse.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
