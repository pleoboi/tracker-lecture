import { redirect } from "next/navigation";

// Découverte a fusionné dans Communauté (onglet "Livres") — on redirige les
// liens existants plutôt que de casser l'URL.
export default function DecouvertePage() {
  redirect("/communaute");
}
