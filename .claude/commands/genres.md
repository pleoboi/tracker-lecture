---
description: Recalcule les genres, résumés et étiquettes Fiction / Non-Fiction des livres, et prépare le rapport à relire
---

Mets à jour les genres des livres de Swena.

1. Lance `node scripts/books-enrich.mjs` : lecture seule, il regénère `scripts/books-fixes.json`, `scripts/books-review.json` et `scripts/books-report.md`. Les règles de genres sont dans `src/lib/genres.ts`.
2. Résume en français : nombre de livres à corriger, ce qui change (genres ajoutés ou nettoyés, étiquettes Fiction / Non-Fiction, résumés, années, couvertures) et la liste des livres à relire à la main (signaux contradictoires, aucun genre trouvé).
3. Si l'utilisateur corrige un genre, ajoute-le dans la table `MANUAL` de `scripts/books-enrich.mjs` puis relance l'étape 1.
4. N'applique RIEN à la base sans accord explicite. Une fois qu'il valide, lance `node scripts/books-apply.mjs` (aperçu), puis `node scripts/books-apply.mjs --write` : la sauvegarde `scripts/books-backup.json` est faite avant l'écriture.

Ces scripts écrivent en production avec la clé service : toujours montrer l'aperçu avant `--write`.
