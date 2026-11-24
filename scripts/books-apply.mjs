// Applique les corrections de scripts/books-fixes.json dans la base (après relecture).
//   node scripts/books-apply.mjs            -> aperçu (ne modifie rien)
//   node scripts/books-apply.mjs --write    -> écrit les corrections
// Ne touche que les colonnes listées dans "set" de chaque ligne.
import fs from "node:fs";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json", Prefer: "return=minimal" };
const fixes = JSON.parse(fs.readFileSync("scripts/books-fixes.json", "utf8"));
const write = process.argv.includes("--write");
console.log(`${fixes.length} lignes à corriger${write ? "" : " (aperçu, rien n'est écrit)"}`);
if (!write) process.exit(0);
// Sauvegarde de l'état actuel des lignes touchées, pour pouvoir revenir en arrière
const ids = fixes.map((f) => f.id);
const backup = [];
for (let i = 0; i < ids.length; i += 100) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/books?select=id,genre,summary,published_year,pages,cover_url&id=in.(${ids.slice(i, i + 100).join(",")})`, { headers: h });
  backup.push(...(await r.json()));
}
fs.writeFileSync("scripts/books-backup.json", JSON.stringify(backup));
let ok = 0, ko = 0;
for (const f of fixes) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/books?id=eq.${f.id}`, { method: "PATCH", headers: h, body: JSON.stringify(f.set) });
  if (r.ok) ok++; else { ko++; console.log("échec", f.id, await r.text()); }
}
console.log(`${ok} lignes corrigées, ${ko} échecs. Sauvegarde : scripts/books-backup.json`);
